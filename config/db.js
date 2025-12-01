// config/db.js
const mongoose = require('mongoose');

const connectDB = async (uri) => {
  if (!uri) {
    console.warn('MONGO_URI not provided — skipping MongoDB connection');
    return;
  }
  try {
    // Modern mongoose / mongodb driver no longer requires (and rejects)
    // legacy options like `useNewUrlParser` and `useUnifiedTopology`.
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message || err);
  }
};

module.exports = connectDB;

