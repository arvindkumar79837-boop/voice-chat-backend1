// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/services/ip.service.js
// ARVIND PARTY - IP INTELLIGENCE SERVICE
// This service checks an IP address against an external API to detect VPNs/Proxies.
// NOTE: This uses a free service for demonstration. For production, use a robust,
// paid service like IPQualityScore, IPinfo.io, or MaxMind.
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');

/**
 * Checks IP information using an external service.
 * @param {string} ipAddress The IP address to check.
 * @returns {Promise<{isVpn: boolean, country: string, city: string, isp: string}>}
 */
const checkIpInfo = async (ipAddress) => {
  // In a production environment, you would use a more reliable, paid API.
  // Example using the free ip-api.com for demonstration purposes.
  // It has a 'proxy' field which can indicate VPN/hosting usage.
  const apiUrl = `http://ip-api.com/json/${ipAddress}?fields=status,message,country,city,isp,proxy`;

  try {
    // Skip checks for local IPs during development
    if (ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.')) {
      return { isVpn: false, country: 'Local', city: 'Local', isp: 'Local Network' };
    }

    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.status === 'fail') {
      console.warn(`[IP Service] Failed to check IP ${ipAddress}: ${data.message}`);
      return { isVpn: false, country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
    }

    // The 'proxy' field is a boolean indicating if the IP is a known proxy/VPN.
    return {
      isVpn: data.proxy === true,
      country: data.country || 'Unknown',
      city: data.city || 'Unknown',
      isp: data.isp || 'Unknown',
    };
  } catch (error) {
    console.error(`[IP Service] Error checking IP ${ipAddress}:`, error.message);
    // Fail-safe: If the service fails, do not block the user.
    return { isVpn: false, country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
  }
};

module.exports = { checkIpInfo };