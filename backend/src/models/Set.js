const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    required: true
  },
  localId: {
    type: String,
    required: true  // Client-generated ID for sync
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  cardCount: {
    type: Number,
    default: 0  // Denormalized for performance
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for user's sets in a folder
setSchema.index({ userId: 1, folderId: 1 });
// Index for sync lookups by local ID
setSchema.index({ userId: 1, localId: 1 });
// Index for active sets in folder
setSchema.index({ folderId: 1, deletedAt: 1 });
// Index for sync delta queries
setSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Set', setSchema);
