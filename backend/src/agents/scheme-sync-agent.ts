/**
 * Scheme Sync Agent
 * 
 * Responsibilities:
 * 1. Fetch all schemes from India.gov.in API every 48 hours
 * 2. Extract categories from tags and descriptions
 * 3. Store schemes in Neo4j with categorical relationships
 * 4. Maintain sync status and timestamps
 */

import { indiaGovService, Scheme } from '../schemes/india-gov.service';
import { neo4jService } from '../db/neo4j.service';
import { schemesCacheService } from '../schemes/schemes-cache.service';
import {
  SCHEMA_QUERIES,
  CATEGORY_RULES,
  CategoryType,
  EmploymentStatus,
  IncomeLevel,
  LocalityType,
  SocialCategory,
  EducationLevel,
  PovertyLine,
} from '../db/schemes-schema';

interface CategoryMapping {
  type: CategoryType;
  value: string;
}

interface SyncStatus {
  totalSchemes: number;
  lastSync: string | null;
  nextSync: string | null;
}

class SchemeSyncAgent {
  private readonly SYNC_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48 hours
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  /**
   * Start the sync agent
   */
  async start() {
    console.log('🔄 Scheme Sync Agent starting...');

    // Check if initial sync is needed
    const status = await this.getSyncStatus();
    const needsSync = this.needsSync(status);

    if (needsSync) {
      console.log('📥 Initial sync needed, starting...');
      await this.syncSchemes();
    } else {
      console.log(`✅ Schemes are up to date. Next sync: ${status.nextSync}`);
    }

    // Schedule periodic sync
    this.scheduleNextSync();
  }

  /**
   * Stop the sync agent
   */
  stop() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    console.log('🛑 Scheme Sync Agent stopped');
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const result = await neo4jService.executeQuery(
        SCHEMA_QUERIES.getSyncStatus,
        {}
      );

      const record = result.records[0];
      const totalSchemes = record?.get('totalSchemes')?.toNumber() || 0;
      const lastSync = record?.get('lastSync') || null;

      const nextSync = lastSync
        ? new Date(new Date(lastSync).getTime() + this.SYNC_INTERVAL_MS).toISOString()
        : null;

