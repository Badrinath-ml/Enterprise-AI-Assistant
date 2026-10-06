# Level 2 — Document Management

Level 2 adds the document workspace without introducing ingestion, embeddings, pgvector retrieval, RAG, or LLM behavior.

## Scope

- Tenant-scoped document metadata in PostgreSQL
- Local filesystem storage for development
- Upload, browse, search, filter, preview, download, metadata update, content replacement, and delete
- Department organization
- Document lifecycle status
- Version number on content replacement
- Role-aware document access
- File-storage abstraction so object storage can be introduced later

## Supported files

- PDF
- DOCX
- TXT
- Maximum size: 25 MB per file

## Roles

### ADMIN
- Browse all documents in the organization
- Upload organization-wide or department documents
- Update metadata/status/department
- Replace content
- Delete documents

### MANAGER
- Browse organization-wide and own-department documents
- Upload documents into their own department
- Update/replace/delete documents in their own department
- Cannot move documents to another department

### EMPLOYEE
- Browse organization-wide and own-department documents
- Preview and download
- Cannot upload, edit, replace, or delete

## Storage

Binary content is kept outside PostgreSQL.

Development path:

`storage/documents/<tenant-id>/<document-id>/...`

PostgreSQL stores metadata and the generated storage key.

The backend resolves storage keys beneath the configured root and rejects path traversal.

Configure the root with:

`DOCUMENT_STORAGE_PATH`

Default:

`storage/documents`

The storage implementation is behind `FileStorageService`, allowing an S3/object-storage implementation to replace local storage later.

## API

`POST /api/v1/documents` — multipart upload

`GET /api/v1/documents` — paginated search/filter

`GET /api/v1/documents/{id}` — metadata

`GET /api/v1/documents/{id}/content` — authenticated inline content

`GET /api/v1/documents/{id}/download` — authenticated download

`PUT /api/v1/documents/{id}` — metadata/status update

`PUT /api/v1/documents/{id}/content` — replace content and increment version

`DELETE /api/v1/documents/{id}` — delete metadata and stored content

All endpoints are tenant-scoped from the authenticated JWT. The frontend is not trusted for isolation.

## Status lifecycle

- DRAFT
- PENDING_REVIEW
- APPROVED
- REJECTED
- ARCHIVED

The lifecycle is intentionally metadata-only in Level 2. There is no AI ingestion triggered by status changes yet.

## Run locally

Start PostgreSQL:

`docker compose up -d postgres`

Run backend:

`mvn spring-boot:run`

Run frontend:

`cd frontend && npm run dev`

Flyway applies `V2__documents.sql` automatically.

## Validation checklist

1. Admin uploads an organization-wide document.
2. Admin uploads a department document.
3. Manager can see organization-wide + own-department documents.
4. Manager cannot access another department's document.
5. Employee can preview/download authorized documents but cannot mutate them.
6. Replacing content increments the version.
7. Deleting removes both metadata and the local file.
8. A path-traversal storage key is rejected.
9. Files over 25 MB or unsupported extensions are rejected.
