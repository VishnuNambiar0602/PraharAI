import Joi from 'joi';
import citizenService from '../services/citizenService.js';
import logger from '../config/logger.js';

// Validation schemas
const createCitizenSchema = Joi.object({
  name: Joi.string().required().min(3).max(100),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  aadhar: Joi.string().pattern(/^[0-9]{12}$/).required(),
  locationId: Joi.string().uuid(),
  userGroupIds: Joi.array().items(Joi.string().uuid()),
});

class CitizenController {
  /**
   * Create a new citizen
   * POST /api/v1/citizens
   */
  async createCitizen(req, res) {
    try {
      const { error, value } = createCitizenSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message),
        });
      }

      const citizen = await citizenService.createCitizen(value);
      
      res.status(201).json({
        success: true,
        message: 'Citizen created successfully',
        data: citizen,
      });
    } catch (error) {
      logger.error('Failed to create citizen:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create citizen',
        error: error.message,
      });
    }
  }

  /**
   * Get citizen by ID
   * GET /api/v1/citizens/:citizenId
   */
  async getCitizen(req, res) {
    try {
      const { citizenId } = req.params;

      const citizen = await citizenService.getCitizenById(citizenId);
      
      if (!citizen) {
        return res.status(404).json({
          success: false,
          message: 'Citizen not found',
        });
      }

      res.status(200).json({
        success: true,
        data: citizen,
      });
    } catch (error) {
      logger.error('Failed to get citizen:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve citizen',
        error: error.message,
      });
    }
  }

  /**
   * Get all citizens
   * GET /api/v1/citizens
   */
  async getAllCitizens(req, res) {
    try {
      const filters = {
        skip: parseInt(req.query.skip) || 0,
        limit: parseInt(req.query.limit) || 50,
        locationId: req.query.locationId,
        userGroupId: req.query.userGroupId,
      };

      const citizens = await citizenService.getAllCitizens(filters);
      
      res.status(200).json({
        success: true,
        count: citizens.length,
        data: citizens,
      });
    } catch (error) {
      logger.error('Failed to get citizens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve citizens',
        error: error.message,
      });
    }
  }

  /**
   * Apply for a scheme
   * POST /api/v1/citizens/:citizenId/apply/:schemeId
   */
  async applyCitizenForScheme(req, res) {
    try {
      const { citizenId, schemeId } = req.params;

      const application = await citizenService.applyCitizenForScheme(citizenId, schemeId);
      
      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: application,
      });
    } catch (error) {
      logger.error('Failed to apply for scheme:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit application',
        error: error.message,
      });
    }
  }

  /**
   * Send nudge to citizen
   * POST /api/v1/citizens/:citizenId/nudge
   */
  async sendNudge(req, res) {
    try {
      const { citizenId } = req.params;
      const { title, message, schemeId } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required',
        });
      }

      const nudge = await citizenService.sendNudgeToCitizen(citizenId, {
        title,
        message,
        schemeId,
      });
      
      res.status(201).json({
        success: true,
        message: 'Nudge sent successfully',
        data: nudge,
      });
    } catch (error) {
      logger.error('Failed to send nudge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send nudge',
        error: error.message,
      });
    }
  }

  /**
   * Add citizen to user groups
   * POST /api/v1/citizens/:citizenId/groups
   */
  async addToUserGroups(req, res) {
    try {
      const { citizenId } = req.params;
      const { userGroupIds } = req.body;

      if (!Array.isArray(userGroupIds) || userGroupIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'userGroupIds array is required and must not be empty',
        });
      }

      await citizenService.addCitizenToUserGroups(citizenId, userGroupIds);
      
      res.status(200).json({
        success: true,
        message: `Citizen added to ${userGroupIds.length} user groups`,
      });
    } catch (error) {
      logger.error('Failed to add citizen to groups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add citizen to groups',
        error: error.message,
      });
    }
  }
}

export default new CitizenController();
