const mongoose = require('mongoose');

const srSchema = new mongoose.Schema({
  easeFactor: { type: Number, default: 2.5 },
  interval: { type: Number, default: 0 },
  repetitions: { type: Number, default: 0 },
  nextReview: { type: String, default: null },
  lastReview: { type: String, default: null }
}, { _id: false });

const cardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  setId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Set',
    required: true
  },
  localId: {
    type: String,
    required: true  // Client-generated ID for sync
  },
  front: {
    type: String,
    required: true
  },
  back: {
    type: String,
    required: true
  },
  example: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: null  // URL to uploaded image (not base64)
  },
  starred: {
    type: Boolean,
    default: false
  },
  mastery: {
    type: String,
    enum: ['not-started', 'learning', 'mastered'],
    default: 'not-started'
  },
  sr: {
    type: srSchema,
    default: () => ({})
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Primary query path - cards in a set
cardSchema.index({ userId: 1, setId: 1 });
// Sync lookups by local ID
cardSchema.index({ userId: 1, localId: 1 });
// Active cards in set
cardSchema.index({ setId: 1, deletedAt: 1 });
// Due cards query (critical for 100K+ cards)
cardSchema.index({ userId: 1, 'sr.nextReview': 1 });
// Progress filtering
cardSchema.index({ userId: 1, mastery: 1 });
// Sync delta queries
cardSchema.index({ setId: 1, updatedAt: -1 });

module.exports = mongoose.model('Card', cardSchema);
