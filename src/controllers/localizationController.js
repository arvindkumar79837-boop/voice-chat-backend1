const AppLocalizationString = require('../models/AppLocalizationString');
const ApiResponse = require('../utils/apiResponse');

class LocalizationController {
  async getTranslations(req, res) {
    try {
      const { language = 'en' } = req.query;
      const keys = req.query.keys ? req.query.keys.split(',') : null;

      const query = { isActive: true };
      if (keys && keys.length > 0) {
        query.key = { $in: keys };
      }

      const strings = await AppLocalizationString.find(query).select('key translations category');

      const result = {};
      strings.forEach(item => {
        const translation = item.translations.get(language);
        if (translation) {
          result[item.key] = translation.text;
        } else {
          const defaultTranslation = item.translations.get('en');
          result[item.key] = defaultTranslation ? defaultTranslation.text : item.key;
        }
      });

      return ApiResponse.success(res, 'Translations fetched successfully', {
        language,
        count: Object.keys(result).length,
        translations: result
      });
    } catch (error) {
      return ApiResponse.error(res, 'Failed to fetch translations', 500, error.message);
    }
  }

  async getAllStrings(req, res) {
    try {
      const { page = 1, limit = 100, category, search } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = {};
      if (category) query.category = category;
      if (search) {
        query.key = { $regex: search, $options: 'i' };
      }

      const [strings, total] = await Promise.all([
        AppLocalizationString.find(query)
          .sort({ key: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        AppLocalizationString.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Localization strings fetched', {
        strings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      return ApiResponse.error(res, 'Failed to fetch localization strings', 500, error.message);
    }
  }

  async createString(req, res) {
    try {
      const { key, translations, category, description } = req.body;

      if (!key || !translations || !translations.en) {
        return ApiResponse.error(res, 'Key and English translation are required', 400);
      }

      const existingKey = await AppLocalizationString.findOne({ key });
      if (existingKey) {
        return ApiResponse.error(res, 'Key already exists', 409);
      }

      const newString = new AppLocalizationString({
        key,
        translations: new Map(Object.entries(translations)),
        category: category || 'common',
        description
      });

      await newString.save();

      return ApiResponse.success(res, 'Localization string created successfully', {
        key: newString.key,
        category: newString.category,
        description: newString.description
      }, 201);
    } catch (error) {
      return ApiResponse.error(res, 'Failed to create localization string', 500, error.message);
    }
  }

  async updateString(req, res) {
    try {
      const { id } = req.params;
      const { translations, category, description, isActive } = req.body;

      const string = await AppLocalizationString.findById(id);
      if (!string) {
        return ApiResponse.error(res, 'Localization string not found', 404);
      }

      if (translations && typeof translations === 'object') {
        string.translations = new Map(Object.entries(translations));
      }
      if (category) string.category = category;
      if (description !== undefined) string.description = description;
      if (isActive !== undefined) string.isActive = isActive;

      await string.save();

      return ApiResponse.success(res, 'Localization string updated successfully', {
        key: string.key,
        category: string.category,
        isActive: string.isActive
      });
    } catch (error) {
      return ApiResponse.error(res, 'Failed to update localization string', 500, error.message);
    }
  }

  async deleteString(req, res) {
    try {
      const { id } = req.params;

      const string = await AppLocalizationString.findById(id);
      if (!string) {
        return ApiResponse.error(res, 'Localization string not found', 404);
      }

      await AppLocalizationString.findByIdAndDelete(id);

      return ApiResponse.success(res, 'Localization string deleted successfully');
    } catch (error) {
      return ApiResponse.error(res, 'Failed to delete localization string', 500, error.message);
    }
  }

  async bulkImportStrings(req, res) {
    try {
      const { strings } = req.body;

      if (!Array.isArray(strings) || strings.length === 0) {
        return ApiResponse.error(res, 'Strings array is required and cannot be empty', 400);
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const item of strings) {
        try {
          const { key, translations, category, description } = item;

          if (!key || !translations || !translations.en) {
            results.failed++;
            results.errors.push({ key, error: 'Key and English translation required' });
            continue;
          }

          const existingKey = await AppLocalizationString.findOne({ key });
          if (existingKey) {
            existingKey.translations = new Map(Object.entries(translations));
            if (category) existingKey.category = category;
            if (description) existingKey.description = description;
            await existingKey.save();
          } else {
            const newString = new AppLocalizationString({
              key,
              translations: new Map(Object.entries(translations)),
              category: category || 'common',
              description
            });
            await newString.save();
          }

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({ key: item.key, error: err.message });
        }
      }

      return ApiResponse.success(res, 'Bulk import completed', results);
    } catch (error) {
      return ApiResponse.error(res, 'Failed to bulk import strings', 500, error.message);
    }
  }

  async getCategories(req, res) {
    try {
      const categories = await AppLocalizationString.distinct('category');
      return ApiResponse.success(res, 'Categories fetched successfully', categories);
    } catch (error) {
      return ApiResponse.error(res, 'Failed to fetch categories', 500, error.message);
    }
  }

  async getSupportedLanguages(req, res) {
    try {
      const allStrings = await AppLocalizationString.find({ isActive: true }).select('translations');
      const languages = new Set(['en']);

      allStrings.forEach(item => {
        item.translations.forEach((value, key) => {
          languages.add(key);
        });
      });

      return ApiResponse.success(res, 'Supported languages fetched successfully', {
        languages: Array.from(languages).sort(),
        count: languages.size
      });
    } catch (error) {
      return ApiResponse.error(res, 'Failed to fetch supported languages', 500, error.message);
    }
  }
}

module.exports = new LocalizationController();