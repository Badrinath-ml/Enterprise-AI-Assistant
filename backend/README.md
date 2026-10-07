# Enterprise Knowledge Assistant — Backend

Production-ready backend for the Enterprise AI Assistant, implementing multi-tenant RBAC, memory-bounded document ingestion, vector retrieval with pgvector, and grounded RAG streaming with Google Gemini.

## Technology Stack

- **Java 21**
- **Spring Boot 4.1.1**
- **Spring AI 2.0.1** (Gemini embeddings & chat)
- **PostgreSQL 17 + pgvector** (HNSW vector index)
- **Spring Security + JWT**
- **Spring Data JPA & Criteria Specifications**
- **Flyway** (Migrations V1 through V8)
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
      │     └─► GeminiEmbeddingService (Bounded exponential backoff)
      └─► ChatService (`/api/v1/chat`)
            ├─► ChatRetrievalService (Pgvector cosine distance retrieval)
            └─► Gemini Streaming via SSE (`citation`, `token`, `done`, `error`)
```

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/enterprise_assistant` | PostgreSQL connection URL |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | *(Development secret)* | Base64-encoded JWT signing secret (min 256 bits) |
| `SPRING_AI_GEMINI_API_KEY` | *(None)* | Google Gemini API Key |
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
- `POST /api/v1/chat/stream` — SSE endpoint for grounded chat interactions
- `POST /api/v1/chat/attachment` — Upload temporary attachment directly in chat

## Automated Testing

Execute the test suite:

```bash
mvn test
```

Packaging the production application JAR:

```bash
mvn package
```
