const express = require('express');
const router = express.Router();
const SearchHistory = require('../models/SearchHistory');
const Business = require('../models/Business');

// GET all search history
router.get('/', async (req, res) => {
  try {
    const history = await SearchHistory.find().sort({ createdAt: -1 }).limit(50);
    res.json({ count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history', details: error.message });
  }
});

// GET businesses from specific search
router.get('/:searchId/businesses', async (req, res) => {
  try {
    const { searchId } = req.params;
    const search = await SearchHistory.findById(searchId);
    
    if (!search) {
      return res.status(404).json({ error: 'Search not found' });
    }

    const businesses = await Business.find({
      'location.city': search.city,
      'location.country': search.country,
      scannedAt: { $gte: new Date(search.createdAt.getTime() - 60000) }
    }).sort({ scannedAt: -1 });

    res.json({ count: businesses.length, data: businesses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch businesses', details: error.message });
  }
});

// DELETE search history
router.delete('/:searchId', async (req, res) => {
  try {
    const { searchId } = req.params;
    await SearchHistory.findByIdAndDelete(searchId);
    res.json({ message: 'Search history deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete history', details: error.message });
  }
});

module.exports = router;
