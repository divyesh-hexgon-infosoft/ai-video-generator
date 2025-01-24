const express = require('express');
const router = express.Router();
const scriptController = require('../controllers/script.controller');

// Existing routes
router.post('/generate-script', scriptController.generateScript);
router.post('/generate-video-script', scriptController.generateVideoScript);

// New routes
router.post('/generate-script-with-media', scriptController.generateScriptWithMedia);
router.post('/get-media-for-script', scriptController.getMediaForScript);
router.post('/cleanup-media', scriptController.cleanupMedia);

module.exports = router;
