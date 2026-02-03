const logger = require('../utils/logger');

function filterLegacyWebsites(businesses) {
  logger.info(`Filtering legacy websites from ${businesses.length} businesses`);
  
  const cutoffDate = new Date('2020-01-01');
  
  const legacy = businesses.filter(business => {
    if (!business.creationDate) return false;
    const creationDate = new Date(business.creationDate);
    return creationDate < cutoffDate;
  }).map(business => ({
    ...business,
    isLegacy: true
  }));

  logger.success(`Found ${legacy.length} legacy websites (created before Jan 1, 2020)`);
  return legacy;
}

module.exports = { filterLegacyWebsites };
