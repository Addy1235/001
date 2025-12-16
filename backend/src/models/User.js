const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema({
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActivityDate: { type: String, default: null },
  totalActiveDays: { type: Number, default: 0 }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  settings: {
    defaultLanguage: { type: String, default: 'german' },
    theme: { type: String, default: 'light' },
    ttsEnabled: { type: Boolean, default: true }
  },
  streak: {
    type: streakSchema,
    default: () => ({})
  },
  refreshTokenHash: {
    type: String,
    default: null
  },
  lastSyncAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for email lookup
userSchema.index({ email: 1 });
// Index for refresh token lookup
userSchema.index({ refreshTokenHash: 1 });

module.exports = mongoose.model('User', userSchema);
