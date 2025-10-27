const Search = require('../models/Search');
const SearchResult = require('../models/SearchResult');

class SearchResultService {
  
  // Store search results with proper validation
  static async storeResults(searchId, results, source = 'manual') {
    try {
      const search = await Search.findById(searchId);
      if (!search) {
        throw new Error('Search not found');
      }

      const searchResults = results.map(result => ({
        searchId,
        businessData: {
          name: result.name || result.businessName,
          website: result.website,
          email: result.email,
          phone: result.phone,
          address: result.address,
          city: result.city,
          state: result.state,
          country: result.country,
          category: result.category,
          industry: result.industry,
          domainAge: result.domainAge,
          registrar: result.registrar,
          isLegacy: result.isLegacy || false
        },
        metadata: {
          source,
          confidence: result.confidence || 1,
          verificationStatus: result.verificationStatus || 'unverified'
        }
      }));

      await SearchResult.insertMany(searchResults);
      
      // Update search status
      await Search.findByIdAndUpdate(searchId, {
        resultsCount: results.length,
        status: 'completed',
        'downloadInfo.isDownloadable': true,
        'downloadInfo.expiresAt': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      return { success: true, count: results.length };
    } catch (error) {
      throw new Error(`Failed to store search results: ${error.message}`);
    }
  }

  // Get results for a search with filtering
  static async getResults(searchId, filters = {}) {
    try {
      const query = { searchId, 'downloadStatus.isIncludedInDownload': true };
      
      if (filters.isLegacy !== undefined) {
        query['businessData.isLegacy'] = filters.isLegacy;
      }
      
      if (filters.source) {
        query['metadata.source'] = filters.source;
      }

      const results = await SearchResult.find(query)
        .select('businessData metadata')
        .sort({ createdAt: -1 });

      return results.map(r => ({
        ...r.businessData,
        source: r.metadata.source,
        confidence: r.metadata.confidence
      }));
    } catch (error) {
      throw new Error(`Failed to get search results: ${error.message}`);
    }
  }

  // Clean up expired search results
  static async cleanupExpiredResults() {
    try {
      const expiredSearches = await Search.find({
        'downloadInfo.expiresAt': { $lt: new Date() },
        'downloadInfo.isDownloadable': true
      });

      for (const search of expiredSearches) {
        await SearchResult.deleteMany({ searchId: search._id });
        await Search.findByIdAndUpdate(search._id, {
          'downloadInfo.isDownloadable': false
        });
      }

      return { cleaned: expiredSearches.length };
    } catch (error) {
      throw new Error(`Failed to cleanup expired results: ${error.message}`);
    }
  }
}

module.exports = SearchResultService;