/**
 * Script: fixValidationImports2.js
 * Expands validation.middleware imports to include ALL validators
 * for files that already import from validation.middleware with a limited set.
 */
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const NEW_IMPORT = "const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');";

const ALL_VALIDATOR_NAMES = [
  'validateObjectId', 'validatePagination', 'validateEmail', 'validateOTP',
  'validatePhone', 'validateNumber', 'validateEnum', 'validateDate',
  'validateBoolean', 'validateString', 'validateBodyObjectId',
  'validateAllowedFields', 'validateRefreshToken', 'validatePassword',
  'validateName', 'handleValidationErrors'
];

let fixedCount = 0;

for (const file of routeFiles) {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find lines that import from validation.middleware
  const importLineIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("require('../middlewares/validation.middleware')") &&
        lines[i].startsWith('const ') && lines[i].includes('{')) {
      importLineIndices.push(i);
    }
  }
  
  if (importLineIndices.length === 0) continue;
  
  let changed = false;
  
  for (const lineIdx of importLineIndices) {
    let line = lines[lineIdx];
    // Check if all validators are already imported
    let allPresent = true;
    for (const vname of ALL_VALIDATOR_NAMES) {
      if (!line.includes(vname)) {
        allPresent = false;
        break;
      }
    }
    
    if (allPresent) continue;
    
    // Replace with full import
    lines[lineIdx] = NEW_IMPORT;
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    fixedCount++;
    console.log(`✓ Fixed import: ${file}`);
  }
}

console.log(`\n=== Fixed ${fixedCount} files ===`);
