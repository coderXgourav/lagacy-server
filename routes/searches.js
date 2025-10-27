const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const downloadController = require('../controllers/downloadController');

// GET /api/searches - Get all searches
router.get('/', searchController.getAllSearches);

// GET /api/searches/recent - Get recent searches
router.get('/recent', searchController.getRecentSearches);

// GET /api/searches/downloadable - Get downloadable searches
router.get('/downloadable', downloadController.getDownloadableSearches);

// GET /api/searches/:id - Get search by ID
router.get('/:id', searchController.getSearchById);

// GET /api/searches/:searchId/results - Get search results
router.get('/:searchId/results', searchController.getSearchResults);

// GET /api/searches/:searchId/download - Download search results as Excel
router.get('/:searchId/download', downloadController.downloadSearchExcel);

// POST /api/searches - Create new search
router.post('/', searchController.createSearch);

// POST /api/searches/results - Store search results
router.post('/results', searchController.storeSearchResults);

// PUT /api/searches/:id - Update search status
router.put('/:id', searchController.updateSearchStatus);

// DELETE /api/searches/:id - Delete search
router.delete('/:id', searchController.deleteSearch);

module.exports = router;
