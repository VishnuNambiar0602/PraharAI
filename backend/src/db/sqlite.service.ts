/**
 * SQLite Database Service
 * Persistent local database for government schemes.
 * Replaces the in-memory cache so scheme data survives server restarts
 * and avoids hitting the India.gov.in API on every startup.
 */

import Database from 'better-sqlite3';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SchemeRow {
  scheme_id: string;
  name: string;
  description: string;
  category: string;       // JSON array string
  ministry: string | null;
  tags: string;           // JSON array string
  state: string | null;
  categories_json: string; // JSON array of {type,value}
  scheme_url: string | null; // direct application URL
  last_updated: string;
}

export interface CategoryMapping {
  type: string;
  value: string;
}

export interface SyncMeta {
  last_sync: string | null;
  total_schemes: number;
}

// ─── Category extraction (single source of truth) ───────────────────────────

const CATEGORY_RULES: Record<string, Record<string, string[]>> = {
  Employment: {
    Employed: ['employed', 'employee', 'worker', 'job'],
    Unemployed: ['unemployed', 'jobless', 'unemployment'],
    'Self-Employed': ['self-employed', 'entrepreneur', 'business owner'],
    Student: ['student', 'education', 'scholarship'],
    Retired: ['retired', 'pension', 'senior citizen'],
  },
  Income: {
    'Below 1 Lakh': ['bpl', 'below poverty', 'poor', 'low income'],
    '1-3 Lakh': ['middle income', 'moderate income'],
    'Above 10 Lakh': ['high income', 'wealthy'],
  },
  Locality: {
    Rural: ['rural', 'village', 'farmer'],
    Urban: ['urban', 'city'],
  },
  SocialCategory: {
    SC: ['sc', 'scheduled caste'],
    ST: ['st', 'scheduled tribe', 'tribal'],
    OBC: ['obc', 'other backward'],
    Minority: ['minority', 'muslim', 'christian'],
    Women: ['women', 'woman', 'female', 'girl'],
    PWD: ['pwd', 'disabled', 'disability', 'handicapped'],
    General: ['general'],
  },
  Education: {
    Primary: ['primary', 'elementary'],
    Secondary: ['secondary', 'high school'],
    Graduate: ['graduate', 'degree', 'college'],
    'Post-Graduate': ['post graduate', 'masters', 'phd'],
    Professional: ['professional', 'technical', 'vocational'],
  },
  PovertyLine: {
    BPL: ['bpl', 'below poverty'],
    APL: ['apl', 'above poverty'],
  },
};

function extractCategories(name: string, description: string, tags: string[]): CategoryMapping[] {
  const text = `${name} ${description} ${tags.join(' ')}`.toLowerCase();
  const categories: CategoryMapping[] = [];

  for (const [type, rules] of Object.entries(CATEGORY_RULES)) {
    for (const [value, keywords] of Object.entries(rules)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({ type, value });
      }
    }
  }

  if (categories.length === 0) {
    categories.push(
      { type: 'Employment', value: 'Any' },
      { type: 'Income', value: 'Any' },
      { type: 'Locality', value: 'Any' },
      { type: 'SocialCategory', value: 'Any' },
      { type: 'Education', value: 'Any' },
      { type: 'PovertyLine', value: 'Any' },
    );
  }

  return categories;
}

// ─── Database Service ────────────────────────────────────────────────────────

class SqliteService {
  private db!: Database.Database;
  private dbPath: string;

  constructor() {
    // Store the DB file next to the backend package
    this.dbPath = path.resolve(__dirname, '..', '..', 'data', 'schemes.db');
  }

