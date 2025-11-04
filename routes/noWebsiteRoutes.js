const express = require('express');
const router = express.Router();
const noWebsiteController = require('../controllers/noWebsiteController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/scan', noWebsiteController.scanForBusinesses);
router.get('/searches/recent', noWebsiteController.getRecentSearches);
router.get('/searches/:searchId/results', noWebsiteController.getSearchResults);
router.post('/searches/:searchId/cancel', noWebsiteController.cancelSearch);
router.delete('/searches/:searchId', noWebsiteController.deleteSearch);

module.exports = router;
