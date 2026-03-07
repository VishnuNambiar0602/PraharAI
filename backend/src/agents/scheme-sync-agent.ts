/**
 * Scheme Sync Agent
 *
 * Responsibilities:
 * 1. On startup: initialize Neo4j + Redis, check if data is fresh (< 24 h old)
 * 2. If data is stale or missing: fetch all schemes from India.gov.in API and persist to Neo4j graph
 * 3. Schedule periodic re-sync every 24 hours
 * 4. Expose forceSyncNow() for manual trigger
 */

import { indiaGovService } from '../schemes/india-gov.service';
import { mySchemePageService } from '../schemes/myscheme-page.service';
import { neo4jService } from '../db/neo4j.service';

interface SyncStatus {
  totalSchemes: number;
  lastSync: string | null;
  nextSync: string | null;
  isSyncing: boolean;
}

class SchemeSyncAgent {
  private readonly SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  /**
   * Start the sync agent — initialises Neo4j + Redis, then syncs if stale
   */
  async start() {
    console.log('🔄 Scheme Sync Agent starting...');

    // Initialize Neo4j + Redis
    await neo4jService.init();

    // Check if we already have fresh data
    if (await neo4jService.isFresh(this.SYNC_INTERVAL_MS)) {
      const meta = await neo4jService.getSyncMeta();
      console.log(
        `✅ Neo4j has ${meta.total_schemes} schemes (synced ${meta.last_sync}). Skipping API fetch.`
      );
    } else {
      console.log('📥 Scheme data is stale or missing, syncing from India.gov.in...');
      await this.syncSchemes();
    }

    // Schedule periodic sync
    this.scheduleNextSync();
  }

  /**
   * Stop the sync agent
   */
  async stop() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    await neo4jService.close();
    console.log('🛑 Scheme Sync Agent stopped');
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const meta = await neo4jService.getSyncMeta();
    const nextSync = meta.last_sync
      ? new Date(
          new Date(meta.last_sync + (meta.last_sync.includes('Z') ? '' : 'Z')).getTime() +
            this.SYNC_INTERVAL_MS
        ).toISOString()
      : null;
    return {
      totalSchemes: meta.total_schemes,
      lastSync: meta.last_sync,
      nextSync,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Schedule next sync
   */
  private scheduleNextSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);

    this.syncTimer = setTimeout(async () => {
      await this.syncSchemes();
      this.scheduleNextSync();
    }, this.SYNC_INTERVAL_MS);

    const nextSyncTime = new Date(Date.now() + this.SYNC_INTERVAL_MS);
    console.log(`⏰ Next sync scheduled for: ${nextSyncTime.toISOString()}`);
  }

  /**
   * Main sync function — fetches from API and stores in Neo4j graph
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
      const allSchemes = await indiaGovService.fetchAllSchemes(500);

      if (allSchemes.length === 0) {
        console.log('⚠️  No schemes fetched from API');
        return;
      }

      console.log(`✅ Fetched ${allSchemes.length} schemes from API`);

      // Enrich each scheme using its MyScheme page API payload.
      const enrichedSchemes = await mySchemePageService.enrichSchemes(allSchemes);

      // Persist to Neo4j graph (batch insert + category relationship creation)
      await neo4jService.storeSchemes(enrichedSchemes);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `✅ Sync complete! ${enrichedSchemes.length} schemes persisted to Neo4j in ${duration}s`
      );
    } catch (error: any) {
      console.error('❌ Sync failed:', error.message || error);
      // On failure, existing Neo4j data remains intact — no data loss
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force sync now (for manual trigger via API)
   */
  async forceSyncNow(): Promise<void> {
    console.log('🔄 Force sync triggered');
    await this.syncSchemes();
  }
}

export const schemeSyncAgent = new SchemeSyncAgent();
