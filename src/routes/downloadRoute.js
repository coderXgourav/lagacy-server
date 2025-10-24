const express = require('express');
const router = express.Router();
const Business = require('../models/Business');
const { exportToExcel } = require('../agents/excelExporter');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  try {
    logger.info('Fetching legacy businesses for export');

    const businesses = await Business.find({ isLegacy: true }).sort({ scannedAt: -1 });

    if (businesses.length === 0) {
      return res.status(404).json({ error: 'No legacy websites found to export' });
    }

    const excelBuffer = await exportToExcel(businesses);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=legacy-websites.xlsx');
    res.send(excelBuffer);

    logger.success(`Exported ${businesses.length} businesses to Excel`);
  } catch (error) {
    logger.error('Download failed', error.message);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

module.exports = router;
