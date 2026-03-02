/**
 * Neo4j Schema for Government Schemes
 * 
 * Graph Structure:
 * - Scheme nodes with properties
 * - Category nodes (Employment, Income, Locality, SocialCategory, Education, PovertyLine)
 * - Relationships between schemes and categories
 * - Multiple relationships per scheme (many-to-many)
 */

export interface SchemeNode {
  schemeId: string;           // Unique identifier (slug from API)
  name: string;               // Scheme title
  description: string;        // Full description
  ministry: string | null;    // Ministry name
  state: string | null;       // State (null for national schemes)
  tags: string[];             // Original tags from API
  rawCategory: string[];      // Original categories from API
  lastUpdated: string;        // ISO timestamp
  embedding?: number[];       // Vector embedding for similarity search
}

// Category Types
export enum CategoryType {
  EMPLOYMENT = 'Employment',
  INCOME = 'Income',
  LOCALITY = 'Locality',
  SOCIAL_CATEGORY = 'SocialCategory',
  EDUCATION = 'Education',
  POVERTY_LINE = 'PovertyLine',
}

// Employment Categories
export enum EmploymentStatus {
  EMPLOYED = 'Employed',
  UNEMPLOYED = 'Unemployed',
  SELF_EMPLOYED = 'SelfEmployed',
  STUDENT = 'Student',
  RETIRED = 'Retired',
  ANY = 'Any',
}

// Income Categories
export enum IncomeLevel {
  BELOW_1_LAKH = 'Below1Lakh',
  ONE_TO_THREE_LAKH = '1To3Lakh',
  THREE_TO_FIVE_LAKH = '3To5Lakh',
  FIVE_TO_TEN_LAKH = '5To10Lakh',
  ABOVE_TEN_LAKH = 'Above10Lakh',
  ANY = 'Any',
}

// Locality Categories
export enum LocalityType {
  RURAL = 'Rural',
  URBAN = 'Urban',
  SEMI_URBAN = 'SemiUrban',
  ANY = 'Any',
}

// Social Categories
export enum SocialCategory {
  GENERAL = 'General',
  SC = 'SC',
  ST = 'ST',
  OBC = 'OBC',
  MINORITY = 'Minority',
  WOMEN = 'Women',
  PWD = 'PWD',
  ANY = 'Any',
}

// Education Categories
export enum EducationLevel {
  NO_FORMAL = 'NoFormal',
  PRIMARY = 'Primary',
  SECONDARY = 'Secondary',
  HIGHER_SECONDARY = 'HigherSecondary',
  GRADUATE = 'Graduate',
  POST_GRADUATE = 'PostGraduate',
  PROFESSIONAL = 'Professional',
  ANY = 'Any',
}

// Poverty Line Categories
export enum PovertyLine {
  BPL = 'BPL',
  APL = 'APL',
  ANY = 'Any',
}

/**
 * Cypher Queries for Schema Creation
 */
