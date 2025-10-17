const Search = require('../models/Search');
const Lead = require('../models/Lead');

// Get all searches
exports.getAllSearches = async (req, res) => {
  try {
    const searches = await Search.find().sort({ executedAt: -1 }).limit(50);
    res.json({ success: true, data: searches });
  } catch (error) {
    console.error('Error fetching searches:', error);
    res.status(500).json({ success: false, message: 'Error fetching searches', error: error.message });
  }
};

// Get recent searches (last 10)
exports.getRecentSearches = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const searches = await Search.find().sort({ executedAt: -1 }).limit(limit);
    res.json({ success: true, data: searches });
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    res.status(500).json({ success: false, message: 'Error fetching recent searches', error: error.message });
  }
};

// Get search by ID
exports.getSearchById = async (req, res) => {
  try {
    const search = await Search.findById(req.params.id);
    
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    res.json({ success: true, data: search });
  } catch (error) {
    console.error('Error fetching search:', error);
    res.status(500).json({ success: false, message: 'Error fetching search', error: error.message });
  }
};

// Create new search
exports.createSearch = async (req, res) => {
  try {
    const { query, searchType, filters, apiUsed } = req.body;
    
    const search = await Search.create({
      query,
      searchType,
      filters,
      apiUsed,
      status: 'pending',
      resultsCount: 0
    });
    
    res.status(201).json({ success: true, message: 'Search created successfully', data: search });
  } catch (error) {
    console.error('Error creating search:', error);
    res.status(500).json({ success: false, message: 'Error creating search', error: error.message });
  }
};

// Update search status
exports.updateSearchStatus = async (req, res) => {
  try {
    const { status, resultsCount } = req.body;
    
    const search = await Search.findByIdAndUpdate(
      req.params.id,
      { status, resultsCount },
      { new: true }
    );
    
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    res.json({ success: true, message: 'Search updated successfully', data: search });
  } catch (error) {
    console.error('Error updating search:', error);
    res.status(500).json({ success: false, message: 'Error updating search', error: error.message });
  }
};

// Delete search
exports.deleteSearch = async (req, res) => {
  try {
    const search = await Search.findByIdAndDelete(req.params.id);
    
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    // Also delete associated leads
    await Lead.deleteMany({ searchId: req.params.id });
    
    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    console.error('Error deleting search:', error);
    res.status(500).json({ success: false, message: 'Error deleting search', error: error.message });
  }
};
