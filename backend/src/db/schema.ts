/**
 * Neo4j Database Schema Initialization
 *
 * Creates node types, indexes, constraints, and full-text search indexes
 * for the Personalized Scheme Recommendation System.
 */

import { Neo4jConnection } from './neo4j.config';

export interface SchemaInitResult {
  constraints: string[];
  indexes: string[];
  fullTextIndexes: string[];
  errors: string[];
}

/**
 * Initialize the complete database schema
 */
export async function initializeSchema(connection: Neo4jConnection): Promise<SchemaInitResult> {
  const result: SchemaInitResult = {
    constraints: [],
    indexes: [],
    fullTextIndexes: [],
    errors: [],
  };

  console.log('Initializing Neo4j database schema...');

  try {
    // Create constraints (ensures uniqueness and creates indexes)
    await createConstraints(connection, result);

    // Create additional indexes for performance
    await createIndexes(connection, result);

    // Create full-text search indexes
    await createFullTextIndexes(connection, result);

    console.log('✓ Schema initialization completed successfully');
    console.log(`  - Constraints: ${result.constraints.length}`);
    console.log(`  - Indexes: ${result.indexes.length}`);
    console.log(`  - Full-text indexes: ${result.fullTextIndexes.length}`);

    if (result.errors.length > 0) {
      console.warn(`  - Errors: ${result.errors.length}`);
      result.errors.forEach((error) => console.warn(`    ${error}`));
    }
  } catch (error) {
    console.error('Schema initialization failed:', error);
    throw error;
  }

  return result;
}

/**
 * Create uniqueness constraints (automatically creates indexes)
 */
async function createConstraints(
  connection: Neo4jConnection,
  result: SchemaInitResult
): Promise<void> {
  const constraints = [
    // User constraints
    {
      name: 'user_userId_unique',
      query:
        'CREATE CONSTRAINT user_userId_unique IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE',
    },
    {
      name: 'user_email_unique',
      query:
        'CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
    },

    // Scheme constraints
    {
      name: 'scheme_schemeId_unique',
      query:
        'CREATE CONSTRAINT scheme_schemeId_unique IF NOT EXISTS FOR (s:Scheme) REQUIRE s.schemeId IS UNIQUE',
    },

    // UserGroup constraints
    {
      name: 'usergroup_groupId_unique',
      query:
        'CREATE CONSTRAINT usergroup_groupId_unique IF NOT EXISTS FOR (g:UserGroup) REQUIRE g.groupId IS UNIQUE',
    },

    // Nudge constraints
    {
      name: 'nudge_nudgeId_unique',
      query:
        'CREATE CONSTRAINT nudge_nudgeId_unique IF NOT EXISTS FOR (n:Nudge) REQUIRE n.nudgeId IS UNIQUE',
    },

    // Category constraints
    {
      name: 'category_categoryId_unique',
      query:
        'CREATE CONSTRAINT category_categoryId_unique IF NOT EXISTS FOR (c:Category) REQUIRE c.categoryId IS UNIQUE',
    },
  ];

  for (const constraint of constraints) {
    try {
      await connection.executeWrite(constraint.query);
      result.constraints.push(constraint.name);
      console.log(`  ✓ Created constraint: ${constraint.name}`);
    } catch (error: any) {
      // Constraint might already exist
      if (error.code === 'Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists') {
        console.log(`  - Constraint already exists: ${constraint.name}`);
      } else {
        result.errors.push(`Failed to create constraint ${constraint.name}: ${error.message}`);
      }
    }
  }
}

/**
 * Create indexes for frequently queried fields
 */
async function createIndexes(connection: Neo4jConnection, result: SchemaInitResult): Promise<void> {
  const indexes = [
    // User indexes
    {
      name: 'user_state_index',
      query: 'CREATE INDEX user_state_index IF NOT EXISTS FOR (u:User) ON (u.state)',
    },
    {
      name: 'user_incomeLevel_index',
      query: 'CREATE INDEX user_incomeLevel_index IF NOT EXISTS FOR (u:User) ON (u.incomeLevel)',
    },
    {
      name: 'user_occupation_index',
      query: 'CREATE INDEX user_occupation_index IF NOT EXISTS FOR (u:User) ON (u.occupation)',
    },
    {
      name: 'user_age_index',
      query: 'CREATE INDEX user_age_index IF NOT EXISTS FOR (u:User) ON (u.age)',
    },

    // Scheme indexes
    {
      name: 'scheme_category_index',
      query: 'CREATE INDEX scheme_category_index IF NOT EXISTS FOR (s:Scheme) ON (s.category)',
    },
    {
      name: 'scheme_isActive_index',
      query: 'CREATE INDEX scheme_isActive_index IF NOT EXISTS FOR (s:Scheme) ON (s.isActive)',
    },
    {
      name: 'scheme_deadline_index',
      query:
        'CREATE INDEX scheme_deadline_index IF NOT EXISTS FOR (s:Scheme) ON (s.applicationDeadline)',
    },

    // Nudge indexes
    {
      name: 'nudge_userId_index',
      query: 'CREATE INDEX nudge_userId_index IF NOT EXISTS FOR (n:Nudge) ON (n.userId)',
    },
    {
      name: 'nudge_viewed_index',
      query: 'CREATE INDEX nudge_viewed_index IF NOT EXISTS FOR (n:Nudge) ON (n.viewed)',
    },
    {
      name: 'nudge_createdAt_index',
      query: 'CREATE INDEX nudge_createdAt_index IF NOT EXISTS FOR (n:Nudge) ON (n.createdAt)',
    },
  ];

  for (const index of indexes) {
    try {
      await connection.executeWrite(index.query);
      result.indexes.push(index.name);
      console.log(`  ✓ Created index: ${index.name}`);
    } catch (error: any) {
      // Index might already exist
      if (error.code === 'Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists') {
        console.log(`  - Index already exists: ${index.name}`);
      } else {
        result.errors.push(`Failed to create index ${index.name}: ${error.message}`);
      }
    }
  }
}

