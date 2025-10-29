const express = require('express');
const router = express.Router();
const lowRatingController = require('../controllers/lowRatingController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/scan', lowRatingController.scanForLowRatingBusinesses);
router.get('/searches/recent', lowRatingController.getRecentSearches);
router.get('/searches/:searchId/results', lowRatingController.getSearchResults);
router.delete('/searches/:searchId', lowRatingController.deleteSearch);

module.exports = router;
