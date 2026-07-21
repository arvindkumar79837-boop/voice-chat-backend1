// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/utils/phoneUtils.js
// ARVIND PARTY - PHONE NUMBER UTILITIES (Global E.164 Support)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format E.164 phone number for display (local format without country code).
 * Stored data is ALWAYS full E.164 (+<countrycode><number>).
 * This function is for DISPLAY ONLY — never modify stored data.
 *
 * @param {string} phone - Full E.164 phone number (e.g. +919876543210, +14155552671)
 * @param {object} options - { showCountryCode: false, maskLocal: false }
 * @returns {string} Formatted phone for display
 */
function formatPhoneForDisplay(phone, options = {}) {
  if (!phone) return '';

  const { showCountryCode = false, maskLocal = false } = options;

  // E.164 format: +<1-3 digit country code><number>
  if (!phone.startsWith('+')) {
    // Not E.164 — return as-is
    return phone;
  }

  // Common country code lengths (most are 1-3 digits)
  // After removing '+', the local number is typically 10 digits
  const digits = phone.substring(1); // Remove leading '+'
  const localNumber = digits.slice(-10); // Last 10 digits are the local number
  const countryCode = digits.slice(0, -10); // Everything before is country code

  if (showCountryCode) {
    return `+${countryCode} ${formatLocalNumber(localNumber, maskLocal)}`;
  }

  return formatLocalNumber(localNumber, maskLocal);
}

/**
 * Format local number part with appropriate spacing.
 * @param {string} local - 10-digit local number
 * @param {boolean} mask - Whether to mask middle digits
 * @returns {string}
 */
function formatLocalNumber(local, mask = false) {
  if (mask) {
    return `****${local.slice(-4)}`;
  }

  // Indian format: XXXXX XXXXX (if 10 digits)
  if (local.length === 10) {
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }

  return local;
}

/**
 * Mask phone for privacy — show only last 4 digits with country code prefix.
 * E.164: +919876543210 → +91****543210
 * @param {string} phone - Full E.164 phone number
 * @returns {string} Masked phone
 */
function maskPhone(phone) {
  if (!phone) return null;

  if (phone.startsWith('+') && phone.length > 4) {
    const digits = phone.substring(1);
    const localNumber = digits.slice(-10);
    const countryCode = digits.slice(0, -10);

    if (countryCode.length > 0) {
      return `+${countryCode}****${localNumber.slice(-4)}`;
    }
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }

  if (phone.length >= 10) {
    return phone.slice(0, 2) + '****' + phone.slice(-4);
  }
  return '****' + phone.slice(-4);
}

module.exports = { formatPhoneForDisplay, maskPhone, formatLocalNumber };
