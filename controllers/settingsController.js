const Settings = require('../models/Settings');

// Get settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await Settings.create({
        apiKeys: {
          whoisxml: '',
          hunter: '',
          googlePlaces: ''
        },
        notifications: {
          email: false,
          slack: false
        },
        exportSettings: {
          autoExport: false,
          emailRecipients: ''
        }
      });
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Error fetching settings', error: error.message });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const { apiKeys, notifications, exportSettings } = req.body;
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
    }
    
    if (apiKeys) {
      settings.apiKeys = { ...settings.apiKeys, ...apiKeys };
    }
    
    if (notifications) {
      settings.notifications = { ...settings.notifications, ...notifications };
    }
    
    if (exportSettings) {
      settings.exportSettings = { ...settings.exportSettings, ...exportSettings };
    }
    
    settings.updatedAt = Date.now();
    await settings.save();
    
    res.json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: 'Error updating settings', error: error.message });
  }
};

// Update API keys specifically
exports.updateApiKeys = async (req, res) => {
  try {
    const { whoisxml, hunter, googlePlaces } = req.body;
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
    }
    
    if (whoisxml !== undefined) settings.apiKeys.whoisxml = whoisxml;
    if (hunter !== undefined) settings.apiKeys.hunter = hunter;
    if (googlePlaces !== undefined) settings.apiKeys.googlePlaces = googlePlaces;
    
    settings.updatedAt = Date.now();
    await settings.save();
    
    res.json({ success: true, message: 'API keys updated successfully', data: settings });
  } catch (error) {
    console.error('Error updating API keys:', error);
    res.status(500).json({ success: false, message: 'Error updating API keys', error: error.message });
  }
};
