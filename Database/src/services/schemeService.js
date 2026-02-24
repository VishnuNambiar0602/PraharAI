import neo4jService from './neo4jService.js';
import { v4 as uuid } from 'uuid';
import logger from '../config/logger.js';

class SchemeService {
  /**
   * Create a new scheme
   */
  async createScheme(schemeData) {
    const {
      name,
      description,
      category,
      launch_date,
      budget,
      target_audience,
      api_endpoint = null,
    } = schemeData;

    const schemeId = uuid();

    const query = `
      CREATE (s:Scheme {
        scheme_id: $schemeId,
        name: $name,
        description: $description,
        category: $category,
        launch_date: $launchDate,
        budget: $budget,
        target_audience: $targetAudience,
        api_endpoint: $apiEndpoint,
        created_at: timestamp(),
        updated_at: timestamp(),
        is_active: true
      })
      RETURN s
    `;

    const params = {
      schemeId,
      name,
      description,
      category,
      launchDate: launch_date,
      budget,
      targetAudience: target_audience,
      apiEndpoint: api_endpoint,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const scheme = neo4jService.recordToObject(result.records[0], ['s']);
      logger.info(`Created scheme: ${schemeId} (${name})`);
      return scheme.s.properties;
    } catch (error) {
      logger.error('Failed to create scheme:', error);
      throw error;
    }
  }

  /**
   * Get scheme by ID with all relationships
   */
  async getSchemeById(schemeId) {
    const query = `
      MATCH (s:Scheme { scheme_id: $schemeId })
      OPTIONAL MATCH (s)-[:TARGETS]->(ug:UserGroup)
      OPTIONAL MATCH (s)-[:VALID_IN]->(l:Location)
      OPTIONAL MATCH (s)-[:REQUIRES]->(d:Document)
      OPTIONAL MATCH (s)-[:HAS_RULE]->(er:EligibilityRule)
      OPTIONAL MATCH (s)-[:FETCHED_FROM]->(ga:GovAPI)
      RETURN s, collect(DISTINCT ug) as targetUserGroups, 
             collect(DISTINCT l) as locations,
             collect(DISTINCT d) as requiredDocuments,
             collect(DISTINCT er) as eligibilityRules,
             collect(DISTINCT ga) as govAPIs
    `;

    try {
      const result = await neo4jService.executeQuery(query, { schemeId });
      
      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const scheme = record.get('s').properties;
      const targetUserGroups = record.get('targetUserGroups')
        .filter(ug => ug !== null)
        .map(ug => ug.properties);
      const locations = record.get('locations')
        .filter(l => l !== null)
        .map(l => l.properties);
      const requiredDocuments = record.get('requiredDocuments')
        .filter(d => d !== null)
        .map(d => d.properties);
      const eligibilityRules = record.get('eligibilityRules')
        .filter(er => er !== null)
        .map(er => er.properties);
      const govAPIs = record.get('govAPIs')
        .filter(ga => ga !== null)
        .map(ga => ga.properties);

      return {
        ...scheme,
        targetUserGroups,
        locations,
        requiredDocuments,
        eligibilityRules,
        govAPIs,
      };
    } catch (error) {
      logger.error('Failed to get scheme:', error);
      throw error;
    }
  }

