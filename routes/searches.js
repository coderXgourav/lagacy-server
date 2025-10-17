const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// GET /api/searches - Get all searches
router.get('/', searchController.getAllSearches);

// GET /api/searches/recent - Get recent searches
router.get('/recent', searchController.getRecentSearches);

// GET /api/searches/:id - Get search by ID
router.get('/:id', searchController.getSearchById);

// POST /api/searches - Create new search
router.post('/', searchController.createSearch);

// PUT /api/searches/:id - Update search status
router.put('/:id', searchController.updateSearchStatus);

// DELETE /api/searches/:id - Delete search
router.delete('/:id', searchController.deleteSearch);

module.exports = router;
