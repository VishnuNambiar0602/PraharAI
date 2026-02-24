import driver from '../config/neo4j.js';
import logger from '../config/logger.js';

class Neo4jService {
  async executeQuery(query, params = {}, mode = 'READ') {
    let session = null;
    try {
      session = driver.session({ defaultAccessMode: mode === 'WRITE' ? 'WRITE' : 'READ' });
      const result = await session.run(query, params);
      return result;
    } catch (error) {
      logger.error('Query execution failed:', { query, params, error: error.message });
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  async executeTransaction(transactionFn) {
    const session = driver.session();
    try {
      const result = await session.executeWrite(transactionFn);
      return result;
    } catch (error) {
      logger.error('Transaction execution failed:', error.message);
      throw error;
    } finally {
      await session.close();
    }
  }

  // Convert Neo4j records to plain objects
  recordToObject(record, keys = null) {
    const fields = keys || record.keys;
    const obj = {};
    fields.forEach(key => {
      let value = record.get(key);
      // Handle Neo4j types
      if (value && typeof value === 'object') {
        if (value.properties) {
          obj[key] = value.properties;
        } else if (value.low !== undefined && value.high !== undefined) {
          // Integer type
          obj[key] = value.toNumber();
        } else {
          obj[key] = value;
        }
      } else {
        obj[key] = value;
      }
    });
    return obj;
  }

  recordsToArray(records, keys = null) {
    return records.map(record => this.recordToObject(record, keys));
  }
}

export default new Neo4jService();
