import express from 'express';
import userGroupController from '../controllers/userGroupController.js';

const router = express.Router();

// User groups
router.post('/', userGroupController.createUserGroup);
router.get('/', userGroupController.getAllUserGroups);
router.get('/:groupId', userGroupController.getUserGroup);
router.put('/:groupId', userGroupController.updateUserGroup);

// Predefined groups
router.get('/predefined/list', userGroupController.getPredefinedGroups);
router.post('/init/defaults', userGroupController.initializeDefaults);

// Relations
router.get('/:groupId/citizens', userGroupController.getCitizensInGroup);
router.get('/:groupId/schemes', userGroupController.getSchemesForGroup);

export default router;
