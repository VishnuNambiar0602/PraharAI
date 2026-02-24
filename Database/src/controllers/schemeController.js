import Joi from 'joi';
import schemeService from '../services/schemeService.js';
import logger from '../config/logger.js';

const createSchemeSchema = Joi.object({
  name: Joi.string().required().min(5).max(200),
  description: Joi.string().required().max(1000),
  category: Joi.string().required(),
  launch_date: Joi.date().required(),
  budget: Joi.number().positive().required(),
  target_audience: Joi.string().required(),
  api_endpoint: Joi.string().uri(),
});

class SchemeController {
  /**
   * Create a new scheme
   * POST /api/v1/schemes
   */
  async createScheme(req, res) {
    try {
      const { error, value } = createSchemeSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message),
        });
      }

      const scheme = await schemeService.createScheme(value);
      
      res.status(201).json({
        success: true,
        message: 'Scheme created successfully',
        data: scheme,
      });
    } catch (error) {
      logger.error('Failed to create scheme:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create scheme',
        error: error.message,
      });
    }
  }

  /**
   * Get scheme by ID
   * GET /api/v1/schemes/:schemeId
   */
  async getScheme(req, res) {
    try {
      const { schemeId } = req.params;

      const scheme = await schemeService.getSchemeById(schemeId);
      
      if (!scheme) {
        return res.status(404).json({
          success: false,
          message: 'Scheme not found',
        });
      }

      res.status(200).json({
        success: true,
        data: scheme,
      });
    } catch (error) {
      logger.error('Failed to get scheme:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve scheme',
        error: error.message,
      });
    }
  }

  /**
   * Get all schemes
   * GET /api/v1/schemes
   */
  async getAllSchemes(req, res) {
    try {
      const filters = {
        skip: parseInt(req.query.skip) || 0,
        limit: parseInt(req.query.limit) || 50,
        category: req.query.category,
        isActive: req.query.isActive === 'true',
      };

      const schemes = await schemeService.getAllSchemes(filters);
      
      res.status(200).json({
        success: true,
        count: schemes.length,
        data: schemes,
      });
    } catch (error) {
      logger.error('Failed to get schemes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve schemes',
        error: error.message,
      });
    }
  }

  /**
   * Link scheme to user group
   * POST /api/v1/schemes/:schemeId/link-user-group/:userGroupId
   */
  async linkToUserGroup(req, res) {
    try {
      const { schemeId, userGroupId } = req.params;

      await schemeService.linkSchemeToUserGroup(schemeId, userGroupId);
      
      res.status(200).json({
        success: true,
        message: 'Scheme linked to user group successfully',
      });
    } catch (error) {
      logger.error('Failed to link scheme to user group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to link scheme to user group',
        error: error.message,
      });
    }
  }

  /**
   * Link scheme to location
   * POST /api/v1/schemes/:schemeId/link-location/:locationId
   */
  async linkToLocation(req, res) {
    try {
      const { schemeId, locationId } = req.params;

      await schemeService.linkSchemeToLocation(schemeId, locationId);
      
      res.status(200).json({
        success: true,
        message: 'Scheme linked to location successfully',
      });
    } catch (error) {
      logger.error('Failed to link scheme to location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to link scheme to location',
        error: error.message,
      });
    }
  }

  /**
   * Add eligibility rule to scheme
   * POST /api/v1/schemes/:schemeId/rules
   */
  async addEligibilityRule(req, res) {
    try {
      const { schemeId } = req.params;
      const { rule_name, rule_condition, rule_value, field_name } = req.body;

      if (!rule_name || !rule_condition || !field_name) {
        return res.status(400).json({
          success: false,
          message: 'rule_name, rule_condition, and field_name are required',
        });
      }

      const rule = await schemeService.addEligibilityRule(schemeId, {
        rule_name,
        rule_condition,
        rule_value,
        field_name,
      });
      
      res.status(201).json({
        success: true,
        message: 'Eligibility rule added successfully',
        data: rule,
      });
    } catch (error) {
      logger.error('Failed to add eligibility rule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add eligibility rule',
        error: error.message,
      });
    }
  }

  /**
   * Check citizen eligibility
   * GET /api/v1/schemes/:schemeId/check-eligibility/:citizenId
   */
  async checkEligibility(req, res) {
    try {
      const { schemeId, citizenId } = req.params;

      const eligibility = await schemeService.checkCitizenEligibility(citizenId, schemeId);
      
      res.status(200).json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      logger.error('Failed to check eligibility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check eligibility',
        error: error.message,
      });
    }
  }
}

export default new SchemeController();
