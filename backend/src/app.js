require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const folderRoutes = require('./routes/folder.routes');
const setRoutes = require('./routes/set.routes');
const cardRoutes = require('./routes/card.routes');
const syncRoutes = require('./routes/sync.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for Render, Railway, etc.)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// CORS configuration for production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (important for Render/Railway)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Flashcard API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1'
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/folders', folderRoutes);
app.use('/api/v1', setRoutes);
app.use('/api/v1', cardRoutes);
app.use('/api/v1/sync', syncRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
