const { z } = require('zod');
const Set = require('../models/Set');
const Card = require('../models/Card');
const Folder = require('../models/Folder');
const { success, created, error, notFound } = require('../utils/response');

const setSchema = z.object({
  localId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

// List sets in folder
exports.list = async (req, res, next) => {
  try {
    const { folderId } = req.params;

    // Verify folder belongs to user
    const folder = await Folder.findOne({
      _id: folderId,
      userId: req.userId,
      deletedAt: null
    });

    if (!folder) {
      return notFound(res, 'Folder not found');
    }

    const sets = await Set.find({
      userId: req.userId,
      folderId,
      deletedAt: null
    }).sort({ createdAt: -1 });

    return success(res, sets);
  } catch (err) {
    next(err);
  }
};

// Create set
exports.create = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const data = setSchema.parse(req.body);

    // Verify folder belongs to user
    const folder = await Folder.findOne({
      _id: folderId,
      userId: req.userId,
      deletedAt: null
    });

    if (!folder) {
      return notFound(res, 'Folder not found');
    }

    const set = await Set.create({
      userId: req.userId,
      folderId,
      ...data
    });

    return created(res, set);
  } catch (err) {
    next(err);
  }
};

// Get set with cards
exports.get = async (req, res, next) => {
  try {
    const set = await Set.findOne({
      _id: req.params.id,
      userId: req.userId,
      deletedAt: null
    });

    if (!set) {
      return notFound(res, 'Set not found');
    }

    // Get cards for set
    const cards = await Card.find({
      setId: set._id,
      deletedAt: null
    }).sort({ createdAt: 1 });

    return success(res, { ...set.toObject(), cards });
  } catch (err) {
    next(err);
  }
};

// Update set
exports.update = async (req, res, next) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional()
    });

    const data = updateSchema.parse(req.body);

    const set = await Set.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: data },
      { new: true }
    );

    if (!set) {
      return notFound(res, 'Set not found');
    }

    return success(res, set);
  } catch (err) {
    next(err);
  }
};

// Soft delete set (cascade to cards)
exports.delete = async (req, res, next) => {
  try {
    const set = await Set.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!set) {
      return notFound(res, 'Set not found');
    }

    // Soft delete all cards in set
    await Card.updateMany(
      { setId: set._id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );

    return success(res, null, 'Set deleted');
  } catch (err) {
    next(err);
  }
};

// Move set to different folder
exports.move = async (req, res, next) => {
  try {
    const { newFolderId } = z.object({
      newFolderId: z.string()
    }).parse(req.body);

    // Verify new folder belongs to user
    const folder = await Folder.findOne({
      _id: newFolderId,
      userId: req.userId,
      deletedAt: null
    });

    if (!folder) {
      return notFound(res, 'Target folder not found');
    }

    const set = await Set.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: { folderId: newFolderId } },
      { new: true }
    );

    if (!set) {
      return notFound(res, 'Set not found');
    }

    return success(res, set);
  } catch (err) {
    next(err);
  }
};
