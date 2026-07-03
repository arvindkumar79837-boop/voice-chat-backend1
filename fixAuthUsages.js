const fs = require('fs');

const files = [
  'src/routes/gift.routes.js',
  'src/routes/agencyRoutes.js',
  'src/routes/agentRoutes.js',
  'src/routes/attendanceRoutes.js',
  'src/routes/blindDateRoutes.js',
  'src/routes/shopRoutes.js',
  'src/routes/support.routes.js',
  'src/routes/tournamentRoutes.js',
  'src/routes/treasureHuntRoutes.js',
  'src/routes/vipRoutes.js',
  'src/routes/vipSystemRoutes.js',
  'src/routes/wallet.routes.js',
  'src/routes/withdrawalRoutes.js'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  // Check if the file has the destructured import
  if (content.includes("const { authMiddleware } = require('../middlewares/auth.middleware')")) {
    // Replace all usages of `auth` in route definitions with `authMiddleware`
    // but be careful not to replace `auth` inside strings or other variable names.
    // We'll do a simple replacement of `, auth, ` or similar patterns.
    
    // Pattern 1: router.post('/x', auth, ...)
    let r1 = /, auth, /g;
    if (r1.test(content)) {
      content = content.replace(r1, ', authMiddleware, ');
      changed = true;
    }

    // Pattern 2: router.get('/x', auth, ...)
    let r2 = /auth, /g;
    if (r2.test(content)) {
      content = content.replace(r2, 'authMiddleware, ');
      changed = true;
    }

    // Also handle `const auth = require(...)` if any were reverted or missed
    // But our script already changed them. So focus on replacing `auth` usages.
  }

  if (changed) {
    fs.writeFileSync(f, content, 'utf8');
    console.log(`Fixed usages: ${f}`);
  }
});
