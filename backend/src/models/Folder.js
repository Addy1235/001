const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folderId: {
    type: String,
    required: true  // e.g., "german", "russian"
  },
  name: {
    type: String,
    required: true
  },
  flag: {
    type: String,
    required: true  // ISO country code e.g., "de"
  },
  order: {
    type: Number,
    default: 0
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for user's folders
folderSchema.index({ userId: 1, folderId: 1 }, { unique: true });
// Index for sorting
folderSchema.index({ userId: 1, order: 1 });
// Index for active folders query
folderSchema.index({ userId: 1, deletedAt: 1 });

module.exports = mongoose.model('Folder', folderSchema);
