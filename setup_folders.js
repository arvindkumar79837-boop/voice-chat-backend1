const fs = require('fs');
const path = require('path');

// Aapke server.js aur controllers ke analysis ke hisaab se required folders
const foldersToCreate = [
  'src/config',
  'src/models',
  'src/controllers',
  'src/middlewares',
  'src/utils',
  'src/modules/auth',
  'src/modules/room',
  'src/modules/user',
  'src/modules/wallet',
  'src/modules/gift',
  'src/modules/family',
  'src/modules/agency',
  'src/modules/ranking',
  'src/modules/admin',
  'src/modules/chat',
  'src/modules/pk_battle'
];

console.log('🚀 Arvind Party Backend - Folder Structure Setup Started...\n');

foldersToCreate.forEach((folder) => {
  const fullPath = path.join(__dirname, folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created: ${folder}`);
  }
});

console.log('\n🎉 Setup Complete! Saare folders successfully ban gaye hain.');