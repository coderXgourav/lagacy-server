const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const csvFilterController = require('../controllers/csvFilterController');

// Setup Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Keep original extension or just unique
        cb(null, `upload_${Date.now()}_${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

const authMiddleware = require('../middleware/auth');

// Routes
router.post('/upload-csv', authMiddleware, upload.single('file'), csvFilterController.uploadCsv);
router.post('/filter-csv', authMiddleware, csvFilterController.filterCsv);
router.get('/download-result', csvFilterController.downloadResult); // Public download route

module.exports = router;
