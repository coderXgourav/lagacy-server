const express = require('express');
const router = express.Router();
const newDomainController = require('../controllers/newDomainController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/scan', newDomainController.scanNewDomains);
router.get('/searches/recent', newDomainController.getRecentSearches);
router.get('/searches/:id/results', newDomainController.getSearchResults);
router.post('/searches/:id/cancel', newDomainController.cancelSearch);
router.delete('/searches/:id', newDomainController.deleteSearch);

module.exports = router;
