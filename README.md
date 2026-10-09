# Enterprise AI Assistant — Multi-Tenant Knowledge Platform

A production-ready, multi-tenant enterprise AI assistant and hybrid RAG (Retrieval-Augmented Generation) knowledge platform built with **Java 21**, **Spring Boot 4.1**, **xAI Grok**, **Sentence Transformers**, **PostgreSQL 17/18 + pgvector**, and **React 18 + TypeScript**.

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
│  │ • Sentence Transformers embeddings (768-dim)      │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Hybrid RAG & Grounded Chat Service                │ │
│  │ • Intent router (GREETING, GENERAL, ENTERPRISE)   │ │
│  │ • Dense Vector (pgvector) + Sparse BM25 (FTS)     │ │
│  │ • Reciprocal Rank Fusion (RRF) + Cross-Encoder    │ │
│  │ • Incremental xAI Grok token streaming (SSE)      │ │
│  │ • Strictly grounded system prompt (Zero-halluc)   │ │
│  │ • Enforced conversation deletion & attachments    │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────┬──────────────────────────┬─────────────┘
                │                          │
                ▼                          ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│  PostgreSQL + pgvector        │ │ Local / Cloud Storage│
│  • Flyway Migrations (V1-V9)  │ │ (Tenants file depot) │
│  • HNSW Vector + BM25 Indexes │ └──────────────────────┘
└───────────────────────────────┘
```

---

## 🚀 Key Features

### 1. Multi-Tenant Architecture & Enterprise RBAC
- **Strict Server-Side Isolation**: Authenticated tenant ID extracted from JWT and bound to `TenantContext`. All JPA Criteria specifications, repository calls, and native vector queries strictly filter on `tenant_id`.
- **Role-Based Access Control (RBAC)**:
  - **ADMIN**: Manage users, departments, configure settings, upload/approve documents across all departments, chat with access to all company documents.
  - **MANAGER**: Upload and manage documents within their assigned department; chat access scoped to their department and company-wide documents.
  - **EMPLOYEE**: Read-only document access; chat access scoped to their department and company-wide documents; ability to upload private attachments to their own conversations.

### 2. High-Performance Memory-Bounded Ingestion
- **Streaming Document Extractors**:
  - `PdfDocumentTextExtractor`: Uses Apache PDFBox with `MemoryUsageSetting.setupMixed(10MB)` to avoid loading entire multi-megabyte PDFs onto heap; extracts text per page while preserving paragraph spacing.
  - `DocxDocumentTextExtractor`: Extracts paragraphs, detects heading styles (`Heading 1`, `Heading 2`) for section segmentation, and extracts structured markdown tables.
  - `TxtDocumentTextExtractor`: Streams lines in chunks of 80 lines into virtual pages for citation anchors.
- **Structure-Aware Chunking (`TextChunker`)**:
  - Chunks across Document -> Page/Section -> Paragraph -> Sentence hierarchy.
  - Preserves sentence boundaries; strictly bounds overlap to configured token/character limits; guarantees no empty or trailing fragments.
  - Generates clear locator labels (e.g. `Architecture Overview (Page 3)` or `Page 1`).

### 3. Hybrid Retrieval & Cross-Encoder Reranking
- **Intent-Aware Routing**:
  - Automatically identifies user intent (`GREETING`, `IDENTITY`, `GENERAL`, `ENTERPRISE`, `MIXED`).
  - Common greetings and general programming/math questions are answered immediately without unnecessary document searches, completely preventing false citations on non-enterprise queries.
- **Dense Vector Search (pgvector)**:
  - Computes 768-dimensional embeddings using `all-mpnet-base-v2`.
  - Performs cosine distance retrieval (`<=> ?::vector`) with HNSW indexing, strictly scoped by tenant and department.
- **Sparse BM25 Keyword Search**:
  - PostgreSQL full-text search index (`idx_document_chunks_fts`) over chunk content using `to_tsvector('english', ...) @@ plainto_tsquery('english', ...)`.
- **Reciprocal Rank Fusion (RRF)**:
  - Merges dense and sparse ranks with standard smoothing constant $k = 60$.
- **Cross-Encoder Reranking**:
  - Re-evaluates top candidate chunks with `cross-encoder/ms-marco-MiniLM-L-6-v2`.
  - Enforces minimum relevance score bounds before building the prompt context.

### 4. Grounded Chat & Real-Time SSE Streaming
- **Incremental xAI Grok Generation**:
  - Generated response tokens are streamed in real-time over SSE as they arrive from the API.
  - Citations are emitted only after grounded validation against retrieved passages, preventing phantom source cards when no evidence exists or on unanswerable questions.
- **Structured Server-Sent Events (SSE)**:
  - `event: token` — Streams generated token chunk `{"text":"..."}`.
  - `event: citation` — Streams validated citation metadata (`documentId`, `title`, `fileName`, `pageNumber`, `sourceLocator`, `confidence`).
  - `event: done` — Streams final metadata `{"conversationId":"...","provider":"grok","model":"grok-2-latest"}`.
  - `event: error` — Streams error message `{"message":"..."}`.

### 5. Private Chat Attachments & Conversation Lifecycle
- **Isolated Employee Attachments**:
  - Employees can upload temporary attachments (PDF, DOCX, TXT <= 25MB) directly inside chat conversations without needing administrative document repository privileges.
  - Attachments are stored separately in `chat_conversation_attachments` and are strictly private to the specific conversation.
- **Backend-Enforced Conversation Deletion**:
  - `DELETE /api/v1/chat/conversations/{id}` deletes conversation messages, citations, attachment metadata, and binary files from disk while leaving shared knowledge base documents intact.

---

## 🛠️ Getting Started

### Prerequisites
- **JDK 21**
- **Node.js 18+** & **npm**
- **Python 3.10+** (for local Sentence Transformers & Reranker microservice)
- **PostgreSQL 17 / 18 with pgvector**

### 1. Start Sentence Transformers Sidecar
In the `backend` directory:
```bash
cd backend
python scripts/embedding_service.py
```
This runs a fast local FastAPI server on `http://127.0.0.1:8001` serving `all-mpnet-base-v2` embeddings and `cross-encoder/ms-marco-MiniLM-L-6-v2` reranking.

