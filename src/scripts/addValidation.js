/**
 * Script: addValidation.js
 * Automatically injects express-validator validation middleware into route files.
 * ONLY adds validateObjectId() for route params and route-specific body validators.
 * DOES NOT change business logic, API responses, route names, or controllers.
 */
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');

// Collect all route files
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const VALIDATORS = '../middlewares/validation.middleware';

// Param names that represent MongoDB ObjectIds - these apply to ALL files
const OBJECT_ID_PARAMS = new Set([
  'userId', 'id', 'roomId', 'agentId', 'agencyId', 'familyId', 'warId',
  'eventId', 'giftId', 'taskId', 'tournamentId', 'championshipId', 'gameId',
  'tierId', 'backupId', 'errorId', 'alertId', 'invitationId',
  'notificationId', 'commentId', 'messageId', 'sessionId', 'refundId',
  'requestId', 'drawId', 'itemId', 'hostId', 'reportId',
  'moduleId', 'bannerId', 'hostId'
]);

// Route-specific body validators: maps route path prefix to validators
// These are only applied to POST/PUT/PATCH routes whose path starts with the prefix
const ROUTE_BODY_VALIDATORS = {
  'auth.routes.js': [
    // otp-verify already has validateOTP in auth.routes.js (manually added)
    // refresh-token already has validateRefreshToken (manually added)
    // register already has validateName (manually added)
  ],
  'authSecure.routes.js': [
    { path: '/logout', validators: ['validateRefreshToken()'] },
    { path: '/revoke-all-sessions', validators: ['validateRefreshToken()'] },
    { path: '/admin/revoke-user-sessions', validators: ['validateRefreshToken()'] },
  ],
  'firebaseAuth.routes.js': [
    { path: '/firebase-verify', validators: [
      "validateString('platform', { required: true, isIn: ['android', 'ios', 'web', 'windows'] })",
      "validateString('idToken', { required: true, maxLength: 4096 })",
    ]},
    { path: '/apple-verify', validators: [
      "validateString('platform', { required: true, isIn: ['ios', 'macos', 'windows'] })",
      "validateString('identityToken', { required: true, maxLength: 4096 })",
    ]},
    { path: '/firebase-link', validators: ["validateString('idToken', { required: true, maxLength: 4096 })"] },
  ],
  'googleAuthRoutes.js': [
    { path: '/google', validators: ["validateString('idToken', { required: true, maxLength: 4096 })"] },
    { path: '/apple', validators: ["validateString('identityToken', { required: true, maxLength: 4096 })"] },
  ],
  'socialAuthRoutes.js': [
    { path: '/login', validators: ["validateEnum('provider', ['google', 'apple', 'facebook', 'snapchat', 'instagram', 'phone'], { required: true })"] },
    { path: '/link', validators: ["validateEnum('provider', ['google', 'apple', 'facebook', 'snapchat', 'instagram', 'phone'], { required: true })"] },
    { path: '/unlink', validators: ["validateEnum('provider', ['google', 'apple', 'facebook', 'snapchat', 'instagram'], { required: true })"] },
  ],
  'user.routes.js': [
    { path: '/complete-profile', validators: [
      "validateString('name', { required: false, minLength: 2, maxLength: 50 })",
    ]},
  ],
  'adminRoutes.js': [
    { path: '/users/block/:userId', validators: ["validateEnum('isBanned', [true, false], { required: true })"] },
    { path: '/users/unblock/:userId', validators: ["validateEnum('isBanned', [true, false], { required: true })"] },
    { path: '/users/adjust-coins/:userId', validators: [
      "validateNumber('coins', { required: false, min: 0 })",
      "validateNumber('diamonds', { required: false, min: 0 })",
    ]},
    { path: '/users/balance/:userId', validators: [
      "validateNumber('coins', { required: false, min: 0 })",
      "validateNumber('diamonds', { required: false, min: 0 })",
    ]},
    { path: '/wallets/adjust/:userId', validators: [
      "validateNumber('coins', { required: false, min: 0 })",
      "validateNumber('diamonds', { required: false, min: 0 })",
    ]},
    { path: '/announcement', validators: ["validateString('title', { required: true, maxLength: 200 })", "validateString('message', { required: true, maxLength: 1000 })"] },
    { path: '/bans', validators: ["validateBodyObjectId('userId')"] },
    { path: '/notifications/send', validators: ["validateString('title', { required: true, maxLength: 200 })", "validateString('message', { required: true, maxLength: 1000 })"] },
    { path: '/coins/generate', validators: ["validateNumber('coins', { required: true, min: 0 })"] },
    { path: '/coins/deduct', validators: ["validateNumber('coins', { required: true, min: 0 })"] },
    { path: '/rewards/send', validators: ["validateBodyObjectId('userId')", "validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
    { path: '/security/block-ip', validators: ["validateString('ipAddress', { required: true })"] },
    { path: '/rewards/inject', validators: ["validateBodyObjectId('userId')", "validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
  ],
  'adminAuth.js': [
    { path: '/login', validators: ["validateEmail()", "validateString('password', { required: true, minLength: 6, maxLength: 128 })"] },
    { path: '/verify-2fa', validators: ["validateOTP()"] },
  ],
  'staffRoutes.js': [
    { path: '/create', validators: ["validateString('name', { required: true, minLength: 2, maxLength: 50 })", "validateEmail()", "validatePhone()", "validateEnum('role', ['admin', 'owner', 'staff', 'moderator'], { required: true })"] },
  ],
  'securityRoutes.js': [
    { path: '/2fa/enable', validators: ["validateEnum('method', ['totp', 'sms', 'email'], { required: true })"] },
    { path: '/2fa/verify-enable', validators: ["validateString('code', { required: true, minLength: 4, maxLength: 10 })"] },
    { path: '/2fa/disable', validators: ["validateString('code', { required: true, minLength: 4, maxLength: 10 })"] },
    { path: '/forgot-password', validators: ["validateEmail()"] },
    { path: '/reset-password', validators: ["validateString('token', { required: true })", "validatePassword('newPassword', { required: true, minLength: 6, maxLength: 128 })"] },
    { path: '/change-password', validators: ["validatePassword('currentPassword', { required: true, minLength: 6, maxLength: 128 })", "validatePassword('newPassword', { required: true, minLength: 6, maxLength: 128 })"] },
    { path: '/recovery/setup', validators: ["validateEmail()", "validatePhone()"] },
    { path: '/devices/sessions/:sessionId/logout', validators: [] },
    { path: '/devices/sessions/:sessionId/trust', validators: [] },
  ],
  'wallet.routes.js': [
    { path: '/recharge', validators: ["validateNumber('amount', { required: true, min: 1 })"] },
  ],
  'gift.routes.js': [
    { path: '/send', validators: ["validateBodyObjectId('targetUserId')", "validateNumber('quantity', { required: true, min: 1 })"] },
    { path: '/combo', validators: ["validateBodyObjectId('targetUserId')", "validateNumber('quantity', { required: true, min: 1 })"] },
    { path: '/goals', validators: ["validateString('title', { required: true, maxLength: 200 })", "validateNumber('target', { required: true, min: 1 })", "validateEnum('type', ['coins', 'diamonds'], { required: true })"] },
  ],
  'agencyRoutes.js': [
    { path: '/apply', validators: ["validateString('agencyId', { required: true })"] },
    { path: '/commission/calculate', validators: ["validateBodyObjectId('userId')", "validateNumber('amount', { required: true, min: 0 })"] },
  ],
  'profileRoutes.js': [
    { path: '/:userId', validators: [
      "validateString('name', { required: false, minLength: 2, maxLength: 50 })",
      "validateString('bio', { required: false, maxLength: 500 })",
    ]},
  ],
  'legalRoutes.js': [
    { path: '/document', validators: ["validateEnum('documentType', ['privacy', 'terms', 'refund', 'eula'], { required: true })"] },
    { path: '/accept', validators: ["validateEnum('documentType', ['privacy', 'terms', 'refund', 'eula'], { required: true })"] },
    { path: '/request-deletion', validators: [] },
    { path: '/cancel-deletion', validators: [] },
  ],
  'treasuryRoutes.js': [
    { path: '/generate', validators: ["validateNumber('coins', { required: true, min: 0 })"] },
    { path: '/deduct', validators: ["validateNumber('coins', { required: true, min: 0 })"] },
    { path: '/send-reward', validators: ["validateBodyObjectId('userId')", "validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
  ],
  'blindDateRoutes.js': [
    { path: '/profile', validators: ["validateString('bio', { required: false, maxLength: 500 })"] },
    { path: '/:sessionId/decide', validators: ["validateEnum('decision', ['yes', 'no'], { required: true })"] },
    { path: '/:sessionId/report', validators: ["validateString('reason', { required: true, maxLength: 500 })"] },
  ],
  'attendanceRoutes.js': [
    { path: '/attendance/start', validators: ["validateBodyObjectId('roomId')"] },
    { path: '/attendance/end', validators: ["validateBodyObjectId('roomId')"] },
  ],
  'bonusRoutes.js': [
    { path: '/bonus/award', validators: ["validateBodyObjectId('userId')", "validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
  ],
  'coinDistributionRoutes.js': [
    { path: '/generate-for-user', validators: ["validateBodyObjectId('userId')", "validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
    { path: '/distribute', validators: ["validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
  ],
  'cpRoutes.js': [
    { path: '/bind', validators: ["validateEnum('status', ['single', 'couple'], { required: true })"] },
  ],
  'dailyTaskRoutes.js': [
    { path: '/:taskId/claim', validators: [] },
    { path: '/admin/create', validators: ["validateString('title', { required: true, maxLength: 200 })", "validateNumber('reward', { required: false, min: 0 })"] },
  ],
  'pkBattleRoutes.js': [
    { path: '/request', validators: ["validateBodyObjectId('opponentId')"] },
    { path: '/accept', validators: ["validateString('challengeToken', { required: true })"] },
    { path: '/end', validators: ["validateNumber('hostScore', { required: true, min: 0 })", "validateNumber('guestScore', { required: true, min: 0 })"] },
  ],
  'penaltyRoutes.js': [
    { path: '/penalty/apply', validators: ["validateBodyObjectId('userId')", "validateNumber('amount', { required: false, min: 0 })", "validateEnum('type', ['coins', 'diamonds', 'ban', 'mute'], { required: true })"] },
  ],
  'dealer.routes.js': [
    { path: '/wallet/credit', validators: ["validateNumber('coins', { required: true, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
    { path: '/transfer', validators: ["validateBodyObjectId('userId')", "validateNumber('coins', { required: false, min: 0 })", "validateNumber('diamonds', { required: false, min: 0 })"] },
    { path: '/refund/request', validators: ["validateNumber('coins', { required: true, min: 0 })"] },
  ],
  'moderation.routes.js': [
    { path: '/report', validators: ["validateEnum('type', ['user', 'moment', 'gift', 'room', 'message'], { required: true })", "validateBodyObjectId('targetId')", "validateString('reason', { required: false, maxLength: 500 })"] },
    { path: '/block', validators: ["validateBodyObjectId('targetUserId')"] },
  ],
  'shopRoutes.js': [
    { path: '/purchase', validators: ["validateBodyObjectId('itemId')", "validateNumber('quantity', { required: true, min: 1 })"] },
  ],
  'matchmakingRoutes.js': [
    { path: '/search', validators: ["validateEnum('mode', ['solo', 'duo', 'squad'], { required: true })", "validateString('gender', { required: false, isIn: ['male', 'female', 'any'] })"] },
  ],
  'level.routes.js': [
    { path: '/xp/add', validators: ["validateNumber('xp', { required: true, min: 0 })"] },
  ],
  'inventory.routes.js': [
    { path: '/use/:itemId', validators: ["validateNumber('quantity', { required: false, min: 1 })"] },
  ],
  'premiumSubscriptionRoutes.js': [
    { path: '/tiers', validators: ["validateString('name', { required: true, maxLength: 100 })", "validateNumber('price', { required: true, min: 0 })", "validateNumber('duration', { required: true, min: 1 })"] },
    { path: '/verify-play-subscription', validators: ["validateString('purchaseToken', { required: true })"] },
  ],
  'roomFeaturesRoutes.js': [
    { path: '/create', validators: ["validateEnum('roomType', ['public', 'private', 'password'], { required: true })"] },
    { path: '/:roomId/follow', validators: [] },
    { path: '/promote-admin', validators: ["validateBodyObjectId('targetUserId')"] },
    { path: '/demote-admin', validators: ["validateBodyObjectId('targetUserId')"] },
    { path: '/award-xp', validators: ["validateNumber('xp', { required: true, min: 0 })"] },
    { path: '/verify-password', validators: ["validateString('password', { required: true, minLength: 1 })"] },
  ],
  'tournamentRoutes.js': [
    { path: '/create', validators: ["validateString('name', { required: true, maxLength: 200 })", "validateDate('startDate', { required: true })", "validateDate('endDate', { required: true })"] },
    { path: '/:tournamentId/score', validators: ["validateBodyObjectId('participantId')", "validateNumber('score', { required: true, min: 0 })"] },
    { path: '/championship/create', validators: ["validateString('name', { required: true, maxLength: 200 })"] },
  ],
  'youtube.routes.js': [
    { path: '/playlist/add', validators: ["validateString('videoId', { required: true })", "validateString('title', { required: true, maxLength: 200 })"] },
    { path: '/playback/update', validators: ["validateEnum('action', ['play', 'pause', 'stop', 'skip', 'seek'], { required: true })"] },
  ],
  'inviteRoutes.js': [
    { path: '/register', validators: ["validateString('inviteCode', { required: true })"] },
    { path: '/commission', validators: ["validateNumber('amount', { required: false, min: 0 })"] },
  ],
  'loginStreakRoutes.js': [
    { path: '/claim-daily', validators: [] },
    { path: '/admin/reset/:userId', validators: [] },
  ],
  'luckyDrawRoutes.js': [
    { path: '/admin/create', validators: ["validateString('name', { required: true, maxLength: 200 })", "validateNumber('tickets', { required: true, min: 1 })"] },
  ],
};

// Track files modified
const modifiedFiles = [];
const changesByFile = {};

function ensureImport(content) {
  if (content.includes('validation.middleware')) {
    return content;
  }
  
  const lines = content.split('\n');
  let insertAfter = -1;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('require(') && (lines[i].startsWith('const ') || lines[i].startsWith('let '))) {
      insertAfter = i;
      break;
    }
  }
  
  if (insertAfter === -1) {
    insertAfter = 0;
  }
  
  const importLine = `const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('${VALIDATORS}');`;
  lines.splice(insertAfter + 1, 0, importLine);
  
  return lines.join('\n');
}

function parseRouteLine(line) {
  const routeRegex = /router\.(post|put|patch)\s*\(\s*(['"])(.+?)\2\s*,\s*(.*)\);\s*$/;
  const match = line.match(routeRegex);
  if (!match) return null;

  const method = match[1];
  const routePath = match[3];
  const rest = match[4];

  const paramRegex = /:(\w+)/g;
  const params = [];
  let paramMatch;
  while ((paramMatch = paramRegex.exec(routePath)) !== null) {
    params.push(paramMatch[1]);
  }

  const usedValidators = new Set();
  const validatorRegex = /\b(validate\w+)\s*\(/g;
  let vMatch;
  while ((vMatch = validatorRegex.exec(rest)) !== null) {
    usedValidators.add(vMatch[1]);
  }

  return { method, routePath, rest, params, usedValidators, line, lineIndex: -1 };
}

function getRouteBodyValidators(fileName, routePath) {
  const rules = ROUTE_BODY_VALIDATORS[fileName];
  if (!rules) return [];
  
  for (const rule of rules) {
    if (routePath.startsWith(rule.path)) {
      return rule.validators;
    }
  }
  return [];
}

function processFile(filePath) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  const changes = [];

  // Step 1: Ensure validation import
  let newContent = content;
  if (!newContent.includes('validation.middleware')) {
    newContent = ensureImport(newContent);
    changed = true;
    changes.push('Added validation.middleware import');
  }

  // Step 2: Process each line for route definitions
  const lines = newContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const routeDef = parseRouteLine(lines[i]);
    if (!routeDef) continue;

    const validatorsToAdd = [];

    // ObjectId params - always add for params
    for (const param of routeDef.params) {
      if (OBJECT_ID_PARAMS.has(param)) {
        // Check if validateObjectId is already used for this param
        if (routeDef.usedValidators.has('validateObjectId')) {
          // Already has some validateObjectId - check if this specific one is present
          if (!routeDef.rest.includes(`validateObjectId('${param}')`)) {
            validatorsToAdd.push(`validateObjectId('${param}')`);
          }
        } else {
          validatorsToAdd.push(`validateObjectId('${param}')`);
        }
      }
    }

    // Route-specific body validators
    const bodyValidators = getRouteBodyValidators(fileName, routeDef.routePath);
    for (const v of bodyValidators) {
      // Extract validator name (before the opening paren)
      const vName = v.match(/^(\w+)/)[1];
      if (!routeDef.usedValidators.has(vName)) {
        validatorsToAdd.push(v);
      }
    }

    if (validatorsToAdd.length === 0) continue;

    const validatorsStr = validatorsToAdd.join(', ');
    
    const routeRegex = new RegExp(
      `(router\\.${routeDef.method}\\s*\\(\\s*['"]${routeDef.routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*,\\s*)(.*)`
    );
    const match = lines[i].match(routeRegex);
    
    if (match) {
      const beforePath = match[1];
      const afterPath = match[2];
      lines[i] = `${beforePath}${validatorsStr}, ${afterPath}`;
      changed = true;
      changes.push(`POST/PUT/PATCH ${routeDef.routePath} - Added: ${validatorsStr}`);
    }
  }

  newContent = lines.join('\n');

  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    modifiedFiles.push(fileName);
    changesByFile[fileName] = changes;
    console.log(`✓ Updated: ${fileName} (${changes.length} changes)`);
  }
}

console.log('=== Starting validation middleware injection ===\n');

for (const file of routeFiles) {
  const filePath = path.join(routesDir, file);
  processFile(filePath);
}

console.log('\n=== Summary ===');
console.log(`Total files processed: ${routeFiles.length}`);
console.log(`Files modified: ${modifiedFiles.length}`);

const summary = {
  modifiedFiles,
  changesByFile,
  timestamp: new Date().toISOString()
};

fs.writeFileSync(
  path.join(__dirname, 'validation_changes.json'),
  JSON.stringify(summary, null, 2)
);

console.log('Summary written to src/scripts/validation_changes.json');
