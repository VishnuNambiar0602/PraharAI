import neo4jService from './neo4jService.js';
import { v4 as uuid } from 'uuid';
import logger from '../config/logger.js';

class LocationService {
  /**
   * Create a location (State/District)
   */
  async createLocation(locationData) {
    const {
      name,
      type, // 'STATE' or 'DISTRICT'
      code,
      parent_location_id = null,
    } = locationData;

    const locationId = uuid();

    const query = `
      CREATE (l:Location {
        location_id: $locationId,
        name: $name,
        type: $type,
        code: $code,
        created_at: timestamp()
      })
      ${parent_location_id ? 'WITH l MATCH (parent:Location { location_id: $parentLocationId }) CREATE (l)-[:PART_OF]->(parent)' : ''}
      RETURN l
    `;

    const params = {
      locationId,
      name,
      type,
      code,
      parentLocationId: parent_location_id,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const location = neo4jService.recordToObject(result.records[0], ['l']);
      logger.info(`Created location: ${locationId} (${name})`);
      return location.l.properties;
    } catch (error) {
      logger.error('Failed to create location:', error);
      throw error;
    }
  }

  /**
   * Get all locations
   */
  async getAllLocations(filters = {}) {
    let query = `
      MATCH (l:Location)
      ${filters.type ? 'WHERE l.type = $type' : ''}
      RETURN l
      ORDER BY l.name
      SKIP $skip
      LIMIT $limit
    `;

    const params = {
      ...filters,
      skip: filters.skip || 0,
      limit: filters.limit || 50,
    };

    try {
      const result = await neo4jService.executeQuery(query, params);
      return neo4jService.recordsToArray(result.records, ['l']).map(r => r.l.properties);
    } catch (error) {
      logger.error('Failed to get locations:', error);
      throw error;
    }
  }
}

export default new LocationService();
