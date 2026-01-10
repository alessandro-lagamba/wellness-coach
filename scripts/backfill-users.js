
const axios = require('axios');
require('dotenv').config();

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://wellness-coach-production-0b04.up.railway.app'; // Update with your actual Railway URL if different
// Note: You might need to set API key if you have protected endpoints, 
// but currently /api/journal/backfill seems open or relies on userId which is passed in body

const USERS_TO_BACKFILL = [
    '99413c5b-ddc0-4e15-900e-a42ea3c0c547',
    'c40e37fb-cc41-482b-a6b6-17b30f28694d',
    'e701bdfc-3a4e-4f3c-b0e8-27a51fd94682',
    'a4ecbd3b-0f7a-4aa6-be1d-bd448d59ecd1'
];

async function backfillUser(userId) {
    console.log(`\n🔄 Starting backfill for user: ${userId}`);
    try {
        const response = await axios.post(`${BACKEND_URL}/api/journal/backfill`, {
            userId: userId
        });

        if (response.data && response.data.success) {
            console.log(`✅ Success! Processed ${response.data.embeddedCount} entries.`);
        } else {
            console.error('❌ Failed:', response.data);
        }
    } catch (error) {
        if (error.response) {
            console.error(`❌ Error ${error.response.status}:`, error.response.data);
        } else {
            console.error('❌ Network Error:', error.message);
        }
    }
}

async function main() {
    console.log('🚀 Starting Journal Embeddings Backfill Process');
    console.log(`Target Backend: ${BACKEND_URL}`);

    for (const userId of USERS_TO_BACKFILL) {
        await backfillUser(userId);
        // Wait a bit between users to be nice to the server/rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✨ All done!');
}

main();
