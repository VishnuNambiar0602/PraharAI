import { neo4jService } from '../db/neo4j.service';
import { redisService } from '../db/redis.service';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_SECONDS = 365 * 24 * 60 * 60;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const NUDGE_SCHEDULE_MS = envInt('NUDGE_SCHEDULE_MS', SIX_HOURS_MS);
const NUDGE_NEW_SCHEME_BATCH_LIMIT = envInt('NUDGE_NEW_SCHEME_BATCH_LIMIT', 250);
const NUDGE_SEED_BATCH_LIMIT = envInt('NUDGE_SEED_BATCH_LIMIT', 2500);
const NUDGE_DEADLINE_DAYS_AHEAD = envInt('NUDGE_DEADLINE_DAYS_AHEAD', 7);
const NUDGE_MIN_SCORE_FLOOR = envInt('NUDGE_MIN_SCORE_FLOOR', 70);
const NUDGE_NEW_SCHEME_COOLDOWN_DAYS = envInt('NUDGE_NEW_SCHEME_COOLDOWN_DAYS', 14);

interface NudgeRunSummary {
  schemesEvaluated: number;
  nudgesCreated: number;
  deadlineRemindersCreated: number;
}

class NudgeService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.timer) return;

    if (String(process.env.NUDGE_ENABLED || 'true').toLowerCase() === 'false') {
      console.log('ℹ️ Nudge Service disabled by NUDGE_ENABLED=false');
      return;
    }

    await this.seedSeenSchemes();
    await this.runOnce();

    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        console.error('Nudge scheduler run failed:', error);
      });
    }, NUDGE_SCHEDULE_MS);

    console.log(`✅ Nudge Service started (every ${Math.round(NUDGE_SCHEDULE_MS / 3600000)} hours)`);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<NudgeRunSummary> {
    if (this.isRunning) {
      return { schemesEvaluated: 0, nudgesCreated: 0, deadlineRemindersCreated: 0 };
    }

    this.isRunning = true;
    try {
      let schemesEvaluated = 0;
      let nudgesCreated = 0;
      let deadlineRemindersCreated = 0;

      const schemes = await neo4jService.getAllSchemes(NUDGE_NEW_SCHEME_BATCH_LIMIT, 0);
      for (const scheme of schemes) {
        if (!scheme.scheme_id) continue;

        const seenKey = `nudge:seen_scheme:${scheme.scheme_id}`;
        const seen = await redisService.get<boolean>(seenKey);
        if (seen) continue;

        try {
          schemesEvaluated += 1;
          nudgesCreated += await this.evaluateNewScheme(scheme.scheme_id);
          await redisService.set(seenKey, true, YEAR_SECONDS);
        } catch (error) {
          console.error(`Nudge evaluation failed for scheme ${scheme.scheme_id}:`, error);
        }
      }

      deadlineRemindersCreated = await this.checkUpcomingDeadlines(NUDGE_DEADLINE_DAYS_AHEAD);

      return { schemesEvaluated, nudgesCreated, deadlineRemindersCreated };
    } finally {
      this.isRunning = false;
    }
  }

  async evaluateNewScheme(schemeId: string): Promise<number> {
    const scheme = await neo4jService.getSchemeById(schemeId);
    if (!scheme) return 0;

    const users = await neo4jService.getAllUsers();
    let created = 0;

    for (const user of users) {
      const userId = user.user_id;
      if (!userId) continue;

      const prefs = await neo4jService.getNudgePreferences(userId);
      if (!prefs.enabled) continue;
      if (!this.matchesPreferredCategories(prefs.categories, scheme)) continue;

      const eligibility = await neo4jService.checkGraphEligibility(userId, schemeId);
      const threshold = Math.max(NUDGE_MIN_SCORE_FLOOR, prefs.minEligibilityScore);
      if (eligibility.score < threshold) continue;

      const weeklyCount = await neo4jService.countNudgesSince(userId, this.startOfWeekIso());
      const maxPerWeek = Math.max(1, prefs.maxPerWeek || 3);
      if (weeklyCount >= maxPerWeek) continue;

      const alreadySent = await neo4jService.hasRecentNudgeForScheme(
        userId,
        schemeId,
        'new_scheme',
        NUDGE_NEW_SCHEME_COOLDOWN_DAYS
      );
      if (alreadySent) continue;

      const priority = this.priorityFromScore(eligibility.score);
      await neo4jService.createNudge({
        userId,
        type: 'new_scheme',
        schemeId,
        title: 'New scheme matched for you',
        message: `${scheme.name} matches your profile with ${Math.round(eligibility.score)}% eligibility.`,
        actionUrl: `/schemes/${schemeId}`,
        priority,
        eligibilityScore: eligibility.score,
        channels: prefs.channels,
        expiresAt: new Date(Date.now() + 14 * ONE_DAY_MS).toISOString(),
      });
      created += 1;
    }

    return created;
  }

  async checkUpcomingDeadlines(daysAhead = 7): Promise<number> {
    const schemes = await neo4jService.getSchemesWithUpcomingDeadlines(daysAhead);
    if (schemes.length === 0) return 0;

    const users = await neo4jService.getAllUsers();
    let created = 0;

    for (const scheme of schemes) {
      const schemeId = scheme.scheme_id;
      if (!schemeId) continue;

      for (const user of users) {
        const userId = user.user_id;
        if (!userId) continue;

        const prefs = await neo4jService.getNudgePreferences(userId);
        if (!prefs.enabled) continue;
        if (!this.matchesPreferredCategories(prefs.categories, scheme)) continue;

        const eligibility = await neo4jService.checkGraphEligibility(userId, schemeId);
        const threshold = Math.max(NUDGE_MIN_SCORE_FLOOR, prefs.minEligibilityScore);
        if (eligibility.score < threshold) continue;

        const weeklyCount = await neo4jService.countNudgesSince(userId, this.startOfWeekIso());
        const maxPerWeek = Math.max(1, prefs.maxPerWeek || 3);
        if (weeklyCount >= maxPerWeek) continue;

        const alreadySent = await neo4jService.hasRecentNudgeForScheme(
          userId,
          schemeId,
          'deadline_reminder',
          daysAhead
        );
        if (alreadySent) continue;

        await neo4jService.createNudge({
          userId,
          type: 'deadline_reminder',
          schemeId,
          title: 'Upcoming scheme deadline',
          message: `${scheme.name} deadline is approaching. Please review and apply soon.`,
          actionUrl: `/schemes/${schemeId}`,
          priority: 'high',
          eligibilityScore: eligibility.score,
          channels: prefs.channels,
          expiresAt: new Date(Date.now() + daysAhead * ONE_DAY_MS).toISOString(),
        });
        created += 1;
      }
    }

    return created;
  }

  async createProfileCompletionNudge(userId: string): Promise<void> {
    const user = await neo4jService.getUserById(userId);
    if (!user) return;

    const fields = ['name', 'email', 'age', 'income', 'state', 'employment', 'education', 'gender'];
    const filled = fields.filter((field) => user[field] != null && user[field] !== '').length;
    const completeness = Math.round((filled / fields.length) * 100);

    if (completeness >= 100) return;

    const prefs = await neo4jService.getNudgePreferences(userId);
    if (!prefs.enabled) return;

    await neo4jService.createNudge({
      userId,
      type: 'profile_update_suggestion',
      title: 'Complete your profile for better matches',
      message: `Your profile is ${completeness}% complete. Add missing details to improve recommendations.`,
      actionUrl: '/profile',
      priority: 'medium',
      channels: prefs.channels,
      expiresAt: new Date(Date.now() + 30 * ONE_DAY_MS).toISOString(),
    });
  }

  private async seedSeenSchemes(): Promise<void> {
    const seeded = await redisService.get<boolean>('nudge:seen_seeded');
    if (seeded) return;

    const schemes = await neo4jService.getAllSchemes(NUDGE_SEED_BATCH_LIMIT, 0);
    for (const scheme of schemes) {
      if (!scheme.scheme_id) continue;
      await redisService.set(`nudge:seen_scheme:${scheme.scheme_id}`, true, YEAR_SECONDS);
    }
    await redisService.set('nudge:seen_seeded', true, YEAR_SECONDS);
  }

  private startOfWeekIso(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }

  private priorityFromScore(score: number): 'high' | 'medium' | 'low' {
    if (score >= 90) return 'high';
    if (score >= 80) return 'medium';
    return 'low';
  }

  private matchesPreferredCategories(preferredCategories: string[], scheme: any): boolean {
    if (!Array.isArray(preferredCategories) || preferredCategories.length === 0) {
      return true;
    }

    const preferred = preferredCategories
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean);

    if (preferred.length === 0 || preferred.includes('all')) {
      return true;
    }

    const categoryTokens = new Set<string>();

    try {
      const categoryRaw = JSON.parse(String(scheme.category || '[]'));
      if (Array.isArray(categoryRaw)) {
        for (const item of categoryRaw) {
          categoryTokens.add(String(item).trim().toLowerCase());
        }
      }
    } catch {
      // Keep best-effort behavior for malformed category JSON.
    }

    try {
      const categoriesJsonRaw = JSON.parse(String(scheme.categories_json || '[]'));
      if (Array.isArray(categoriesJsonRaw)) {
        for (const item of categoriesJsonRaw) {
          if (item?.type) categoryTokens.add(String(item.type).trim().toLowerCase());
          if (item?.value) categoryTokens.add(String(item.value).trim().toLowerCase());
        }
      }
    } catch {
      // Keep best-effort behavior for malformed categories_json.
    }

    const fallbackText = `${scheme.name || ''} ${scheme.description || ''}`.toLowerCase();
    return preferred.some((pref) => {
      if (categoryTokens.has(pref)) return true;
      return fallbackText.includes(pref);
    });
  }
}

export const nudgeService = new NudgeService();
