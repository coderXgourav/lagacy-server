const logger = {
  info: (message, data = '') => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
  },
  error: (message, error = '') => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  },
  success: (message, data = '') => {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`, data);
  }
};

module.exports = logger;
