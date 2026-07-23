// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: queryValidation
// Validates and sanitizes query parameters (page, limit, offset) to prevent
// DoS via extremely large values. Apply to routes that accept pagination.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000;

const queryValidation = (req, res, next) => {
  // Sanitize page
  if (req.query.page) {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (page > MAX_PAGE) page = MAX_PAGE;
    req.query.page = String(page);
  }

  // Sanitize limit — prevent DoS via limit=999999999
  if (req.query.limit) {
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    req.query.limit = String(limit);
  }

  // Sanitize offset
  if (req.query.offset) {
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(offset) || offset < 0) offset = 0;
    req.query.offset = String(offset);
  }

  next();
};

module.exports = queryValidation;
