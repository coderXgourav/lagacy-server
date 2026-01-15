const express = require('express');
const cors = require('cors');
const connectDB = require('./conf/database');
const domainScraperScheduler = require('./services/domainScraperScheduler');

const app = express();

// Connect to MongoDB
connectDB();

// Start domain scraper scheduler
domainScraperScheduler.start();

// Middleware
app.use(cors({
  origin: ["https://lagacy-client.vercel.app", "http://localhost:8080", "http://localhost:5173", "https://aitool.kyptronix.us", "https://www.aitool.kyptronix.us"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const searchesRoutes = require('./routes/searches');
const leadsRoutes = require('./routes/leads');
const searchExecutionRoutes = require('./routes/searchExecution');
const scanRoute = require('./src/routes/scanRoute');
const downloadRoute = require('./src/routes/downloadRoute');
const historyRoute = require('./src/routes/historyRoute');
const noWebsiteRoutes = require('./routes/noWebsiteRoutes');
const lowRatingRoutes = require('./routes/lowRatingRoutes');
const newDomainRoutes = require('./routes/newDomainRoutes');
const newBusinessRoutes = require('./routes/newBusinessRoutes');
const domainScraperRoutes = require('./routes/domainScraperRoutes');
const csvFilterRoutes = require('./routes/csvFilterRoutes');
const authMiddleware = require('./middleware/auth');

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Lagacy Agent API Server' });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Mount API routes
app.use('/api/auth', authRoutes); // Public
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/searches', authMiddleware, searchesRoutes);
app.use('/api/leads', authMiddleware, leadsRoutes);
app.use('/api/search', authMiddleware, searchExecutionRoutes);
app.use('/api/scan', authMiddleware, scanRoute);
app.use('/api/download', authMiddleware, downloadRoute);
app.use('/api/history', authMiddleware, historyRoute);
app.use('/api/no-website', authMiddleware, noWebsiteRoutes);
app.use('/api/low-rating', authMiddleware, lowRatingRoutes);
app.use('/api/new-domain', authMiddleware, newDomainRoutes);
app.use('/api/new-business', authMiddleware, newBusinessRoutes);
app.use('/api/domain-scraper', authMiddleware, domainScraperRoutes);
app.use('/api/csv-filter', csvFilterRoutes);

module.exports = app;
