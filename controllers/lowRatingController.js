const LowRatingSearch = require('../models/LowRatingSearch');
const LowRatingBusiness = require('../models/LowRatingBusiness');
const googlePlacesService = require('../services/lowRatingGoogleService.optimized');
const logger = require('../src/utils/logger');

exports.scanForLowRatingBusinesses = async (req, res) => {
  try {
    const { city, state, country, radius, niche, maxRating, leads } = req.body;
    const userId = req.user._id;

    if (!city || !country) {
      return res.status(400).json({ success: false, message: 'City and country are required' });
    }

    const ratingThreshold = maxRating || 3.0;
    if (ratingThreshold < 1.0 || ratingThreshold > 5.0) {
      return res.status(400).json({ success: false, message: 'maxRating must be between 1.0 and 5.0' });
    }

    const search = await LowRatingSearch.create({
      userId,
      city,
      state,
      country,
      radius: radius || 5000,
      niche,
      maxRating: ratingThreshold,
      leads: leads || 200,
      status: 'processing',
      executedAt: new Date()
    });

    logger.info(`Starting low rating scan for ${city}, maxRating: ${ratingThreshold}`);

    const businesses = await googlePlacesService.findBusinessesByRating({
      city,
      state,
      country,
      radius: radius || 5000,
      category: niche,
      maxRating: ratingThreshold,
      limit: leads || 200
    });

    const savedBusinesses = [];

    for (const business of businesses) {
      try {
        const savedBusiness = await LowRatingBusiness.create({
          searchId: search._id,
          userId,
          businessName: business.name,
          rating: business.rating,
          totalReviews: business.totalReviews,
          phone: business.phone,
          email: business.email,
          website: business.website,
          address: business.address,
          city: business.city || city,
          state: business.state || state,
          country: business.country || country,
          niche: business.category || niche,
          location: business.location
        });

        savedBusinesses.push(savedBusiness);
      } catch (error) {
        logger.error(`Error saving business ${business.name}`, error.message);
      }
    }

    search.resultsCount = savedBusinesses.length;
    search.status = 'completed';
    await search.save();

    logger.success(`Found ${savedBusinesses.length} businesses with ratings ≤ ${ratingThreshold}`);

    // Format response with both field name formats for frontend compatibility
    const formattedBusinesses = savedBusinesses.map(b => ({
      _id: b._id,
      businessName: b.businessName,
      name: b.businessName, // Alias for compatibility
      rating: b.rating,
      totalReviews: b.totalReviews,
      phone: b.phone,
      email: b.email,
      website: b.website,
      address: b.address,
      city: b.city,
      state: b.state,
      country: b.country,
      niche: b.niche
    }));

    res.json({
      success: true,
      message: `Found ${savedBusinesses.length} businesses with ratings ≤ ${ratingThreshold}`,
      count: savedBusinesses.length,
      searchId: search._id,
      data: formattedBusinesses
    });

  } catch (error) {
    logger.error('Low rating scan failed', error.message);
    res.status(500).json({ success: false, message: error.message || 'Scan failed' });
  }
};

exports.getRecentSearches = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const searches = await LowRatingSearch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, searches, data: searches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSearchResults = async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user._id;

    const search = await LowRatingSearch.findOne({ _id: searchId, userId });
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    const businesses = await LowRatingBusiness.find({ searchId, userId }).lean();

    // Format businesses with both field name formats
    const formattedBusinesses = businesses.map(b => ({
      _id: b._id,
      businessName: b.businessName,
      name: b.businessName, // Alias for compatibility
      rating: b.rating,
      totalReviews: b.totalReviews,
      phone: b.phone,
      email: b.email,
      website: b.website,
      address: b.address,
      city: b.city,
      state: b.state,
      country: b.country,
      niche: b.niche
    }));

    res.json({ success: true, data: { search, results: formattedBusinesses } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSearch = async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user._id;

    const search = await LowRatingSearch.findOneAndDelete({ _id: searchId, userId });

    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    await LowRatingBusiness.deleteMany({ searchId, userId });

    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
