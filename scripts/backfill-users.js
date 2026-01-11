#!/usr/bin/env node
/**
 * Backfill Journal Embeddings Script
 * 
 * This script generates embeddings for existing journal entries
 * by calling the backend /api/journal/backfill endpoint.
 * 
 * Usage: node backfill-users.js
 * 
 * No external dependencies needed - uses native fetch (Node 18+)
 */

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://wellness-coach-production.up.railway.app';

// Add your user IDs here
const USERS_TO_BACKFILL = [
    '99413c5b-ddc0-4e15-900e-a42ea3c0c547',
    'c40e37fb-cc41-482b-a6b6-17b30f28694d',
    'e701bdfc-3a4e-4f3c-b0e8-27a51fd94682',
    'a4ecbd3b-0f7a-4aa6-be1d-bd448d59ecd1'
];

async function backfillUser(userId) {
    console.log(`\n🔄 Starting backfill for user: ${userId}`);
    try {
        const response = await fetch(`${BACKEND_URL}/api/journal/backfill`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log(`✅ Success! Processed ${data.embeddedCount} entries.`);
        } else {
            console.error(`❌ Failed (${response.status}):`, data);
        }
    } catch (error) {
        console.error('❌ Network Error:', error.message);
    }
}

async function main() {
    console.log('🚀 Starting Journal Embeddings Backfill Process');
    console.log(`Target Backend: ${BACKEND_URL}`);
    console.log(`Users to process: ${USERS_TO_BACKFILL.length}\n`);

    for (const userId of USERS_TO_BACKFILL) {
        await backfillUser(userId);
        // Wait a bit between users to be nice to the server/rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✨ All done!');
}

main();
