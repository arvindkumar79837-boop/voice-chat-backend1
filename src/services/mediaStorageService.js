const cloudinary = require('cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Logger = require('../utils/logger');

class MediaStorageService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.tempDir = path.join(__dirname, '../../temp');
    this.initialized = false;
    this.compressionQueue = [];
  }

  async initialize() {
    try {
      [this.uploadDir, this.tempDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      cloudinary.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });

      this.initialized = true;
      console.log('✅ Media Storage Service Initialized');
    } catch (error) {
      console.error('⚠️ Media Storage Service initialization failed:', error.message);
    }
  }

  getMulterStorage(folder, allowedTypes = ['image/jpeg', 'image/png', 'image/webp']) {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const targetDir = path.join(this.tempDir, folder);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`), false);
      }
    };

    return multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter
    }).single('file');
  }

  async compressImage(filePath, options = {}) {
    try {
      const {
        width = 800,
        height = 800,
        quality = 80,
        format = 'webp'
      } = options;

      const compressedPath = filePath.replace(path.extname(filePath), `_compressed.${format}`);

      await sharp(filePath)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .toFormat(format, { quality })
        .toFile(compressedPath);

      const stats = fs.statSync(compressedPath);
      const originalStats = fs.statSync(filePath);

      Logger.info('Image compressed', {
        originalSize: originalStats.size,
        compressedSize: stats.size,
        savings: ((1 - stats.size / originalStats.size) * 100).toFixed(2) + '%'
      });

      return compressedPath;
    } catch (error) {
      Logger.error('Image compression failed', { error: error.message, filePath });
      return filePath;
    }
  }

  async uploadToCloudinary(filePath, folder, options = {}) {
    try {
      const result = await cloudinary.v2.uploader.upload(filePath, {
        folder: `arvind-party/${folder}`,
        resource_type: 'auto',
        transformation: options.transformation || [],
        ...options
      });

      Logger.info('File uploaded to Cloudinary', {
        publicId: result.public_id,
        size: result.bytes,
        format: result.format
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes
      };
    } catch (error) {
      Logger.error('Cloudinary upload failed', { error: error.message, filePath });
      throw error;
    }
  }

  async deleteFromCloudinary(publicId) {
    try {
      const result = await cloudinary.v2.uploader.destroy(publicId);
      Logger.info('File deleted from Cloudinary', { publicId, result });
      return result.result === 'ok';
    } catch (error) {
      Logger.error('Cloudinary delete failed', { error: error.message, publicId });
      return false;
    }
  }

  async processAndUpload(file, folder, options = {}) {
    try {
      const compressedPath = await this.compressImage(file.path, options.compression || {});

      const uploadResult = await this.uploadToCloudinary(compressedPath, folder, options.cloudinary || {});

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      if (fs.existsSync(compressedPath) && compressedPath !== file.path) {
        fs.unlinkSync(compressedPath);
      }

      return uploadResult;
    } catch (error) {
      Logger.error('Process and upload failed', { error: error.message });

      if (fs.existsSync(file?.path)) {
        fs.unlinkSync(file.path);
      }

      throw error;
    }
  }

  async uploadMultiple(files, folder, options = {}) {
    const uploadPromises = files.map(file => this.processAndUpload(file, folder, options));
    const results = await Promise.allSettled(uploadPromises);

    return {
      successful: results.filter(r => r.status === 'fulfilled').map(r => r.value),
      failed: results.filter(r => r.status === 'rejected').map(r => r.reason)
    };
  }

  generateSignedUrl(publicId, expiresIn = 3600) {
    try {
      return cloudinary.v2.url(publicId, {
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn
      });
    } catch (error) {
      Logger.error('Signed URL generation failed', { error: error.message, publicId });
      return null;
    }
  }

  async createThumbnail(publicId, options = {}) {
    try {
      const { width = 200, height = 200, format = 'webp' } = options;

      const thumbnailUrl = cloudinary.v2.url(publicId, {
        transformation: [
          { width, height, crop: 'fill', gravity: 'auto' },
          { format, quality: 70 }
        ]
      });

      return thumbnailUrl;
    } catch (error) {
      Logger.error('Thumbnail generation failed', { error: error.message, publicId });
      return null;
    }
  }

  async getStorageStats() {
    try {
      const result = await cloudinary.v2.api.usage();
      return {
        credits: result.credits,
        uploads: result.uploads,
        bandwidth: result.bandwidth,
        storage: result.storage,
        limit: result.limit,
        usedPercentage: ((result.credits.used / result.limit) * 100).toFixed(2)
      };
    } catch (error) {
      Logger.error('Failed to get storage stats', { error: error.message });
      return null;
    }
  }

  isReady() {
    return this.initialized;
  }
}

module.exports = new MediaStorageService();