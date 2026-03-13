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

function computeSchemeSourceHash(scheme: {
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
  page_references_json?: string;
  page_application_process_json?: string;
  page_eligibility_md?: string | null;
  page_benefits_md?: string | null;
  page_description_md?: string | null;
  page_exclusions_md?: string | null;
  page_scheme_raw_json?: string;
  page_enriched_at?: string | null;
}): string {
  const normalized = {
    name: scheme.name || '',
    description: scheme.description || '',
    category: [...(scheme.category || [])].map(String).sort(),
    ministry: scheme.ministry || '',
    tags: [...(scheme.tags || [])].map(String).sort(),
    state: scheme.state || '',
    schemeUrl: scheme.schemeUrl || '',
    page_scheme_id: scheme.page_scheme_id || '',
    page_title: scheme.page_title || '',
    page_ministry: scheme.page_ministry || '',
    page_description: scheme.page_description || '',
    page_eligibility_json: scheme.page_eligibility_json || '[]',
    page_benefits_json: scheme.page_benefits_json || '[]',
    page_references_json: scheme.page_references_json || '[]',
    page_application_process_json: scheme.page_application_process_json || '[]',
    page_eligibility_md: scheme.page_eligibility_md || '',
    page_benefits_md: scheme.page_benefits_md || '',
    page_description_md: scheme.page_description_md || '',
    page_exclusions_md: scheme.page_exclusions_md || '',
    page_scheme_raw_json: scheme.page_scheme_raw_json || '{}',
    page_enriched_at: scheme.page_enriched_at || '',
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
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
  page_references_json?: string;
  page_application_process_json?: string;
  page_eligibility_md?: string | null;
  page_benefits_md?: string | null;
  page_description_md?: string | null;
  page_exclusions_md?: string | null;
  page_scheme_raw_json?: string;
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
      page_references_json?: string;
      page_application_process_json?: string;
      page_eligibility_md?: string | null;
      page_benefits_md?: string | null;
      page_description_md?: string | null;
      page_exclusions_md?: string | null;
      page_scheme_raw_json?: string;
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
          page_references_json: s.page_references_json ?? '[]',
          page_application_process_json: s.page_application_process_json ?? '[]',
          page_eligibility_md: s.page_eligibility_md ?? '',
          page_benefits_md: s.page_benefits_md ?? '',
          page_description_md: s.page_description_md ?? '',
          page_exclusions_md: s.page_exclusions_md ?? '',
          page_scheme_raw_json: s.page_scheme_raw_json ?? '{}',
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
           page_references_json: row.page_references_json,
           page_application_process_json: row.page_application_process_json,
           page_eligibility_md: row.page_eligibility_md,
           page_benefits_md: row.page_benefits_md,
           page_description_md: row.page_description_md,
           page_exclusions_md: row.page_exclusions_md,
           page_scheme_raw_json: row.page_scheme_raw_json,
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
      page_references_json?: string;
      page_application_process_json?: string;
      page_eligibility_md?: string | null;
      page_benefits_md?: string | null;
      page_description_md?: string | null;
      page_exclusions_md?: string | null;
      page_scheme_raw_json?: string;
      page_enriched_at?: string | null;
    }[],
    syncRunId: string
  ): Promise<{ inserted: number; updated: number; unchanged: number; changedSchemeIds: string[] }> {
    if (!schemes.length) {
      return { inserted: 0, updated: 0, unchanged: 0, changedSchemeIds: [] };
    }

    const seen = new Set<string>();
    const uniqueSchemes = schemes.filter((s) => {
      if (seen.has(s.schemeId)) return false;
      seen.add(s.schemeId);
      return true;
    });

    const nowIso = new Date().toISOString();
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
        page_references_json: s.page_references_json ?? '[]',
        page_application_process_json: s.page_application_process_json ?? '[]',
        page_eligibility_md: s.page_eligibility_md ?? '',
        page_benefits_md: s.page_benefits_md ?? '',
        page_description_md: s.page_description_md ?? '',
        page_exclusions_md: s.page_exclusions_md ?? '',
        page_scheme_raw_json: s.page_scheme_raw_json ?? '{}',
        page_enriched_at: s.page_enriched_at ?? '',
        is_active: true,
        source_hash: computeSchemeSourceHash(s),
        sync_run_id: syncRunId,
        last_updated: nowIso,
        last_seen_at: nowIso,
      };
    });

    const summaryRows = await this.connection.executeWrite<{
      inserted: number;
      updated: number;
      unchanged: number;
      changedSchemeIds: string[];
    }>(
      `UNWIND $rows AS row
       MERGE (s:Scheme { scheme_id: row.scheme_id })
       WITH s, row, coalesce(s.source_hash, '') AS prev_hash
       SET s.is_active = row.is_active,
           s.last_seen_at = row.last_seen_at,
           s.last_seen_run = row.sync_run_id,
           s.deactivated_at = null
       FOREACH (_ IN CASE WHEN prev_hash <> row.source_hash THEN [1] ELSE [] END |
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
             s.page_references_json = row.page_references_json,
             s.page_application_process_json = row.page_application_process_json,
             s.page_eligibility_md = row.page_eligibility_md,
             s.page_benefits_md = row.page_benefits_md,
             s.page_description_md = row.page_description_md,
             s.page_exclusions_md = row.page_exclusions_md,
             s.page_scheme_raw_json = row.page_scheme_raw_json,
             s.page_enriched_at = row.page_enriched_at,
             s.source_hash = row.source_hash,
             s.last_updated = row.last_updated
       )
       RETURN
         sum(CASE WHEN prev_hash = '' THEN 1 ELSE 0 END) AS inserted,
         sum(CASE WHEN prev_hash <> '' AND prev_hash <> row.source_hash THEN 1 ELSE 0 END) AS updated,
         sum(CASE WHEN prev_hash <> '' AND prev_hash = row.source_hash THEN 1 ELSE 0 END) AS unchanged,
         [sid IN collect(CASE WHEN prev_hash = '' OR prev_hash <> row.source_hash THEN row.scheme_id ELSE NULL END) WHERE sid IS NOT NULL] AS changedSchemeIds`,
      { rows }
    );

    await this.createCategoryRelationships(uniqueSchemes);

    const summary = summaryRows[0] || { inserted: 0, updated: 0, unchanged: 0 };
    return {
      inserted: Number(summary.inserted) || 0,
      updated: Number(summary.updated) || 0,
      unchanged: Number(summary.unchanged) || 0,
      changedSchemeIds: Array.isArray(summary.changedSchemeIds)
        ? summary.changedSchemeIds.map((sid) => String(sid)).filter((sid) => sid.length > 0)
        : [],
    };
  }

  /**
   * Finalize incremental sync by linking groups, updating sync meta and clearing caches.
   */
  private async invalidateSchemeCaches(
    changedSchemeIds: string[],
    deactivatedSchemeIds: string[]
  ): Promise<void> {
    const impacted = Array.from(
      new Set([...changedSchemeIds, ...deactivatedSchemeIds].map((sid) => String(sid).trim()))
    ).filter((sid) => sid.length > 0);

    for (const schemeId of impacted) {
      await redisService.del(`schemes:id:${schemeId}`);
    }

    await redisService.del('schemes:count');
    await redisService.del('schemes:count:enriched');
    await redisService.del('categories:all');

    if (impacted.length > 0) {
      await redisService.delPattern('schemes:all:*');
      await redisService.delPattern('schemes:search:*');
      await redisService.delPattern('schemes:search_count:*');
      await redisService.delPattern('schemes:cats:*');
      await redisService.delPattern('schemes:user:*');
    }
  }

  async finalizeIncrementalSchemeSync(
    totalSchemes: number,
    syncRunId: string,
    changedSchemeIds: string[]
  ): Promise<void> {
    const deactivatedAt = new Date().toISOString();
    const staleRows = await this.connection.executeWrite<{ deactivatedSchemeIds: string[] }>(
      `MATCH (s:Scheme)
       WHERE coalesce(s.last_seen_run, '') <> $syncRunId
         AND coalesce(s.is_active, true) = true
       WITH collect(s) AS stale, collect(s.scheme_id) AS staleIds
       FOREACH (n IN stale |
         SET n.is_active = false,
             n.deactivated_at = $deactivatedAt)
       RETURN [sid IN staleIds WHERE sid IS NOT NULL] AS deactivatedSchemeIds`,
      { syncRunId, deactivatedAt }
    );

    const deactivatedSchemeIds = Array.isArray(staleRows[0]?.deactivatedSchemeIds)
      ? staleRows[0].deactivatedSchemeIds.map((sid) => String(sid))
      : [];

    await this.autoLinkSchemesToUserGroups();
    await this.updateSyncMeta(totalSchemes);
    await this.invalidateSchemeCaches(changedSchemeIds, deactivatedSchemeIds);
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
      'MATCH (s:Scheme) WHERE coalesce(s.is_active, true) = true RETURN count(s) AS cnt'
    );
    const cnt = Number(rows[0]?.cnt) || 0;
    await redisService.set('schemes:count', cnt, CacheTTL.CATEGORIES);
    return cnt;
  }

  async getEnrichedSchemeCount(): Promise<number> {
    const cached = await redisService.get<number>('schemes:count:enriched');
    if (cached != null) return cached;

    const rows = await this.connection.executeRead<{ cnt: number }>(
      `MATCH (s:Scheme)
       WHERE coalesce(s.is_active, true) = true
         AND (coalesce(s.page_scheme_id, '') <> '' OR coalesce(s.page_enriched_at, '') <> '')
       RETURN count(s) AS cnt`
    );
    const cnt = Number(rows[0]?.cnt) || 0;
    await redisService.set('schemes:count:enriched', cnt, CacheTTL.CATEGORIES);
    return cnt;
  }

  async getGramPanchayatCount(): Promise<number> {
    const rows = await this.connection.executeRead<{ cnt: number }>(
      'MATCH (g:GramPanchayat) RETURN count(g) AS cnt'
    );
    return Number(rows[0]?.cnt) || 0;
  }

  async getAdminMetrics(): Promise<{
    users: {
      total: number;
      onboarded: number;
      updatedProfiles: number;
    };
    schemes: {
      total: number;
      enriched: number;
      withEligibility: number;
      withBenefits: number;
      enrichmentRate: number;
    };
    trends: {
      users: Array<{ date: string; count: number }>;
      sync: Array<{ date: string; synced: number; enriched: number }>;
    };
  }> {
    const today = new Date();
    const dateKeys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dateKeys.push(d.toISOString().slice(0, 10));
    }
    const fromDate = dateKeys[0];

    const [userRows, schemeRows] = await Promise.all([
      this.connection.executeRead<{
        totalUsers: number;
        onboardedUsers: number;
        updatedProfiles: number;
      }>(
        `MATCH (u:User)
         RETURN
           count(u) AS totalUsers,
           sum(CASE WHEN coalesce(u.onboarding_complete, false) = true THEN 1 ELSE 0 END) AS onboardedUsers,
           sum(CASE WHEN coalesce(u.updated_at, '') <> '' THEN 1 ELSE 0 END) AS updatedProfiles`
      ),
      this.connection.executeRead<{
        totalSchemes: number;
        enrichedSchemes: number;
        withEligibility: number;
        withBenefits: number;
      }>(
        `MATCH (s:Scheme)
         RETURN
           count(s) AS totalSchemes,
           sum(CASE WHEN coalesce(s.page_scheme_id, '') <> '' OR coalesce(s.page_enriched_at, '') <> '' THEN 1 ELSE 0 END) AS enrichedSchemes,
           sum(CASE WHEN coalesce(s.page_eligibility_json, '[]') <> '[]' THEN 1 ELSE 0 END) AS withEligibility,
           sum(CASE WHEN coalesce(s.page_benefits_json, '[]') <> '[]' THEN 1 ELSE 0 END) AS withBenefits`
      ),
    ]);

    const [userTrendRows, syncTrendRows] = await Promise.all([
      this.connection.executeRead<{ date: string; count: number }>(
        `MATCH (u:User)
         WHERE coalesce(u.created_at, '') <> ''
           AND substring(u.created_at, 0, 10) >= $fromDate
         RETURN substring(u.created_at, 0, 10) AS date, count(u) AS count
         ORDER BY date ASC`,
        { fromDate }
      ),
      this.connection.executeRead<{ date: string; synced: number; enriched: number }>(
        `MATCH (s:Scheme)
         WHERE coalesce(s.updated_at, s.last_updated, '') <> ''
           AND substring(coalesce(s.updated_at, s.last_updated), 0, 10) >= $fromDate
         RETURN
           substring(coalesce(s.updated_at, s.last_updated), 0, 10) AS date,
           count(s) AS synced,
           sum(CASE WHEN coalesce(s.page_enriched_at, '') <> '' THEN 1 ELSE 0 END) AS enriched
         ORDER BY date ASC`,
        { fromDate }
      ),
    ]);

    const userTrendMap = new Map<string, number>();
    userTrendRows.forEach((row) => {
      userTrendMap.set(String(row.date), Number(row.count) || 0);
    });

    const syncTrendMap = new Map<string, { synced: number; enriched: number }>();
    syncTrendRows.forEach((row) => {
      syncTrendMap.set(String(row.date), {
        synced: Number(row.synced) || 0,
        enriched: Number(row.enriched) || 0,
      });
    });

    const users = userRows[0] || { totalUsers: 0, onboardedUsers: 0, updatedProfiles: 0 };
    const schemes = schemeRows[0] || {
      totalSchemes: 0,
      enrichedSchemes: 0,
      withEligibility: 0,
      withBenefits: 0,
    };

    const totalSchemes = Number(schemes.totalSchemes) || 0;
    const enrichedSchemes = Number(schemes.enrichedSchemes) || 0;

    return {
      users: {
        total: Number(users.totalUsers) || 0,
        onboarded: Number(users.onboardedUsers) || 0,
        updatedProfiles: Number(users.updatedProfiles) || 0,
      },
      schemes: {
        total: totalSchemes,
        enriched: enrichedSchemes,
        withEligibility: Number(schemes.withEligibility) || 0,
        withBenefits: Number(schemes.withBenefits) || 0,
        enrichmentRate:
          totalSchemes > 0 ? Math.round((enrichedSchemes / totalSchemes) * 1000) / 10 : 0,
      },
      trends: {
        users: dateKeys.map((date) => ({
          date,
          count: userTrendMap.get(date) || 0,
        })),
        sync: dateKeys.map((date) => {
          const values = syncTrendMap.get(date) || { synced: 0, enriched: 0 };
          return {
            date,
            synced: values.synced,
            enriched: values.enriched,
          };
        }),
      },
    };
  }

  async getAllSchemes(limit = 5000, offset = 0): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    const offsetInt = Math.max(0, Math.floor(Number(offset) || 0));
    const cacheKey = `schemes:all:${offsetInt}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.connection.executeRead<any>(
      `MATCH (s:Scheme)
       WHERE coalesce(s.is_active, true) = true
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
      'MATCH (s:Scheme { scheme_id: $schemeId }) WHERE coalesce(s.is_active, true) = true RETURN s',
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
         WHERE coalesce(s.is_active, true) = true
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
         WHERE coalesce(s.is_active, true) = true
           AND (s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern)
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
         WHERE coalesce(s.is_active, true) = true
         RETURN count(s) AS cnt`,
        { query: `${ftQuery}~` }
      );
      count = Number(rows[0]?.cnt) || 0;
    } catch {
      const pattern = `(?i).*${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;
      const rows = await this.connection.executeRead<{ cnt: number }>(
        `MATCH (s:Scheme)
         WHERE coalesce(s.is_active, true) = true
           AND (s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern)
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
           WHERE coalesce(s.is_active, true) = true
             AND (s.state = $state OR s.state IS NULL OR s.state = '')
           RETURN s ORDER BY score DESC LIMIT toInteger($limit)`,
          { query: `${ftQuery}~`, state, limit: limitInt }
        );
      } else {
        rows = await this.connection.executeRead<any>(
          `CALL db.index.fulltext.queryNodes('scheme_fulltext', $query)
           YIELD node AS s, score
           WHERE coalesce(s.is_active, true) = true
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
           WHERE coalesce(s.is_active, true) = true
             AND (s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern)
             AND (s.state = $state OR s.state IS NULL OR s.state = '')
           RETURN s LIMIT toInteger($limit)`,
          { pattern, state, limit: limitInt }
        );
      } else {
        rows = await this.connection.executeRead<any>(
          `MATCH (s:Scheme)
           WHERE coalesce(s.is_active, true) = true
             AND (s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern)
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
       WHERE coalesce(s.is_active, true) = true
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
         WHERE coalesce(s1.is_active, true) = true
       OPTIONAL MATCH (u)-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(s2:Scheme)
         WHERE coalesce(s2.is_active, true) = true
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
      page_references_json: p.page_references_json ?? '[]',
      page_application_process_json: p.page_application_process_json ?? '[]',
      page_eligibility_md: p.page_eligibility_md || null,
      page_benefits_md: p.page_benefits_md || null,
      page_description_md: p.page_description_md || null,
      page_exclusions_md: p.page_exclusions_md || null,
      page_scheme_raw_json: p.page_scheme_raw_json ?? '{}',
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
        references: JSON.parse(row.page_references_json ?? '[]') as Array<{
          title: string;
          url: string;
        }>,
        applicationProcess: JSON.parse(row.page_application_process_json ?? '[]') as Array<{
          mode: string;
          steps: string[];
          markdown: string;
        }>,
        eligibilityMarkdown: row.page_eligibility_md ?? null,
        benefitsMarkdown: row.page_benefits_md ?? null,
        descriptionMarkdown: row.page_description_md ?? null,
        exclusionsMarkdown: row.page_exclusions_md ?? null,
        raw: JSON.parse(row.page_scheme_raw_json ?? '{}') as Record<string, any>,
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
    isAdmin?: boolean;
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
        is_admin: $isAdmin,
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
        isAdmin: Boolean(user.isAdmin),
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

  async getUsersByState(state: string): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User)
       WHERE toLower(coalesce(u.state, '')) = toLower($state)
       RETURN u ORDER BY u.created_at DESC`,
      { state }
    );
    return Promise.all(rows.map((r: any) => this.nodeToUser(r.u)));
  }

  async getUsersByPanchayatScoped(
    panchayatId: string,
    state: string,
    district: string,
    panchayatName: string
  ): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User)
       WHERE u.registered_by_panchayat = $panchayatId
          OR (
            $panchayatName <> '' AND
            toLower(coalesce(u.state, '')) = toLower($state) AND
            toLower(coalesce(u.district, '')) = toLower($district) AND
            toLower(coalesce(u.panchayat_name, '')) = toLower($panchayatName)
          )
       RETURN u ORDER BY u.created_at DESC`,
      { panchayatId, state, district, panchayatName }
    );
    return Promise.all(rows.map((r: any) => this.nodeToUser(r.u)));
  }

  async updateUserProfile(userId: string, fields: Record<string, any>): Promise<void> {
    const allowed = [
      'name',
      'date_of_birth',
      'age',
      'income',
      'state',
      'gender',
      'employment',
      'education',
      'interests',
      'onboarding_complete',
      'social_category',
      'is_disabled',
      'is_minority',
      'marital_status',
      'family_size',
      'rural_urban',
      'occupation',
      'poverty_status',
      'ration_card',
      'land_ownership',
      'district',
      'subdistrict',
      'disability_type',
      'minority_community',
      'is_admin',
      'registered_by_panchayat',
      'panchayat_name',
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

  async deleteUserById(userId: string): Promise<boolean> {
    const rows = await this.connection.executeRead<any>(
      'MATCH (u:User { user_id: $userId }) RETURN u LIMIT 1',
      { userId }
    );

    if (rows.length === 0) {
      return false;
    }

    await this.connection.executeWrite('MATCH (u:User { user_id: $userId }) DETACH DELETE u', {
      userId,
    });

    await redisService.del(`user:${userId}`);
    await redisService.delPattern(`schemes:user:${userId}:*`);
    await redisService.delPattern(`recommendations:${userId}:*`);

    return true;
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
    const normalizedPanchayatName = p.panchayat_name || p.panchayatName || p.village || null;
    const raw = {
      user_id: p.user_id,
      email: p.email,
      password: p.password,
      name: p.name || null,
      date_of_birth: p.date_of_birth?.toString?.() || p.date_of_birth || null,
      age: p.age != null ? Number(p.age) : null,
      income: p.income || null,
      state: p.state || null,
      gender: p.gender || null,
      employment: p.employment || null,
      education: p.education || null,
      interests: p.interests || null,
      social_category: p.social_category || null,
      is_disabled: Boolean(p.is_disabled),
      is_minority: Boolean(p.is_minority),
      marital_status: p.marital_status || null,
      family_size: p.family_size != null ? Number(p.family_size) : null,
      rural_urban: p.rural_urban || null,
      occupation: p.occupation || null,
      poverty_status: p.poverty_status || null,
      ration_card: p.ration_card || null,
      land_ownership: p.land_ownership || null,
      district: p.district || null,
      village: p.village || normalizedPanchayatName,
      panchayat_name: normalizedPanchayatName,
      panchayatName: normalizedPanchayatName,
      disability_type: p.disability_type || null,
      minority_community: p.minority_community || null,
      is_admin: Boolean(p.is_admin),
      onboarding_complete: p.onboarding_complete ? 1 : 0,
      created_at: p.created_at?.toString?.() || null,
      updated_at: p.updated_at?.toString?.() || null,
    };
    return decryptPII(raw);
  }

  async listAdminUsers(): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User)
       WHERE coalesce(u.is_admin, false) = true OR u.user_id = 'admin123' OR u.email = 'admin@example.com'
       RETURN u
       ORDER BY u.created_at DESC`
    );
    return Promise.all(rows.map((r: any) => this.nodeToUser(r.u)));
  }

  async createAdminUser(input: { email: string; password: string; name?: string }): Promise<any> {
    const existing = await this.getUserByEmail(input.email);
    if (existing) {
      throw new Error('Admin user with this email already exists');
    }

    const userId = `admin_${Date.now()}`;
    await this.createUser({
      userId,
      email: input.email,
      password: input.password,
      name: input.name || 'Admin User',
      isAdmin: true,
    });

    await this.updateUserProfile(userId, {
      onboarding_complete: true,
      is_admin: true,
    });

    return this.getUserById(userId);
  }

  async deleteAdminUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;

    const isAdmin =
      Boolean(user.is_admin) || user.user_id === 'admin123' || user.email === 'admin@example.com';
    if (!isAdmin) return false;

    // Safety rule: do not allow admin deletion when total admins are below 2.
    const admins = await this.listAdminUsers();
    if (admins.length < 2) {
      throw new Error('Cannot delete admin account while total admin accounts are below 2');
    }

    return this.deleteUserById(userId);
  }

  // ─── Panchayat Users ────────────────────────────────────────────────────────

  async createPanchayatUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    panchayatName: string;
    district: string;
    state: string;
  }): Promise<any> {
    const existing = await this.getPanchayatUserByEmail(input.email);
    if (existing) {
      throw new Error('Panchayat user with this email already exists');
    }

    const userId = `panchayat_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await this.connection.executeWrite(
      `CREATE (p:PanchayatUser {
         user_id: $userId,
         email: $email,
         email_hash: $emailHash,
         password_hash: $passwordHash,
         name: $name,
         panchayat_name: $panchayatName,
         district: $district,
         state: $state,
         created_at: toString(datetime())
       })`,
      {
        userId,
        email: input.email,
        emailHash: emailHash(input.email),
        passwordHash: input.passwordHash,
        name: input.name,
        panchayatName: input.panchayatName,
        district: input.district,
        state: input.state,
      }
    );

    return this.getPanchayatUserById(userId);
  }

  async listPanchayatNamesByLocation(state: string, district: string): Promise<string[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (p:PanchayatUser)
       WHERE toLower(coalesce(p.state, '')) = toLower($state)
         AND toLower(coalesce(p.district, '')) = toLower($district)
       RETURN DISTINCT p.panchayat_name AS name
       ORDER BY name`,
      { state, district }
    );
    return rows.map((r: any) => r.name).filter(Boolean);
  }

  /**
   * Returns official village/GP names for a given state+district,
   * sourced from the seeded GramPanchayat (LGD village) nodes.
   * Optionally filtered to a sub-district (block) for shorter lists.
   */
  async listGramPanchayats(
    state: string,
    district: string,
    subdistrict?: string
  ): Promise<string[]> {
    const query = subdistrict
      ? `MATCH (g:GramPanchayat)
         WHERE toLower(g.state) = toLower($state)
           AND toLower(g.district) = toLower($district)
           AND toLower(g.subdistrict) = toLower($subdistrict)
         RETURN g.name AS name ORDER BY name`
      : `MATCH (g:GramPanchayat)
         WHERE toLower(g.state) = toLower($state)
           AND toLower(g.district) = toLower($district)
         RETURN g.name AS name ORDER BY name`;
    const rows = await this.connection.executeRead<any>(query, {
      state,
      district,
      subdistrict: subdistrict ?? '',
    });
    return rows.map((r: any) => r.name).filter(Boolean);
  }

  /**
   * Returns distinct sub-district (block) names for a state+district,
   * used to optionally add a block-level filter before showing villages.
   */
  async listSubdistricts(state: string, district: string): Promise<string[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (g:GramPanchayat)
       WHERE toLower(g.state) = toLower($state)
         AND toLower(g.district) = toLower($district)
       RETURN DISTINCT g.subdistrict AS name ORDER BY name`,
      { state, district }
    );
    return rows.map((r: any) => r.name).filter(Boolean);
  }

  /**
   * Idempotent bulk upsert of GramPanchayat (village) nodes from LGD data.
   */
  async bulkUpsertGramPanchayats(
    batch: Array<{
      lgd_code: string;
      name: string;
      subdistrict: string;
      subdistrict_code: string;
      district: string;
      district_lgd_code: string;
      state: string;
      state_lgd_code: string;
      pincode: string;
    }>
  ): Promise<void> {
    await this.connection.executeWrite(
      `UNWIND $batch AS v
       MERGE (g:GramPanchayat { lgd_code: v.lgd_code })
       SET g.name              = v.name,
           g.subdistrict       = v.subdistrict,
           g.subdistrict_code  = v.subdistrict_code,
           g.district          = v.district,
           g.district_lgd_code = v.district_lgd_code,
           g.state             = v.state,
           g.state_lgd_code    = v.state_lgd_code,
           g.pincode           = v.pincode`,
      { batch }
    );
  }

  async listPanchayatUsers(): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (p:PanchayatUser) RETURN p ORDER BY p.created_at DESC`
    );
    return rows.map((r: any) => {
      const n = r.p.properties ?? r.p;
      return {
        userId: n.user_id,
        email: n.email,
        name: n.name,
        panchayatName: n.panchayat_name,
        district: n.district,
        state: n.state,
        createdAt: n.created_at ?? null,
      };
    });
  }

  async getPanchayatUserByEmail(email: string): Promise<any | undefined> {
    const hash = emailHash(email);
    let rows = await this.connection.executeRead<any>(
      'MATCH (p:PanchayatUser { email_hash: $hash }) RETURN p',
      { hash }
    );
    if (rows.length === 0) {
      rows = await this.connection.executeRead<any>(
        'MATCH (p:PanchayatUser { email: $email }) RETURN p',
        { email }
      );
    }
    if (rows.length === 0) return undefined;
    const n = rows[0].p.properties ?? rows[0].p;
    return {
      userId: n.user_id,
      email: n.email,
      passwordHash: n.password_hash,
      name: n.name,
      panchayatName: n.panchayat_name,
      district: n.district,
      state: n.state,
      createdAt: n.created_at ?? null,
    };
  }

  async getPanchayatUserById(userId: string): Promise<any | undefined> {
    const rows = await this.connection.executeRead<any>(
      'MATCH (p:PanchayatUser { user_id: $userId }) RETURN p',
      { userId }
    );
    if (rows.length === 0) return undefined;
    const n = rows[0].p.properties ?? rows[0].p;
    return {
      userId: n.user_id,
      email: n.email,
      name: n.name,
      panchayatName: n.panchayat_name,
      district: n.district,
      state: n.state,
      createdAt: n.created_at ?? null,
    };
  }

  async deletePanchayatUser(userId: string): Promise<boolean> {
    const rows = await this.connection.executeRead<any>(
      'MATCH (p:PanchayatUser { user_id: $userId }) RETURN p LIMIT 1',
      { userId }
    );
    if (rows.length === 0) return false;

    await this.connection.executeWrite(
      'MATCH (p:PanchayatUser { user_id: $userId }) DETACH DELETE p',
      { userId }
    );
    return true;
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

  // ─── Nudge helpers (stubs — to be fully implemented with Nudge node model) ──

  async getNudgePreferences(_userId: string): Promise<{
    enabled: boolean;
    categories: string[];
    minEligibilityScore: number;
    maxPerWeek: number;
    channels: string[];
  }> {
    return {
      enabled: true,
      categories: [],
      minEligibilityScore: 70,
      maxPerWeek: 3,
      channels: ['in_app'],
    };
  }

  async countNudgesSince(userId: string, sinceIso: string): Promise<number> {
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })-[:HAS_NUDGE]->(n:Nudge)
       WHERE n.createdAt >= $sinceIso
       RETURN count(n) AS cnt`,
      { userId, sinceIso }
    );
    return Number(rows[0]?.cnt) || 0;
  }

  async hasRecentNudgeForScheme(
    userId: string,
    schemeId: string,
    type: string,
    withinDays: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinDays * 86400000).toISOString();
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })-[:HAS_NUDGE]->(n:Nudge { schemeId: $schemeId, type: $type })
       WHERE n.createdAt >= $since
       RETURN count(n) AS cnt`,
      { userId, schemeId, type, since }
    );
    return (Number(rows[0]?.cnt) || 0) > 0;
  }

  async createNudge(nudge: {
    userId: string;
    type: string;
    schemeId?: string;
    title: string;
    message: string;
    actionUrl?: string;
    priority: string;
    eligibilityScore?: number;
    channels: string[];
    expiresAt?: string;
  }): Promise<void> {
    await this.connection.executeWrite(
      `MATCH (u:User { user_id: $userId })
       CREATE (u)-[:HAS_NUDGE]->(n:Nudge {
         id: randomUUID(),
         type: $type,
         schemeId: $schemeId,
         title: $title,
         message: $message,
         actionUrl: $actionUrl,
         priority: $priority,
         eligibilityScore: $eligibilityScore,
         channels: $channels,
         read: false,
         createdAt: datetime().epochMillis,
         expiresAt: $expiresAt
       })`,
      {
        userId: nudge.userId,
        type: nudge.type,
        schemeId: nudge.schemeId ?? '',
        title: nudge.title,
        message: nudge.message,
        actionUrl: nudge.actionUrl ?? '',
        priority: nudge.priority,
        eligibilityScore: nudge.eligibilityScore ?? 0,
        channels: nudge.channels,
        expiresAt: nudge.expiresAt ?? '',
      }
    );
  }

  async getSchemesWithUpcomingDeadlines(daysAhead: number): Promise<SchemeRow[]> {
    const futureDate = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await this.connection.executeRead<any>(
      `MATCH (s:Scheme)
       WHERE s.applicationDeadline IS NOT NULL
         AND s.applicationDeadline >= $today
         AND s.applicationDeadline <= $futureDate
       RETURN properties(s) AS props
       ORDER BY s.applicationDeadline ASC`,
      { today, futureDate }
    );
    return rows.map((r: any) => r.props);
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
