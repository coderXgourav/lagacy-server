const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const searchController = require('../controllers/searchController');
const downloadController = require('../controllers/downloadController');

// GET /api/searches - Get all searches
router.get('/', authMiddleware, searchController.getAllSearches);

// GET /api/searches/recent - Get recent searches
router.get('/recent', authMiddleware, searchController.getRecentSearches);

// GET /api/searches/downloadable - Get downloadable searches
router.get('/downloadable', authMiddleware, downloadController.getDownloadableSearches);

// GET /api/searches/:id - Get search by ID
router.get('/:id', authMiddleware, searchController.getSearchById);

// GET /api/searches/:searchId/results - Get search results
router.get('/:searchId/results', authMiddleware, searchController.getSearchResults);

// GET /api/searches/:searchId/download - Download search results as Excel
router.get('/:searchId/download', authMiddleware, downloadController.downloadSearchExcel);

// POST /api/searches - Create new search
router.post('/', authMiddleware, searchController.createSearch);

// POST /api/searches/results - Store search results
router.post('/results', authMiddleware, searchController.storeSearchResults);

// PUT /api/searches/:id - Update search status
router.put('/:id', authMiddleware, searchController.updateSearchStatus);

// DELETE /api/searches/:id - Delete search
router.delete('/:id', authMiddleware, searchController.deleteSearch);

module.exports = router;
