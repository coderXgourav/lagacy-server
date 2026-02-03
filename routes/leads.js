const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

// GET /api/leads - Get all leads
router.get('/', leadController.getAllLeads);

// GET /api/leads/:id - Get lead by ID
router.get('/:id', leadController.getLeadById);

// GET /api/leads/search/:searchId - Get leads by search ID
router.get('/search/:searchId', leadController.getLeadsBySearchId);

// POST /api/leads - Create new lead
router.post('/', leadController.createLead);

// POST /api/leads/bulk - Create multiple leads
router.post('/bulk', leadController.createBulkLeads);

// PUT /api/leads/:id - Update lead
router.put('/:id', leadController.updateLead);

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', leadController.deleteLead);

module.exports = router;
