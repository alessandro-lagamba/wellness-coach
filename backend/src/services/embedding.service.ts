/**
 * Embedding Service - OpenAI Embeddings for Semantic Search
 * 
 * This service handles:
 * 1. Generating embeddings for journal entries using OpenAI
 * 2. Searching journal entries with vector similarity
 */

import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 🔥 FIX: Lazy initialization to avoid crash when env vars not loaded
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (!_supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            console.error('[Embedding] ❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not configured');
            throw new Error('Supabase not configured for embeddings');
        }

        _supabase = createClient(url, key);
    }
    return _supabase;
}

// Use text-embedding-3-small for cost efficiency (1536 dimensions)
const EMBEDDING_MODEL = 'text-embedding-3-small';

export interface JournalMatch {
    id: string;
    entry_date: string;
    content: string;
    ai_analysis: string | null;
    similarity: number;
}

export interface EmbeddingResult {
    success: boolean;
    embedding?: number[];
    error?: string;
}

/**
 * Generate embedding for a text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
        // Clean and truncate text to avoid token limits (max ~8000 tokens for embedding)
        const cleanText = text
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 30000); // ~8000 tokens max

        if (!cleanText || cleanText.length < 10) {
            console.log('[Embedding] ⚠️ Text too short for embedding');
            return { success: false, error: 'Text too short' };
        }

        console.log('[Embedding] 🔄 Generating embedding for text:', cleanText.slice(0, 100) + '...');

        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: cleanText,
        });

        const embedding = response.data[0]?.embedding;

        if (!embedding) {
            console.log('[Embedding] ❌ No embedding returned');
            return { success: false, error: 'No embedding returned' };
        }

        console.log('[Embedding] ✅ Embedding generated, dimensions:', embedding.length);

        return { success: true, embedding };
    } catch (error) {
        console.error('[Embedding] ❌ Error generating embedding:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Store embedding for a journal entry
 */
export async function storeJournalEmbedding(
    entryId: string,
    embedding: number[]
): Promise<boolean> {
    try {
        console.log('[Embedding] 💾 Storing embedding for entry:', entryId);

        // Convert array to pgvector format string
        const vectorString = `[${embedding.join(',')}]`;

        const { error } = await getSupabase()
            .from('daily_journal_entries')
            .update({ embedding: vectorString })
            .eq('id', entryId);

        if (error) {
            console.error('[Embedding] ❌ Error storing embedding:', error);
            return false;
        }

        console.log('[Embedding] ✅ Embedding stored successfully');
        return true;
    } catch (error) {
        console.error('[Embedding] ❌ Error storing embedding:', error);
        return false;
    }
}

/**
 * Generate and store embedding for a journal entry
 */
export async function embedJournalEntry(
    entryId: string,
    content: string,
    aiAnalysis?: string | null
): Promise<boolean> {
    try {
        // Combine content and analysis for richer embedding
        const textToEmbed = [
            content,
            aiAnalysis ? `Analisi: ${aiAnalysis}` : ''
        ].filter(Boolean).join('\n\n');

        const result = await generateEmbedding(textToEmbed);

        if (!result.success || !result.embedding) {
            console.log('[Embedding] ⚠️ Failed to generate embedding for entry:', entryId);
            return false;
        }

        return await storeJournalEmbedding(entryId, result.embedding);
    } catch (error) {
        console.error('[Embedding] ❌ Error embedding journal entry:', error);
        return false;
    }
}

/**
 * Search journal entries using semantic similarity
 */
export async function searchJournalEntries(
    query: string,
    userId: string,
    limit: number = 5,
    threshold: number = 0.5
): Promise<JournalMatch[]> {
    try {
        console.log('[Embedding] 🔍 Searching journals for:', query.slice(0, 50) + '...');

        // Generate embedding for the query
        const queryResult = await generateEmbedding(query);

        if (!queryResult.success || !queryResult.embedding) {
            console.log('[Embedding] ⚠️ Failed to generate query embedding');
            return [];
        }

        // Convert to pgvector format
        const vectorString = `[${queryResult.embedding.join(',')}]`;

        // Call the Supabase RPC function
        const { data, error } = await getSupabase().rpc('search_journal_entries', {
            query_embedding: vectorString,
            user_id_param: userId,
            match_threshold: threshold,
            match_count: limit
        });

        if (error) {
            console.error('[Embedding] ❌ Search error:', error);
            return [];
        }

        console.log('[Embedding] ✅ Found', data?.length || 0, 'matching entries');

        return (data || []) as JournalMatch[];
    } catch (error) {
        console.error('[Embedding] ❌ Error searching journal entries:', error);
        return [];
    }
}

/**
 * Batch embed all journal entries for a user (for backfilling)
 */
export async function backfillUserEmbeddings(userId: string): Promise<number> {
    try {
        console.log('[Embedding] 🔄 Backfilling embeddings for user:', userId);

        // Get all entries without embeddings
        const { data: entries, error } = await getSupabase()
            .from('daily_journal_entries')
            .select('id, content, ai_analysis')
            .eq('user_id', userId)
            .is('embedding', null);

        if (error) {
            console.error('[Embedding] ❌ Error fetching entries:', error);
            return 0;
        }

        if (!entries || entries.length === 0) {
            console.log('[Embedding] ℹ️ No entries need embedding');
            return 0;
        }

        console.log('[Embedding] 📝 Found', entries.length, 'entries to embed');

        let successCount = 0;

        for (const entry of entries) {
            const success = await embedJournalEntry(entry.id, entry.content, entry.ai_analysis);
            if (success) successCount++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('[Embedding] ✅ Backfill complete:', successCount, '/', entries.length);
        return successCount;
    } catch (error) {
        console.error('[Embedding] ❌ Error backfilling embeddings:', error);
        return 0;
    }
}
