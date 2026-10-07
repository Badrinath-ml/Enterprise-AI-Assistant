CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE documents
    ADD COLUMN ingestion_status VARCHAR(30) NOT NULL DEFAULT 'NOT_INDEXED',
    ADD COLUMN ingestion_error VARCHAR(2000),
    ADD COLUMN indexed_at TIMESTAMPTZ,
    ADD COLUMN indexed_chunk_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_documents_ingestion_status ON documents(ingestion_status);

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_version INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_chunk_version UNIQUE (document_id, document_version, chunk_index)
);

CREATE INDEX idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_version ON document_chunks(document_id, document_version);
CREATE INDEX idx_document_chunks_embedding_hnsw
    ON document_chunks USING hnsw (embedding vector_cosine_ops);
