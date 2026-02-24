import neo4jService from './neo4jService.js';
import { v4 as uuid } from 'uuid';
import logger from '../config/logger.js';

class GovAPIService {
  /**
   * Create a government API reference
   */
  async createGovAPI(apiData) {
    const {
      name,
      endpoint,
      description,
      authentication_type = 'API_KEY',
      rate_limit = 1000,
    } = apiData;

    const apiId = uuid();

    const query = `
      CREATE (ga:GovAPI {
        api_id: $apiId,
        name: $name,
        endpoint: $endpoint,
        description: $description,
        authentication_type: $authenticationType,
        rate_limit: $rateLimit,
        created_at: timestamp(),
        updated_at: timestamp()
      })
      RETURN ga
    `;

    const params = {
      apiId,
      name,
      endpoint,
      description,
      authenticationType: authentication_type,
      rateLimit: rate_limit,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const govAPI = neo4jService.recordToObject(result.records[0], ['ga']);
      logger.info(`Created GovAPI: ${apiId} (${name})`);
      return govAPI.ga.properties;
    } catch (error) {
      logger.error('Failed to create GovAPI:', error);
      throw error;
    }
  }

  /**
   * Get all government APIs
   */
  async getAllGovAPIs() {
    const query = `
      MATCH (ga:GovAPI)
      RETURN ga
      ORDER BY ga.name
    `;

    try {
      const result = await neo4jService.executeQuery(query, {});
      return neo4jService.recordsToArray(result.records, ['ga']).map(r => r.ga.properties);
    } catch (error) {
      logger.error('Failed to get GovAPIs:', error);
      throw error;
    }
  }

  /**
   * Get GovAPI by ID
   */
  async getGovAPIById(apiId) {
    const query = `
      MATCH (ga:GovAPI { api_id: $apiId })
      OPTIONAL MATCH (s:Scheme)-[:FETCHED_FROM]->(ga)
      RETURN ga, collect(s) as schemes
    `;

    try {
      const result = await neo4jService.executeQuery(query, { apiId });
      
      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const govAPI = record.get('ga').properties;
      const schemes = record.get('schemes')
        .filter(s => s !== null)
        .map(s => s.properties);

      return { ...govAPI, schemes };
    } catch (error) {
      logger.error('Failed to get GovAPI:', error);
      throw error;
    }
  }
}

export default new GovAPIService();
