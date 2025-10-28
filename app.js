const express = require('express');
const cors = require('cors');
const connectDB = require('./conf/database');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: ["https://lagacy-client.vercel.app", "http://localhost:8080", "http://localhost:5173"],
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

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Lagacy Agent API Server' });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/searches', searchesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/search', searchExecutionRoutes);
app.use('/api/scan', scanRoute);
app.use('/api/download', downloadRoute);
app.use('/api/history', historyRoute);

module.exports = app;