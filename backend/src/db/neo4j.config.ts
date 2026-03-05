/**
 * Neo4j Database Configuration
 *
 * Configures connection pooling, authentication, and driver settings
 * for the Neo4j graph database.
 */

import neo4j, { Driver, Session, auth } from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
  maxTransactionRetryTime?: number;
}

export class Neo4jConnection {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor(config: Neo4jConfig) {
    this.config = {
      database: 'neo4j',
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000,
      maxTransactionRetryTime: 30000,
      ...config,
    };
  }

  /**
   * Initialize the Neo4j driver with connection pooling
   */
  async connect(): Promise<void> {
    if (this.driver) {
      console.log('Neo4j driver already connected');
      return;
    }

    const maxAttempts = Number(process.env.NEO4J_CONNECT_RETRIES || 8);
    const retryDelayMs = Number(process.env.NEO4J_CONNECT_RETRY_DELAY_MS || 2000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.driver = neo4j.driver(
          this.config.uri,
          auth.basic(this.config.username, this.config.password),
          {
            maxConnectionPoolSize: this.config.maxConnectionPoolSize,
            connectionTimeout: this.config.connectionTimeout,
            maxTransactionRetryTime: this.config.maxTransactionRetryTime,
            disableLosslessIntegers: true,
          }
        );

        await this.driver.verifyConnectivity();
        console.log('✓ Neo4j connection established successfully');
        return;
      } catch (error) {
        if (this.driver) {
          await this.driver.close();
          this.driver = null;
        }

        const isLastAttempt = attempt === maxAttempts;
        if (isLastAttempt) {
          console.error('Failed to connect to Neo4j:', error);
          throw error;
        }

        console.warn(
          `Neo4j connection attempt ${attempt}/${maxAttempts} failed. Retrying in ${retryDelayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  /**
   * Get a read session for queries
   */
  getReadSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.READ,
    });
  }

  /**
   * Get a write session for mutations
   */
  getWriteSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.WRITE,
    });
  }

  /**
   * Execute a read query
   */
  async executeRead<T>(query: string, parameters: Record<string, any> = {}): Promise<T[]> {
    const session = this.getReadSession();
    try {
      const result = await session.run(query, parameters);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write query
   */
  async executeWrite<T>(query: string, parameters: Record<string, any> = {}): Promise<T[]> {
    const session = this.getWriteSession();
    try {
      const result = await session.run(query, parameters);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a transaction with retry logic
   */
  async executeTransaction<T>(work: (tx: any) => Promise<T>, maxRetries: number = 3): Promise<T> {
    const session = this.getWriteSession();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await session.executeWrite(work);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Transaction attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      } finally {
        if (attempt === maxRetries) {
          await session.close();
        }
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /**
   * Close the driver and release all connections
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.log('✓ Neo4j connection closed');
    }
  }

  /**
   * Get the driver instance (for advanced usage)
   */
  getDriver(): Driver {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver;
  }
}

// Singleton instance
let neo4jConnection: Neo4jConnection | null = null;

/**
 * Initialize the Neo4j connection singleton
 */
export function initializeNeo4j(config: Neo4jConfig): Neo4jConnection {
  if (!neo4jConnection) {
    neo4jConnection = new Neo4jConnection(config);
  }
  return neo4jConnection;
}

/**
 * Get the Neo4j connection instance
 */
export function getNeo4jConnection(): Neo4jConnection {
  if (!neo4jConnection) {
    throw new Error('Neo4j not initialized. Call initializeNeo4j() first.');
  }
  return neo4jConnection;
}

/**
 * Close the Neo4j connection
 */
export async function closeNeo4j(): Promise<void> {
  if (neo4jConnection) {
    await neo4jConnection.close();
    neo4jConnection = null;
  }
}
