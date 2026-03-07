/**
 * Eligibility and Profile Tools
 *
 * Tools for checking scheme eligibility and managing user profiles:
 * - check_eligibility: Calculate eligibility score for user-scheme pair
 * - update_user_profile: Update user profile information
 * - get_user_profile: Retrieve current user profile data
 */

import { BaseTool } from './base';
import { ParameterDefinition } from './types';
import { neo4jService } from '../../db/neo4j.service';
import { mlService } from '../../services/ml.service';

/**
 * Check if a user is eligible for a scheme
 */
export class CheckEligibilityTool extends BaseTool {
  name = 'check_eligibility';
  description =
    'Check if a user meets the eligibility criteria for a specific scheme. Returns eligibility score (0-100%) and explanation.';

  parameters: Record<string, ParameterDefinition> = {
    userId: {
      type: 'string',
      description: 'The user ID',
      required: true,
    },
    schemeId: {
      type: 'string',
      description: 'The scheme ID',
      required: true,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const userId = params.userId?.trim();
    const schemeId = params.schemeId?.trim();

    if (!userId || !schemeId) {
      throw new Error('Both userId and schemeId are required');
    }

    console.log(`✅ Checking eligibility: user=${userId}, scheme=${schemeId}`);

    try {
      // Get user profile
      const user = await neo4jService.getUserById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Get scheme
      const scheme = await neo4jService.getSchemeById(schemeId);
      if (!scheme) {
        throw new Error(`Scheme not found: ${schemeId}`);
      }

      // Build user profile object
      const userProfile = {
        userId: user.user_id,
        age: user.age,
        income: user.income,
        state: user.state,
        employment: user.employment,
        education: user.education,
        gender: user.gender,
      };

      // Try to use ML service for eligibility
      let result = await mlService.eligibility(userProfile, {
        id: scheme.scheme_id,
        name: scheme.name,
        state: scheme.state,
        tags: (scheme.tags || '').split(','),
        description: scheme.description,
      });

      if (!result) {
        console.log('⚠️ ML service unavailable, using rule-based eligibility');
        // Fallback to simple rule-based eligibility
        result = this.ruleBasedEligibility(userProfile, scheme);
      }

      return {
        schemeId,
        schemeName: scheme.name,
        userId,
        userName: user.name,
        score: result!.score,
        percentage: result!.percentage,
        category: result!.category,
        metCriteria: result!.met_criteria,
        unmetCriteria: result!.unmet_criteria,
        explanation: result!.explanation,
      };
    } catch (error) {
      console.error('Check eligibility error:', error);
      throw error;
    }
  }

  /**
   * Fallback: Simple rule-based eligibility checking
   */
  private ruleBasedEligibility(userProfile: any, scheme: any): any {
    let score = 0.5; // Base score
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];

    const tags = (scheme.tags || '').toLowerCase();
    const desc = (scheme.description || '').toLowerCase();

    // State match
    if (
      userProfile.state &&
      scheme.state &&
      userProfile.state.toLowerCase() === scheme.state.toLowerCase()
    ) {
      score += 0.15;
      metCriteria.push(`State (${userProfile.state}) matches`);
    } else if (!scheme.state || scheme.state === 'All-India') {
      score += 0.05;
      metCriteria.push('Scheme available across India');
    }

    // Employment match
    if (userProfile.employment) {
      const employment = userProfile.employment.toLowerCase();
      if (tags.includes(employment) || desc.includes(employment)) {
        score += 0.15;
        metCriteria.push(`Employment (${userProfile.employment}) relevant`);
      }
    }

    // Gender match
    if (userProfile.gender === 'Female') {
      if (tags.includes('women') || tags.includes('female') || desc.includes('women')) {
        score += 0.2;
        metCriteria.push('Scheme targets women');
      }
    }

    // Income match
    if (userProfile.income) {
      if (userProfile.income < 300000 && (tags.includes('bpl') || tags.includes('low income'))) {
        score += 0.1;
        metCriteria.push('Income within BPL threshold');
      }
    }

    // Education match
    if (userProfile.education) {
      const education = userProfile.education.toLowerCase();
      if (tags.includes(education) || desc.includes(education)) {
        score += 0.1;
        metCriteria.push(`Education level (${userProfile.education}) matches`);
      }
    }

    score = Math.min(score, 1.0);
    const percentage = Math.round(score * 100);

    let category = 'low_eligibility';
    if (percentage >= 80) category = 'highly_eligible';
    else if (percentage >= 50) category = 'potentially_eligible';

    return {
      score,
      percentage,
      category,
      met_criteria: metCriteria,
      unmet_criteria: unmetCriteria,
      explanation: this.generateExplanation(percentage, metCriteria, category),
    };
  }

  private generateExplanation(
    percentage: number,
    metCriteria: string[],
    _category: string
  ): string {
    if (percentage >= 80) {
      return `You appear highly eligible (${percentage}%). ${metCriteria.map((c) => c).join(', ')}.`;
    }
    if (percentage >= 50) {
      return `You may be eligible (${percentage}%). Key matches: ${metCriteria.map((c) => c).join(', ')}.`;
    }
    return `You may not meet the criteria (${percentage}%). Check the official website for complete eligibility.`;
  }
}

/**
 * Update user profile information
 */
export class UpdateUserProfileTool extends BaseTool {
  name = 'update_user_profile';
  description =
    'Update user profile fields like age, income, state, employment, education. Changes are persisted to database.';

  parameters: Record<string, ParameterDefinition> = {
    userId: {
      type: 'string',
      description: 'The user ID',
      required: true,
    },
    updates: {
      type: 'object',
      description:
        'Object with fields to update (e.g., {"age": 30, "state": "Maharashtra", "income": 200000})',
      required: true,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const userId = params.userId?.trim();
    const updates = params.updates || {};

    if (!userId) {
      throw new Error('userId is required');
    }

    if (Object.keys(updates).length === 0) {
      return { message: 'No updates provided', updated: false };
    }

    console.log(`👤 Updating user profile: ${userId}`, updates);

    try {
      // Validate updates
      const allowed = ['age', 'income', 'state', 'employment', 'education', 'gender', 'interests'];
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(updates)) {
        if (!allowed.includes(key)) {
          console.warn(`⚠️ Skipping disallowed field: ${key}`);
          continue;
        }
        sanitized[key] = value;
      }

      if (Object.keys(sanitized).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Update in database
      await neo4jService.updateUserProfile(userId, sanitized);

      console.log(`✅ Profile updated for user ${userId}`);

      return {
        userId,
        updated: true,
        fields: Object.keys(sanitized),
        message: `Updated ${Object.keys(sanitized).join(', ')}`,
      };
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
}

/**
 * Get current user profile
 */
export class GetUserProfileTool extends BaseTool {
  name = 'get_user_profile';
  description =
    'Retrieve the current user profile including age, income, state, employment, education, and other personal information.';

  parameters: Record<string, ParameterDefinition> = {
    userId: {
      type: 'string',
      description: 'The user ID',
      required: true,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const userId = params.userId?.trim();

    if (!userId) {
      throw new Error('userId is required');
    }

    console.log(`👤 Fetching profile for user: ${userId}`);

    try {
      const user = await neo4jService.getUserById(userId);

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      return {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        age: user.age || null,
        income: user.income || null,
        state: user.state || null,
        employment: user.employment || null,
        education: user.education || null,
        gender: user.gender || null,
        createdAt: user.created_at || null,
        profileComplete: Boolean(user.age && user.state && user.employment),
      };
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }
}
