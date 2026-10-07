# Enterprise AI Assistant — Multi-Tenant Knowledge Monolith

A production-ready, multi-tenant enterprise AI assistant and RAG (Retrieval-Augmented Generation) knowledge platform built with **Java 21**, **Spring Boot 4.1**, **Spring AI**, **PostgreSQL 17 + pgvector**, and **React 18 + TypeScript**.

---

## 🏛️ Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│              React 18 + TypeScript SPA                 │
│   (Vite, Tailwind-free Vanilla CSS Design System)      │
│   Dashboard · Chat (SSE) · Documents · Admin / Users   │
└───────────────────────────┬────────────────────────────┘
                            │ REST / SSE
                            ▼
┌────────────────────────────────────────────────────────┐
│             Spring Boot 4.1 Backend Monolith           │
│                                                        │
│  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ Security & Auth  │  │ Multi-Tenant Isolation     │ │
│  │ JWT / RBAC       │  │ Strict TenantContext Scoping│ │
│  └──────────────────┘  └─────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Document Ingestion & Chunking Pipeline            │ │
│  │ • Memory-bounded extractors: PDF, DOCX, TXT       │ │
│  │ • Structure-aware sentence/paragraph chunker      │ │
│  │ • Deterministic UUIDs & transactional swap        │ │
│  │ • Resilient Google Gemini Embeddings (Retries)    │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Enterprise RAG & Chat Service                     │ │
│  │ • Pgvector cosine distance (tenant + dept scoped) │ │
│  │ • Strictly grounded system prompt (Zero-halluc)   │ │
│  │ • Real-time SSE streaming (citation, token, done) │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────┬──────────────────────────┬─────────────┘
                │                          │
                ▼                          ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│  PostgreSQL 17 + pgvector     │ │ Local / Cloud Storage│
│  • Flyway Migrations (V1-V8)  │ │ (Tenants file depot) │
│  • HNSW Vector Indexes        │ └──────────────────────┘
└───────────────────────────────┘
```

---

## 🚀 Key Features

### 1. Multi-Tenant Architecture & Enterprise RBAC
- **Strict Server-Side Isolation**: Authenticated tenant ID extracted from JWT and bound to `TenantContext`. All JPA Criteria specifications, repository calls, and native vector queries strictly filter on `tenant_id`.
- **Role-Based Access Control (RBAC)**:
  - **ADMIN**: Manage users, departments, configure settings, upload/approve documents across all departments, chat with access to all company documents.
  - **MANAGER**: Upload and manage documents within their assigned department; chat access scoped to their department and company-wide documents.
  - **EMPLOYEE**: Read-only document access; chat access scoped to their department and company-wide documents.

### 2. High-Performance Memory-Bounded Ingestion
- **Streaming Document Extractors**:
  - `PdfDocumentTextExtractor`: Uses Apache PDFBox with `MemoryUsageSetting.setupMixed(10MB)` to avoid loading entire multi-megabyte PDFs onto heap; extracts text per page while preserving paragraph spacing.
  - `DocxDocumentTextExtractor`: Extracts paragraphs, detects heading styles (`Heading 1`, `Heading 2`) for section segmentation, and extracts structured markdown tables.
  - `TxtDocumentTextExtractor`: Streams lines in chunks of 80 lines into virtual pages for citation anchors.
- **Structure-Aware Chunking (`TextChunker`)**:
  - Chunks across Document -> Page/Section -> Paragraph -> Sentence hierarchy.
  - Preserves sentence boundaries; strictly bounds overlap to configured token/character limits; guarantees no empty or trailing fragments.
  - Generates clear locator labels (e.g. `Architecture Overview (Page 3)` or `Page 1`).

### 3. Pgvector Retrieval & Resilient Embeddings
- **Deterministic Chunk IDs**: Generates stable chunk UUIDs using `UUID.nameUUIDFromBytes(documentId + ":v" + version + ":c" + chunkIndex)` for idempotent re-ingestion.
- **Bounded Exponential Backoff**: Embeddings generated via Google Gemini `text-embedding-004` (768 dimensions) with bounded 3-attempt exponential retries.
- **Tenant-Isolated Vector Retrieval (`ChatRetrievalService`)**:
  - Uses cosine distance (`<=> ?::vector`) with HNSW indexing.
  - Department filtering respects access levels (admins search all, managers/employees search their department + company-wide docs where `department_id IS NULL`).
  - Configurable similarity thresholding (`app.ai.retrieval.minimum-similarity`).

### 4. Grounded Chat & SSE Streaming Contract
- **Strict Anti-Hallucination Grounding**: The LLM is instructed to answer strictly based on retrieved enterprise context, admitting when information is unavailable.
- **Structured Server-Sent Events (SSE)**:
  - `event: citation` — Streams citation metadata array (`documentId`, `title`, `fileName`, `pageNumber`, `sourceLocator`).
  - `event: token` — Streams generated token chunk `{"text":"..."}`.
  - `event: done` — Streams final metadata `{"conversationId":"...","provider":"google","model":"..."}`.
  - `event: error` — Streams error message `{"message":"..."}`.

### 5. Production Enterprise UI
- Modern, responsive React 18 + TypeScript frontend with a cohesive dark-mode design system.
- Live tenant dashboard with active metrics (Total Documents, Approved, AI Indexed, Failed).
- Documents view with live ingestion status badges, chunk count badges, and one-click "Retry Indexing" action.
- Interactive chat interface with real-time token streaming, cited document popovers, and suggested prompt chips.

---

## 🛠️ Getting Started

### Prerequisites
- **JDK 21**
- **Node.js 18+** & **npm**
- **Docker** & **Docker Compose** (for PostgreSQL with pgvector)

### Running with Docker Compose (Production Setup)

A production-ready `docker-compose.prod.yml` ties the database, backend, and frontend together:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:8080
- **Database**: localhost:5432

### Local Development Setup

#### 1. Start PostgreSQL with pgvector
```bash
docker run -d \
  --name enterprise-postgres \
  -e POSTGRES_DB=enterprise_assistant \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg17
