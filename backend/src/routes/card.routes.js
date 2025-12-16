const express = require('express');
const router = express.Router();
const cardController = require('../controllers/card.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Card routes nested under sets
router.get('/sets/:setId/cards', cardController.list);
router.post('/sets/:setId/cards', cardController.create);
router.post('/sets/:setId/cards/bulk', cardController.bulkCreate);

// Direct card routes
router.get('/cards/due', cardController.getDue);
router.get('/cards/:id', cardController.get);
router.patch('/cards/:id', cardController.update);
router.delete('/cards/:id', cardController.delete);
router.post('/cards/:id/review', cardController.review);

module.exports = router;
