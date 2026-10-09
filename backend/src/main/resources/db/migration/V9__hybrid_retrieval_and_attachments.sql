-- V9: Hybrid retrieval full-text search index and isolated chat conversation attachments

-- 1. Full-text search GIN index on shared document chunks for BM25 retrieval
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts
    ON document_chunks USING gin(to_tsvector('english', content));

-- 2. Isolated private conversation attachments (owned by user & conversation, not in shared knowledge base)
CREATE TABLE IF NOT EXISTS chat_conversation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    ingestion_status VARCHAR(30) NOT NULL DEFAULT 'INDEXED',
    ingestion_error VARCHAR(2000),
    indexed_chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversation_attachments_conv
    ON chat_conversation_attachments(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_conversation_attachments_user
    ON chat_conversation_attachments(tenant_id, user_id);

-- 3. Chunks for private conversation attachments
CREATE TABLE IF NOT EXISTS chat_conversation_attachment_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    attachment_id UUID NOT NULL REFERENCES chat_conversation_attachments(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding vector(768) NOT NULL,
    embedding_provider VARCHAR(50) NOT NULL DEFAULT 'sentence-transformers',
    embedding_model VARCHAR(150) NOT NULL DEFAULT 'all-mpnet-base-v2',
    embedding_dimensions INTEGER NOT NULL DEFAULT 768,
    page_number INTEGER,
    source_locator VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_conv
    ON chat_conversation_attachment_chunks(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_embedding
    ON chat_conversation_attachment_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_fts
    ON chat_conversation_attachment_chunks USING gin(to_tsvector('english', content));

-- 4. Support private attachment citations in chat_message_citations
ALTER TABLE chat_message_citations
    ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE chat_message_citations
    ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES chat_conversation_attachments(id) ON DELETE CASCADE;
