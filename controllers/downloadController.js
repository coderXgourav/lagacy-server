const Search = require('../models/Search');
const SearchResult = require('../models/SearchResult');
const { exportToExcel } = require('../src/agents/excelExporter');

// Download search results as Excel
exports.downloadSearchExcel = async (req, res) => {
  try {
    const { searchId } = req.params;
    
    const search = await Search.findById(searchId);
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    if (!search.downloadInfo.isDownloadable || (search.downloadInfo.expiresAt && search.downloadInfo.expiresAt < new Date())) {
      return res.status(403).json({ success: false, message: 'Search results are no longer available for download' });
    }
    
    const results = await SearchResult.find({ 
      searchId, 
      'downloadStatus.isIncludedInDownload': true 
    });
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'No results found for download' });
    }
    
    const businessData = results.map(r => r.businessData);
    const excelBuffer = await exportToExcel(businessData);
    
    // Update download tracking
    await Search.findByIdAndUpdate(searchId, {
      $inc: { 'downloadInfo.downloadCount': 1 },
      'downloadInfo.lastDownloadedAt': new Date()
    });
    
    const filename = `search-results-${search.query.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error downloading search results:', error);
    res.status(500).json({ success: false, message: 'Download failed', error: error.message });
  }
};

// Get downloadable searches
exports.getDownloadableSearches = async (req, res) => {
  try {
    const searches = await Search.find({
      status: 'completed',
      'downloadInfo.isDownloadable': true,
      $or: [
        { 'downloadInfo.expiresAt': { $exists: false } },
        { 'downloadInfo.expiresAt': { $gt: new Date() } }
      ]
    }).select('query searchType filters resultsCount executedAt downloadInfo').sort({ executedAt: -1 });
    
    res.json({ success: true, data: searches });
  } catch (error) {
    console.error('Error fetching downloadable searches:', error);
    res.status(500).json({ success: false, message: 'Error fetching downloadable searches', error: error.message });
  }
};

module.exports = exports;