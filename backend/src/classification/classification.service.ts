/**
 * Classification Service
 *
 * Provides user classification functionality by interfacing with the
 * trained K-Means model. Handles single user classification and batch
 * reclassification operations.
 */

import { Driver } from 'neo4j-driver';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getCacheService } from '../cache/cache.service';
import {
  UserGroupAssignment,
  ClassifyUserRequest,
  ClassifyUserResponse,
  BatchReclassificationResult,
  ClassificationMetrics,
  ClassificationProfile,
} from './types';

export class ClassificationService {
  private driver: Driver;
  private cacheService = getCacheService();
  private modelPath: string;
  private pythonPath: string;
  private classifierScriptPath: string;

  constructor(driver: Driver) {
    this.driver = driver;

    // Configure paths
    this.modelPath =
      process.env.CLASSIFIER_MODEL_PATH ||
      path.join(__dirname, '../../../ml-pipeline/models/user_classifier.pkl');
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.classifierScriptPath = path.join(__dirname, '../../../ml-pipeline/src/classify_user.py');
  }

  /**
   * Classify a single user into groups
   * Requirement 2.1, 2.3: User classification with 5-second performance target
   */
  async classifyUser(request: ClassifyUserRequest): Promise<ClassifyUserResponse> {
    const startTime = Date.now();
    const { userId, confidenceThreshold = 0.7, multiGroupThreshold = 1.2 } = request;

    try {
      // Check cache first
      const cacheKey = `classification:${userId}`;
      const cached = await this.cacheService.get<ClassifyUserResponse>(cacheKey);
      if (cached) {
        console.log(`Classification cache hit for user ${userId}`);
        return cached;
      }

      // Get user profile from database
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        throw new Error(`User ${userId} not found`);
      }

      // Call Python classifier
      const assignment = await this.callPythonClassifier(
        profile,
        confidenceThreshold,
        multiGroupThreshold
      );

      // Store group assignments in Neo4j
      await this.storeGroupAssignments(assignment);

      // Build response
      const response: ClassifyUserResponse = {
        userId: assignment.userId,
        groups: assignment.groups,
        confidence: assignment.confidence,
        timestamp: assignment.timestamp,
        message:
          assignment.confidence >= confidenceThreshold
            ? 'User successfully classified'
            : 'User assigned to default group due to low confidence',
      };

      // Cache the result (24 hour TTL)
      await this.cacheService.set(cacheKey, response, 86400);

      // Log performance metrics
      const classificationTime = Date.now() - startTime;
      await this.logClassificationMetrics({
        userId,
        classificationTime,
        confidence: assignment.confidence,
        groupCount: assignment.groups.length,
        timestamp: new Date(),
      });

      // Requirement 2.3: Ensure classification completes within 5 seconds
      if (classificationTime > 5000) {
        console.warn(
          `Classification for user ${userId} took ${classificationTime}ms (exceeds 5s target)`
        );
      }

      return response;
    } catch (error) {
      console.error(`Classification failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Batch reclassify all users
   * Requirement 2.1: Reclassification support
   */
  async reclassifyAllUsers(): Promise<BatchReclassificationResult> {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    try {
      // Get all user IDs
      const userIds = await this.getAllUserIds();
      const totalUsers = userIds.length;

      console.log(`Starting batch reclassification for ${totalUsers} users`);

      // Process users in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map((userId) => this.classifyUser({ userId }))
        );

        // Count successes and failures
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successCount++;
          } else {
            failureCount++;
            errors.push({
              userId: batch[index],
              error: result.reason?.message || 'Unknown error',
            });
          }
        });

        console.log(
          `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userIds.length / batchSize)}`
        );
      }

      const duration = Date.now() - startTime;

      console.log(
        `Batch reclassification complete: ${successCount} succeeded, ${failureCount} failed in ${duration}ms`
      );

      return {
        totalUsers,
        successCount,
        failureCount,
        duration,
        errors,
      };
    } catch (error) {
      console.error('Batch reclassification failed:', error);
      throw error;
    }
  }

  /**
   * Get user classification (from cache or database)
   */
  async getUserClassification(userId: string): Promise<UserGroupAssignment | null> {
    // Check cache first
    const cacheKey = `classification:${userId}`;
    const cached = await this.cacheService.get<ClassifyUserResponse>(cacheKey);
    if (cached) {
      return {
        userId: cached.userId,
        groups: cached.groups,
        confidence: cached.confidence,
        features: [], // Features not stored in cache
        timestamp: cached.timestamp,
      };
    }

    // Query from database
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {userId: $userId})-[r:BELONGS_TO]->(g:UserGroup)
        RETURN u.userId as userId, 
               collect({
                 groupId: g.groupId,
                 groupName: g.groupName,
                 description: g.description,
                 memberCount: g.memberCount,
                 confidence: r.confidence
               }) as groups,
               r.confidence as confidence,
               r.timestamp as timestamp
        `,
        { userId }
      );

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        userId: record.get('userId'),
        groups: record.get('groups'),
        confidence: record.get('confidence'),
        features: [],
        timestamp: new Date(record.get('timestamp')),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Call Python classifier script
   * Private method that spawns Python process to classify user
   */
  private async callPythonClassifier(
    profile: ClassificationProfile,
    confidenceThreshold: number,
    multiGroupThreshold: number
  ): Promise<UserGroupAssignment> {
    return new Promise((resolve, reject) => {
      let settled = false;

      // Check if model file exists
      if (!fs.existsSync(this.modelPath)) {
        reject(new Error(`Classifier model not found at ${this.modelPath}`));
        return;
      }

      // Prepare input data
      const input = JSON.stringify({
        profile,
        confidence_threshold: confidenceThreshold,
        multi_group_threshold: multiGroupThreshold,
        model_path: this.modelPath,
      });

      // Spawn Python process
      const python = spawn(this.pythonPath, [this.classifierScriptPath]);

      let stdout = '';
      let stderr = '';

      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        settled = true;
        python.kill();
        reject(new Error('Classification timeout (5 seconds exceeded)'));
      }, 5000);

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);

        if (code !== 0) {
          reject(new Error(`Python classifier failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);

          // Transform Python result to TypeScript format
          const assignment: UserGroupAssignment = {
            userId: result.user_id,
            groups: result.groups.map((g: any) => ({
              groupId: g.group_id,
              groupName: g.group_name || `Group ${g.group_id}`,
              description: g.description || '',
              memberCount: g.member_count || 0,
              typicalProfile: g.typical_profile,
            })),
            confidence: result.confidence,
            features: result.features,
            timestamp: new Date(result.timestamp),
          };

          resolve(assignment);
        } catch (error) {
          reject(new Error(`Failed to parse classifier output: ${error}`));
        }
      });

      // Send input to Python process
      python.stdin.write(input);
      python.stdin.end();

      python.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to start Python classifier: ${error.message}`));
      });
    });
  }

  /**
   * Store group assignments in Neo4j
   * Requirement 2.4: Store BELONGS_TO relationships
   */
  private async storeGroupAssignments(assignment: UserGroupAssignment): Promise<void> {
    const session = this.driver.session();

    try {
      await session.executeWrite(async (tx) => {
        // Delete existing group assignments
        await tx.run(
          `
          MATCH (u:User {userId: $userId})-[r:BELONGS_TO]->(:UserGroup)
          DELETE r
          `,
          { userId: assignment.userId }
        );

        // Create new group assignments
        for (const group of assignment.groups) {
          // Ensure UserGroup node exists
          await tx.run(
            `
            MERGE (g:UserGroup {groupId: $groupId})
            ON CREATE SET 
              g.groupName = $groupName,
              g.description = $description,
              g.memberCount = $memberCount,
              g.createdAt = datetime(),
              g.updatedAt = datetime()
            ON MATCH SET
              g.updatedAt = datetime()
            `,
            {
              groupId: group.groupId,
              groupName: group.groupName,
              description: group.description,
              memberCount: group.memberCount,
            }
          );

          // Create BELONGS_TO relationship
          await tx.run(
            `
            MATCH (u:User {userId: $userId})
            MATCH (g:UserGroup {groupId: $groupId})
            CREATE (u)-[r:BELONGS_TO {
              confidence: $confidence,
              features: $features,
              timestamp: datetime($timestamp)
            }]->(g)
            `,
            {
              userId: assignment.userId,
              groupId: group.groupId,
              confidence: assignment.confidence,
              features: assignment.features,
              timestamp: assignment.timestamp.toISOString(),
            }
          );
        }

        // Update user's userGroups array
        await tx.run(
          `
          MATCH (u:User {userId: $userId})
          SET u.userGroups = $userGroups,
              u.updatedAt = datetime()
          `,
          {
            userId: assignment.userId,
            userGroups: assignment.groups.map((g) => g.groupId.toString()),
          }
        );
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get user profile for classification
   */
  private async getUserProfile(userId: string): Promise<ClassificationProfile | null> {
    const session = this.driver.session();

    try {
      const result = await session.run('MATCH (u:User {userId: $userId}) RETURN u', { userId });

      if (result.records.length === 0) {
        return null;
      }

      const user = result.records[0].get('u').properties;

      // Map to classification profile format
      return {
        user_id: user.userId,
        age: user.age,
        gender: user.gender,
        marital_status: user.maritalStatus,
        family_size: user.familySize,
        annual_income: user.annualIncome,
        employment_status: user.employmentStatus,
        state: user.state,
        rural_urban: user.ruralUrban,
        education_level: user.educationLevel,
        caste: user.caste,
        disability: user.disability,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get all user IDs for batch processing
   */
  private async getAllUserIds(): Promise<string[]> {
    const session = this.driver.session();

    try {
      const result = await session.run('MATCH (u:User) RETURN u.userId as userId');

      return result.records.map((record) => record.get('userId'));
    } finally {
      await session.close();
    }
  }

  /**
   * Log classification performance metrics
   * Requirement 2.3: Monitor classification performance
   */
  private async logClassificationMetrics(metrics: ClassificationMetrics): Promise<void> {
    // Log to console
    console.log(
      `Classification metrics for ${metrics.userId}: ` +
        `time=${metrics.classificationTime}ms, ` +
        `confidence=${metrics.confidence.toFixed(3)}, ` +
        `groups=${metrics.groupCount}`
    );

    // Warn if classification exceeds 5-second target
    if (metrics.classificationTime > 5000) {
      console.warn(
        `⚠️  PERFORMANCE WARNING: Classification for ${metrics.userId} ` +
          `took ${metrics.classificationTime}ms (exceeds 5s requirement)`
      );
    }

    // Store individual metrics in cache (7 day TTL)
    const metricsKey = `metrics:classification:${metrics.userId}:${Date.now()}`;
    await this.cacheService.set(metricsKey, metrics, 604800);

    // Update aggregate metrics
    await this.updateAggregateMetrics(metrics);
  }

  /**
   * Update aggregate performance metrics
   * Tracks rolling averages and performance statistics
   */
  private async updateAggregateMetrics(metrics: ClassificationMetrics): Promise<void> {
    try {
      const aggregateKey = 'metrics:classification:aggregate';

      // Get current aggregate
      const current = await this.cacheService.get<{
        totalClassifications: number;
        totalTime: number;
        avgTime: number;
        maxTime: number;
        minTime: number;
        avgConfidence: number;
        slowClassifications: number; // Count of classifications > 5s
        lastUpdated: string;
      }>(aggregateKey);

      const updated = current || {
        totalClassifications: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        avgConfidence: 0,
        slowClassifications: 0,
        lastUpdated: new Date().toISOString(),
      };

      // Update aggregate statistics
      updated.totalClassifications += 1;
      updated.totalTime += metrics.classificationTime;
      updated.avgTime = updated.totalTime / updated.totalClassifications;
      updated.maxTime = Math.max(updated.maxTime, metrics.classificationTime);
      updated.minTime = Math.min(updated.minTime, metrics.classificationTime);

      // Update rolling average confidence
      updated.avgConfidence =
        (updated.avgConfidence * (updated.totalClassifications - 1) + metrics.confidence) /
        updated.totalClassifications;

      // Count slow classifications
      if (metrics.classificationTime > 5000) {
        updated.slowClassifications += 1;
      }

      updated.lastUpdated = new Date().toISOString();

      // Store updated aggregate (30 day TTL)
      await this.cacheService.set(aggregateKey, updated, 2592000);

      // Log aggregate stats periodically (every 100 classifications)
      if (updated.totalClassifications % 100 === 0) {
        console.log('\n📊 Classification Performance Summary:');
        console.log(`   Total classifications: ${updated.totalClassifications}`);
        console.log(`   Average time: ${updated.avgTime.toFixed(0)}ms`);
        console.log(`   Min time: ${updated.minTime.toFixed(0)}ms`);
        console.log(`   Max time: ${updated.maxTime.toFixed(0)}ms`);
        console.log(`   Average confidence: ${updated.avgConfidence.toFixed(3)}`);
        console.log(
          `   Slow classifications (>5s): ${updated.slowClassifications} (${((updated.slowClassifications / updated.totalClassifications) * 100).toFixed(1)}%)`
        );
        console.log('');
      }
    } catch (error) {
      console.error('Failed to update aggregate metrics:', error);
      // Don't throw - metrics failure shouldn't break classification
    }
  }

  /**
   * Get aggregate performance metrics
   * Public method for monitoring dashboards
   */
  async getPerformanceMetrics(): Promise<{
    totalClassifications: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    avgConfidence: number;
    slowClassifications: number;
    performanceScore: number; // 0-100 score based on meeting 5s target
    lastUpdated: string;
  } | null> {
    const aggregateKey = 'metrics:classification:aggregate';
    const metrics = await this.cacheService.get<any>(aggregateKey);

    if (!metrics) {
      return null;
    }

    // Calculate performance score (100 = all classifications under 5s)
    const performanceScore = Math.max(
      0,
      100 - (metrics.slowClassifications / metrics.totalClassifications) * 100
    );

    return {
      ...metrics,
      performanceScore: Math.round(performanceScore),
    };
  }
}
