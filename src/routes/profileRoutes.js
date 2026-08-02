// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/profileRoutes.js
// ARVIND PARTY - MASTER USER PROFILE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const profileController = require('../controllers/profileController');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { checkBannedDevice } = require('../middlewares/deviceFingerprint');
const { validateFileUpload } = require('../middlewares/security.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/avatars'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const userId = req.params.userId;
    const timestamp = Date.now();
    cb(null, `avatar_${userId}_${timestamp}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/:userId', authMiddleware, checkBannedDevice, profileController.getProfile);

router.put('/:userId', validateObjectId('userId'), validateString('name', { required: false, minLength: 2, maxLength: 50 }), validateString('bio', { required: false, maxLength: 500 }), authMiddleware, checkBannedDevice, requireRole('user', 'admin', 'owner'), profileController.updateProfile);

router.post('/:userId/avatar', validateObjectId('userId'), authMiddleware, checkBannedDevice, upload.single('avatar'), validateFileUpload({ allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxSize: 5 * 1024 * 1024, allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }), profileController.uploadAvatar);

router.get('/:userId/xp', authMiddleware, checkBannedDevice, profileController.getXpProgress);

module.exports = router;