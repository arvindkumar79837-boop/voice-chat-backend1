const crypto = require('crypto');
const Cloudinary = require('cloudinary').v2;
const Logger = require('../utils/logger');

class CDNService {
  constructor() {
    this.isEnabled = process.env.CDN_ENABLED !== 'false';
    this.provider = process.env.CDN_PROVIDER || 'cloudinary';
    this.cacheEnabled = true;
    this.defaultCacheTTL = parseInt(process.env.CDN_CACHE_TTL) || 86400;
    this.cdnDomains = {
      images: process.env.CDN_IMAGES_DOMAIN || '',
      videos: process.env.CDN_VIDEOS_DOMAIN || '',
      static: process.env.CDN_STATIC_DOMAIN || ''
    };
    this.stats = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesServed: 0
    };
  }

  initialize() {
    if (!this.isEnabled) {
      Logger.info('CDN Service is disabled');
      return false;
    }

    try {
      if (this.provider === 'cloudinary') {
        Cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
        Logger.info('CDN Service initialized with Cloudinary');
        return true;
      } else if (this.provider === 's3') {
        const AWS = require('aws-sdk');
        this.s3 = new AWS.S3({
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        this.s3Bucket = process.env.S3_BUCKET_NAME;
        this.cloudFrontDomain = process.env.CLOUD_FRONT_DOMAIN;
        Logger.info('CDN Service initialized with S3 + CloudFront');
        return true;
      } else if (this.provider === 'local') {
        Logger.info('CDN Service running in local mode (no external CDN)');
        return true;
      }

      Logger.warn('Unknown CDN provider, falling back to local mode');
      return true;
    } catch (error) {
      Logger.error('CDN Service initialization failed', { error: error.message });
      return false;
    }
  }

  async uploadAsset(file, options = {}) {
    try {
      const { folder = 'arvind-party', publicId, transformation } = options;
      const result = await Cloudinary.uploader.upload(file, {
        folder,
        public_id: publicId,
        transformation: transformation || {},
        resource_type: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto'
      });

      const cdnUrl = this.transformToCDNUrl(result.secure_url, result.resource_type);

      Logger.info('Asset uploaded to CDN', {
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        cdnUrl
      });

      return {
        success: true,
        url: cdnUrl,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height,
        resourceType: result.resource_type
      };
    } catch (error) {
      Logger.error('CDN upload failed', { error: error.message });
      throw error;
    }
  }

  async uploadVideo(file, options = {}) {
    try {
      const { folder = 'arvind-party/videos', publicId } = options;
      const result = await Cloudinary.uploader.upload_large(file, {
        folder,
        public_id: publicId,
        resource_type: 'video',
        quality: 'auto:good',
        eager: [
          { format: 'webm', quality: 70 },
          { format: 'mp4', quality: 80 }
        ]
      });

      const cdnUrl = this.transformToCDNUrl(result.secure_url, 'video');

      Logger.info('Video uploaded to CDN', {
        publicId: result.public_id,
        duration: result.duration,
        size: result.bytes,
        cdnUrl
      });

      return {
        success: true,
        url: cdnUrl,
        publicId: result.public_id,
        duration: result.duration,
        size: result.bytes,
        format: result.format,
        resourceType: 'video'
      };
    } catch (error) {
      Logger.error('CDN video upload failed', { error: error.message });
      throw error;
    }
  }

  async deleteAsset(publicId, resourceType = 'image') {
    try {
      const result = await Cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      Logger.info('Asset deleted from CDN', { publicId, result: result.result });
      return result;
    } catch (error) {
      Logger.error('CDN delete failed', { publicId, error: error.message });
      throw error;
    }
  }

  transformToCDNUrl(url, resourceType) {
    if (!this.cacheEnabled) {
      return url;
    }

    const domain = this.cdnDomains[resourceType === 'video' ? 'videos' : 'images'];
    if (domain && this.provider === 'cloudinary') {
      return url.replace('res.cloudinary.com', domain);
    }

    return url;
  }

  getOptimizedUrl(publicId, options = {}) {
    try {
      const { width, height, quality, format, crop } = options;
      const transformations = [];

      if (width) transformations.push(`w_${width}`);
      if (height) transformations.push(`h_${height}`);
      if (crop) transformations.push(`c_${crop}`);
      if (quality) transformations.push(`q_${quality}`);
      if (format) transformations.push(`f_${format}`);

      transformations.push('fl_progressive');

      const baseUrl = this.cdnDomains.images || 'res.cloudinary.com';
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

      return `https://${baseUrl}/${cloudName}/image/upload/${transformations.join(',')}/${publicId}`;
    } catch (error) {
      Logger.error('Failed to generate optimized URL', { error: error.message });
      return '';
    }
  }

  getVideoUrl(publicId, options = {}) {
    try {
      const { quality, format } = options;
      const transformations = [];

      if (quality) transformations.push(`q_${quality}`);
      if (format) transformations.push(`f_${format}`);

      const baseUrl = this.cdnDomains.videos || 'res.cloudinary.com';
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

      return `https://${baseUrl}/${cloudName}/video/upload${transformations.length ? '/' + transformations.join(',') : ''}/${publicId}`;
    } catch (error) {
      Logger.error('Failed to generate video URL', { error: error.message });
      return '';
    }
  }

  generateCacheKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  async invalidateCache(urls) {
    try {
      if (this.provider === 'cloudinary') {
        const urlList = Array.isArray(urls) ? urls : [urls];
        const result = await Cloudinary.api.delete_resources_by_prefix(urls[0]);
        Logger.info('CDN cache invalidated', { urls: urlList.length, result: result.result });
        return result;
      } else if (this.provider === 's3' && this.cloudFrontDomain) {
        const cloudfront = require('aws-sdk').CloudFront;
        const cf = new cloudfront({ region: process.env.AWS_REGION });
        const distributionId = process.env.CLOUD_FRONT_DISTRIBUTION_ID;

        const invalidationParams = {
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: Date.now().toString(),
            Paths: {
              Quantity: urlList.length,
              Items: urlList
            }
          }
        };

        const result = await cf.createInvalidation(invalidationParams).promise();
        Logger.info('CloudFront cache invalidated', { invalidationId: result.Invalidation.Id });
        return result;
      }

      return null;
    } catch (error) {
      Logger.error('CDN cache invalidation failed', { error: error.message });
      throw error;
    }
  }

  async getSignedUrl(publicId, expiresIn = 3600) {
    try {
      const timestamp = Math.round(Date.now() / 1000) + expiresIn;

      if (this.provider === 'cloudinary') {
        const signature = Cloudinary.utils.api_sign_request(
          { timestamp, public_id: publicId },
          process.env.CLOUDINARY_API_SECRET
        );

        return `${Cloudinary.url(publicId, { sign_url: true })}?timestamp=${timestamp}&signature=${signature}`;
      }

      return '';
    } catch (error) {
      Logger.error('Failed to generate signed URL', { error: error.message });
      return '';
    }
  }

  recordCacheHit() {
    this.stats.cacheHits++;
    this.stats.requests++;
  }

  recordCacheMiss() {
    this.stats.cacheMisses++;
    this.stats.requests++;
  }

  recordBytesServed(bytes) {
    this.stats.bytesServed += bytes;
  }

  getStats() {
    const hitRate = this.stats.requests > 0
      ? ((this.stats.cacheHits / this.stats.requests) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: parseFloat(hitRate),
      provider: this.provider,
      isEnabled: this.isEnabled,
      cacheEnabled: this.cacheEnabled,
      domains: this.cdnDomains
    };
  }

  getHealthStatus() {
    return {
      status: this.isEnabled ? 'healthy' : 'disabled',
      provider: this.provider,
      stats: this.getStats()
    };
  }
}

module.exports = new CDNService();