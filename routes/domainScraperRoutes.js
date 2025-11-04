const express = require('express');
const router = express.Router();
const domainScraperController = require('../controllers/domainScraperController');
const auth = require('../middleware/auth');

router.get('/stats', auth, domainScraperController.getDashboardStats);
router.post('/scrape', auth, domainScraperController.triggerScrape);
router.get('/domains', auth, domainScraperController.getAllDomains);
router.get('/status', auth, domainScraperController.getStatus);

module.exports = router;
