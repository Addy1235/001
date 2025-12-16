const { z } = require('zod');
const Card = require('../models/Card');
const Set = require('../models/Set');
const { success, created, error, notFound } = require('../utils/response');

const srSchema = z.object({
  easeFactor: z.number().min(1.3).max(2.5).optional(),
  interval: z.number().min(0).optional(),
  repetitions: z.number().min(0).optional(),
  nextReview: z.string().nullable().optional(),
  lastReview: z.string().nullable().optional()
}).optional();

const cardSchema = z.object({
  localId: z.string().min(1),
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(2000),
  example: z.string().max(2000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  starred: z.boolean().optional(),
  mastery: z.enum(['not-started', 'learning', 'mastered']).optional(),
  sr: srSchema
});

// List cards in set (with pagination for large sets)
exports.list = async (req, res, next) => {
  try {
    const { setId } = req.params;
    const { limit = 100, cursor } = req.query;

    // Verify set belongs to user
    const set = await Set.findOne({
      _id: setId,
      userId: req.userId,
      deletedAt: null
    });

    if (!set) {
      return notFound(res, 'Set not found');
    }

    const query = { setId, deletedAt: null };
    if (cursor) {
      query._id = { $gt: cursor };
    }

    const cards = await Card.find(query)
      .sort({ _id: 1 })
      .limit(parseInt(limit) + 1);

    const hasMore = cards.length > limit;
    const data = hasMore ? cards.slice(0, -1) : cards;
    const nextCursor = hasMore ? data[data.length - 1]._id : null;

    return success(res, {
      cards: data,
      pagination: { hasMore, nextCursor }
    });
  } catch (err) {
    next(err);
  }
};

// Create card
exports.create = async (req, res, next) => {
  try {
    const { setId } = req.params;
    const data = cardSchema.parse(req.body);

    // Verify set belongs to user
    const set = await Set.findOne({
      _id: setId,
      userId: req.userId,
      deletedAt: null
    });

    if (!set) {
      return notFound(res, 'Set not found');
    }

    const card = await Card.create({
      userId: req.userId,
      setId,
      ...data
    });

    // Update card count
    await Set.findByIdAndUpdate(setId, { $inc: { cardCount: 1 } });

    return created(res, card);
  } catch (err) {
    next(err);
  }
};

// Bulk create cards (import)
exports.bulkCreate = async (req, res, next) => {
  try {
    const { setId } = req.params;
    const { cards } = z.object({
      cards: z.array(cardSchema).max(1000)
    }).parse(req.body);

    // Verify set belongs to user
    const set = await Set.findOne({
      _id: setId,
      userId: req.userId,
      deletedAt: null
    });

    if (!set) {
      return notFound(res, 'Set not found');
    }

    const cardsToInsert = cards.map(card => ({
      userId: req.userId,
      setId,
      ...card
    }));

    const inserted = await Card.insertMany(cardsToInsert);

    // Update card count
    await Set.findByIdAndUpdate(setId, { $inc: { cardCount: inserted.length } });

    return created(res, { inserted: inserted.length });
  } catch (err) {
    next(err);
  }
};

// Get card
exports.get = async (req, res, next) => {
  try {
    const card = await Card.findOne({
      _id: req.params.id,
      userId: req.userId,
      deletedAt: null
    });

    if (!card) {
      return notFound(res, 'Card not found');
    }

    return success(res, card);
  } catch (err) {
    next(err);
  }
};

// Update card
exports.update = async (req, res, next) => {
  try {
    const updateSchema = z.object({
      front: z.string().min(1).max(2000).optional(),
      back: z.string().min(1).max(2000).optional(),
      example: z.string().max(2000).optional(),
      imageUrl: z.string().url().nullable().optional(),
      starred: z.boolean().optional(),
      mastery: z.enum(['not-started', 'learning', 'mastered']).optional(),
      sr: srSchema
    });

    const data = updateSchema.parse(req.body);

    const card = await Card.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: data },
      { new: true }
    );

    if (!card) {
      return notFound(res, 'Card not found');
    }

    return success(res, card);
  } catch (err) {
    next(err);
  }
};

// Soft delete card
exports.delete = async (req, res, next) => {
  try {
    const card = await Card.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!card) {
      return notFound(res, 'Card not found');
    }

    // Update card count
    await Set.findByIdAndUpdate(card.setId, { $inc: { cardCount: -1 } });

    return success(res, null, 'Card deleted');
  } catch (err) {
    next(err);
  }
};

// Update SR data after review
exports.review = async (req, res, next) => {
  try {
    const reviewSchema = z.object({
      quality: z.number().min(0).max(3),
      sr: srSchema.unwrap()
    });

    const { quality, sr } = reviewSchema.parse(req.body);

    // Update mastery based on quality
    let mastery;
    if (quality === 0) {
      mastery = 'learning';
    } else if (sr.repetitions >= 3) {
      mastery = 'mastered';
    } else {
      mastery = 'learning';
    }

    const card = await Card.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, deletedAt: null },
      { $set: { sr, mastery } },
      { new: true }
    );

    if (!card) {
      return notFound(res, 'Card not found');
    }

    return success(res, card);
  } catch (err) {
    next(err);
  }
};

// Get all due cards across all sets
exports.getDue = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const cards = await Card.find({
      userId: req.userId,
      deletedAt: null,
      'sr.nextReview': { $lte: today }
    })
    .populate('setId', 'name folderId')
    .limit(100);

    return success(res, cards);
  } catch (err) {
    next(err);
  }
};