export const SCHEMA_QUERIES = {
  // Create constraints
  createConstraints: `
    CREATE CONSTRAINT scheme_id IF NOT EXISTS FOR (s:Scheme) REQUIRE s.schemeId IS UNIQUE;
    CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE (c.type, c.value) IS UNIQUE;
  `,

  // Create indexes
  createIndexes: `
    CREATE INDEX scheme_name IF NOT EXISTS FOR (s:Scheme) ON (s.name);
    CREATE INDEX scheme_tags IF NOT EXISTS FOR (s:Scheme) ON (s.tags);
    CREATE INDEX scheme_state IF NOT EXISTS FOR (s:Scheme) ON (s.state);
    CREATE INDEX category_type IF NOT EXISTS FOR (c:Category) ON (c.type);
  `,

  // Create a scheme node
  createScheme: `
    MERGE (s:Scheme {schemeId: $schemeId})
    SET s.name = $name,
        s.description = $description,
        s.ministry = $ministry,
        s.state = $state,
        s.tags = $tags,
        s.rawCategory = $rawCategory,
        s.lastUpdated = $lastUpdated
    RETURN s
  `,

  // Create category node
  createCategory: `
    MERGE (c:Category {type: $type, value: $value})
    RETURN c
  `,

  // Create relationship between scheme and category
  linkSchemeToCategory: `
    MATCH (s:Scheme {schemeId: $schemeId})
    MATCH (c:Category {type: $type, value: $value})
    MERGE (s)-[r:BELONGS_TO]->(c)
    RETURN s, r, c
  `,

  // Get scheme with all categories
  getSchemeWithCategories: `
    MATCH (s:Scheme {schemeId: $schemeId})
    OPTIONAL MATCH (s)-[:BELONGS_TO]->(c:Category)
    RETURN s, collect(c) as categories
  `,

  // Find schemes by category
  findSchemesByCategory: `
    MATCH (s:Scheme)-[:BELONGS_TO]->(c:Category {type: $type, value: $value})
    RETURN s
    LIMIT $limit
  `,

  // Find schemes by multiple categories (intersection)
  findSchemesByMultipleCategories: `
    MATCH (s:Scheme)
    WHERE ALL(cat IN $categories WHERE 
      EXISTS((s)-[:BELONGS_TO]->(:Category {type: cat.type, value: cat.value}))
    )
    RETURN s
    LIMIT $limit
  `,

  // Get all categories
  getAllCategories: `
    MATCH (c:Category)
    RETURN c.type as type, c.value as value
    ORDER BY c.type, c.value
  `,

  // Delete all schemes (for re-sync)
  deleteAllSchemes: `
    MATCH (s:Scheme)
    DETACH DELETE s
  `,

  // Get sync status
  getSyncStatus: `
    MATCH (s:Scheme)
    RETURN count(s) as totalSchemes, 
           max(s.lastUpdated) as lastSync
  `,
};

/**
 * Category Extraction Rules
 * Maps tags and keywords to our category system
 */
export const CATEGORY_RULES = {
  employment: {
    employed: ['employed', 'employee', 'worker', 'job'],
    unemployed: ['unemployed', 'jobless', 'unemployment'],
    selfEmployed: ['self-employed', 'entrepreneur', 'business', 'startup'],
    student: ['student', 'education', 'scholarship', 'college'],
    retired: ['retired', 'pension', 'senior citizen'],
  },

  income: {
    below1Lakh: ['bpl', 'below poverty', 'poor', 'economically weak'],
    '1To3Lakh': ['low income', 'economically weaker'],
    '3To5Lakh': ['middle income'],
    '5To10Lakh': ['upper middle'],
    above10Lakh: ['high income'],
  },

  locality: {
    rural: ['rural', 'village', 'gram', 'panchayat'],
    urban: ['urban', 'city', 'municipal', 'metro'],
    semiUrban: ['semi-urban', 'town'],
  },

  socialCategory: {
    sc: ['scheduled caste', 'sc', 'dalit'],
    st: ['scheduled tribe', 'st', 'tribal', 'adivasi'],
    obc: ['other backward class', 'obc', 'backward'],
    minority: ['minority', 'muslim', 'christian', 'sikh'],
    women: ['women', 'female', 'girl', 'mahila'],
    pwd: ['disability', 'disabled', 'pwd', 'divyang', 'handicapped'],
    general: ['general'],
  },

  education: {
    noFormal: ['illiterate', 'no education'],
    primary: ['primary', 'elementary'],
    secondary: ['secondary', 'high school', 'matric'],
    higherSecondary: ['higher secondary', '12th', 'intermediate'],
    graduate: ['graduate', 'degree', 'bachelor'],
    postGraduate: ['post graduate', 'master', 'phd'],
    professional: ['professional', 'engineering', 'medical', 'mba'],
  },

  povertyLine: {
    bpl: ['bpl', 'below poverty', 'poor'],
    apl: ['apl', 'above poverty'],
  },
};
