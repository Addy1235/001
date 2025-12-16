const { z } = require('zod');
const User = require('../models/User');
const Folder = require('../models/Folder');
const Set = require('../models/Set');
const Card = require('../models/Card');
const { success, error } = require('../utils/response');

// Pull changes since last sync
exports.pull = async (req, res, next) => {
  try {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(0);

    // Get changes since last sync
    const [folders, sets, cards, user] = await Promise.all([
      Folder.find({
        userId: req.userId,
        updatedAt: { $gt: sinceDate }
      }),
      Set.find({
        userId: req.userId,
        updatedAt: { $gt: sinceDate }
      }),
      Card.find({
        userId: req.userId,
        updatedAt: { $gt: sinceDate }
      }),
      User.findById(req.userId).select('streak settings lastSyncAt')
    ]);

    // Separate into created/updated/deleted
    const categorize = (items) => ({
      created: items.filter(i => i.createdAt > sinceDate && !i.deletedAt),
      updated: items.filter(i => i.createdAt <= sinceDate && !i.deletedAt),
      deleted: items.filter(i => i.deletedAt).map(i => i._id)
    });

    // Update last sync time
    await User.findByIdAndUpdate(req.userId, {
      lastSyncAt: new Date()
    });

    return success(res, {
      folders: categorize(folders),
      sets: categorize(sets),
      cards: categorize(cards),
      streak: user.streak,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

// Push local changes to server
exports.push = async (req, res, next) => {
  try {
    const pushSchema = z.object({
      lastSyncAt: z.string().optional(),
      changes: z.object({
        folders: z.object({
          upsert: z.array(z.any()).optional(),
          delete: z.array(z.string()).optional()
        }).optional(),
        sets: z.object({
          upsert: z.array(z.any()).optional(),
          delete: z.array(z.string()).optional()
        }).optional(),
        cards: z.object({
          upsert: z.array(z.any()).optional(),
          delete: z.array(z.string()).optional()
        }).optional(),
        streak: z.any().optional()
      })
    });

    const { lastSyncAt, changes } = pushSchema.parse(req.body);
    const sinceDate = lastSyncAt ? new Date(lastSyncAt) : null;

    const conflicts = [];
    const accepted = { folders: 0, sets: 0, cards: 0 };

    // Process folders
    if (changes.folders?.upsert) {
      for (const folder of changes.folders.upsert) {
        const existing = await Folder.findOne({
          userId: req.userId,
          folderId: folder.folderId
        });

        if (existing && sinceDate && existing.updatedAt > sinceDate) {
          conflicts.push({ type: 'folder', id: folder.folderId, server: existing });
        } else if (existing) {
          await Folder.findByIdAndUpdate(existing._id, {
            $set: { name: folder.name, flag: folder.flag, order: folder.order }
          });
          accepted.folders++;
        } else {
          await Folder.create({
            userId: req.userId,
            ...folder
          });
          accepted.folders++;
        }
      }
    }

    if (changes.folders?.delete) {
      await Folder.updateMany(
        { userId: req.userId, folderId: { $in: changes.folders.delete } },
        { $set: { deletedAt: new Date() } }
      );
    }

    // Process sets
    if (changes.sets?.upsert) {
      for (const set of changes.sets.upsert) {
        const existing = await Set.findOne({
          userId: req.userId,
          localId: set.localId
        });

        if (existing && sinceDate && existing.updatedAt > sinceDate) {
          conflicts.push({ type: 'set', id: set.localId, server: existing });
        } else if (existing) {
          await Set.findByIdAndUpdate(existing._id, {
            $set: { name: set.name, description: set.description }
          });
          accepted.sets++;
        } else {
          // Find folder by folderId
          const folder = await Folder.findOne({
            userId: req.userId,
            folderId: set.folderId
          });
          if (folder) {
            await Set.create({
              userId: req.userId,
              folderId: folder._id,
              ...set
            });
            accepted.sets++;
          }
        }
      }
    }

    if (changes.sets?.delete) {
      await Set.updateMany(
        { userId: req.userId, localId: { $in: changes.sets.delete } },
        { $set: { deletedAt: new Date() } }
      );
    }

    // Process cards
    if (changes.cards?.upsert) {
      for (const card of changes.cards.upsert) {
        const existing = await Card.findOne({
          userId: req.userId,
          localId: card.localId
        });

        if (existing && sinceDate && existing.updatedAt > sinceDate) {
          conflicts.push({ type: 'card', id: card.localId, server: existing });
        } else if (existing) {
          await Card.findByIdAndUpdate(existing._id, {
            $set: {
              front: card.front,
              back: card.back,
              example: card.example,
              starred: card.starred,
              mastery: card.mastery,
              sr: card.sr
            }
          });
          accepted.cards++;
        } else {
          // Find set by localId
          const set = await Set.findOne({
            userId: req.userId,
            localId: card.setLocalId
          });
          if (set) {
            await Card.create({
              userId: req.userId,
              setId: set._id,
              ...card
            });
            accepted.cards++;
          }
        }
      }
    }

    if (changes.cards?.delete) {
      await Card.updateMany(
        { userId: req.userId, localId: { $in: changes.cards.delete } },
        { $set: { deletedAt: new Date() } }
      );
    }

    // Update streak if provided
    if (changes.streak) {
      await User.findByIdAndUpdate(req.userId, {
        $set: { streak: changes.streak }
      });
    }

    // Update last sync time
    await User.findByIdAndUpdate(req.userId, {
      lastSyncAt: new Date()
    });

    return success(res, {
      conflicts,
      accepted,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

// Full sync (initial or recovery)
exports.full = async (req, res, next) => {
  try {
    const [folders, sets, cards, user] = await Promise.all([
      Folder.find({ userId: req.userId, deletedAt: null }),
      Set.find({ userId: req.userId, deletedAt: null }),
      Card.find({ userId: req.userId, deletedAt: null }),
      User.findById(req.userId).select('streak settings')
    ]);

    // Update last sync time
    await User.findByIdAndUpdate(req.userId, {
      lastSyncAt: new Date()
    });

    return success(res, {
      folders,
      sets,
      cards,
      streak: user.streak,
      settings: user.settings,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};
