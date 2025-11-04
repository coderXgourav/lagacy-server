const Search = require('../models/Search');
const Lead = require('../models/Lead');
const SearchResult = require('../models/SearchResult');
const { enrichWithDomainAge } = require('../src/agents/domainAgeAgent');

// Get all searches
exports.getAllSearches = async (req, res) => {
  try {
    const userId = req.user._id;
    const searches = await Search.find({ userId }).sort({ executedAt: -1 }).limit(50);
    res.json({ success: true, data: searches });
  } catch (error) {
    console.error('Error fetching searches:', error);
    res.status(500).json({ success: false, message: 'Error fetching searches', error: error.message });
  }
};

// Get recent searches (last 10)
exports.getRecentSearches = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;
    const searches = await Search.find({ userId }).sort({ executedAt: -1 }).limit(limit);
    res.json({ success: true, searches });
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    res.status(500).json({ success: false, message: 'Error fetching recent searches', error: error.message });
  }
};

// Get search by ID
exports.getSearchById = async (req, res) => {
  try {
    const userId = req.user._id;
    const search = await Search.findOne({ _id: req.params.id, userId });
    
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
    const userId = req.user._id;
    const { query, searchType, filters, apiUsed } = req.body;
    
    const search = await Search.create({
      userId,
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
    const userId = req.user._id;
    const { status, resultsCount } = req.body;
    
    const updateData = { status, resultsCount };
    
    // Set download expiry for completed searches (30 days)
    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData['downloadInfo.isDownloadable'] = true;
      updateData['downloadInfo.expiresAt'] = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    const search = await Search.findOneAndUpdate({ _id: req.params.id, userId }, updateData, { new: true });
    
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    res.json({ success: true, message: 'Search updated successfully', data: search });
  } catch (error) {
    console.error('Error updating search:', error);
    res.status(500).json({ success: false, message: 'Error updating search', error: error.message });
  }
};

// Store search results
exports.storeSearchResults = async (req, res) => {
  try {
    const userId = req.user._id;
    const { searchId, results } = req.body;
    
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ success: false, message: 'Results array is required' });
    }
    
    const searchResults = results.map(result => ({
      searchId,
      userId,
      businessData: {
        name: result.name || result.businessName || result.company || 'Unknown Business',
        website: result.website || '',
        email: result.email || '',
        phone: result.phone || '',
        address: result.address || '',
        city: result.city || '',
        state: result.state || '',
        country: result.country || '',
        category: result.category || '',
        industry: result.industry || '',
        domainAge: result.domainAge || null,
        registrar: result.registrar || '',
        ownerName: result.ownerName || null,
        isLegacy: result.isLegacy || false
      },
      metadata: {
        source: result.source || 'manual',
        confidence: result.confidence || 1,
        verificationStatus: result.verificationStatus || 'unverified'
      }
    }));
    
    await SearchResult.insertMany(searchResults);
    
    // Update search with results count
    await Search.findByIdAndUpdate(searchId, { 
      resultsCount: results.length,
      status: 'completed',
      completedAt: new Date(),
      'downloadInfo.isDownloadable': true,
      'downloadInfo.expiresAt': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    
    res.json({ success: true, message: 'Search results stored successfully', count: results.length });
  } catch (error) {
    console.error('Error storing search results:', error);
    res.status(500).json({ success: false, message: 'Error storing search results', error: error.message });
  }
};

// Get search results for download
exports.getSearchResults = async (req, res) => {
  try {
    const userId = req.user._id;
    const { searchId } = req.params;
    const { format = 'json' } = req.query;
    
    const search = await Search.findOne({ _id: searchId, userId });
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    if (!search.downloadInfo.isDownloadable || (search.downloadInfo.expiresAt && search.downloadInfo.expiresAt < new Date())) {
      return res.status(403).json({ success: false, message: 'Search results are no longer available for download' });
    }
    
    const results = await SearchResult.find({ 
      searchId,
      userId,
      'downloadStatus.isIncludedInDownload': true 
    }).select('-_id -searchId -userId -downloadStatus -createdAt -updatedAt');
    
    // Update download tracking
    await Search.findByIdAndUpdate(searchId, {
      $inc: { 'downloadInfo.downloadCount': 1 },
      'downloadInfo.lastDownloadedAt': new Date()
    });
    
    await SearchResult.updateMany(
      { searchId },
      { $inc: { 'downloadStatus.downloadedCount': 1 } }
    );
    
    res.json({ 
      success: true, 
      data: {
        search: {
          id: search._id,
          query: search.query,
          executedAt: search.executedAt,
          resultsCount: search.resultsCount,
          status: search.status
        },
        results: results.map(r => r.businessData)
      }
    });
  } catch (error) {
    console.error('Error fetching search results:', error);
    res.status(500).json({ success: false, message: 'Error fetching search results', error: error.message });
  }
};

// Cancel search
exports.cancelSearch = async (req, res) => {
  try {
    const userId = req.user._id;
    const search = await Search.findOne({ _id: req.params.id, userId });
    
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    if (search.status === 'completed' || search.status === 'failed') {
      return res.json({ success: false, message: 'Search already completed' });
    }
    
    search.cancelRequested = true;
    if (search.status === 'pending') {
      search.status = 'cancelled';
      search.completedAt = new Date();
    }
    await search.save();
    
    console.log(`🚫 Cancellation requested for search ${search._id}`);
    res.json({ success: true, message: 'Cancellation requested' });
  } catch (error) {
    console.error('Error cancelling search:', error);
    res.status(500).json({ success: false, message: 'Error cancelling search', error: error.message });
  }
};

// Delete search
exports.deleteSearch = async (req, res) => {
  try {
    const userId = req.user._id;
    const search = await Search.findOneAndDelete({ _id: req.params.id, userId });
    
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    // Delete associated data
    await Promise.all([
      Lead.deleteMany({ searchId: req.params.id }),
      SearchResult.deleteMany({ searchId: req.params.id, userId })
    ]);
    
    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    console.error('Error deleting search:', error);
    res.status(500).json({ success: false, message: 'Error deleting search', error: error.message });
  }
};
