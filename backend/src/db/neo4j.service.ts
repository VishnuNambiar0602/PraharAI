/**
 * Neo4j Service
 * Provides a simple interface for executing queries against Neo4j
 */

import { getNeo4jConnection } from './neo4j.config';

class Neo4jService {
  /**
   * Execute a write query against Neo4j
   */
  async executeWriteQuery(
    query: string,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    try {
      const connection = getNeo4jConnection();
      const session = connection.getWriteSession();
      
      try {
        const result = await session.run(query, parameters);
        return result;
      } finally {
        await session.close();
      }
    } catch (error) {
      console.warn('Neo4j write query failed, database may not be initialized:', error);
      throw error;
    }
  }

  /**
   * Execute a query against Neo4j (auto-detects read/write)
   */
  async executeQuery(
    query: string,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    // Detect if this is a write query - check for any write operations
    const trimmedQuery = query.trim().toUpperCase();
    const isWrite = 
      trimmedQuery.startsWith('CREATE') ||
      trimmedQuery.startsWith('MERGE') ||
      trimmedQuery.startsWith('SET') ||
      trimmedQuery.startsWith('DELETE') ||
      trimmedQuery.startsWith('REMOVE') ||
      trimmedQuery.includes('MERGE') ||
      trimmedQuery.includes(' SET ') ||
      trimmedQuery.includes(' DELETE ') ||
      trimmedQuery.includes(' CREATE ');
    
    if (isWrite) {
      return this.executeWriteQuery(query, parameters);
    }
    
    try {
      const connection = getNeo4jConnection();
      const session = connection.getReadSession();
      
      try {
        const result = await session.run(query, parameters);
        return result;
      } finally {
        await session.close();
      }
    } catch (error) {
      // Neo4j not initialized or not available
      console.warn('Neo4j query failed, database may not be initialized:', error);
      throw error;
    }
  }

  /**
   * Check if Neo4j is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const connection = getNeo4jConnection();
      await connection.getDriver().verifyConnectivity();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const neo4jService = new Neo4jService();
