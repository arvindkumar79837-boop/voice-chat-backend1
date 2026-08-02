/**
 * Script: addPaginationValidation.js
 * Adds validatePagination() middleware to GET routes that return lists/pagination data.
 */
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

// Files that have paginated GET routes (return lists with page/limit)
const PAGINATED_FILES = [
  'adminRoutes.js',
  'staffRoutes.js',
  'securityRoutes.js',
  'room.routes.js',
  'gift.routes.js',
  'wallet.routes.js',
  'agencyRoutes.js',
  'agencyInvitationRoutes.js',
  'attendanceRoutes.js',
  'familyRoutes.js',
  'familyChatRoutes.js',
  'gameRoutes.js',
  'eventRoutes.js',
  'moduleManagerRoutes.js',
  'notificationRoutes.js',
  'rankingRoutes.js',
  'reportController', // not a file
  'reportsRoutes.js',
  'shopRoutes.js',
  'singingRoutes.js',
  'support.routes.js',
  'targetRoutes.js',
  'tournamentRoutes.js',
  'tournamentRoutes.js',
  'treasuryRoutes.js',
  'user.routes.js',
  'vipRoutes.js',
  'vipSystemRoutes.js',
  'youtube.routes.js',
  'coinOrderRoutes.js',
  'coinDistributionRoutes.js',
  'luckyDrawRoutes.js',
  'dailyTaskRoutes.js',
  'level.routes.js',
  'inventory.routes.js',
  'premiumSubscriptionRoutes.js',
  'diamondWithdrawalRoutes.js',
  'rechargePlanRoutes.js',
  'rewardsRoutes.js',
  'socialRoutes.js',
  'blindDateRoutes.js',
  'moderation.routes.js',
  'referral.routes.js',
  'inviteRoutes.js',
  'loginStreakRoutes.js',
  'missionRoutes.js',
  'momentRoutes.js',
  'analytics.routes.js',
  'legalRoutes.js',
  'creator.routes.js',
  'dealer.routes.js',
  'penaltyRoutes.js',
  'agentRoutes.js',
  'attendanceRoutes.js',
  'salaryRoutes.js',
  'bonusRoutes.js',
  'agenciesRoutes.js',
  'antiBanRoutes.js',
  'appUserRoutes.js',
  'cpRoutes.js',
  'infrastructureRoutes.js',
  'localizationRoutes.js',
  'rewardsRoutes.js',
];

const PAGINATED_SET = new Set(PAGINATED_FILES);

let modified = [];

for (const file of routeFiles) {
  if (!PAGINATED_SET.has(file)) continue;
  
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let changed = false;
  
  for (let i = 0; i < lines.length; i++) {
    // Only process GET routes
    if (!lines[i].includes('router.get(')) continue;
    
    // Skip if validatePagination is already in the line
    if (lines[i].includes('validatePagination')) continue;
    
    // Match route.get('/path', ...) or route.get('/:param/...', ...)
    const getRegex = /router\.get\(\s*(['"])(.+?)\1\s*,\s*(.*)\);/;
    const match = lines[i].match(getRegex);
    if (!match) continue;
    
    const routePath = match[2];
    const rest = match[4];
    
    // Check if the line already has middleware (not just a controller call)
    // We want to add validatePagination after the route path
    const routeMatch = lines[i].match(/(router\.get\(\s*['"].+?['"]\s*,\s*)(.*)/);
    if (!routeMatch) continue;
    
    // Insert validatePagination() right after the path
    lines[i] = `${routeMatch[1]}validatePagination(), ${routeMatch[2]}`;
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    modified.push(file);
    console.log(`✓ Added validatePagination() to: ${file}`);
  }
}

console.log(`\n=== Added pagination validation to ${modified.length} files ===`);
