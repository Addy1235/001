const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

router.get('/pull', syncController.pull);
router.post('/push', syncController.push);
router.post('/full', syncController.full);

module.exports = router;
