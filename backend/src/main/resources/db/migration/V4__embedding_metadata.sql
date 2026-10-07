ALTER TABLE document_chunks
    ADD COLUMN embedding_provider VARCHAR(50) NOT NULL DEFAULT 'ollama',
    ADD COLUMN embedding_model VARCHAR(150) NOT NULL DEFAULT 'nomic-embed-text',
    ADD COLUMN embedding_dimensions INTEGER NOT NULL DEFAULT 768;

CREATE INDEX idx_document_chunks_embedding_model
    ON document_chunks(embedding_provider, embedding_model);
