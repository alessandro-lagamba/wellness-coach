-- Migration: Add Journal Embeddings for RAG
-- Date: 2026-01-10
-- Description: Enable pgvector and add embedding column for semantic search

-- Step 1: Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Step 2: Add embedding column to journal entries (1536 dimensions for text-embedding-3-small)
ALTER TABLE daily_journal_entries 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Create index for fast similarity search using HNSW
-- HNSW is better for smaller datasets and provides faster queries
CREATE INDEX IF NOT EXISTS idx_journal_embedding 
ON daily_journal_entries 
USING hnsw (embedding vector_cosine_ops);

-- Step 4: Create semantic search function for journal entries
CREATE OR REPLACE FUNCTION search_journal_entries(
  query_embedding vector(1536),
  user_id_param uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  entry_date date,
  content text,
  ai_analysis text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dje.id,
    dje.entry_date,
    dje.content,
    dje.ai_analysis,
    (1 - (dje.embedding <=> query_embedding))::float as similarity
  FROM daily_journal_entries dje
  WHERE dje.user_id = user_id_param
    AND dje.embedding IS NOT NULL
    AND (1 - (dje.embedding <=> query_embedding)) > match_threshold
  ORDER BY dje.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_journal_entries TO authenticated;
