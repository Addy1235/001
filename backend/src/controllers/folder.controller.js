const { z } = require('zod');
const Folder = require('../models/Folder');
const { success, created, error, notFound } = require('../utils/response');

const folderSchema = z.object({
  folderId: z.string().min(1),
  name: z.string().min(1).max(100),
  flag: z.string().min(2).max(5),
  order: z.number().optional()
});

// List all folders for user
exports.list = async (req, res, next) => {
  try {
    const folders = await Folder.find({
      userId: req.userId,
      deletedAt: null
    }).sort({ order: 1 });

    return success(res, folders);
  } catch (err) {
    next(err);
  }
};

// Create folder
exports.create = async (req, res, next) => {
  try {
    const data = folderSchema.parse(req.body);

    // Check if folder already exists
    const existing = await Folder.findOne({
      userId: req.userId,
      folderId: data.folderId,
      deletedAt: null
    });

    if (existing) {
      return error(res, 'Folder already exists', 409);
    }

    // Get max order
    const maxOrder = await Folder.findOne({ userId: req.userId })
      .sort({ order: -1 })
      .select('order');

    const folder = await Folder.create({
      userId: req.userId,
      ...data,
      order: data.order ?? (maxOrder?.order ?? 0) + 1
    });

    return created(res, folder);
  } catch (err) {
    next(err);
  }
};

// Get folder by ID
exports.get = async (req, res, next) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.userId,
      deletedAt: null
    });

    if (!folder) {
      return notFound(res, 'Folder not found');
    }

    return success(res, folder);
  } catch (err) {
    next(err);
  }
};

// Update folder
exports.update = async (req, res, next) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      flag: z.string().min(2).max(5).optional(),
      order: z.number().optional()
    });

    const data = updateSchema.parse(req.body);

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: data },
      { new: true }
    );

    if (!folder) {
      return notFound(res, 'Folder not found');
    }

    return success(res, folder);
  } catch (err) {
    next(err);
  }
};

// Soft delete folder
exports.delete = async (req, res, next) => {
  try {
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!folder) {
      return notFound(res, 'Folder not found');
    }

    return success(res, null, 'Folder deleted');
  } catch (err) {
    next(err);
  }
};

// Reorder folders
exports.reorder = async (req, res, next) => {
  try {
    const { folderIds } = z.object({
      folderIds: z.array(z.string())
    }).parse(req.body);

    const bulkOps = folderIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, userId: req.userId },
        update: { $set: { order: index } }
      }
    }));

    await Folder.bulkWrite(bulkOps);

    return success(res, null, 'Folders reordered');
  } catch (err) {
    next(err);
  }
};
