const express = require('express');
const router = express.Router();
const searchExecutionController = require('../controllers/searchExecutionController');

// Execute a new search
router.post('/execute', searchExecutionController.executeSearch);

// Get search status
router.get('/status/:id', searchExecutionController.getSearchStatus);

// Get all searches (for history)
router.get('/all', searchExecutionController.getAllSearches);

module.exports = router;