```

#### 2. Backend Setup
Copy `.env.example` to `.env` in `backend/` and set your Google Gemini API key:
```bash
cd backend
cp .env.example .env
```
Run database migrations and launch the Spring Boot service:
```bash
mvn spring-boot:run
```

#### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 to access the application.

---

## 🧪 Automated Testing

The backend includes a comprehensive automated test suite verifying tenant isolation, RBAC permissions, document extractors, structure-aware chunking, vector retrieval, and deterministic ingestion:

```bash
cd backend
mvn clean test
```

### Test Coverage Highlights
- `DocumentServiceTest`: RBAC permissions (ADMIN, MANAGER, EMPLOYEE), file validation, 25MB boundary, version increments, tenant isolation 404/403.
- `DocumentSpecificationsTest`: All Criteria API query predicate permutations without SQL parameter ambiguity.
- `TextChunkerTest`: Structure-aware sentence/paragraph chunking, boundary preservation, overlap limits, locator generation.
- `DocumentExtractorsTest`: PDFBox memory-bounded extraction, POI DOCX table/heading parsing, TXT virtual page chunking.
- `ChatRetrievalServiceTest`: Tenant isolation in vector queries, department scoping, cosine similarity filtering.
- `DocumentIngestionServiceTest`: End-to-end ingestion lifecycle, deterministic chunk UUIDs, atomic chunk replacement.

---

## 🔒 Security Best Practices
- CORS properly configured with explicit allowed origins.
- Global exception handler maps `AccessDeniedException` to HTTP 403, `ResourceNotFoundException` to HTTP 404, eliminating 500 information leakage.
- JWT expiration and signature verification using HS256/HS512.
- File uploads validated for both extension and MIME type against strict allowlist (PDF, DOCX, TXT) with maximum size bounded to 25MB.
- Path traversal prevention in local filesystem storage keys.
