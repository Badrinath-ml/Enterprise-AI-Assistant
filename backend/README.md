# Enterprise Knowledge Assistant — Backend

Production-ready backend for the Enterprise AI Assistant, implementing multi-tenant RBAC, memory-bounded document ingestion, hybrid vector + BM25 retrieval with cross-encoder reranking, intent-aware routing, Grok generation with streaming SSE, and isolated private chat attachments.

## Technology Stack

- **Java 21**
- **Spring Boot 4.1.1**
- **xAI Grok API** (`grok-2-latest` incremental streaming generation with resilient retries)
- **Sentence Transformers** (`all-mpnet-base-v2`, 768 dimensions) & **Cross-Encoder Reranker** (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
- **PostgreSQL 17 / 18 + pgvector** (HNSW vector index + Postgres English FTS index)
- **Spring Security + JWT**
- **Spring Data JPA & Criteria Specifications**
- **Flyway** (Migrations V1 through V9)
- **Apache PDFBox & Apache POI** (Memory-bounded document extraction)

## Architecture

```text
HTTP REST / SSE
      │
      ▼
Spring Security & JWT Filter ──► TenantContext & UserPrincipal
      │
      ├─► AuthController (`/api/v1/auth`)
      ├─► TenantController (`/api/v1/tenant`)
      ├─► DepartmentController (`/api/v1/departments`)
      ├─► UserController (`/api/v1/users`)
      ├─► DocumentController (`/api/v1/documents`)
      │     ├─► DocumentSpecifications (Type-safe Criteria API)
      │     └─► FileStorageService (Local filesystem / Cloud)
      ├─► DocumentIngestionService
      │     ├─► DocumentTextExtractorService (PDF, DOCX, TXT)
      │     ├─► TextChunker (Sentence & paragraph structure aware)
      │     └─► SentenceTransformersEmbeddingService (all-mpnet-base-v2, 768 dim)
      └─► ChatService (`/api/v1/chat`)
            ├─► IntentRoutingService (GREETING, IDENTITY, GENERAL, ENTERPRISE, MIXED)
            ├─► ChatRetrievalService (Hybrid: Dense Pgvector + Postgres BM25 FTS + RRF + Cross-Encoder Rerank)
            ├─► GrokGenerationService (xAI Grok incremental SSE streaming)
            ├─► Private Chat Attachments (Isolated employee attachments)
            └─► Conversation Deletion (Cascades private attachments & messages)
```

## Hybrid Retrieval Pipeline

1. **Intent-Aware Routing**:
   - Queries classified as `GREETING`, `IDENTITY`, or `GENERAL` are answered directly without running document retrieval, preventing spurious document citations (e.g., greetings retrieving NIST security standards).
   - Queries classified as `ENTERPRISE` or `MIXED` trigger the hybrid retrieval pipeline.
2. **Dense Vector Search**:
   - Computes query embedding via `all-mpnet-base-v2` (768 dimensions).
   - Retrieves top matching candidates via pgvector cosine distance (`<=> ?::vector`), strictly scoped by tenant and user department.
3. **Sparse BM25 Keyword Search**:
   - Uses PostgreSQL Full-Text Search (`to_tsvector('english', ...) @@ plainto_tsquery('english', ...)`).
   - Accurately captures exact acronyms, codes, names, and policy identifiers.
4. **Reciprocal Rank Fusion (RRF)**:
   - Fuses dense and sparse rankings with standard smoothing constant $k = 60$:
     $$RRF(d) = \frac{1}{60 + rank_{dense}(d)} + \frac{1}{60 + rank_{bm25}(d)}$$
5. **Cross-Encoder Reranking**:
   - Reranks top fused candidates using `cross-encoder/ms-marco-MiniLM-L-6-v2`.
   - Filters out weak context below relevance threshold before constructing the bounded context prompt.

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/enterprise_assistant` | PostgreSQL connection URL |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | *(Development secret)* | Base64-encoded JWT signing secret (min 256 bits) |
| `GROK_API_KEY` | *(None)* | xAI Grok API Key |
| `GROK_API_URL` | `https://api.x.ai/v1` | xAI Grok API Base URL |
| `GROK_MODEL` | `grok-2-latest` | Grok model name |
| `APP_AI_EMBEDDING_SERVICE_URL` | `http://127.0.0.1:8001` | Local Sentence Transformers embedding sidecar URL |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed CORS origins |
| `DOCUMENT_STORAGE_PATH` | `storage/documents` | Storage folder for binary document files |
| `APP_INGESTION_CHUNK_SIZE` | `1000` | Target token limit per chunk |
| `APP_INGESTION_CHUNK_OVERLAP` | `150` | Sentence overlap token limit between chunks |
| `APP_AI_RETRIEVAL_MINIMUM_SIMILARITY` | `0.20` | Cosine similarity threshold for RAG retrieval |

## REST & Streaming API Endpoints

### Authentication
- `POST /api/v1/auth/register` — Register a new tenant organization and initial admin user
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token

### Tenant & Users
- `GET /api/v1/tenant/me` — Current tenant details
- `GET /api/v1/departments` — List departments in tenant
- `POST /api/v1/departments` — Create department (Admin)
- `PUT /api/v1/departments/{id}` — Update department (Admin)
- `DELETE /api/v1/departments/{id}` — Delete department (Admin)
- `GET /api/v1/users` — List users in tenant (Admin)
- `POST /api/v1/users` — Create user (Admin)
- `PUT /api/v1/users/{id}` — Update user role/department (Admin)
- `DELETE /api/v1/users/{id}` — Deactivate user (Admin)

### Documents
- `GET /api/v1/documents` — Search & list documents (paged, filtered by status, department, search text)
- `GET /api/v1/documents/{id}` — Document metadata
- `POST /api/v1/documents` — Upload new document (PDF, DOCX, TXT; Admin or Manager)
- `PUT /api/v1/documents/{id}` — Update document metadata (Admin or Manager)
- `PUT /api/v1/documents/{id}/content` — Replace document file and increment version (Admin or Manager)
- `GET /api/v1/documents/{id}/content` — Stream/view document binary
- `GET /api/v1/documents/{id}/download` — Download document attachment
- `DELETE /api/v1/documents/{id}` — Delete document and associated chunks (Admin or Manager)
- `GET /api/v1/documents/stats` — Aggregate metrics (total, approved, indexed, failed)
- `GET /api/v1/documents/{id}/ingestion` — Ingestion state and chunk count
- `POST /api/v1/documents/{id}/retry-ingestion` — Retry indexing failed document

### Chat & Grounded RAG
- `GET /api/v1/chat/conversations` — List current user's conversations
- `POST /api/v1/chat/conversations` — Create a new conversation
- `DELETE /api/v1/chat/conversations/{id}` — Delete conversation and cascades private attachments
- `GET /api/v1/chat/conversations/{id}/messages` — Conversation message history
- `POST /api/v1/chat/conversations/{id}/stream` — SSE endpoint for grounded chat interactions
- `POST /api/v1/chat/conversations/{id}/upload` — Isolated private attachment upload (Employee accessible, <=25MB)
- `GET /api/v1/chat/sources/{documentId}` — Source document preview

## Automated Testing

Execute the test suite:

```bash
mvn test
```

Packaging the production application JAR:

```bash
mvn package
```