  /**
   * Get all schemes
   */
  async getAllSchemes(filters = {}) {
    let query = `
      MATCH (s:Scheme)
      ${filters.isActive !== undefined ? 'WHERE s.is_active = $isActive' : ''}
      ${filters.category ? 'WHERE s.category = $category' : ''}
      RETURN s
      ORDER BY s.created_at DESC
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
      return neo4jService.recordsToArray(result.records, ['s']).map(r => r.s.properties);
    } catch (error) {
      logger.error('Failed to get schemes:', error);
      throw error;
    }
  }

  /**
   * Link scheme to user group (targets)
   */
  async linkSchemeToUserGroup(schemeId, userGroupId) {
    const query = `
      MATCH (s:Scheme { scheme_id: $schemeId })
      MATCH (ug:UserGroup { group_id: $userGroupId })
      MERGE (s)-[:TARGETS]->(ug)
    `;

    try {
      await neo4jService.executeQuery(query, { schemeId, userGroupId }, 'WRITE');
      logger.info(`Linked scheme ${schemeId} to user group ${userGroupId}`);
    } catch (error) {
      logger.error('Failed to link scheme to user group:', error);
      throw error;
    }
  }

  /**
   * Link scheme to location (valid_in)
   */
  async linkSchemeToLocation(schemeId, locationId) {
    const query = `
      MATCH (s:Scheme { scheme_id: $schemeId })
      MATCH (l:Location { location_id: $locationId })
      MERGE (s)-[:VALID_IN]->(l)
    `;

    try {
      await neo4jService.executeQuery(query, { schemeId, locationId }, 'WRITE');
      logger.info(`Linked scheme ${schemeId} to location ${locationId}`);
    } catch (error) {
      logger.error('Failed to link scheme to location:', error);
      throw error;
    }
  }

  /**
   * Add required document to scheme
   */
  async addRequiredDocument(schemeId, documentId) {
    const query = `
      MATCH (s:Scheme { scheme_id: $schemeId })
      MATCH (d:Document { document_id: $documentId })
      MERGE (s)-[:REQUIRES]->(d)
    `;

    try {
      await neo4jService.executeQuery(query, { schemeId, documentId }, 'WRITE');
      logger.info(`Added required document ${documentId} to scheme ${schemeId}`);
    } catch (error) {
      logger.error('Failed to add required document:', error);
      throw error;
    }
  }

  /**
   * Add eligibility rule to scheme
   */
  async addEligibilityRule(schemeId, ruleData) {
    const {
      rule_name,
      rule_condition,
      rule_value,
      field_name,
    } = ruleData;

    const ruleId = uuid();

    const query = `
      MATCH (s:Scheme { scheme_id: $schemeId })
      CREATE (er:EligibilityRule {
        rule_id: $ruleId,
        rule_name: $ruleName,
        rule_condition: $ruleCondition,
        rule_value: $ruleValue,
        field_name: $fieldName,
        created_at: timestamp()
      })
      CREATE (s)-[:HAS_RULE]->(er)
      RETURN er
    `;

    const params = {
      schemeId,
      ruleId,
      ruleName: rule_name,
      ruleCondition: rule_condition,
      ruleValue: rule_value,
      fieldName: field_name,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const rule = neo4jService.recordToObject(result.records[0], ['er']);
      logger.info(`Added eligibility rule ${ruleId} to scheme ${schemeId}`);
      return rule.er.properties;
    } catch (error) {
      logger.error('Failed to add eligibility rule:', error);
      throw error;
    }
  }

  /**
   * Link scheme to government API
   */
  async linkSchemeToGovAPI(schemeId, govAPIId) {
    const query = `
      MATCH (s:Scheme { scheme_id: $schemeId })
      MATCH (ga:GovAPI { api_id: $govAPIId })
      MERGE (s)-[:FETCHED_FROM]->(ga)
    `;

    try {
      await neo4jService.executeQuery(query, { schemeId, govAPIId }, 'WRITE');
      logger.info(`Linked scheme ${schemeId} to GovAPI ${govAPIId}`);
    } catch (error) {
      logger.error('Failed to link scheme to GovAPI:', error);
      throw error;
    }
  }

  /**
   * Check citizen eligibility for scheme
   */
  async checkCitizenEligibility(citizenId, schemeId) {
    const query = `
      MATCH (c:Citizen { citizen_id: $citizenId })
      MATCH (s:Scheme { scheme_id: $schemeId })
      OPTIONAL MATCH (c)-[:BELONGS_TO]->(ug:UserGroup)
      OPTIONAL MATCH (s)-[:TARGETS]->(targetUG:UserGroup)
      WITH c, s, ug, targetUG,
           EXISTS { MATCH (ug)-[:BELONGS_TO*1..-1]->(targetUG) OR (ug) = (targetUG) } as isGroupMatch
      OPTIONAL MATCH (c)-[:LOCATED_IN]->(l:Location)
      OPTIONAL MATCH (s)-[:VALID_IN]->(validL:Location)
      WITH c, s, isGroupMatch, l, validL,
           EXISTS { MATCH (l)-[:LOCATED_IN*1..-1]->(validL) OR (l) = (validL) } as isLocationMatch
      RETURN {
        eligible: isGroupMatch AND isLocationMatch,
        groupMatch: isGroupMatch,
        locationMatch: isLocationMatch,
        citizenId: c.citizen_id,
        schemeId: s.scheme_id
      } as eligibility
    `;

    try {
      const result = await neo4jService.executeQuery(query, { citizenId, schemeId });
      
      if (result.records.length === 0) {
        return { eligible: false, reason: 'Citizen or scheme not found' };
      }

      return result.records[0].get('eligibility');
    } catch (error) {
      logger.error('Failed to check eligibility:', error);
      throw error;
    }
  }
}

export default new SchemeService();
