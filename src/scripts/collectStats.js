const fs = require('fs');
const path = require('path');
const routesDir = path.join(__dirname, '..', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

let totalPOST = 0, totalPUT = 0, totalPATCH = 0;
let withValidation = { post: 0, put: 0, patch: 0 };
let filesWithValidation = 0;
let totalObjectIdVal = 0;
let totalValidatorUses = 0;
const allChanges = {};

files.forEach(f => {
  const content = fs.readFileSync(path.join(routesDir, f), 'utf8');
  const lines = content.split('\n');
  let fileHasValidation = false;
  let fileChanges = [];

  lines.forEach(line => {
    if (line.match(/router\.post\(/)) { totalPOST++; if (line.includes('validate')) { withValidation.post++; fileHasValidation = true; } }
    if (line.match(/router\.put\(/)) { totalPUT++; if (line.includes('validate')) { withValidation.put++; fileHasValidation = true; } }
    if (line.match(/router\.patch\(/)) { totalPATCH++; if (line.includes('validate')) { withValidation.patch++; fileHasValidation = true; } }

    const oidMatches = line.match(/validateObjectId\(/g);
    if (oidMatches) totalObjectIdVal += oidMatches.length;

    const allMatches = line.match(/validate\w+\s*\(/g);
    if (allMatches) {
      totalValidatorUses += allMatches.length;
      if (line.match(/router\.(post|put|patch)/)) {
        fileChanges.push(line.trim());
      }
    }
  });

  if (fileHasValidation) filesWithValidation++;
  if (fileChanges.length > 0) allChanges[f] = fileChanges;
});

const report = {
  totalRouteFiles: files.length,
  totalPOST,
  totalPUT,
  totalPATCH,
  withValidation,
  totalRoutes: totalPOST + totalPUT + totalPATCH,
  filesWithValidation,
  totalObjectId: totalObjectIdVal,
  totalValidatorUses,
  coverage: {
    post: `${((withValidation.post/totalPOST)*100).toFixed(1)}%`,
    put: `${((withValidation.put/totalPUT)*100).toFixed(1)}%`,
    patch: `${((withValidation.patch/totalPATCH)*100).toFixed(1)}%`,
  }
};

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(__dirname, 'stats.json'), JSON.stringify(report, null, 2));
