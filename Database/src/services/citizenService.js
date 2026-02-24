import neo4jService from './neo4jService.js';
import { v4 as uuid } from 'uuid';
import logger from '../config/logger.js';

class CitizenService {
  /**
   * Create a new citizen
   * @param {Object} citizenData - Citizen information
   * @returns {Promise<Object>} Created citizen
   */
  async createCitizen(citizenData) {
    const {
      name,
      email,
      phone,
      aadhar,
      locationId,
      userGroupIds = []
    } = citizenData;

    const citizenId = uuid();
    
    const query = `
      CREATE (c:Citizen {
        citizen_id: $citizenId,
        name: $name,
        email: $email,
        phone: $phone,
        aadhar: $aadhar,
        created_at: timestamp(),
        updated_at: timestamp()
      })
      ${locationId ? 'WITH c MATCH (l:Location { location_id: $locationId }) CREATE (c)-[:LOCATED_IN]->(l)' : ''}
      RETURN c
    `;

    const params = {
      citizenId,
      name,
      email,
      phone,
      aadhar,
      locationId,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const citizen = neo4jService.recordToObject(result.records[0], ['c']);
      
      // Add to user groups
      if (userGroupIds.length > 0) {
        await this.addCitizenToUserGroups(citizenId, userGroupIds);
      }

      logger.info(`Created citizen: ${citizenId}`);
      return { ...citizen.c.properties, id: citizen.c.identity };
    } catch (error) {
      logger.error('Failed to create citizen:', error);
      throw error;
    }
  }

  /**
   * Get citizen by ID
   */
  async getCitizenById(citizenId) {
    const query = `
      MATCH (c:Citizen { citizen_id: $citizenId })
      OPTIONAL MATCH (c)-[:BELONGS_TO]->(ug:UserGroup)
      OPTIONAL MATCH (c)-[:LOCATED_IN]->(l:Location)
      OPTIONAL MATCH (c)-[:APPLIED_FOR]->(s:Scheme)
      RETURN c, collect(ug) as userGroups, l as location, collect(s) as schemes
    `;

    try {
      const result = await neo4jService.executeQuery(query, { citizenId });
      
      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const citizen = record.get('c').properties;
      const userGroups = record.get('userGroups')
        .filter(ug => ug !== null)
        .map(ug => ug.properties);
      const location = record.get('location')?.properties || null;
      const schemes = record.get('schemes')
        .filter(s => s !== null)
        .map(s => s.properties);

      return { ...citizen, userGroups, location, schemes };
    } catch (error) {
      logger.error('Failed to get citizen:', error);
      throw error;
    }
  }

  /**
   * Add citizen to user groups
   */
  async addCitizenToUserGroups(citizenId, userGroupIds) {
    const query = `
      MATCH (c:Citizen { citizen_id: $citizenId })
      UNWIND $userGroupIds as ugId
      MATCH (ug:UserGroup { group_id: ugId })
      MERGE (c)-[:BELONGS_TO]->(ug)
    `;

    try {
      await neo4jService.executeQuery(query, { citizenId, userGroupIds }, 'WRITE');
      logger.info(`Added citizen ${citizenId} to ${userGroupIds.length} user groups`);
    } catch (error) {
      logger.error('Failed to add citizen to user groups:', error);
      throw error;
    }
  }

  /**
   * Get all citizens with optional filters
   */
  async getAllCitizens(filters = {}) {
    let query = `
      MATCH (c:Citizen)
      ${filters.locationId ? 'MATCH (c)-[:LOCATED_IN]->(l:Location { location_id: $locationId })' : ''}
      ${filters.userGroupId ? 'MATCH (c)-[:BELONGS_TO]->(ug:UserGroup { group_id: $userGroupId })' : ''}
      RETURN c
      ORDER BY c.created_at DESC
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
      return neo4jService.recordsToArray(result.records, ['c']).map(r => r.c.properties);
    } catch (error) {
      logger.error('Failed to get citizens:', error);
      throw error;
    }
  }

  /**
   * Apply for a scheme
   */
  async applyCitizenForScheme(citizenId, schemeId) {
    const query = `
      MATCH (c:Citizen { citizen_id: $citizenId })
      MATCH (s:Scheme { scheme_id: $schemeId })
      CREATE (a:Application {
        application_id: $applicationId,
        status: 'PENDING',
        applied_at: timestamp(),
        updated_at: timestamp()
      })
      CREATE (c)-[:APPLIED_FOR { application: $applicationId }]->(s)
      RETURN a
    `;

    const applicationId = uuid();
    const params = { citizenId, schemeId, applicationId };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const application = neo4jService.recordToObject(result.records[0], ['a']);
      logger.info(`Citizen ${citizenId} applied for scheme ${schemeId}`);
      return application.a.properties;
    } catch (error) {
      logger.error('Failed to apply for scheme:', error);
      throw error;
    }
  }

  /**
   * Send nudge to citizen
   */
  async sendNudgeToCitizen(citizenId, nudgeData) {
    const { title, message, schemeId } = nudgeData;
    const nudgeId = uuid();

    const query = `
      MATCH (c:Citizen { citizen_id: $citizenId })
      ${schemeId ? 'MATCH (s:Scheme { scheme_id: $schemeId })' : ''}
      CREATE (n:Nudge {
        nudge_id: $nudgeId,
        title: $title,
        message: $message,
        sent_at: timestamp(),
        read: false
      })
      CREATE (c)-[:RECEIVED_NUDGE]->(n)
      ${schemeId ? 'CREATE (n)-[:FOR_SCHEME]->(s)' : ''}
      RETURN n
    `;

    const params = {
      citizenId,
      nudgeId,
      title,
      message,
      schemeId,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const nudge = neo4jService.recordToObject(result.records[0], ['n']);
      logger.info(`Sent nudge ${nudgeId} to citizen ${citizenId}`);
      return nudge.n.properties;
    } catch (error) {
      logger.error('Failed to send nudge:', error);
      throw error;
    }
  }
}

export default new CitizenService();
