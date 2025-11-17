const Lead = require('../models/Lead');
const Search = require('../models/Search');

// Get all leads
exports.getAllLeads = async (req, res) => {
  try {
    const { page = 1, limit = 999, status, source, searchId } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (source) query.source = source;
    if (searchId) query.searchId = searchId;
    
    const leads = await Lead.find(query)
      .populate('searchId', 'query searchType executedAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Lead.countDocuments(query);
    
    res.json({
      success: true,
      data: leads,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalLeads: count
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, message: 'Error fetching leads', error: error.message });
  }
};

// Get lead by ID
exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('searchId');
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    res.json({ success: true, data: lead });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ success: false, message: 'Error fetching lead', error: error.message });
  }
};

// Create new lead
exports.createLead = async (req, res) => {
  try {
    const leadData = req.body;
    
    const lead = await Lead.create(leadData);
    
    // Update search results count if searchId is provided
    if (lead.searchId) {
      await Search.findByIdAndUpdate(lead.searchId, {
        $inc: { resultsCount: 1 }
      });
    }
    
    res.status(201).json({ success: true, message: 'Lead created successfully', data: lead });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ success: false, message: 'Error creating lead', error: error.message });
  }
};

// Create multiple leads
exports.createBulkLeads = async (req, res) => {
  try {
    const { leads, searchId } = req.body;
    
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid leads data' });
    }
    
    // Add searchId to all leads
    const leadsWithSearchId = leads.map(lead => ({
      ...lead,
      searchId: searchId || lead.searchId
    }));
    
    const createdLeads = await Lead.insertMany(leadsWithSearchId);
    
    // Update search results count
    if (searchId) {
      await Search.findByIdAndUpdate(searchId, {
        $inc: { resultsCount: createdLeads.length }
      });
    }
    
    res.status(201).json({
      success: true,
      message: `${createdLeads.length} leads created successfully`,
      data: createdLeads
    });
  } catch (error) {
    console.error('Error creating bulk leads:', error);
    res.status(500).json({ success: false, message: 'Error creating bulk leads', error: error.message });
  }
};

// Update lead
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    res.json({ success: true, message: 'Lead updated successfully', data: lead });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ success: false, message: 'Error updating lead', error: error.message });
  }
};

// Delete lead
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Update search results count
    if (lead.searchId) {
      await Search.findByIdAndUpdate(lead.searchId, {
        $inc: { resultsCount: -1 }
      });
    }
    
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ success: false, message: 'Error deleting lead', error: error.message });
  }
};

// Get leads by search ID
exports.getLeadsBySearchId = async (req, res) => {
  try {
    const leads = await Lead.find({ searchId: req.params.searchId }).sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('Error fetching leads by search ID:', error);
    res.status(500).json({ success: false, message: 'Error fetching leads', error: error.message });
  }
};
