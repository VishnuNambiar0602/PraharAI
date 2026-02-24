import neo4jService from './neo4jService.js';
import { v4 as uuid } from 'uuid';
import logger from '../config/logger.js';

// Enum for user group types
export const USER_GROUP_TYPES = {
  FARMER: 'Farmer',
  STUDENT: 'Student',
  SENIOR_CITIZEN: 'Senior Citizen',
  LOW_INCOME_WORKER: 'Low Income Worker',
  WOMEN: 'Women',
  MSME_SELF_EMPLOYED: 'MSME / Self-employed',
  DISABLED: 'Disabled',
  RURAL_HOUSEHOLD: 'Rural Household',
  URBAN_BPL: 'Urban BPL',
};

class UserGroupService {
  /**
   * Create a new user group (segment/bucket)
   */
  async createUserGroup(groupData) {
    const {
      name,
      income_range = null,
      age_range = null,
      occupation_type = null,
      rural_urban = null,
      gender_priority = null,
      description = ''
    } = groupData;

    const groupId = uuid();

    const query = `
      CREATE (ug:UserGroup {
        group_id: $groupId,
        name: $name,
        income_range: $incomeRange,
        age_range: $ageRange,
        occupation_type: $occupationType,
        rural_urban: $ruralUrban,
        gender_priority: $genderPriority,
        description: $description,
        created_at: timestamp(),
        updated_at: timestamp(),
        member_count: 0
      })
      RETURN ug
    `;

    const params = {
      groupId,
      name,
      incomeRange: income_range,
      ageRange: age_range,
      occupationType: occupation_type,
      ruralUrban: rural_urban,
      genderPriority: gender_priority,
      description,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const userGroup = neo4jService.recordToObject(result.records[0], ['ug']);
      logger.info(`Created user group: ${groupId} (${name})`);
      return userGroup.ug.properties;
    } catch (error) {
      logger.error('Failed to create user group:', error);
      throw error;
    }
  }

  /**
   * Get all predefined user groups (buckets)
   */
  async getPredefinedGroups() {
    const groups = [
      {
        name: USER_GROUP_TYPES.FARMER,
        occupation_type: 'Agriculture',
        description: 'Farmers and agricultural laborers',
      },
      {
        name: USER_GROUP_TYPES.STUDENT,
        age_range: '18-25',
        description: 'Students pursuing education',
      },
      {
        name: USER_GROUP_TYPES.SENIOR_CITIZEN,
        age_range: '60+',
        description: 'Senior citizens aged 60 and above',
      },
      {
        name: USER_GROUP_TYPES.LOW_INCOME_WORKER,
        income_range: '0-250000',
        description: 'Workers with low annual income',
      },
      {
        name: USER_GROUP_TYPES.WOMEN,
        gender_priority: 'Female',
        description: 'Women-focused schemes and programs',
      },
      {
        name: USER_GROUP_TYPES.MSME_SELF_EMPLOYED,
        occupation_type: 'Self-employed',
        description: 'Micro, Small & Medium Enterprises and self-employed',
      },
      {
        name: USER_GROUP_TYPES.DISABLED,
        description: 'Persons with disabilities',
      },
      {
        name: USER_GROUP_TYPES.RURAL_HOUSEHOLD,
        rural_urban: 'Rural',
        description: 'Households in rural areas',
      },
      {
        name: USER_GROUP_TYPES.URBAN_BPL,
        rural_urban: 'Urban',
        income_range: '0-150000',
        description: 'Urban households below poverty line',
      },
    ];

    return groups;
  }

  /**
   * Initialize default user groups
   */
  async initializeDefaultGroups() {
    const groups = await this.getPredefinedGroups();
    const results = [];

    for (const groupData of groups) {
      try {
        // Check if group already exists
        const existingQuery = `
          MATCH (ug:UserGroup { name: $name })
          RETURN ug
        `;
        const existing = await neo4jService.executeQuery(existingQuery, { name: groupData.name });
        
        if (existing.records.length === 0) {
          const created = await this.createUserGroup(groupData);
          results.push({ status: 'created', ...created });
        } else {
          results.push({ status: 'exists', name: groupData.name });
        }
      } catch (error) {
        logger.error(`Failed to initialize group ${groupData.name}:`, error);
        results.push({ status: 'failed', name: groupData.name, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get user group by ID
   */
  async getUserGroupById(groupId) {
    const query = `
      MATCH (ug:UserGroup { group_id: $groupId })
      OPTIONAL MATCH (c:Citizen)-[:BELONGS_TO]->(ug)
      RETURN ug, count(c) as member_count
    `;

    try {
      const result = await neo4jService.executeQuery(query, { groupId });
      
      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const userGroup = record.get('ug').properties;
      const memberCount = record.get('member_count').toNumber();

      return { ...userGroup, member_count: memberCount };
    } catch (error) {
      logger.error('Failed to get user group:', error);
      throw error;
    }
  }

  /**
   * Get all user groups
   */
  async getAllUserGroups(filters = {}) {
    let query = `
      MATCH (ug:UserGroup)
      ${filters.nameContains ? 'WHERE ug.name CONTAINS $nameContains' : ''}
      OPTIONAL MATCH (c:Citizen)-[:BELONGS_TO]->(ug)
      WITH ug, count(c) as member_count
      RETURN ug, member_count
      ORDER BY ug.created_at DESC
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
      return result.records.map(record => ({
        ...record.get('ug').properties,
        member_count: record.get('member_count').toNumber(),
      }));
    } catch (error) {
      logger.error('Failed to get user groups:', error);
      throw error;
    }
  }

  /**
   * Get citizens in a user group
   */
  async getCitizensInGroup(groupId, pagination = {}) {
    const query = `
      MATCH (ug:UserGroup { group_id: $groupId })
      MATCH (c:Citizen)-[:BELONGS_TO]->(ug)
      RETURN c
      ORDER BY c.created_at DESC
      SKIP $skip
      LIMIT $limit
    `;

    const params = {
      groupId,
      skip: pagination.skip || 0,
      limit: pagination.limit || 50,
    };

    try {
      const result = await neo4jService.executeQuery(query, params);
      return neo4jService.recordsToArray(result.records, ['c']).map(r => r.c.properties);
    } catch (error) {
      logger.error('Failed to get citizens in group:', error);
      throw error;
    }
  }

  /**
   * Update user group
   */
  async updateUserGroup(groupId, updateData) {
    const setClauses = Object.keys(updateData)
      .map(key => `ug.${key} = $${key}`)
      .join(', ');

    if (!setClauses) {
      throw new Error('No fields to update');
    }

    const query = `
      MATCH (ug:UserGroup { group_id: $groupId })
      SET ${setClauses}, ug.updated_at = timestamp()
      RETURN ug
    `;

    const params = { groupId, ...updateData };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const userGroup = neo4jService.recordToObject(result.records[0], ['ug']);
      logger.info(`Updated user group: ${groupId}`);
      return userGroup.ug.properties;
    } catch (error) {
      logger.error('Failed to update user group:', error);
      throw error;
    }
  }

  /**
   * Get eligible schemes for a user group
   */
  async getSchemesForUserGroup(groupId) {
    const query = `
      MATCH (ug:UserGroup { group_id: $groupId })
      MATCH (s:Scheme)-[:TARGETS]->(ug)
      RETURN s
    `;

    try {
      const result = await neo4jService.executeQuery(query, { groupId });
      return neo4jService.recordsToArray(result.records, ['s']).map(r => r.s.properties);
    } catch (error) {
      logger.error('Failed to get schemes for user group:', error);
      throw error;
    }
  }
}

export default new UserGroupService();
