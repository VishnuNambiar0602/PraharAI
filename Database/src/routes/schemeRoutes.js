import express from 'express';
import schemeController from '../controllers/schemeController.js';

const router = express.Router();

// Schemes
router.post('/', schemeController.createScheme);
router.get('/', schemeController.getAllSchemes);
router.get('/:schemeId', schemeController.getScheme);

// Relations
router.post('/:schemeId/link-user-group/:userGroupId', schemeController.linkToUserGroup);
router.post('/:schemeId/link-location/:locationId', schemeController.linkToLocation);
router.post('/:schemeId/rules', schemeController.addEligibilityRule);

// Eligibility
router.get('/:schemeId/check-eligibility/:citizenId', schemeController.checkEligibility);

export default router;
