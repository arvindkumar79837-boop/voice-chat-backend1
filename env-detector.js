// env-detector.js (यह वही नई फाइल है)
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const isRender = process.env.RENDER === 'true';
const isTermux = process.env.PREFIX && process.env.PREFIX.includes('com.termux');

let platformName = "Render Cloud / Default";

if (isTermux) {
    platformName = "Mobile Termux (16GB RAM Local)";
    
    // यहाँ जादू है: यह तुम्हारे मोबाइल की इंटरनल मेमोरी का रास्ता (Path) है
    // अरविंद भाई, 'ArvindConfig' वही फोल्डर है जो तुमने फोन के स्टोरेज में बनाया है
    const internalStorageEnvPath = path.join('/sdcard', 'ArvindConfig', '.env');
    
    // चेक करो कि क्या मोबाइल स्टोरेज में फाइल मौजूद है
    if (fs.existsSync(internalStorageEnvPath)) {
        // यह कमांड सीधे तुम्हारे फोन की मेमोरी से .env लोड कर देगी!
        dotenv.config({ path: internalStorageEnvPath });
        console.log(`✅ [SECURITY] .env file successfully loaded from Mobile Internal Storage!`);
    } else {
        console.log(`⚠️ [WARNING] .env file not found in Mobile Storage at: ${internalStorageEnvPath}`);
        // अगर फाइल नहीं मिली, तो डिफ़ॉल्ट रूप से लोकल सेटिंग्स ले लेगा
        process.env.MONGO_URI = "mongodb://127.0.0.1:27017/arvind_party";
        process.env.REDIS_URL = "redis://127.0.0.1:6379";
    }
} else if (!isRender) {
    platformName = "Local Laptop/PC";
    // लैपटॉप के लिए डिफ़ॉल्ट रूप से इसी फोल्डर की .env लोड होगी
    dotenv.config();
}

console.log(`\n==================================================`);
console.log(`🚀 सर्वर ने ऑटो-सिस्टम एडजस्ट कर लिया है!`);
console.log(`📍 वर्तमान प्लेटफॉर्म: ${platformName}`);
console.log(`==================================================\n`);

module.exports = { isRender, isTermux };
