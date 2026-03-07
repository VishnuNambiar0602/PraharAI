/**
 * Scheme Sync Agent
 *
 * Responsibilities:
 * 1. On startup: initialize Neo4j + Redis, check if data is fresh (< 24 h old)
 * 2. If data is stale or missing: fetch all schemes from India.gov.in API and persist to Neo4j graph
 * 3. Schedule periodic re-sync every 24 hours
 * 4. Expose forceSyncNow() for manual trigger
 */

import { indiaGovService, type Scheme } from '../schemes/india-gov.service';
import { mySchemePageService } from '../schemes/myscheme-page.service';
import { neo4jService } from '../db/neo4j.service';
import { redisService } from '../db/redis.service';

interface SyncStatus {
  totalSchemes: number;
  lastSync: string | null;
  nextSync: string | null;
  isSyncing: boolean;
}

class SchemeSyncAgent {
  private readonly SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly RESUME_KEY = 'scheme_sync_resume_state';
  private readonly RESUME_STATE_TTL_SECONDS = 24 * 60 * 60; // 24h
  private readonly RESUME_DELAY_MS = Math.max(
    30_000,
    Number(process.env.SCHEME_SYNC_RESUME_DELAY_MS || 5 * 60 * 1000)
  );
  private readonly ENRICH_BATCH_SIZE = Math.max(
    10,
    Number(process.env.SCHEME_ENRICH_BATCH_SIZE || 120)
  );
  private readonly PAUSE_FAILURE_RATIO = Math.min(
    1,
    Math.max(0, Number(process.env.SCHEME_SYNC_PAUSE_FAILURE_RATIO || 0.7))
  );
  private readonly PAUSE_MIN_BATCH_SIZE = Math.max(
    10,
    Number(process.env.SCHEME_SYNC_PAUSE_MIN_BATCH_SIZE || 50)
  );
  private syncTimer: NodeJS.Timeout | null = null;
  private resumeTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  private dedupeSchemes(schemes: Scheme[]): Scheme[] {
    const seen = new Set<string>();
    return schemes.filter((scheme) => {
      if (seen.has(scheme.schemeId)) return false;
      seen.add(scheme.schemeId);
      return true;
    });
  }

  private async getResumeState(): Promise<{ nextIndex: number; totalSchemes: number } | null> {
    const state = await redisService.get<{ nextIndex?: number; totalSchemes?: number }>(
      this.RESUME_KEY
    );
    if (!state) return null;

    const nextIndex = Number(state.nextIndex);
    const totalSchemes = Number(state.totalSchemes);
    if (!Number.isFinite(nextIndex) || !Number.isFinite(totalSchemes)) return null;

    return {
      nextIndex: Math.max(0, Math.floor(nextIndex)),
      totalSchemes: Math.max(0, Math.floor(totalSchemes)),
    };
  }

  private async saveResumeState(nextIndex: number, totalSchemes: number): Promise<void> {
    await redisService.set(
      this.RESUME_KEY,
      {
        nextIndex,
        totalSchemes,
        updatedAt: new Date().toISOString(),
      },
      this.RESUME_STATE_TTL_SECONDS
    );
  }

  private async clearResumeState(): Promise<void> {
    await redisService.del(this.RESUME_KEY);
  }

