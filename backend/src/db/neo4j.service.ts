/**
 * Neo4j Graph Database Service
 *
 * Full-featured database service that replaces SQLite.
 * Manages government schemes as a graph with Category nodes,
 * UserGroup nodes, and rich relationships for graph-based matching.
 *
 * Graph Model:
 *   (Scheme)-[:HAS_CATEGORY]->(Category {type, value})
 *   (Scheme)-[:TARGETS]->(UserGroup)
 *   (User)-[:BELONGS_TO]->(UserGroup)
 *   (User)-[:HAS_CATEGORY]->(Category)
 *
 * Category dimensions: Employment, Income, Locality, SocialCategory,
 *   Education, PovertyLine, Gender, Age, Disability, Minority
 */

import { initializeNeo4j, Neo4jConnection } from './neo4j.config';
import { redisService, CacheTTL } from './redis.service';
import * as crypto from 'crypto';

// ─── PII encryption helpers ─────────────────────────────────────────────────

let _encService: import('../encryption/encryption.service').EncryptionService | null = null;

function getEnc(): import('../encryption/encryption.service').EncryptionService | null {
  if (_encService) return _encService;
  try {
    if (!process.env.ENCRYPTION_KEY) return null;
    // Lazy-load to avoid circular deps and to allow running without key
    const { getEncryptionService } = require('../encryption');
    _encService = getEncryptionService();
    return _encService;
  } catch {
    return null;
  }
}

function emailHash(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

async function encryptPII(fields: { email: string; name: string }): Promise<{
  email: string;
  name: string;
  email_hash: string;
}> {
  const enc = getEnc();
  if (!enc) return { ...fields, email_hash: emailHash(fields.email) };
  return {
    email: await enc.encrypt(fields.email),
    name: await enc.encrypt(fields.name),
    email_hash: emailHash(fields.email),
  };
}

async function decryptPII<T extends Record<string, any>>(user: T): Promise<T> {
  const enc = getEnc();
  if (!enc) return user;
  const out = { ...user };
  for (const field of ['email', 'name'] as const) {
    const val = out[field];
    if (typeof val === 'string' && val.includes(':')) {
      try {
        (out as any)[field] = await enc.decrypt(val);
      } catch {
        // Not encrypted (backward compat) — keep original
      }
    }
  }
  return out;
}

// ─── Types (same as old sqlite.service.ts for drop-in compat) ────────────────

export interface SchemeRow {
  scheme_id: string;
  name: string;
  description: string;
  category: string; // JSON array string
  ministry: string | null;
  tags: string; // JSON array string
  state: string | null;
  categories_json: string; // JSON array of {type,value}
  scheme_url: string | null;
  page_scheme_id?: string | null;
  page_title?: string | null;
  page_ministry?: string | null;
  page_description?: string | null;
  page_eligibility_json?: string;
  page_benefits_json?: string;
  page_enriched_at?: string | null;
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
  Gender: {
    Male: ['male', 'men', 'boy'],
    Female: ['female', 'women', 'woman', 'girl'],
    Other: ['transgender', 'non-binary'],
  },
  Age: {
    Child: ['child', 'children', 'minor', 'kid'],
    Youth: ['youth', 'young'],
    Adult: ['adult'],
    Senior: ['senior citizen', 'elderly', 'old age', 'pension'],
  },
  Disability: {
    Yes: ['disabled', 'disability', 'pwd', 'handicapped', 'divyang'],
  },
  Minority: {
    Yes: ['minority', 'muslim', 'christian', 'sikh', 'buddhist', 'parsi', 'jain'],
  },
};

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return false;

  // Use boundary-safe matching to avoid false positives like "sc" in "scheme".
  const phrase = escapeRegExp(normalizedKeyword)
    .replace(/\\\s+/g, '\\s+')
    .replace(/\\-/g, '[-\\s]?');
  const regex = new RegExp(`(^|[^a-z0-9])${phrase}([^a-z0-9]|$)`, 'i');
  return regex.test(text);
}

