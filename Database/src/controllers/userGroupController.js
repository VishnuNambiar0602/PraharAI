import Joi from 'joi';
import userGroupService from '../services/userGroupService.js';
import logger from '../config/logger.js';

const createUserGroupSchema = Joi.object({
  name: Joi.string().required().min(3).max(100),
  income_range: Joi.string(),
  age_range: Joi.string(),
  occupation_type: Joi.string(),
  rural_urban: Joi.string().valid('Rural', 'Urban'),
  gender_priority: Joi.string(),
  description: Joi.string().max(500),
});

class UserGroupController {
  /**
   * Create a new user group
   * POST /api/v1/user-groups
   */
  async createUserGroup(req, res) {
    try {
      const { error, value } = createUserGroupSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message),
        });
      }

      const userGroup = await userGroupService.createUserGroup(value);
      
      res.status(201).json({
        success: true,
        message: 'User group created successfully',
        data: userGroup,
      });
    } catch (error) {
      logger.error('Failed to create user group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user group',
        error: error.message,
      });
    }
  }

  /**
   * Get all user groups
   * GET /api/v1/user-groups
   */
  async getAllUserGroups(req, res) {
    try {
      const filters = {
        skip: parseInt(req.query.skip) || 0,
        limit: parseInt(req.query.limit) || 50,
        nameContains: req.query.nameContains,
      };

      const userGroups = await userGroupService.getAllUserGroups(filters);
      
      res.status(200).json({
        success: true,
        count: userGroups.length,
        data: userGroups,
      });
    } catch (error) {
      logger.error('Failed to get user groups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user groups',
        error: error.message,
      });
    }
  }

  /**
   * Get user group by ID
   * GET /api/v1/user-groups/:groupId
   */
  async getUserGroup(req, res) {
    try {
      const { groupId } = req.params;

      const userGroup = await userGroupService.getUserGroupById(groupId);
      
      if (!userGroup) {
        return res.status(404).json({
          success: false,
          message: 'User group not found',
        });
      }

      res.status(200).json({
        success: true,
        data: userGroup,
      });
    } catch (error) {
      logger.error('Failed to get user group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user group',
        error: error.message,
      });
    }
  }

  /**
   * Get prescribed user groups (buckets)
   * GET /api/v1/user-groups/predefined
   */
  async getPredefinedGroups(req, res) {
    try {
      const groups = await userGroupService.getPredefinedGroups();
      
      res.status(200).json({
        success: true,
        count: groups.length,
        data: groups,
      });
    } catch (error) {
      logger.error('Failed to get predefined groups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve predefined groups',
        error: error.message,
      });
    }
  }

  /**
   * Initialize default user groups
   * POST /api/v1/user-groups/init-defaults
   */
  async initializeDefaults(req, res) {
    try {
      const results = await userGroupService.initializeDefaultGroups();
      
      res.status(200).json({
        success: true,
        message: 'Default user groups initialization complete',
        data: results,
      });
    } catch (error) {
      logger.error('Failed to initialize defaults:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize default groups',
        error: error.message,
      });
    }
  }

  /**
   * Get citizens in user group
   * GET /api/v1/user-groups/:groupId/citizens
   */
  async getCitizensInGroup(req, res) {
    try {
      const { groupId } = req.params;
      const pagination = {
        skip: parseInt(req.query.skip) || 0,
        limit: parseInt(req.query.limit) || 50,
      };

      const citizens = await userGroupService.getCitizensInGroup(groupId, pagination);
      
      res.status(200).json({
        success: true,
        count: citizens.length,
        data: citizens,
      });
    } catch (error) {
      logger.error('Failed to get citizens in group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve citizens',
        error: error.message,
      });
    }
  }

  /**
   * Get schemes for user group
   * GET /api/v1/user-groups/:groupId/schemes
   */
  async getSchemesForGroup(req, res) {
    try {
      const { groupId } = req.params;

      const schemes = await userGroupService.getSchemesForUserGroup(groupId);
      
      res.status(200).json({
        success: true,
        count: schemes.length,
        data: schemes,
      });
    } catch (error) {
      logger.error('Failed to get schemes for group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve schemes',
        error: error.message,
      });
    }
  }

  /**
   * Update user group
   * PUT /api/v1/user-groups/:groupId
   */
  async updateUserGroup(req, res) {
    try {
      const { groupId } = req.params;
      const updateData = req.body;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update provided',
        });
      }

      const userGroup = await userGroupService.updateUserGroup(groupId, updateData);
      
      res.status(200).json({
        success: true,
        message: 'User group updated successfully',
        data: userGroup,
      });
    } catch (error) {
      logger.error('Failed to update user group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user group',
        error: error.message,
      });
    }
  }
}

export default new UserGroupController();