  /** Open (or create) the database and ensure tables exist */
  init(): void {
    const fs = require('fs');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64 MB

    this.createTables();
    console.log(`✅ SQLite database ready at ${this.dbPath}`);
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schemes (
        scheme_id   TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category    TEXT NOT NULL DEFAULT '[]',
        ministry    TEXT,
        tags        TEXT NOT NULL DEFAULT '[]',
        state       TEXT,
        categories_json TEXT NOT NULL DEFAULT '[]',
        scheme_url  TEXT,
        last_updated TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS scheme_categories (
        scheme_id TEXT NOT NULL,
        cat_type  TEXT NOT NULL,
        cat_value TEXT NOT NULL,
        PRIMARY KEY (scheme_id, cat_type, cat_value),
        FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_meta (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync  TEXT,
        total_schemes INTEGER NOT NULL DEFAULT 0
      );

      -- Ensure exactly one row in sync_meta
      INSERT OR IGNORE INTO sync_meta (id, last_sync, total_schemes) VALUES (1, NULL, 0);

      CREATE TABLE IF NOT EXISTS users (
        user_id     TEXT PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        name        TEXT,
        age         INTEGER,
        income      TEXT,
        state       TEXT,
        gender      TEXT,
        employment  TEXT,
        education   TEXT,
        interests   TEXT,
        onboarding_complete INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Indexes for fast search
      CREATE INDEX IF NOT EXISTS idx_schemes_name ON schemes(name);
      CREATE INDEX IF NOT EXISTS idx_scheme_categories_type ON scheme_categories(cat_type, cat_value);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Migrate: add scheme_url column if it doesn't exist yet (for existing DBs)
    try {
      this.db.exec('ALTER TABLE schemes ADD COLUMN scheme_url TEXT');
    } catch {
      // Column already exists – ignore
    }

    // Backfill scheme_url for any rows where it's NULL (scheme_id IS the slug)
    const backfilled = this.db.prepare(
      `UPDATE schemes SET scheme_url = 'https://www.myscheme.gov.in/schemes/' || scheme_id WHERE scheme_url IS NULL AND scheme_id IS NOT NULL`
    ).run();
    if (backfilled.changes > 0) {
      console.log(`✅ Backfilled scheme_url for ${backfilled.changes} existing schemes`);
    }

    // Migrate: add gender/employment/education/interests/onboarding to users if they don't exist
    const userCols = ['gender TEXT', 'employment TEXT', 'education TEXT', 'interests TEXT', 'onboarding_complete INTEGER NOT NULL DEFAULT 0'];
    for (const col of userCols) {
      try { this.db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* already exists */ }
    }
  }

  // ─── Sync Meta ──────────────────────────────────────────────────────────────

  getSyncMeta(): SyncMeta {
    const row = this.db.prepare('SELECT last_sync, total_schemes FROM sync_meta WHERE id = 1').get() as any;
    return {
      last_sync: row?.last_sync ?? null,
      total_schemes: row?.total_schemes ?? 0,
    };
  }

  private updateSyncMeta(total: number): void {
    this.db.prepare(
      'UPDATE sync_meta SET last_sync = datetime(\'now\'), total_schemes = ? WHERE id = 1'
    ).run(total);
  }

  /** Returns true if schemes were synced less than `maxAgeMs` ago */
  isFresh(maxAgeMs: number): boolean {
    const meta = this.getSyncMeta();
    if (!meta.last_sync || meta.total_schemes === 0) return false;
    const syncTime = new Date(meta.last_sync + 'Z').getTime(); // SQLite datetime is UTC
    return Date.now() - syncTime < maxAgeMs;
  }

  // ─── Bulk Write (transactional) ─────────────────────────────────────────────

  /**
   * Replace all schemes in one transaction.
   * This is called by the sync agent after a successful API fetch.
   */
  storeSchemes(schemes: { schemeId: string; name: string; description: string; category: string[]; ministry: string | null; tags: string[]; state: string | null; schemeUrl?: string | null }[]): void {
    const insertScheme = this.db.prepare(`
      INSERT OR REPLACE INTO schemes (scheme_id, name, description, category, ministry, tags, state, categories_json, scheme_url, last_updated)
      VALUES (@scheme_id, @name, @description, @category, @ministry, @tags, @state, @categories_json, @scheme_url, datetime('now'))
    `);

    const insertCat = this.db.prepare(`
      INSERT OR REPLACE INTO scheme_categories (scheme_id, cat_type, cat_value)
      VALUES (@scheme_id, @cat_type, @cat_value)
    `);

    const tx = this.db.transaction((items: typeof schemes) => {
      // Clear old data
      this.db.prepare('DELETE FROM scheme_categories').run();
      this.db.prepare('DELETE FROM schemes').run();

      for (const s of items) {
        const cats = extractCategories(s.name, s.description, s.tags);

        insertScheme.run({
          scheme_id: s.schemeId,
          name: s.name,
          description: s.description,
          category: JSON.stringify(s.category),
          ministry: s.ministry,
          tags: JSON.stringify(s.tags),
          state: s.state,
          categories_json: JSON.stringify(cats),
          scheme_url: s.schemeUrl ?? null,
        });

        for (const c of cats) {
          insertCat.run({ scheme_id: s.schemeId, cat_type: c.type, cat_value: c.value });
        }
      }

      this.updateSyncMeta(items.length);
    });

    tx(schemes);
    console.log(`✅ Stored ${schemes.length} schemes in SQLite`);
  }

  // ─── Read Queries ───────────────────────────────────────────────────────────

  /** Get total scheme count */
  getSchemeCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM schemes').get() as any;
    return row?.cnt ?? 0;
  }

  /** Get all schemes (with optional limit) */
  getAllSchemes(limit = 5000): SchemeRow[] {
    return this.db.prepare('SELECT * FROM schemes LIMIT ?').all(limit) as SchemeRow[];
  }

  /** Get scheme by ID */
  getSchemeById(schemeId: string): SchemeRow | undefined {
    return this.db.prepare('SELECT * FROM schemes WHERE scheme_id = ?').get(schemeId) as SchemeRow | undefined;
  }

  /** Full-text search on name, description, tags */
  searchSchemes(query: string, limit = 20): SchemeRow[] {
    const pattern = `%${query}%`;
    return this.db.prepare(`
      SELECT * FROM schemes
      WHERE name LIKE @p OR description LIKE @p OR tags LIKE @p
      LIMIT @limit
    `).all({ p: pattern, limit }) as SchemeRow[];
  }

  /** Find schemes matching any of the given category pairs */
  findSchemesByCategories(categories: CategoryMapping[], limit = 20): SchemeRow[] {
    if (categories.length === 0) {
      return this.getAllSchemes(limit);
    }

    // Build OR clauses
    const conditions = categories.map((_, i) => `(sc.cat_type = @t${i} AND (sc.cat_value = @v${i} OR sc.cat_value = 'Any'))`);
    const params: Record<string, string | number> = { limit };
    categories.forEach((c, i) => {
      params[`t${i}`] = c.type;
      params[`v${i}`] = c.value;
    });

    const sql = `
      SELECT DISTINCT s.* FROM schemes s
      JOIN scheme_categories sc ON s.scheme_id = sc.scheme_id
      WHERE ${conditions.join(' OR ')}
      LIMIT @limit
    `;
    return this.db.prepare(sql).all(params) as SchemeRow[];
  }

  /** Get all distinct categories grouped by type */
  getAllCategories(): Record<string, string[]> {
    const rows = this.db.prepare(
      'SELECT DISTINCT cat_type, cat_value FROM scheme_categories ORDER BY cat_type, cat_value'
    ).all() as { cat_type: string; cat_value: string }[];

    const result: Record<string, string[]> = {};
    for (const r of rows) {
      if (!result[r.cat_type]) result[r.cat_type] = [];
      result[r.cat_type].push(r.cat_value);
    }
    return result;
  }

  // ─── Utility helpers for consumers ──────────────────────────────────────────

  /** Convert a SchemeRow back to the Scheme shape used by india-gov.service */
  toScheme(row: SchemeRow) {
    return {
      schemeId: row.scheme_id,
      name: row.name,
      description: row.description,
      category: JSON.parse(row.category) as string[],
      ministry: row.ministry,
      tags: JSON.parse(row.tags) as string[],
      state: row.state,
      categories: JSON.parse(row.categories_json) as CategoryMapping[],
      schemeUrl: row.scheme_url ?? null,
    };
  }

  // ─── User CRUD ───────────────────────────────────────────────────────────────

  createUser(user: {
    userId: string; email: string; password: string;
    name?: string; age?: number; income?: string; state?: string; gender?: string;
  }): void {
    this.db.prepare(`
      INSERT INTO users (user_id, email, password, name, age, income, state, gender)
      VALUES (@userId, @email, @password, @name, @age, @income, @state, @gender)
    `).run({
      userId: user.userId,
      email: user.email,
      password: user.password,
      name: user.name ?? null,
      age: user.age ?? null,
      income: user.income ?? null,
      state: user.state ?? null,
      gender: user.gender ?? null,
    });
  }

  getUserByEmail(email: string): any | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  getUserById(userId: string): any | undefined {
    return this.db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  }

  getAllUsers(): any[] {
    return this.db.prepare('SELECT * FROM users').all();
  }

  updateUserProfile(userId: string, fields: Record<string, any>): void {
    const allowed = ['name', 'age', 'income', 'state', 'gender', 'employment', 'education', 'interests', 'onboarding_complete'];
    const updates = Object.entries(fields)
      .filter(([k]) => allowed.includes(k))
      .map(([k]) => `${k} = @${k}`);
    if (updates.length === 0) return;
    this.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = @userId`)
      .run({ ...fields, userId });
  }

  /** Graceful close */
  close(): void {
    if (this.db) {
      this.db.close();
      console.log('SQLite database closed');
    }
  }
}

export const sqliteService = new SqliteService();
