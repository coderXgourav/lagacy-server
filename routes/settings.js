const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// GET /api/settings - Get all settings
router.get('/', settingsController.getSettings);

// PUT /api/settings - Update settings
router.put('/', settingsController.updateSettings);

// PUT /api/settings/api-keys - Update API keys
router.put('/api-keys', settingsController.updateApiKeys);

module.exports = router;
