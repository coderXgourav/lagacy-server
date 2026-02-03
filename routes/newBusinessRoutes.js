const express = require('express');
const router = express.Router();
const newBusinessController = require('../controllers/newBusinessController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/scan', newBusinessController.scanNewBusinesses);
router.get('/searches/recent', newBusinessController.getRecentSearches);
router.get('/searches/:id/results', newBusinessController.getSearchResults);
router.post('/searches/:id/cancel', newBusinessController.cancelSearch);
router.delete('/searches/:id', newBusinessController.deleteSearch);

module.exports = router;
