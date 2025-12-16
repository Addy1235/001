const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folder.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

router.get('/', folderController.list);
router.post('/', folderController.create);
router.patch('/reorder', folderController.reorder);
router.get('/:id', folderController.get);
router.patch('/:id', folderController.update);
router.delete('/:id', folderController.delete);

module.exports = router;