### 2. Configure & Run Backend
Copy `.env.example` to `.env` in `backend/` and set your credentials:
```bash
cd backend
cp .env.example .env
```
Ensure your database connection details and `GROK_API_KEY` are configured.
Launch the Spring Boot service:
```bash
mvn spring-boot:run
```

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 to access the application.

---

## 🧪 Automated Testing

The backend includes a comprehensive automated test suite verifying tenant isolation, RBAC permissions, document extractors, structure-aware chunking, hybrid retrieval, intent routing, and private attachments:

```bash
cd backend
mvn clean test
```

### Test Coverage Highlights
- `IntentRoutingServiceTest`: Verifies query classification across GREETING, IDENTITY, GENERAL, ENTERPRISE, and MIXED.
- `GrokGenerationServiceTest`: Verifies Grok generation, streaming, retry handling, key redaction, and fallback.
- `SentenceTransformersEmbeddingServiceTest`: Verifies 768-dimensional embeddings, batch bounds, and empty text handling.
- `ConversationDeletionTest`: Verifies cascade deletion of conversations and private files while preserving shared documents.
- `PrivateAttachmentSecurityTest`: Verifies 25MB boundary, extension validation, department isolation, and employee attachment security.
- `ChatStreamingAndGroundedRagTest`: Verifies greeting bypass, unanswerable queries without false citations, and grounding behavior.
- `DocumentServiceTest`: RBAC permissions (ADMIN, MANAGER, EMPLOYEE), file validation, version increments, tenant isolation.
- `TextChunkerTest`: Structure-aware sentence/paragraph chunking, boundary preservation, overlap limits, locator generation.
- `DocumentExtractorsTest`: PDFBox memory-bounded extraction, POI DOCX table/heading parsing, TXT virtual page chunking.
- `ChatRetrievalServiceTest`: Tenant isolation in vector queries, department scoping, cosine similarity filtering.
- `DocumentIngestionServiceTest`: End-to-end ingestion lifecycle, deterministic chunk UUIDs, atomic chunk replacement.

---

## 🔒 Security Best Practices
- CORS properly configured with explicit allowed origins.
- Global exception handler maps `AccessDeniedException` to HTTP 403, `ResourceNotFoundException` to HTTP 404, eliminating information leakage.
- JWT expiration and signature verification using HS256/HS512.
- File uploads validated for both extension and MIME type against strict allowlist (PDF, DOCX, TXT) with maximum size bounded to 25MB.
- Path traversal prevention in local filesystem storage keys.
- Safe logging prevents API keys and sensitive tokens from appearing in console or application logs.
