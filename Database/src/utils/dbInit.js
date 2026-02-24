import driver from '../config/neo4j.js';
import logger from '../config/logger.js';

/**
 * Initialize database schema with constraints and indexes
 */
const initializeConstraints = async () => {
  const session = driver.session();
  
  try {
    const constraints = [
      // Unique constraints
      'CREATE CONSTRAINT citizen_id_unique IF NOT EXISTS FOR (c:Citizen) REQUIRE c.citizen_id IS UNIQUE',
      'CREATE CONSTRAINT user_group_id_unique IF NOT EXISTS FOR (ug:UserGroup) REQUIRE ug.group_id IS UNIQUE',
      'CREATE CONSTRAINT scheme_id_unique IF NOT EXISTS FOR (s:Scheme) REQUIRE s.scheme_id IS UNIQUE',
      'CREATE CONSTRAINT location_id_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.location_id IS UNIQUE',
      'CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.document_id IS UNIQUE',
      'CREATE CONSTRAINT gov_api_id_unique IF NOT EXISTS FOR (ga:GovAPI) REQUIRE ga.api_id IS UNIQUE',
      'CREATE CONSTRAINT eligibility_rule_id_unique IF NOT EXISTS FOR (er:EligibilityRule) REQUIRE er.rule_id IS UNIQUE',
      'CREATE CONSTRAINT nudge_id_unique IF NOT EXISTS FOR (n:Nudge) REQUIRE n.nudge_id IS UNIQUE',
      'CREATE CONSTRAINT application_id_unique IF NOT EXISTS FOR (a:Application) REQUIRE a.application_id IS UNIQUE',
      
      // Email unique constraint
      'CREATE CONSTRAINT citizen_email_unique IF NOT EXISTS FOR (c:Citizen) REQUIRE c.email IS UNIQUE',
      'CREATE CONSTRAINT location_code_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.code IS UNIQUE',
    ];

    for (const constraint of constraints) {
      try {
        await session.run(constraint);
        logger.info(`Created constraint: ${constraint.substring(0, 50)}...`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          logger.debug(`Constraint already exists: ${constraint.substring(0, 50)}...`);
        } else {
          logger.error(`Failed to create constraint: ${error.message}`);
        }
      }
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX citizen_aadhar_index IF NOT EXISTS FOR (c:Citizen) ON (c.aadhar)',
      'CREATE INDEX citizen_created_at_index IF NOT EXISTS FOR (c:Citizen) ON (c.created_at)',
      'CREATE INDEX scheme_category_index IF NOT EXISTS FOR (s:Scheme) ON (s.category)',
      'CREATE INDEX scheme_active_index IF NOT EXISTS FOR (s:Scheme) ON (s.is_active)',
      'CREATE INDEX location_type_index IF NOT EXISTS FOR (l:Location) ON (l.type)',
      'CREATE INDEX nudge_sent_at_index IF NOT EXISTS FOR (n:Nudge) ON (n.sent_at)',
      'CREATE INDEX application_status_index IF NOT EXISTS FOR (a:Application) ON (a.status)',
    ];

    for (const index of indexes) {
      try {
        await session.run(index);
        logger.info(`Created index: ${index.substring(0, 50)}...`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          logger.debug(`Index already exists: ${index.substring(0, 50)}...`);
        } else {
          logger.error(`Failed to create index: ${error.message}`);
        }
      }
    }

    logger.info('Database schema initialization complete');
  } catch (error) {
    logger.error('Failed to initialize constraints:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export { initializeConstraints };
