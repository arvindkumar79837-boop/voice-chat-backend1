require('dotenv').config();
const Redis = require('ioredis');

// Yahan check karte hain ki .env se kya URL aa raha hai
const redisUrl = process.env.REDIS_URL || process.env.QUEUE_REDIS_URL;

console.log("=============================================");
console.log("🔍 Testing Redis Connection...");
console.log(`🔗 URL Found in .env: ${redisUrl ? redisUrl.split('@')[1] || 'URL Format Weird' : 'NOT FOUND'}`);
console.log("=============================================");

if (!redisUrl) {
    console.error("❌ Error: .env file mein REDIS_URL ya QUEUE_REDIS_URL nahi mila!");
    process.exit(1);
}

// Redis client ko connect karne ki koshish
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 10000 // 10 second ka timeout
});

redis.on('connect', () => {
    console.log("🎉 SUCCESS: Redis cloud se perfectly connect ho gaya!");
    redis.disconnect();
    process.exit(0);
});

redis.on('error', (err) => {
    console.error("❌ Redis Connection Error Detail:");
    console.error(err);
    redis.disconnect();
    process.exit(1);
});