  private scheduleResumeSync(reason: string): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }

    const resumeAt = new Date(Date.now() + this.RESUME_DELAY_MS).toISOString();
    console.log(`⏸️  Pausing sync (${reason}). Will auto-resume at ${resumeAt}`);

    this.resumeTimer = setTimeout(async () => {
      this.resumeTimer = null;
      console.log('🔁 Resuming paused scheme sync...');
      await this.syncSchemes();
    }, this.RESUME_DELAY_MS);
  }

  /**
   * Start the sync agent — initialises Neo4j + Redis, then syncs if stale
   */
  async start() {
    console.log('🔄 Scheme Sync Agent starting...');

    // Initialize Neo4j + Redis
    await neo4jService.init();

    const pendingResume = await this.getResumeState();
    if (pendingResume && pendingResume.nextIndex > 0) {
      console.log(
        `🔁 Found pending incremental sync state at ${pendingResume.nextIndex}/${pendingResume.totalSchemes}. Resuming now...`
      );
      await this.syncSchemes();
      this.scheduleNextSync();
      return;
    }

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
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
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
      const fetchStartedAt = Date.now();
      const fetchedSchemes = await indiaGovService.fetchAllSchemes(500);
      const allSchemes = this.dedupeSchemes(fetchedSchemes);
      const fetchDurationSec = ((Date.now() - fetchStartedAt) / 1000).toFixed(2);

      if (allSchemes.length === 0) {
        console.log('⚠️  No schemes fetched from API');
        return;
      }

      if (allSchemes.length !== fetchedSchemes.length) {
        console.log(
          `⚠️  Removed ${fetchedSchemes.length - allSchemes.length} duplicate scheme(s) before enrichment`
        );
      }

      console.log(`✅ Fetched ${allSchemes.length} schemes from API in ${fetchDurationSec}s`);

      const totalSchemes = allSchemes.length;
      const resumeState = await this.getResumeState();
      const shouldResume =
        !!resumeState &&
        resumeState.totalSchemes === totalSchemes &&
        resumeState.nextIndex > 0 &&
        resumeState.nextIndex < totalSchemes;

      let startIndex = 0;
      if (shouldResume) {
        startIndex = resumeState!.nextIndex;
        console.log(
          `🔁 Resuming incremental sync from index ${startIndex}/${totalSchemes} (remaining ${totalSchemes - startIndex})`
        );
      } else {
        console.log(
          '🧹 Starting new incremental sync run (resetting existing Scheme nodes once)...'
        );
        await neo4jService.resetSchemesForIncrementalSync();
        await this.saveResumeState(0, totalSchemes);
      }

      // Enrich each batch and persist immediately, so progress survives interruptions.
      console.log(
        `🧩 Starting incremental enrichment+persist stage (batchSize=${this.ENRICH_BATCH_SIZE})...`
      );
      const enrichStartedAt = Date.now();

      let processed = startIndex;
      for (let i = startIndex; i < totalSchemes; i += this.ENRICH_BATCH_SIZE) {
        const batch = allSchemes.slice(i, i + this.ENRICH_BATCH_SIZE);
        const batchEnd = Math.min(totalSchemes, i + batch.length);

        console.log(`📦 Processing batch ${i + 1}-${batchEnd} of ${totalSchemes}...`);
        const enrichedBatch = await mySchemePageService.enrichSchemes(batch);
        await neo4jService.upsertSchemesBatch(enrichedBatch);

        processed = batchEnd;
        await this.saveResumeState(processed, totalSchemes);

        const failedInBatch = enrichedBatch.filter((s) => !s.page_scheme_id).length;
        const batchFailureRatio = batch.length > 0 ? failedInBatch / batch.length : 0;
        const overallPercent = ((processed / totalSchemes) * 100).toFixed(1);
        console.log(
          `💾 Batch persisted: ${processed}/${totalSchemes} (${overallPercent}%) | batchFailures=${failedInBatch}/${batch.length}`
        );

        if (
          batch.length >= this.PAUSE_MIN_BATCH_SIZE &&
          batchFailureRatio >= this.PAUSE_FAILURE_RATIO
        ) {
          this.scheduleResumeSync(`high failure ratio ${Math.round(batchFailureRatio * 100)}%`);
          return;
        }
      }

      const enrichDurationSec = ((Date.now() - enrichStartedAt) / 1000).toFixed(2);
      console.log(`✅ Incremental enrichment+persist stage finished in ${enrichDurationSec}s`);

      // Finalize graph relationships/meta only after all batches are persisted.
      console.log('🔗 Finalizing graph links and sync metadata...');
      const finalizeStartedAt = Date.now();
      await neo4jService.finalizeIncrementalSchemeSync(totalSchemes);
      await this.clearResumeState();
      const finalizeDurationSec = ((Date.now() - finalizeStartedAt) / 1000).toFixed(2);
      console.log(`✅ Finalization stage finished in ${finalizeDurationSec}s`);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Sync complete! ${totalSchemes} schemes persisted to Neo4j in ${duration}s`);
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
