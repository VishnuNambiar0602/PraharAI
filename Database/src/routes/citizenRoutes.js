import express from 'express';
import citizenController from '../controllers/citizenController.js';

const router = express.Router();

// Citizens
router.post('/', citizenController.createCitizen);
router.get('/', citizenController.getAllCitizens);
router.get('/:citizenId', citizenController.getCitizen);

// Apply for scheme
router.post('/:citizenId/apply/:schemeId', citizenController.applyCitizenForScheme);

// Nudges
router.post('/:citizenId/nudge', citizenController.sendNudge);

// User groups
router.post('/:citizenId/groups', citizenController.addToUserGroups);

export default router;
