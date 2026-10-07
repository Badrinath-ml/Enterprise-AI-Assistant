# Level 4 — Enterprise Chat & Grounded RAG

Level 4 adds the final user-facing knowledge layer on top of Level 3 ingestion.

## Capabilities

- Persistent per-user conversations and chat history.
- ChatGPT/Gemini-style assistant workspace.
- Secure tenant and department-aware vector retrieval.
- Approved + indexed + current document-version filtering.
- Gemini generation with existing Hugging Face fallback.
- Retrieval citations containing:
  - document title/file
  - version
  - chunk
  - similarity
  - retrieval confidence heuristic
  - page number when available
  - source snippet
- Clickable source evidence.
- Source viewer that highlights the retrieved chunk inside extracted document text.
- PDF page-aware extraction for new/reindexed documents.
- PDF, DOCX, and TXT upload from the chat composer.
- Chat uploads reuse the existing document storage and ingestion pipeline and are automatically approved for retrieval.

## Security

Retrieval is never performed across the entire database.

For administrators:
- all tenant documents are eligible, subject to approved/indexed/current-version filters.

For managers/employees:
- organization-wide documents plus documents in the user's own department are eligible.

Every chat conversation is scoped to the authenticated tenant and user.

Chat attachments still use the existing document upload permission: administrators and managers can upload them. Employees remain read-only under the current RBAC model.

## Retrieval confidence

The displayed percentage is a **retrieval confidence heuristic**, derived from the cosine similarity returned by pgvector. It is not a calibrated probability and is not the LLM's internal confidence.

A weak-match threshold of 0.35 prevents low-similarity chunks from being presented as evidence.

## Source highlighting

The ingestion pipeline now preserves a page number for PDF extraction. DOCX and TXT are treated as page 1 because their current extractor does not have a reliable native page model.

The source viewer fetches the authorized original document, extracts its text, and highlights the exact retrieved chunk where possible. If normalization changed the text enough that an exact match cannot be found, the viewer shows the extracted source without a false highlight.

## Embedding consistency

The chat retrieval layer only searches chunks whose provider, model, and dimensions match the active embedding service. This prevents mixing incompatible vector spaces.

Existing documents created before page-aware Level 4 changes should be reindexed once so their chunks receive page metadata.

## API

- `GET /api/v1/chat/conversations`
- `POST /api/v1/chat/conversations`
- `GET /api/v1/chat/conversations/{id}/messages`
- `POST /api/v1/chat/conversations/{id}/messages`
- `POST /api/v1/chat/conversations/{id}/upload`
- `GET /api/v1/chat/sources/{documentId}`

## Flow

```text
Chat UI
  ↓
Conversation + message persistence
  ↓
Gemini Embedding 2 query vector
  ↓
pgvector cosine retrieval
  ↓
Tenant/RBAC + APPROVED + INDEXED + current version filters
  ↓
Top evidence chunks
  ↓
Gemini generation
  ↓
HF fallback when Gemini has transient failure
  ↓
Answer + citations + retrieval confidence
  ↓
Clickable source viewer + highlighted evidence
```
