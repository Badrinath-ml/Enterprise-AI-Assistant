ALTER TABLE document_chunks
    ADD COLUMN page_number INTEGER,
    ADD COLUMN source_locator VARCHAR(120);

CREATE INDEX idx_document_chunks_source_location
    ON document_chunks(document_id, document_version, page_number);