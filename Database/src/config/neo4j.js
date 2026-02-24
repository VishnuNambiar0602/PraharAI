import neo4j from 'neo4j-driver';
import logger from './logger.js';

const driver = neo4j.driver(
  `bolt://${process.env.NEO4J_HOST}:${process.env.NEO4J_PORT}`,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  {
    encrypted: process.env.NEO4J_ENCRYPTED === 'true',
    trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES',
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 30000,
    maxTransactionRetryTime: 30000,
    logging: neo4j.logging.console('debug'),
  }
);

// Verify connection on startup
export const initializeDriver = async () => {
  try {
    const session = driver.session();
    await session.run('RETURN 1 as result');
    await session.close();
    logger.info('Neo4j connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Neo4j:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeDriver = async () => {
  try {
    await driver.close();
    logger.info('Neo4j connection closed');
  } catch (error) {
    logger.error('Error closing Neo4j connection:', error);
  }
};

export default driver;
