# LEVEL 3 — Document Ingestion & Knowledge Indexing

## Goal

Turn uploaded enterprise documents into searchable vector knowledge while keeping the Phase 1 tenant/RBAC boundaries intact.

## Scope

- PDF, DOCX, and TXT text extraction
- text normalization
- overlapping text chunking
- local Ollama embeddings
- PostgreSQL + pgvector chunk storage
- asynchronous post-commit indexing
- ingestion lifecycle tracking
- retry endpoint
- version-aware re-indexing
- automatic vector cleanup when a document is deleted

## Pipeline

Document → Local file storage → Extract text → Normalize → Chunk → Embed → document_chunks + pgvector

## Ingestion states

- `NOT_INDEXED`
- `QUEUED`
- `PROCESSING`
- `INDEXED`
- `FAILED`

Document approval status and ingestion status are intentionally separate.

## Database

`V3__document_ingestion.sql` enables pgvector, adds ingestion metadata to `documents`, creates `document_chunks`, stores `vector(768)` embeddings, and adds an HNSW cosine index.

The default embedding model is `nomic-embed-text`, expected to produce 768-dimensional embeddings.

## Configuration

- `OLLAMA_BASE_URL` — default `http://localhost:11434`
- `OLLAMA_EMBEDDING_MODEL` — default `nomic-embed-text`
- `INGESTION_CHUNK_SIZE` — default `1200`
- `INGESTION_CHUNK_OVERLAP` — default `200`

Before running the backend, install/pull the model with `ollama pull nomic-embed-text`.

## API

- `GET /api/v1/documents/{id}/ingestion` — current indexing state
- `POST /api/v1/documents/{id}/ingestion` — retry indexing for authorized administrators/managers

Uploads and content replacements mark the document `QUEUED` and publish an ingestion event. Processing starts after the database transaction commits, avoiding a race with an uncommitted document.

## Security

Every chunk stores `tenant_id`, `document_id`, and `document_version`. Phase 4 retrieval must constrain vector search by tenant, department authorization, document approval state, and current document version.

## Deliberate boundary

Phase 3 does not generate answers or expose semantic search. Retrieval and grounded Q&A are Phase 4.

## Acceptance criteria

- upload succeeds without waiting for embedding
- PDF, DOCX, and TXT text is extracted
- empty/scanned-only text fails clearly
- chunks are persisted with tenant/document/version metadata
- embeddings have 768 dimensions
- failed ingestion is visible and retryable
- replacement re-indexes the new version
- document deletion cascades chunk cleanup
- no LLM answer generation is introduced
