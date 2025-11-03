const NewBusinessSearch = require('../models/NewBusinessSearch');
const NewBusiness = require('../models/NewBusiness');
const overpassService = require('../services/overpassService');

exports.scanNewBusinesses = async (req, res) => {
  try {
    const { city, state, country, radius = 5000, niche, daysBack = 30, leads = 100 } = req.body;
    const userId = req.user._id;

    if (!city || !country) {
      return res.status(400).json({ success: false, message: 'City and country are required' });
    }

    const search = await NewBusinessSearch.create({
      userId, city, state, country, radius, niche, daysBack, leads, status: 'processing'
    });

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);

    const businesses = await overpassService.findNewBusinesses({
      city, state, country, radius, niche, dateThreshold, limit: leads
    });

    const savedBusinesses = [];
    for (const business of businesses) {
      const saved = await NewBusiness.create({
        searchId: search._id,
        userId,
        businessName: business.name,
        phone: business.phone,
        website: business.website,
        address: business.address,
        city: business.city || city,
        state: business.state || state,
        country: business.country || country,
        niche: business.niche || niche,
        registrationDate: business.timestamp,
        location: business.location,
        osmId: business.osmId
      });
      savedBusinesses.push(saved);
      if (savedBusinesses.length >= leads) break;
    }

    search.resultsCount = savedBusinesses.length;
    search.status = 'completed';
    await search.save();

    res.json({
      success: true,
      message: `Found ${savedBusinesses.length} newly registered businesses`,
      count: savedBusinesses.length,
      searchId: search._id,
      data: savedBusinesses
    });
  } catch (error) {
    console.error('New business scan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Scan failed' });
  }
};

exports.getRecentSearches = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;
    const searches = await NewBusinessSearch.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, searches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSearchResults = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const search = await NewBusinessSearch.findOne({ _id: id, userId });
    if (!search) return res.status(404).json({ success: false, message: 'Search not found' });
    const results = await NewBusiness.find({ searchId: id, userId });
    res.json({ success: true, search, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSearch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const search = await NewBusinessSearch.findOneAndDelete({ _id: id, userId });
    if (!search) return res.status(404).json({ success: false, message: 'Search not found' });
    await NewBusiness.deleteMany({ searchId: id, userId });
    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
