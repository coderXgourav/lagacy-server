const express = require('express');
const cors = require('cors');
const connectDB = require('./conf/database');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const settingsRoutes = require('./routes/settings');
const searchesRoutes = require('./routes/searches');
const leadsRoutes = require('./routes/leads');
const searchExecutionRoutes = require('./routes/searchExecution');

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Lagacy Agent API Server' });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Mount API routes
app.use('/api/settings', settingsRoutes);
app.use('/api/searches', searchesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/search', searchExecutionRoutes);

module.exports = app;