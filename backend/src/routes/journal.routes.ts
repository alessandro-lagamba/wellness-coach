/**
 * Journal Routes - Embedding and Search endpoints
 */

import { Router, Request, Response } from 'express';
import { embedJournalEntry, searchJournalEntries, backfillUserEmbeddings } from '../services/embedding.service';

const router = Router();

/**
 * POST /api/journal/embed
 * Generate and store embedding for a journal entry
 */
router.post('/embed', async (req: Request, res: Response) => {
    try {
        const { entryId, content, aiAnalysis } = req.body;

        if (!entryId || !content) {
            return res.status(400).json({
                success: false,
                error: 'entryId and content are required'
            });
        }

        console.log('[Journal] 🔄 Embedding entry:', entryId);

        const success = await embedJournalEntry(entryId, content, aiAnalysis);

        if (success) {
            return res.json({ success: true });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate or store embedding'
            });
        }
    } catch (error) {
        console.error('[Journal] ❌ Embed error:', error);
        return res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

/**
 * POST /api/journal/search
 * Search journal entries using semantic similarity
 */
router.post('/search', async (req: Request, res: Response) => {
    try {
        const { query, userId, limit = 5, threshold = 0.5 } = req.body;

        if (!query || !userId) {
            return res.status(400).json({
                success: false,
                error: 'query and userId are required'
            });
        }

        console.log('[Journal] 🔍 Searching for:', query.slice(0, 50) + '...');

        const results = await searchJournalEntries(query, userId, limit, threshold);

        return res.json({
            success: true,
            results,
            count: results.length
        });
    } catch (error) {
        console.error('[Journal] ❌ Search error:', error);
        return res.status(500).json({
            success: false,
            error: String(error),
            results: []
        });
    }
});

/**
 * POST /api/journal/backfill
 * Backfill embeddings for all user entries
 */
router.post('/backfill', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        console.log('[Journal] 🔄 Backfilling embeddings for user:', userId);

        const count = await backfillUserEmbeddings(userId);

        return res.json({
            success: true,
            embeddedCount: count
        });
    } catch (error) {
        console.error('[Journal] ❌ Backfill error:', error);
        return res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

export default router;
