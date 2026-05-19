const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Loads environment variables from .env file

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Request: ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  console.log('Health check received');
  res.send('ok');
});

app.use(cors({
  origin: "https://pg-finder-web-app.vercel.app",
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Allow the server to accept large JSON (base64 images)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Database Connection ---
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log('MongoDB connection error:', err));
}

// --- API Routes ---
app.use('/api/auth', require('./routes/auth')); // Mount the auth routes
app.use('/api/listings', require('./routes/listings')); // Mount the listings routes

// --- Start the Server ---
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// --- Export for Vercel ---
// CRITICAL: Vercel requires the express instance to be exported to handle serverless requests.
module.exports = app;