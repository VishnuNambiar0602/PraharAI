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
import { redisService } from './redis.service';

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

function extractCategories(name: string, description: string, tags: string[]): CategoryMapping[] {
  const text = `${name} ${description} ${tags.join(' ')}`.toLowerCase();
  const categories: CategoryMapping[] = [];

  for (const [type, rules] of Object.entries(CATEGORY_RULES)) {
    for (const [value, keywords] of Object.entries(rules)) {
      if (keywords.length > 0 && keywords.some((kw) => text.includes(kw))) {
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
      { type: 'PovertyLine', value: 'Any' }
    );
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
      'CREATE INDEX category_type IF NOT EXISTS FOR (c:Category) ON (c.type)',
    ];
    for (const idx of indexes) {
      try {
        await this.connection.executeWrite(idx);
      } catch {
        /* may already exist */
      }
    }
    console.log('✅ Neo4j constraints and indexes ready');
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
    await redisService.set('sync_meta', meta, 300);
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
    await redisService.set('schemes:count', cnt, 600);
    return cnt;
  }

  async getAllSchemes(limit = 5000): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    const cacheKey = `schemes:all:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.connection.executeRead<any>('MATCH (s:Scheme) RETURN s LIMIT $limit', {
      limit: limitInt,
    });
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, 600);
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
    await redisService.set(cacheKey, row, 600);
    return row;
  }

  async searchSchemes(query: string, limit = 20): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    if (!query) return this.getAllSchemes(limitInt);

    const cacheKey = `schemes:search:${query}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    const pattern = `(?i).*${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;
    const rows = await this.connection.executeRead<any>(
      `MATCH (s:Scheme)
       WHERE s.name =~ $pattern OR s.description =~ $pattern OR s.tags =~ $pattern
       RETURN s LIMIT $limit`,
      { pattern, limit: limitInt }
    );
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, 300);
    return result;
  }

  async findSchemesByCategories(categories: CategoryMapping[], limit = 20): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    if (categories.length === 0) return this.getAllSchemes(limitInt);

    const cacheKey = `schemes:cats:${JSON.stringify(categories)}:${limitInt}`;
    const cached = await redisService.get<SchemeRow[]>(cacheKey);
    if (cached) return cached;

    const cats = categories.map((c) => ({ type: c.type, value: c.value }));
    const rows = await this.connection.executeRead<any>(
      `UNWIND $cats AS cat
       MATCH (c:Category)
       WHERE c.type = cat.type AND (c.value = cat.value OR c.value = 'Any')
       MATCH (s:Scheme)-[:HAS_CATEGORY]->(c)
       RETURN DISTINCT s
       LIMIT $limit`,
      { cats, limit: limitInt }
    );
    const result = rows.map((r: any) => this.nodeToSchemeRow(r.s));
    await redisService.set(cacheKey, result, 300);
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
    await redisService.set('categories:all', categories, 600);
    return categories;
  }

  /** Graph traversal: find schemes for a user via UserGroup relationships */
  async findSchemesForUser(userId: string, limit = 20): Promise<SchemeRow[]> {
    const limitInt = Math.floor(Number(limit));
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })-[:BELONGS_TO]->(ug:UserGroup)<-[:TARGETS]-(s:Scheme)
       RETURN DISTINCT s LIMIT $limit`,
      { userId, limit: limitInt }
    );
    return rows.map((r: any) => this.nodeToSchemeRow(r.s));
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
    await this.connection.executeWrite(
      `CREATE (u:User {
         user_id: $userId, email: $email, password: $password,
         name: $name, age: $age, income: $income, state: $state, gender: $gender,
         employment: '', education: '', interests: '',
         onboarding_complete: false,
         created_at: toString(datetime())
       })`,
      {
        userId: user.userId,
        email: user.email,
        password: user.password,
        name: user.name ?? '',
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
    const rows = await this.connection.executeRead<any>(
      'MATCH (u:User { email: $email }) RETURN u',
      { email }
    );
    if (rows.length === 0) return undefined;
    return this.nodeToUser(rows[0].u);
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
    const user = this.nodeToUser(rows[0].u);
    await redisService.set(cacheKey, user, 120);
    return user;
  }

  async getAllUsers(): Promise<any[]> {
    const rows = await this.connection.executeRead<any>(
      'MATCH (u:User) RETURN u ORDER BY u.created_at DESC'
    );
    return rows.map((r: any) => this.nodeToUser(r.u));
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

    const setClauses = updates.map(([k]) => `u.${k} = $${k}`).join(', ');
    const params: Record<string, any> = { userId };
    for (const [k, v] of updates) params[k] = v;

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
      await this.autoAssignUserToGroups(userId, this.nodeToUser(userRows[0].u));
    }

    await redisService.del(`user:${userId}`);
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
    const inc = (profile.income || '').toLowerCase();
    if (inc.includes('below') || inc.includes('bpl') || inc.includes('low'))
      groupNames.push('Low Income Worker');

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

  private nodeToUser(node: any): any {
    const p = node.properties ?? node;
    return {
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
    const rows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(s:Scheme { scheme_id: $schemeId })
       RETURN collect(DISTINCT c.type + ': ' + c.value) AS matched`,
      { userId, schemeId }
    );
    const matched: string[] = rows[0]?.matched || [];
    const ugRows = await this.connection.executeRead<any>(
      `MATCH (u:User { user_id: $userId })-[:BELONGS_TO]->(ug:UserGroup)<-[:TARGETS]-(s:Scheme { scheme_id: $schemeId })
       RETURN count(DISTINCT ug) AS ugMatches`,
      { userId, schemeId }
    );
    const ugMatches = Number(ugRows[0]?.ugMatches) || 0;
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