function extractNumericCategories(text: string): CategoryMapping[] {
  const categories: CategoryMapping[] = [];

  // Age-based signals
  const ageRange = text.match(
    /(?:age|between)?\s*(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?:years?)?/i
  );
  if (ageRange) {
    const min = Number(ageRange[1]);
    const max = Number(ageRange[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      if (max <= 25) categories.push({ type: 'Age', value: 'Youth' });
      if (min >= 60) categories.push({ type: 'Age', value: 'Senior' });
      if (min >= 18 && max <= 59) categories.push({ type: 'Age', value: 'Adult' });
    }
  }

  const ageAbove = text.match(/(?:above|over|minimum)\s*(\d{1,2})\s*(?:years?)?/i);
  if (ageAbove) {
    const min = Number(ageAbove[1]);
    if (Number.isFinite(min)) {
      if (min >= 60) categories.push({ type: 'Age', value: 'Senior' });
      else if (min >= 18) categories.push({ type: 'Age', value: 'Adult' });
    }
  }

  // Income-based signals (convert lakh to rupees)
  const incomeLakh = text.match(
    /(?:annual\s+income|family\s+income|income)[^\d]*(?:not\s+exceed|below|under|upto|up\s*to|maximum)?[^\d]*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i
  );
  if (incomeLakh) {
    const rupees = Number(incomeLakh[1]) * 100000;
    if (Number.isFinite(rupees)) {
      if (rupees <= 100000) categories.push({ type: 'Income', value: 'Below 1 Lakh' });
      else if (rupees <= 300000) categories.push({ type: 'Income', value: '1-3 Lakh' });
      else if (rupees >= 1000000) categories.push({ type: 'Income', value: 'Above 10 Lakh' });
    }
  }

  const incomeRupees = text.match(
    /(?:annual\s+income|family\s+income|income)[^\d]*(?:not\s+exceed|below|under|upto|up\s*to|maximum)?[^\d]*(?:rs\.?|₹)\s*([\d,]+)/i
  );
  if (incomeRupees) {
    const rupees = Number(incomeRupees[1].replace(/,/g, ''));
    if (Number.isFinite(rupees)) {
      if (rupees <= 100000) categories.push({ type: 'Income', value: 'Below 1 Lakh' });
      else if (rupees <= 300000) categories.push({ type: 'Income', value: '1-3 Lakh' });
      else if (rupees >= 1000000) categories.push({ type: 'Income', value: 'Above 10 Lakh' });
    }
  }

  return categories;
}

function extractCategories(name: string, description: string, tags: string[]): CategoryMapping[] {
  const text = `${name} ${description} ${tags.join(' ')}`.toLowerCase();
  const categories: CategoryMapping[] = [];
  const dedupe = new Set<string>();

  const addCategory = (type: string, value: string) => {
    const key = `${type}|${value}`;
    if (!dedupe.has(key)) {
      categories.push({ type, value });
      dedupe.add(key);
    }
  };

  for (const [type, rules] of Object.entries(CATEGORY_RULES)) {
    for (const [value, keywords] of Object.entries(rules)) {
      if (keywords.length > 0 && keywords.some((kw) => containsKeyword(text, kw))) {
        addCategory(type, value);
      }
    }
  }

  for (const cat of extractNumericCategories(text)) {
    addCategory(cat.type, cat.value);
  }

  if (categories.length === 0) {
    addCategory('Employment', 'Any');
    addCategory('Income', 'Any');
    addCategory('Locality', 'Any');
    addCategory('SocialCategory', 'Any');
    addCategory('Education', 'Any');
    addCategory('PovertyLine', 'Any');
  }

  return categories;
}

// ─── Default UserGroup definitions ───────────────────────────────────────────

const DEFAULT_USER_GROUPS = [
  {
    name: 'Farmer',
    occupation_type: 'Agriculture',
    income_range: '',
    age_range: '',
    rural_urban: 'Rural',
    gender_priority: '',
    description: 'Farmers and agricultural laborers',
  },
  {
    name: 'Student',
    occupation_type: '',
    income_range: '',
    age_range: '18-25',
    rural_urban: '',
    gender_priority: '',
    description: 'Students pursuing education',
  },
  {
    name: 'Senior Citizen',
    occupation_type: '',
    income_range: '',
    age_range: '60+',
    rural_urban: '',
    gender_priority: '',
    description: 'Senior citizens aged 60 and above',
  },
  {
    name: 'Low Income Worker',
    occupation_type: '',
    income_range: '0-250000',
    age_range: '',
    rural_urban: '',
    gender_priority: '',
    description: 'Workers with low annual income',
  },
  {
    name: 'Women',
    occupation_type: '',
    income_range: '',
    age_range: '',
    rural_urban: '',
    gender_priority: 'Female',
    description: 'Women-focused schemes and programs',
  },
  {
    name: 'MSME / Self-employed',
    occupation_type: 'Self-employed',
    income_range: '',
    age_range: '',
    rural_urban: '',
    gender_priority: '',
    description: 'Micro, Small & Medium Enterprises and self-employed',
  },
  {
    name: 'Disabled',
    occupation_type: '',
    income_range: '',
    age_range: '',
    rural_urban: '',
    gender_priority: '',
    description: 'Persons with disabilities',
  },
  {
    name: 'Rural Household',
    occupation_type: '',
    income_range: '',
    age_range: '',
    rural_urban: 'Rural',
    gender_priority: '',
    description: 'Households in rural areas',
  },
  {
    name: 'Urban BPL',
    occupation_type: '',
    income_range: '0-150000',
    age_range: '',
    rural_urban: 'Urban',
    gender_priority: '',
    description: 'Urban households below poverty line',
  },
];

// ─── Neo4j Database Service ──────────────────────────────────────────────────

class Neo4jDbService {
  private connection!: Neo4jConnection;
  private initialized = false;

  // ─── Initialization ────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialized) return;

    const uri =
      process.env.NEO4J_URI ||
      `bolt://${process.env.NEO4J_HOST || 'localhost'}:${process.env.NEO4J_PORT || '7687'}`;
    const username = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password123';
    const database = process.env.NEO4J_DATABASE || 'neo4j';

    console.log(`🔌 Connecting to Neo4j at ${uri}...`);
    this.connection = initializeNeo4j({ uri, username, password, database });
    await this.connection.connect();

    await this.createConstraintsAndIndexes();
    await this.initializeDefaultUserGroups();
    await redisService.init();

    this.initialized = true;
    console.log('✅ Neo4j graph database ready');
  }

  private async createConstraintsAndIndexes(): Promise<void> {
    const constraints = [
      'CREATE CONSTRAINT scheme_id IF NOT EXISTS FOR (s:Scheme) REQUIRE s.scheme_id IS UNIQUE',
      'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE',
      'CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
      'CREATE CONSTRAINT category_key IF NOT EXISTS FOR (c:Category) REQUIRE (c.type, c.value) IS UNIQUE',
      'CREATE CONSTRAINT usergroup_name IF NOT EXISTS FOR (ug:UserGroup) REQUIRE ug.name IS UNIQUE',
      'CREATE CONSTRAINT syncmeta_id IF NOT EXISTS FOR (sm:SyncMeta) REQUIRE sm.meta_id IS UNIQUE',
    ];
    for (const c of constraints) {
      try {
        await this.connection.executeWrite(c);
      } catch {
        /* may already exist */
      }
    }

    const indexes = [
      'CREATE INDEX scheme_name IF NOT EXISTS FOR (s:Scheme) ON (s.name)',
      'CREATE INDEX scheme_state IF NOT EXISTS FOR (s:Scheme) ON (s.state)',
      'CREATE INDEX scheme_active IF NOT EXISTS FOR (s:Scheme) ON (s.is_active)',
      'CREATE INDEX scheme_ministry IF NOT EXISTS FOR (s:Scheme) ON (s.ministry)',
      'CREATE INDEX category_type IF NOT EXISTS FOR (c:Category) ON (c.type)',
      'CREATE INDEX category_type_value IF NOT EXISTS FOR (c:Category) ON (c.type, c.value)',
      'CREATE INDEX user_state IF NOT EXISTS FOR (u:User) ON (u.state)',
      'CREATE INDEX user_employment IF NOT EXISTS FOR (u:User) ON (u.employment)',
      'CREATE INDEX user_state_employment IF NOT EXISTS FOR (u:User) ON (u.state, u.employment)',
    ];
    for (const idx of indexes) {
      try {
        await this.connection.executeWrite(idx);
      } catch {
        /* may already exist */
      }
    }

    // Full-text search index on scheme name, description, and tags
    try {
      await this.connection.executeWrite(
        `CREATE FULLTEXT INDEX scheme_fulltext IF NOT EXISTS
         FOR (s:Scheme)
         ON EACH [s.name, s.description, s.tags]`
      );
    } catch {
      /* may already exist */
    }

    console.log('✅ Neo4j constraints, indexes, and full-text search ready');
  }

  private async initializeDefaultUserGroups(): Promise<void> {
    for (const g of DEFAULT_USER_GROUPS) {
      try {
        await this.connection.executeWrite(
          `MERGE (ug:UserGroup { name: $name })
           ON CREATE SET
             ug.income_range = $income_range,
             ug.age_range = $age_range,
             ug.occupation_type = $occupation_type,
             ug.rural_urban = $rural_urban,
             ug.gender_priority = $gender_priority,
             ug.description = $description,
             ug.created_at = toString(datetime()),
             ug.member_count = 0`,
          g
        );
      } catch {
        /* ignore duplicate */
      }
    }
    console.log('✅ Default UserGroups initialized');
  }

  // ─── Sync Meta ──────────────────────────────────────────────────────────────

  async getSyncMeta(): Promise<SyncMeta> {
    const cached = await redisService.get<SyncMeta>('sync_meta');
    if (cached) return cached;

    const rows = await this.connection.executeRead<{
      last_sync: string | null;
      total_schemes: number;
    }>(
      `OPTIONAL MATCH (sm:SyncMeta { meta_id: 'main' })
       RETURN sm.last_sync AS last_sync, COALESCE(sm.total_schemes, 0) AS total_schemes`
    );
    const r = rows[0] || { last_sync: null, total_schemes: 0 };
    const meta: SyncMeta = {
      last_sync: r.last_sync ?? null,
      total_schemes: Number(r.total_schemes) || 0,
    };
    await redisService.set('sync_meta', meta, CacheTTL.SYNC_META);
    return meta;
  }

  private async updateSyncMeta(total: number): Promise<void> {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await this.connection.executeWrite(
      `MERGE (sm:SyncMeta { meta_id: 'main' })
       SET sm.last_sync = $now, sm.total_schemes = $total`,
      { now, total }
    );
    await redisService.del('sync_meta');
  }

  async isFresh(maxAgeMs: number): Promise<boolean> {
    const meta = await this.getSyncMeta();
    if (!meta.last_sync || meta.total_schemes === 0) return false;
    const syncTime = new Date(meta.last_sync + (meta.last_sync.includes('Z') ? '' : 'Z')).getTime();
    return Date.now() - syncTime < maxAgeMs;
  }

  // ─── Bulk Write ────��────────────────────────────────────────────────────────

  async storeSchemes(
    schemes: {
      schemeId: string;
      name: string;
      description: string;
      category: string[];
      ministry: string | null;
      tags: string[];
      state: string | null;
      schemeUrl?: string | null;
      page_scheme_id?: string | null;
      page_title?: string | null;
      page_ministry?: string | null;
      page_description?: string | null;
      page_eligibility_json?: string;
      page_benefits_json?: string;
      page_enriched_at?: string | null;
    }[]
  ): Promise<void> {
    // Deduplicate by scheme_id — the API sometimes returns duplicates
    const seen = new Set<string>();
    const uniqueSchemes = schemes.filter((s) => {
      if (seen.has(s.schemeId)) return false;
      seen.add(s.schemeId);
      return true;
    });
    if (uniqueSchemes.length !== schemes.length) {
      console.log(
        `⚠️  Deduplicated ${schemes.length - uniqueSchemes.length} duplicate scheme(s) before storing`
      );
    }

    console.log(`📥 Storing ${uniqueSchemes.length} schemes in Neo4j graph...`);
    const startTime = Date.now();

    // Step 1: Drop constraint temporarily to allow clean deletion and re-insertion
    try {
      await this.connection.executeWrite('DROP CONSTRAINT scheme_id IF EXISTS');
      console.log('🔓 Dropped scheme_id constraint for clean sync');
    } catch (e) {
      // Constraint might not exist, that's fine
    }

    // Step 2: Remove old scheme nodes
    await this.connection.executeWrite('MATCH (s:Scheme) DETACH DELETE s');
    console.log('🗑️  Cleared existing schemes');

    // Step 3: Batch insert — chunks of 500 (using CREATE since we cleared all schemes)
    const CHUNK = 500;
    for (let i = 0; i < uniqueSchemes.length; i += CHUNK) {
      const rows = uniqueSchemes.slice(i, i + CHUNK).map((s) => {
        const cats = extractCategories(s.name, s.description, s.tags);
        return {
          scheme_id: s.schemeId,
          name: s.name,
          description: s.description,
          category: JSON.stringify(s.category),
          ministry: s.ministry ?? '',
          tags: JSON.stringify(s.tags),
          state: s.state ?? '',
          categories_json: JSON.stringify(cats),
          scheme_url: s.schemeUrl ?? `https://www.myscheme.gov.in/schemes/${s.schemeId}`,
          page_scheme_id: s.page_scheme_id ?? '',
          page_title: s.page_title ?? '',
          page_ministry: s.page_ministry ?? '',
          page_description: s.page_description ?? '',
          page_eligibility_json: s.page_eligibility_json ?? '[]',
          page_benefits_json: s.page_benefits_json ?? '[]',
          page_enriched_at: s.page_enriched_at ?? '',
          is_active: true,
          last_updated: new Date().toISOString(),
        };
      });

      await this.connection.executeWrite(
        `UNWIND $rows AS row
         CREATE (s:Scheme {
           scheme_id: row.scheme_id,
           name: row.name,
           description: row.description,
           category: row.category,
           ministry: row.ministry,
           tags: row.tags,
           state: row.state,
           categories_json: row.categories_json,
           scheme_url: row.scheme_url,
           page_scheme_id: row.page_scheme_id,
           page_title: row.page_title,
           page_ministry: row.page_ministry,
           page_description: row.page_description,
           page_eligibility_json: row.page_eligibility_json,
           page_benefits_json: row.page_benefits_json,
           page_enriched_at: row.page_enriched_at,
           is_active: row.is_active,
           last_updated: row.last_updated
         })`,
        { rows }
      );
    }

    // Step 4: Recreate the constraint
    try {
      await this.connection.executeWrite(
        'CREATE CONSTRAINT scheme_id IF NOT EXISTS FOR (s:Scheme) REQUIRE s.scheme_id IS UNIQUE'
      );
      console.log('🔒 Recreated scheme_id constraint');
    } catch (e) {
      console.log('⚠️  Could not recreate constraint (may already exist)');
    }

    // Step 3: Create Category nodes + HAS_CATEGORY relationships
    // Parse categories_json with Cypher and create relationships
    await this.connection
      .executeWrite(
        `MATCH (s:Scheme)
       WITH s, s.categories_json AS catsStr
       WHERE catsStr IS NOT NULL AND catsStr <> '[]'
       CALL {
         WITH s, catsStr
         WITH s, catsStr
         // We need to iterate over the JSON array; Neo4j doesn't have native
         // JSON parse without APOC, so we store categories as individual props
         // During sync we pre-create Category nodes matched by the in-memory extracted data
         RETURN s AS scheme
       }
       RETURN count(scheme) AS processed`
      )
      .catch(() => {
        /* no-op, we handle below */
      });

    // Direct approach: re-extract and create relationships from JS side
    await this.createCategoryRelationships(uniqueSchemes);

    // Step 5: Auto-link schemes to UserGroups
    await this.autoLinkSchemesToUserGroups();

    // Step 6: Update meta
    await this.updateSyncMeta(uniqueSchemes.length);

    // Clear caches
    await redisService.delPattern('schemes:*');
    await redisService.delPattern('categories:*');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Stored ${uniqueSchemes.length} schemes in Neo4j graph in ${duration}s`);
  }

  /**
   * Prepare for resumable/incremental sync by clearing existing schemes once.
   */
  async resetSchemesForIncrementalSync(): Promise<void> {
    await this.connection.executeWrite('MATCH (s:Scheme) DETACH DELETE s');
    console.log('🧹 Cleared existing Scheme nodes for incremental sync');
  }

  /**
   * Upsert a batch of schemes without clearing existing data.
   */
  async upsertSchemesBatch(
    schemes: {
      schemeId: string;
      name: string;
      description: string;
      category: string[];
      ministry: string | null;
      tags: string[];
      state: string | null;
      schemeUrl?: string | null;
      page_scheme_id?: string | null;
      page_title?: string | null;
      page_ministry?: string | null;
      page_description?: string | null;
      page_eligibility_json?: string;
      page_benefits_json?: string;
      page_enriched_at?: string | null;
    }[]
  ): Promise<void> {
    if (!schemes.length) return;

    const seen = new Set<string>();
    const uniqueSchemes = schemes.filter((s) => {
      if (seen.has(s.schemeId)) return false;
      seen.add(s.schemeId);
      return true;
    });

    const rows = uniqueSchemes.map((s) => {
      const cats = extractCategories(s.name, s.description, s.tags);
      return {
        scheme_id: s.schemeId,
        name: s.name,
        description: s.description,
        category: JSON.stringify(s.category),
        ministry: s.ministry ?? '',
        tags: JSON.stringify(s.tags),
        state: s.state ?? '',
        categories_json: JSON.stringify(cats),
        scheme_url: s.schemeUrl ?? `https://www.myscheme.gov.in/schemes/${s.schemeId}`,
        page_scheme_id: s.page_scheme_id ?? '',
        page_title: s.page_title ?? '',
        page_ministry: s.page_ministry ?? '',
        page_description: s.page_description ?? '',
        page_eligibility_json: s.page_eligibility_json ?? '[]',
        page_benefits_json: s.page_benefits_json ?? '[]',
        page_enriched_at: s.page_enriched_at ?? '',
        is_active: true,
        last_updated: new Date().toISOString(),
      };
    });

    await this.connection.executeWrite(
      `UNWIND $rows AS row
       MERGE (s:Scheme { scheme_id: row.scheme_id })
       SET s.name = row.name,
           s.description = row.description,
           s.category = row.category,
           s.ministry = row.ministry,
           s.tags = row.tags,
           s.state = row.state,
           s.categories_json = row.categories_json,
           s.scheme_url = row.scheme_url,
           s.page_scheme_id = row.page_scheme_id,
           s.page_title = row.page_title,
           s.page_ministry = row.page_ministry,
           s.page_description = row.page_description,
           s.page_eligibility_json = row.page_eligibility_json,
           s.page_benefits_json = row.page_benefits_json,
           s.page_enriched_at = row.page_enriched_at,
           s.is_active = row.is_active,
           s.last_updated = row.last_updated`,
      { rows }
    );

    await this.createCategoryRelationships(uniqueSchemes);
  }

  /**
   * Finalize incremental sync by linking groups, updating sync meta and clearing caches.
   */
  async finalizeIncrementalSchemeSync(totalSchemes: number): Promise<void> {
    await this.autoLinkSchemesToUserGroups();
    await this.updateSyncMeta(totalSchemes);
    await redisService.delPattern('schemes:*');
    await redisService.delPattern('categories:*');
    console.log(`✅ Finalized incremental sync metadata for ${totalSchemes} schemes`);
  }

  /** Create Category nodes and HAS_CATEGORY relationships from JS side */
  private async createCategoryRelationships(
    schemes: { schemeId: string; name: string; description: string; tags: string[] }[]
  ): Promise<void> {
    // Collect all unique categories across all schemes
    const catMap = new Map<string, Set<string>>(); // "type|value" -> Set<schemeId>
    for (const s of schemes) {
      const cats = extractCategories(s.name, s.description, s.tags);
      for (const c of cats) {
        const key = `${c.type}|${c.value}`;
        if (!catMap.has(key)) catMap.set(key, new Set());
        catMap.get(key)!.add(s.schemeId);
      }
    }

    // Batch: create all Category nodes
    const catNodes = [...catMap.keys()].map((k) => {
      const [type, value] = k.split('|');
      return { type, value };
    });
    if (catNodes.length > 0) {
      await this.connection.executeWrite(
        `UNWIND $cats AS cat
         MERGE (c:Category { type: cat.type, value: cat.value })`,
        { cats: catNodes }
      );
    }

    // Batch: create HAS_CATEGORY relationships in chunks
    const rels: { schemeId: string; type: string; value: string }[] = [];
    for (const [key, schemeIds] of catMap.entries()) {
      const [type, value] = key.split('|');
      for (const sid of schemeIds) {
        rels.push({ schemeId: sid, type, value });
      }
    }

    const REL_CHUNK = 2000;
    for (let i = 0; i < rels.length; i += REL_CHUNK) {
      const chunk = rels.slice(i, i + REL_CHUNK);
      await this.connection.executeWrite(
        `UNWIND $rels AS rel
         MATCH (s:Scheme { scheme_id: rel.schemeId })
         MATCH (c:Category { type: rel.type, value: rel.value })
         MERGE (s)-[:HAS_CATEGORY]->(c)`,
        { rels: chunk }
      );
    }
  }

  /** Auto-link schemes to UserGroups via category overlap */
  private async autoLinkSchemesToUserGroups(): Promise<void> {
    const linkQueries = [
      // Women
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'SocialCategory', value: 'Women' })
       MATCH (ug:UserGroup { name: 'Women' }) MERGE (s)-[:TARGETS]->(ug)`,
      // Rural → Rural Household + Farmer
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'Locality', value: 'Rural' })
       MATCH (ug:UserGroup) WHERE ug.name IN ['Rural Household', 'Farmer'] MERGE (s)-[:TARGETS]->(ug)`,
      // Urban → Urban BPL
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'Locality', value: 'Urban' })
       MATCH (ug:UserGroup { name: 'Urban BPL' }) MERGE (s)-[:TARGETS]->(ug)`,
      // Student
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'Employment', value: 'Student' })
       MATCH (ug:UserGroup { name: 'Student' }) MERGE (s)-[:TARGETS]->(ug)`,
      // Retired → Senior Citizen
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'Employment', value: 'Retired' })
       MATCH (ug:UserGroup { name: 'Senior Citizen' }) MERGE (s)-[:TARGETS]->(ug)`,
      // Self-Employed → MSME
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'Employment', value: 'Self-Employed' })
       MATCH (ug:UserGroup { name: 'MSME / Self-employed' }) MERGE (s)-[:TARGETS]->(ug)`,
      // Disabled
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'SocialCategory', value: 'PWD' })
       MATCH (ug:UserGroup { name: 'Disabled' }) MERGE (s)-[:TARGETS]->(ug)`,
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category { type: 'Disability', value: 'Yes' })
       MATCH (ug:UserGroup { name: 'Disabled' }) MERGE (s)-[:TARGETS]->(ug)`,
      // Low Income
      `MATCH (s:Scheme)-[:HAS_CATEGORY]->(c:Category)
       WHERE c.type = 'Income' AND c.value IN ['Below 1 Lakh']
       MATCH (ug:UserGroup { name: 'Low Income Worker' }) MERGE (s)-[:TARGETS]->(ug)`,
    ];
    for (const q of linkQueries) {
      try {
        await this.connection.executeWrite(q);
      } catch {
        /* ignore */
      }
    }
  }

  // ─── Read Queries ───────────────────────────────────────────────────────────

  async getSchemeCount(): Promise<number> {
    const cached = await redisService.get<number>('schemes:count');
    if (cached != null) return cached;

    const rows = await this.connection.executeRead<{ cnt: number }>(
      'MATCH (s:Scheme) RETURN count(s) AS cnt'
    );
    const cnt = Number(rows[0]?.cnt) || 0;
    await redisService.set('schemes:count', cnt, CacheTTL.CATEGORIES);
    return cnt;
  }

  async getAllSchemes(limit = 5000, offset = 0): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    const offsetInt = Math.max(0, Math.floor(Number(offset) || 0));
    const cacheKey = `schemes:all:${offsetInt}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.connection.executeRead<any>(
      `MATCH (s:Scheme)
       RETURN s
       ORDER BY toLower(s.name), s.scheme_id
       SKIP toInteger($offset)
       LIMIT toInteger($limit)`,
      {
        offset: offsetInt,
        limit: limitInt,
      }
    );
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, CacheTTL.SCHEME_SEARCH);
    return result;
  }

  async getSchemeById(schemeId: string): Promise<SchemeRow | undefined> {
    const cacheKey = `schemes:id:${schemeId}`;
    const cached = await redisService.get<SchemeRow>(cacheKey);
    if (cached) return cached;

    const rows = await this.connection.executeRead<any>(
      'MATCH (s:Scheme { scheme_id: $schemeId }) RETURN s',
      { schemeId }
    );
    if (rows.length === 0) return undefined;
    const row = this.nodeToSchemeRow(rows[0].s);
    await redisService.set(cacheKey, row, CacheTTL.SCHEME_DETAIL);
    return row;
  }

  async searchSchemes(query: string, limit = 20, offset = 0): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    const offsetInt = Math.max(0, Math.floor(Number(offset) || 0));
    if (!query) return this.getAllSchemes(limitInt, offsetInt);

    const cacheKey = `schemes:search:${query}:${offsetInt}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    let rows: any[];
    try {
      // Use full-text index for fast search (lucene query syntax)
      const ftQuery = query.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').trim();
      rows = await this.connection.executeRead<any>(
        `CALL db.index.fulltext.queryNodes('scheme_fulltext', $query)
         YIELD node AS s, score
         RETURN s ORDER BY score DESC, toLower(s.name)
         SKIP toInteger($offset)
         LIMIT toInteger($limit)`,
        { query: `${ftQuery}~`, offset: offsetInt, limit: limitInt }
      );
    } catch {
      // Fallback: regex search if full-text index not available
      const pattern = `(?i).*${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;
      rows = await this.connection.executeRead<any>(
        `MATCH (s:Scheme)
         WHERE s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern
         RETURN s
         ORDER BY toLower(s.name), s.scheme_id
         SKIP toInteger($offset)
         LIMIT toInteger($limit)`,
        { pattern, offset: offsetInt, limit: limitInt }
      );
    }
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, CacheTTL.SCHEME_SEARCH);
    return result;
  }

  async countSearchSchemes(query: string): Promise<number> {
    const normalized = (query || '').trim();
    if (!normalized) return this.getSchemeCount();

    const cacheKey = `schemes:search_count:${normalized}`;
    const cached = await redisService.get<number>(cacheKey);
    if (cached != null) return cached;

    let count = 0;
    try {
      const ftQuery = normalized.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').trim();
      const rows = await this.connection.executeRead<{ cnt: number }>(
        `CALL db.index.fulltext.queryNodes('scheme_fulltext', $query)
         YIELD node AS s
         RETURN count(s) AS cnt`,
        { query: `${ftQuery}~` }
      );
      count = Number(rows[0]?.cnt) || 0;
    } catch {
      const pattern = `(?i).*${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;
      const rows = await this.connection.executeRead<{ cnt: number }>(
        `MATCH (s:Scheme)
         WHERE s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern
         RETURN count(s) AS cnt`,
        { pattern }
      );
      count = Number(rows[0]?.cnt) || 0;
    }

    await redisService.set(cacheKey, count, CacheTTL.CATEGORIES);
    return count;
  }

  /**
   * Search schemes with optional state filter (used by agent tools)
   */
  async searchSchemesWithFilter(query: string, state?: string, limit = 20): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    if (!query) return this.getAllSchemes(limitInt);

    const cacheKey = `schemes:search:${query}:${state || 'all'}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    let rows: any[];
    try {
      const ftQuery = query.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').trim();
      if (state) {
        rows = await this.connection.executeRead<any>(
          `CALL db.index.fulltext.queryNodes('scheme_fulltext', $query)
           YIELD node AS s, score
           WHERE s.state = $state OR s.state IS NULL OR s.state = ''
           RETURN s ORDER BY score DESC LIMIT toInteger($limit)`,
          { query: `${ftQuery}~`, state, limit: limitInt }
        );
      } else {
        rows = await this.connection.executeRead<any>(
          `CALL db.index.fulltext.queryNodes('scheme_fulltext', $query)
           YIELD node AS s, score
           RETURN s ORDER BY score DESC LIMIT toInteger($limit)`,
          { query: `${ftQuery}~`, limit: limitInt }
        );
      }
    } catch {
      // Fallback: regex search
      const pattern = `(?i).*${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;
      if (state) {
        rows = await this.connection.executeRead<any>(
          `MATCH (s:Scheme)
           WHERE (s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern)
             AND (s.state = $state OR s.state IS NULL OR s.state = '')
           RETURN s LIMIT toInteger($limit)`,
          { pattern, state, limit: limitInt }
        );
      } else {
        rows = await this.connection.executeRead<any>(
          `MATCH (s:Scheme)
           WHERE s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern
           RETURN s LIMIT toInteger($limit)`,
          { pattern, limit: limitInt }
        );
      }
    }

    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, CacheTTL.SCHEME_SEARCH);
    return result;
  }

  async findSchemesByCategories(categories: CategoryMapping[], limit = 20): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    if (categories.length === 0) return this.getAllSchemes(limitInt);

    const cacheKey = `schemes:cats:${JSON.stringify(categories)}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    const cats = categories.map((c) => ({ type: c.type, value: c.value }));
    // Rank schemes by number of matching categories (more matches = better)
    const rows = await this.connection.executeRead<any>(
      `UNWIND $cats AS cat
       MATCH (c:Category)
       WHERE c.type = cat.type AND (c.value = cat.value OR c.value = 'Any')
       MATCH (s:Scheme)-[:HAS_CATEGORY]->(c)
       WITH s, count(DISTINCT c) AS matchCount
       RETURN s ORDER BY matchCount DESC
       LIMIT toInteger($limit)`,
      { cats, limit: limitInt }
    );
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, CacheTTL.SCHEME_SEARCH);
    return result;
  }

  async getAllCategories(): Promise<Record<string, string[]>> {
    const cached = await redisService.get<Record<string, string[]>>('categories:all');
    if (cached) return cached;

    const rows = await this.connection.executeRead<{ type: string; values: string[] }>(
      `MATCH (c:Category)
       RETURN c.type AS type, collect(DISTINCT c.value) AS values
       ORDER BY c.type`
    );
    const categories: Record<string, string[]> = {};
    for (const r of rows) categories[r.type] = r.values;
    await redisService.set('categories:all', categories, CacheTTL.CATEGORIES);
    return categories;
  }

  /** Graph traversal: find schemes for a user via UserGroup + Category relationships */
  async findSchemesForUser(userId: string, limit = 20): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    const cacheKey = `schemes:user:${userId}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    // Combine both UserGroup-based and Category-based matching, ranked by relevance
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })
       OPTIONAL MATCH (u)-[:BELONGS_TO]->(ug:UserGroup)<-[:TARGETS]-(s1:Scheme)
       OPTIONAL MATCH (u)-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(s2:Scheme)
       WITH collect(DISTINCT s1) + collect(DISTINCT s2) AS allSchemes
       UNWIND allSchemes AS s
       WITH s WHERE s IS NOT NULL
       RETURN DISTINCT s LIMIT toInteger($limit)`,
      { userId, limit: limitInt }
    );
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, CacheTTL.RECOMMENDATIONS);
    return result;
  }

  // ─── Conversion helpers ─────────────────────────────────────────────────────

  private nodeToSchemeRow(node: any): SchemeRow {
    // executeRead with disableLosslessIntegers returns plain objects
    const p = node.properties ?? node;
    return {
      scheme_id: p.scheme_id,
      name: p.name ?? '',
      description: p.description ?? '',
      category: p.category ?? '[]',
      ministry: p.ministry || null,
      tags: p.tags ?? '[]',
      state: p.state || null,
      categories_json: p.categories_json ?? '[]',
      scheme_url: p.scheme_url ?? null,
      page_scheme_id: p.page_scheme_id || null,
      page_title: p.page_title || null,
      page_ministry: p.page_ministry || null,
      page_description: p.page_description || null,
      page_eligibility_json: p.page_eligibility_json ?? '[]',
      page_benefits_json: p.page_benefits_json ?? '[]',
      page_enriched_at: p.page_enriched_at || null,
      last_updated: p.last_updated?.toString?.() || new Date().toISOString(),
    };
  }

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
      pageDetails: {
        schemeId: row.page_scheme_id ?? null,
        title: row.page_title ?? null,
        ministry: row.page_ministry ?? null,
        description: row.page_description ?? null,
        eligibility: JSON.parse(row.page_eligibility_json ?? '[]') as string[],
        benefits: JSON.parse(row.page_benefits_json ?? '[]') as string[],
        enrichedAt: row.page_enriched_at ?? null,
      },
    };
  }

  // ─── User CRUD ───────────────────────────────────────────────────────────────

  async createUser(user: {
    userId: string;
    email: string;
    password: string;
    name?: string;
    age?: number;
    income?: string;
    state?: string;
    gender?: string;
  }): Promise<void> {
    const pii = await encryptPII({
      email: user.email,
      name: user.name ?? '',
    });

    await this.connection.executeWrite(
      `CREATE (u:User {
         user_id: $userId, email: $email, email_hash: $emailHash, password: $password,
         name: $name, age: $age, income: $income, state: $state, gender: $gender,
         employment: '', education: '', interests: '',
         onboarding_complete: false,
         created_at: toString(datetime())
       })`,
      {
        userId: user.userId,
        email: pii.email,
        emailHash: pii.email_hash,
        password: user.password,
        name: pii.name,
        age: user.age ?? 0,
        income: user.income ?? '',
        state: user.state ?? '',
        gender: user.gender ?? '',
      }
    );
    // Auto-assign UserGroups
    await this.autoAssignUserToGroups(user.userId, user);
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    const hash = emailHash(email);
    // Try hash-based lookup first (encrypted users)
    let rows = await this.connection.executeRead<any>(
      'MATCH (u:User { email_hash: $hash }) RETURN u',
      { hash }
    );
    // Fall back to plain email lookup (backward compat for pre-encryption users)
    if (rows.length === 0) {
      rows = await this.connection.executeRead<any>('MATCH (u:User { email: $email }) RETURN u', {
        email,
      });
    }
    if (rows.length === 0) return undefined;
    return await this.nodeToUser(rows[0].u);
  }

  async getUserById(userId: string): Promise<any | undefined> {
    const cacheKey = `user:${userId}`;
    const cached = await redisService.get<any>(cacheKey);
    if (cached) return cached;

    const rows = await this.connection.executeRead<any>(
      'MATCH (u:User { user_id: $userId }) RETURN u',
      { userId }
    );
    if (rows.length === 0) return undefined;
    const user = await this.nodeToUser(rows[0].u);
    await redisService.set(cacheKey, user, CacheTTL.USER_PROFILE);
    return user;
  }

  async getAllUsers(): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      'MATCH (u:User) RETURN u ORDER BY u.created_at DESC'
    );
    return Promise.all(rows.map((r: any) => this.nodeToUser(r.u)));
  }

  async updateUserProfile(userId: string, fields: Record<string, any>): Promise<void> {
    const allowed = [
      'name',
      'age',
      'income',
      'state',
      'gender',
      'employment',
      'education',
      'interests',
      'onboarding_complete',
    ];
    const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return;

    // Encrypt name if it's being updated
    const enc = getEnc();
    const processedUpdates = await Promise.all(
      updates.map(async ([k, v]) => {
        if (k === 'name' && enc && typeof v === 'string') {
          return [k, await enc.encrypt(v)] as [string, any];
        }
        return [k, v] as [string, any];
      })
    );

    const setClauses = processedUpdates.map(([k]) => `u.${k} = $${k}`).join(', ');
    const params: Record<string, any> = { userId };
    for (const [k, v] of processedUpdates) params[k] = v;

    await this.connection.executeWrite(
      `MATCH (u:User { user_id: $userId }) SET ${setClauses}, u.updated_at = toString(datetime())`,
      params
    );

    // Re-assign UserGroups
    const userRows = await this.connection.executeRead<any>(
      'MATCH (u:User { user_id: $userId }) RETURN u',
      { userId }
    );
    if (userRows.length > 0) {
      await this.autoAssignUserToGroups(userId, await this.nodeToUser(userRows[0].u));
    }

    await redisService.del(`user:${userId}`);
    await redisService.delPattern(`schemes:user:${userId}:*`);
    await redisService.delPattern(`recommendations:${userId}:*`);
  }
  /** Auto-assign a user to UserGroups based on profile */
  private async autoAssignUserToGroups(userId: string, profile: any): Promise<void> {
    // Clear old relationships
    await this.connection.executeWrite(
      'MATCH (u:User { user_id: $userId })-[r:BELONGS_TO]->(ug:UserGroup) DELETE r',
      { userId }
    );

    const groupNames: string[] = [];
    if ((profile.gender || '').toLowerCase() === 'female') groupNames.push('Women');
    const age = Number(profile.age) || 0;
    if (age >= 60) groupNames.push('Senior Citizen');
    if (age >= 18 && age <= 25) groupNames.push('Student');
    const emp = (profile.employment || '').toLowerCase();
    if (emp.includes('self')) groupNames.push('MSME / Self-employed');
    if (emp.includes('student')) groupNames.push('Student');
    if (emp.includes('retired')) groupNames.push('Senior Citizen');
    if (emp.includes('farmer') || emp.includes('agriculture')) groupNames.push('Farmer');

    // Handle income: could be number or descriptive string
    const income = profile.income;
    if (typeof income === 'number') {
      // Numeric income thresholds (annual income in INR)
      if (income < 100000) groupNames.push('Low Income Worker');
    } else if (typeof income === 'string') {
      const inc = income.toLowerCase();
      if (inc.includes('below') || inc.includes('bpl') || inc.includes('low'))
        groupNames.push('Low Income Worker');
    }

    const unique = [...new Set(groupNames)];
    if (unique.length > 0) {
      await this.connection.executeWrite(
        `MATCH (u:User { user_id: $userId })
         UNWIND $names AS gName
         MATCH (ug:UserGroup { name: gName })
         MERGE (u)-[:BELONGS_TO]->(ug)`,
        { userId, names: unique }
      );
    }

    // Also create User→Category edges
    const cats: { type: string; value: string }[] = [];
    if (profile.gender) cats.push({ type: 'Gender', value: profile.gender });
    if (profile.income) cats.push({ type: 'Income', value: profile.income });
    if (profile.employment) cats.push({ type: 'Employment', value: profile.employment });
    if (profile.education) cats.push({ type: 'Education', value: profile.education });

    // Remove old HAS_CATEGORY from user
    await this.connection.executeWrite(
      'MATCH (u:User { user_id: $userId })-[r:HAS_CATEGORY]->(c:Category) DELETE r',
      { userId }
    );
    if (cats.length > 0) {
      await this.connection.executeWrite(
        `MATCH (u:User { user_id: $userId })
         UNWIND $cats AS cat
         MERGE (c:Category { type: cat.type, value: cat.value })
         MERGE (u)-[:HAS_CATEGORY]->(c)`,
        { userId, cats }
      );
    }
  }

  private async nodeToUser(node: any): Promise<any> {
    const p = node.properties ?? node;
    const raw = {
      user_id: p.user_id,
      email: p.email,
      password: p.password,
      name: p.name || null,
      age: p.age != null ? Number(p.age) : null,
      income: p.income || null,
      state: p.state || null,
      gender: p.gender || null,
      employment: p.employment || null,
      education: p.education || null,
      interests: p.interests || null,
      onboarding_complete: p.onboarding_complete ? 1 : 0,
      created_at: p.created_at?.toString?.() || null,
    };
    return decryptPII(raw);
  }

  // ─── Graph-specific queries ────────────────────────────────────────────────

  async getUserGroups(userId: string): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })-[:BELONGS_TO]->(ug:UserGroup) RETURN ug`,
      { userId }
    );
    return rows.map((r: any) => r.ug.properties ?? r.ug);
  }

  async getAllUserGroups(): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (ug:UserGroup)
       OPTIONAL MATCH (u:User)-[:BELONGS_TO]->(ug)
       RETURN ug, count(u) AS member_count ORDER BY ug.name`
    );
    return rows.map((r: any) => ({
      ...(r.ug.properties ?? r.ug),
      member_count: Number(r.member_count) || 0,
    }));
  }

  async checkGraphEligibility(
    userId: string,
    schemeId: string
  ): Promise<{
    eligible: boolean;
    matchedCategories: string[];
    score: number;
  }> {
    // Single query that checks both Category and UserGroup matches
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId }), (s:Scheme { scheme_id: $schemeId })
       OPTIONAL MATCH (u)-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(s)
       WITH u, s, collect(DISTINCT c.type + ': ' + c.value) AS matched
       OPTIONAL MATCH (u)-[:BELONGS_TO]->(ug:UserGroup)<-[:TARGETS]-(s)
       RETURN matched, count(DISTINCT ug) AS ugMatches`,
      { userId, schemeId }
    );
    const matched: string[] = (rows[0]?.matched || []).filter((m: string) => m !== 'null: null');
    const ugMatches = Number(rows[0]?.ugMatches) || 0;
    const score = Math.min(100, matched.length * 15 + ugMatches * 20);
    return { eligible: score > 30, matchedCategories: matched, score };
  }

  // ─── Graceful close ─────────────────────────────────────────────────────────

  async close(): Promise<void> {
    await redisService.close();
    if (this.connection) {
      await this.connection.close();
    }
    console.log('Neo4j + Redis connections closed');
  }
}

export const neo4jService = new Neo4jDbService();

// Legacy alias so old imports still work
export { neo4jService as dbService };
