/**
 * Script: fixValidationImports.js
 * Moves the validation.middleware import to the top of each route file
 * to avoid temporal dead zone issues with const declarations.
 */
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const VALIDATORS_IMPORT = "const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');";

let fixedCount = 0;

for (const file of routeFiles) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find the import line
  const importLine = lines.findIndex(l => l.includes("require('../middlewares/validation.middleware')"));
  if (importLine === -1) continue; // No validation import found
  
  // Check if it's already at a good position (within first 25 lines)
  if (importLine <= 25) continue;
  
  // Remove the import line
  const importStatement = lines[importLine];
  lines.splice(importLine, 1);
  
  // Find a good position - after the last import in the top import block
  // Look for the last require in the first ~30 lines
  let insertPos = -1;
  for (let i = Math.min(30, lines.length - 1); i >= 0; i--) {
    if (lines[i].includes('require(')) {
      insertPos = i;
      break;
    }
  }
  
  // If we found an existing import block, check if validation.middleware is already imported elsewhere
  // (it shouldn't be since we removed it)
  // Also check if there's another validation import already at top
  const hasTopImport = lines.slice(0, Math.min(30, lines.length)).some(l => 
    l.includes('validation.middleware')
  );
  
  if (hasTopImport) {
    // Already has import at top (shouldn't happen since we removed it)
    continue;
  }
  
  if (insertPos === -1) {
    // No require lines found, insert at line 1
    insertPos = 0;
  }
  
  lines.splice(insertPos + 1, 0, importStatement);
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  fixedCount++;
  console.log(`✓ Fixed import position: ${file} (moved from line ${importLine + 1} to ${insertPos + 2})`);
}

console.log(`\n=== Fixed ${fixedCount} files ===`);