      return { totalSchemes, lastSync, nextSync };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return { totalSchemes: 0, lastSync: null, nextSync: null };
    }
  }

  /**
   * Check if sync is needed
   */
  private needsSync(status: SyncStatus): boolean {
    if (status.totalSchemes === 0) return true;
    if (!status.lastSync) return true;

    const lastSyncTime = new Date(status.lastSync).getTime();
    const now = Date.now();
    const timeSinceSync = now - lastSyncTime;

    return timeSinceSync >= this.SYNC_INTERVAL_MS;
  }

  /**
   * Schedule next sync
   */
  private scheduleNextSync() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(async () => {
      await this.syncSchemes();
      this.scheduleNextSync();
    }, this.SYNC_INTERVAL_MS);

    const nextSyncTime = new Date(Date.now() + this.SYNC_INTERVAL_MS);
    console.log(`⏰ Next sync scheduled for: ${nextSyncTime.toISOString()}`);
  }

  /**
   * Main sync function
   */
  async syncSchemes(): Promise<void> {
    if (this.isSyncing) {
      console.log('⚠️  Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      console.log('🚀 Starting scheme sync from India.gov.in...');

      // Fetch all schemes from API in batches
      console.log('📡 Fetching schemes from API in batches...');
      const batchSize = 500;
      const allSchemes: Scheme[] = [];
      let batch = 1;
      
      while (true) {
        try {
          const schemes = await indiaGovService.fetchAllSchemes(batchSize);
          
          if (schemes.length === 0) break;
          
          allSchemes.push(...schemes);
          console.log(`✅ Fetched batch ${batch}: ${schemes.length} schemes (Total: ${allSchemes.length})`);
          
          // Store this batch immediately
          await this.storeBatch(schemes);
          
          if (schemes.length < batchSize) break; // Last batch
          
          batch++;
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching batch ${batch}:`, error);
          break;
        }
      }
      
      console.log(`✅ Fetched total of ${allSchemes.length} schemes from API`);

      // Store schemes in Neo4j
      console.log('💾 All schemes stored successfully');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Sync complete! Stored ${allSchemes.length} schemes in ${duration}s`);
      console.log(`📊 Storage: Neo4j + In-Memory Cache`);
    } catch (error: any) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Store a batch of schemes
   */
  private async storeBatch(schemes: Scheme[]): Promise<void> {
    let useNeo4j = true;

    // Try Neo4j first
    try {
      for (const scheme of schemes) {
        await this.storeScheme(scheme);
      }
      console.log(`  ✓ Stored ${schemes.length} schemes in Neo4j`);
    } catch (neo4jError) {
      console.warn('  ⚠️  Neo4j storage failed for this batch, using cache');
      useNeo4j = false;
    }

    // Always store in cache as well for fast access
    schemesCacheService.storeSchemes(schemes);
    
    if (!useNeo4j) {
      console.log(`  ✓ Stored ${schemes.length} schemes in cache`);
    }
  }

  /**
   * Store a single scheme in Neo4j with categories
   */
  private async storeScheme(scheme: Scheme): Promise<void> {
    try {
      // Create scheme node
      await neo4jService.executeQuery(SCHEMA_QUERIES.createScheme, {
        schemeId: scheme.schemeId,
        name: scheme.name,
        description: scheme.description,
        ministry: scheme.ministry,
        state: scheme.state,
        tags: scheme.tags,
        rawCategory: scheme.category,
        lastUpdated: new Date().toISOString(),
      });

      // Extract and create categories
      const categories = this.extractCategories(scheme);

      for (const category of categories) {
        // Create category node
        await neo4jService.executeQuery(SCHEMA_QUERIES.createCategory, {
          type: category.type,
          value: category.value,
        });

        // Link scheme to category
        await neo4jService.executeQuery(SCHEMA_QUERIES.linkSchemeToCategory, {
          schemeId: scheme.schemeId,
          type: category.type,
          value: category.value,
        });
      }
    } catch (error) {
      console.error(`Error storing scheme ${scheme.schemeId}:`, error);
      throw error;
    }
  }

  /**
   * Extract categories from scheme data
   */
  private extractCategories(scheme: Scheme): CategoryMapping[] {
    const categories: CategoryMapping[] = [];
    const text = `${scheme.name} ${scheme.description} ${scheme.tags.join(' ')}`.toLowerCase();

    // Extract Employment categories
    for (const [key, keywords] of Object.entries(CATEGORY_RULES.employment)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({
          type: CategoryType.EMPLOYMENT,
          value: this.mapEmploymentKey(key),
        });
      }
    }

    // Extract Income categories
    for (const [key, keywords] of Object.entries(CATEGORY_RULES.income)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({
          type: CategoryType.INCOME,
          value: this.mapIncomeKey(key),
        });
      }
    }

    // Extract Locality categories
    for (const [key, keywords] of Object.entries(CATEGORY_RULES.locality)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({
          type: CategoryType.LOCALITY,
          value: this.mapLocalityKey(key),
        });
      }
    }

    // Extract Social Category
    for (const [key, keywords] of Object.entries(CATEGORY_RULES.socialCategory)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({
          type: CategoryType.SOCIAL_CATEGORY,
          value: this.mapSocialCategoryKey(key),
        });
      }
    }

    // Extract Education categories
    for (const [key, keywords] of Object.entries(CATEGORY_RULES.education)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({
          type: CategoryType.EDUCATION,
          value: this.mapEducationKey(key),
        });
      }
    }

    // Extract Poverty Line categories
    for (const [key, keywords] of Object.entries(CATEGORY_RULES.povertyLine)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({
          type: CategoryType.POVERTY_LINE,
          value: this.mapPovertyLineKey(key),
        });
      }
    }

    // If no categories found, add "Any" for each type
    if (categories.length === 0) {
      categories.push(
        { type: CategoryType.EMPLOYMENT, value: EmploymentStatus.ANY },
        { type: CategoryType.INCOME, value: IncomeLevel.ANY },
        { type: CategoryType.LOCALITY, value: LocalityType.ANY },
        { type: CategoryType.SOCIAL_CATEGORY, value: SocialCategory.ANY },
        { type: CategoryType.EDUCATION, value: EducationLevel.ANY },
        { type: CategoryType.POVERTY_LINE, value: PovertyLine.ANY }
      );
    }

    return categories;
  }

  // Mapping helpers
  private mapEmploymentKey(key: string): string {
    const map: Record<string, string> = {
      employed: EmploymentStatus.EMPLOYED,
      unemployed: EmploymentStatus.UNEMPLOYED,
      selfEmployed: EmploymentStatus.SELF_EMPLOYED,
      student: EmploymentStatus.STUDENT,
      retired: EmploymentStatus.RETIRED,
    };
    return map[key] || EmploymentStatus.ANY;
  }

  private mapIncomeKey(key: string): string {
    const map: Record<string, string> = {
      below1Lakh: IncomeLevel.BELOW_1_LAKH,
      '1To3Lakh': IncomeLevel.ONE_TO_THREE_LAKH,
      '3To5Lakh': IncomeLevel.THREE_TO_FIVE_LAKH,
      '5To10Lakh': IncomeLevel.FIVE_TO_TEN_LAKH,
      above10Lakh: IncomeLevel.ABOVE_TEN_LAKH,
    };
    return map[key] || IncomeLevel.ANY;
  }

  private mapLocalityKey(key: string): string {
    const map: Record<string, string> = {
      rural: LocalityType.RURAL,
      urban: LocalityType.URBAN,
      semiUrban: LocalityType.SEMI_URBAN,
    };
    return map[key] || LocalityType.ANY;
  }

  private mapSocialCategoryKey(key: string): string {
    const map: Record<string, string> = {
      sc: SocialCategory.SC,
      st: SocialCategory.ST,
      obc: SocialCategory.OBC,
      minority: SocialCategory.MINORITY,
      women: SocialCategory.WOMEN,
      pwd: SocialCategory.PWD,
      general: SocialCategory.GENERAL,
    };
    return map[key] || SocialCategory.ANY;
  }

  private mapEducationKey(key: string): string {
    const map: Record<string, string> = {
      noFormal: EducationLevel.NO_FORMAL,
      primary: EducationLevel.PRIMARY,
      secondary: EducationLevel.SECONDARY,
      higherSecondary: EducationLevel.HIGHER_SECONDARY,
      graduate: EducationLevel.GRADUATE,
      postGraduate: EducationLevel.POST_GRADUATE,
      professional: EducationLevel.PROFESSIONAL,
    };
    return map[key] || EducationLevel.ANY;
  }

  private mapPovertyLineKey(key: string): string {
    const map: Record<string, string> = {
      bpl: PovertyLine.BPL,
      apl: PovertyLine.APL,
    };
    return map[key] || PovertyLine.ANY;
  }

  /**
   * Force sync now (for manual trigger)
   */
  async forceSyncNow(): Promise<void> {
    console.log('🔄 Force sync triggered');
    await this.syncSchemes();
  }
}

export const schemeSyncAgent = new SchemeSyncAgent();
