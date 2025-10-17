const Search = require('../models/Search');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const SearchService = require('../services/searchService');

/**
 * Execute a new search with API integration
 */
exports.executeSearch = async (req, res) => {
  try {
    const { city, state, country, radius, category } = req.body;

    // Validate required fields
    if (!city || !state || !country || !radius || !category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: city, state, country, radius, and category are required'
      });
    }

    // Get API keys from settings
    const settings = await Settings.findOne();
    if (!settings || !settings.apiKeys) {
      return res.status(400).json({
        success: false,
        message: 'API keys not configured. Please configure your API keys in Settings first.'
      });
    }

    // Create search record
    const search = await Search.create({
      query: `${category} in ${city}, ${state}, ${country}`,
      searchType: 'location',
      filters: {
        city,
        state,
        country,
        radius: parseInt(radius),
        category
      },
      status: 'processing',
      apiUsed: 'multiple',
      executedAt: new Date()
    });

    // Send immediate response
    res.json({
      success: true,
      message: 'Search started successfully',
      data: search
    });

    // Execute search asynchronously
    executeSearchAsync(search._id, settings.apiKeys, { city, state, country, radius, category });

  } catch (error) {
    console.error('Error starting search:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting search',
      error: error.message
    });
  }
};

/**
 * Execute search asynchronously
 */
async function executeSearchAsync(searchId, apiKeys, searchParams) {
  try {
    console.log(`Starting async search for ID: ${searchId}`);
    
    // Initialize search service
    const searchService = new SearchService(apiKeys);
    
    // Execute search
    const leads = await searchService.executeSearch(searchParams);
    
    console.log(`Search completed. Found ${leads.length} leads`);
    
    // Save leads to database
    const savedLeads = [];
    for (const leadData of leads) {
      try {
        const lead = await Lead.create({
          ...leadData,
          searchId: searchId
        });
        savedLeads.push(lead);
      } catch (err) {
        console.error('Error saving lead:', err.message);
      }
    }
    
    // Update search status
    await Search.findByIdAndUpdate(searchId, {
      status: 'completed',
      resultsCount: savedLeads.length
    });
    
    console.log(`Search ${searchId} completed successfully with ${savedLeads.length} leads`);
    
  } catch (error) {
    console.error('Error executing search:', error);
    
    // Update search with error
    await Search.findByIdAndUpdate(searchId, {
      status: 'failed',
      errorMessage: error.message
    });
  }
}

/**
 * Get search status
 */
exports.getSearchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const search = await Search.findById(id);
    if (!search) {
      return res.status(404).json({
        success: false,
        message: 'Search not found'
      });
    }
    
    res.json({
      success: true,
      data: search
    });
    
  } catch (error) {
    console.error('Error getting search status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting search status',
      error: error.message
    });
  }
};

/**
 * Get all searches with pagination
 */
exports.getAllSearches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const searches = await Search.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Search.countDocuments();

    res.json({
      success: true,
      data: searches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching searches:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching searches',
      error: error.message
    });
  }
};