/**
 * Create full-text search indexes
 */
async function createFullTextIndexes(
  connection: Neo4jConnection,
  result: SchemaInitResult
): Promise<void> {
  const fullTextIndexes = [
    {
      name: 'scheme_search_index',
      query: `
        CREATE FULLTEXT INDEX scheme_search_index IF NOT EXISTS
        FOR (s:Scheme)
        ON EACH [s.schemeName, s.shortDescription, s.fullDescription]
        OPTIONS {
          indexConfig: {
            \`fulltext.analyzer\`: 'standard-no-stop-words',
            \`fulltext.eventually_consistent\`: true
          }
        }
      `,
    },
  ];

  for (const index of fullTextIndexes) {
    try {
      await connection.executeWrite(index.query);
      result.fullTextIndexes.push(index.name);
      console.log(`  ✓ Created full-text index: ${index.name}`);
    } catch (error: any) {
      // Full-text index might already exist
      if (
        error.code === 'Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists' ||
        error.message.includes('already exists')
      ) {
        console.log(`  - Full-text index already exists: ${index.name}`);
      } else {
        result.errors.push(`Failed to create full-text index ${index.name}: ${error.message}`);
      }
    }
  }
}

/**
 * Drop all constraints and indexes (use with caution!)
 */
export async function dropSchema(connection: Neo4jConnection): Promise<void> {
  console.log('Dropping all constraints and indexes...');

  try {
    // Get all constraints
    const constraints = await connection.executeRead<{ name: string }>('SHOW CONSTRAINTS');

    // Drop each constraint
    for (const constraint of constraints) {
      try {
        await connection.executeWrite(`DROP CONSTRAINT ${constraint.name} IF EXISTS`);
        console.log(`  ✓ Dropped constraint: ${constraint.name}`);
      } catch (error: any) {
        console.warn(`  - Failed to drop constraint ${constraint.name}: ${error.message}`);
      }
    }

    // Get all indexes
    const indexes = await connection.executeRead<{ name: string }>('SHOW INDEXES');

    // Drop each index (excluding constraint-backed indexes)
    for (const index of indexes) {
      try {
        await connection.executeWrite(`DROP INDEX ${index.name} IF EXISTS`);
        console.log(`  ✓ Dropped index: ${index.name}`);
      } catch (error: any) {
        // Some indexes are backed by constraints and can't be dropped separately
        if (!error.message.includes('constraint')) {
          console.warn(`  - Failed to drop index ${index.name}: ${error.message}`);
        }
      }
    }

    console.log('✓ Schema dropped successfully');
  } catch (error) {
    console.error('Failed to drop schema:', error);
    throw error;
  }
}

/**
 * Verify schema is properly initialized
 */
export async function verifySchema(connection: Neo4jConnection): Promise<boolean> {
  console.log('Verifying database schema...');

  try {
    // Check constraints
    const constraints = await connection.executeRead<{
      name: string;
      type?: string;
      labelsOrTypes?: string[];
      properties?: string[];
    }>('SHOW CONSTRAINTS');
    console.log(`  - Found ${constraints.length} constraints`);

    // Check indexes
    const indexes = await connection.executeRead<{ name: string }>('SHOW INDEXES');
    console.log(`  - Found ${indexes.length} indexes`);

    // Verify required uniqueness constraints by semantic definition, not exact name.
    // Different environments may use different constraint names (e.g. user_email vs user_email_unique).
    const requiredUniquenessConstraints = [
      { label: 'User', property: 'userId' },
      { label: 'User', property: 'email' },
      { label: 'Scheme', property: 'schemeId' },
      { label: 'UserGroup', property: 'groupId' },
      { label: 'Nudge', property: 'nudgeId' },
      { label: 'Category', property: 'categoryId' },
    ];

    const missingConstraints = requiredUniquenessConstraints.filter((required) => {
      return !constraints.some((constraint) => {
        const isUniqueness = (constraint.type || '').toUpperCase() === 'UNIQUENESS';
        const labels = constraint.labelsOrTypes || [];
        const properties = constraint.properties || [];
        return (
          isUniqueness && labels.includes(required.label) && properties.includes(required.property)
        );
      });
    });

    if (missingConstraints.length > 0) {
      const missingDescriptions = missingConstraints.map(
        (constraint) => `${constraint.label}.${constraint.property}`
      );
      console.error('  ✗ Missing required constraints:', missingDescriptions);
      return false;
    }

    // Verify full-text index exists
    const hasFullTextIndex = indexes.some((idx) => idx.name === 'scheme_search_index');
    if (!hasFullTextIndex) {
      console.error('  ✗ Missing full-text search index: scheme_search_index');
      return false;
    }

    console.log('✓ Schema verification passed');
    return true;
  } catch (error) {
    console.error('Schema verification failed:', error);
    return false;
  }
}
