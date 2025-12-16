const express = require('express');
const router = express.Router();
const setController = require('../controllers/set.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Set routes (nested under folders)
router.get('/folders/:folderId/sets', setController.list);
router.post('/folders/:folderId/sets', setController.create);

// Direct set routes
router.get('/sets/:id', setController.get);
router.patch('/sets/:id', setController.update);
router.delete('/sets/:id', setController.delete);
router.post('/sets/:id/move', setController.move);

module.exports = router;
