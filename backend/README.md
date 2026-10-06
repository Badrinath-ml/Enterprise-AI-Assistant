# Enterprise Knowledge Assistant — Backend

The backend currently covers **Level 1 identity/RBAC/organization management** and **Level 2 document management**.

## Stack

- Java 21
- Spring Boot 4.1.1
- Spring AI 2.0.1 baseline
- Maven
- PostgreSQL 17 + pgvector image
- Spring Security + JWT
- Spring Data JPA
- Flyway
- Docker Compose
- Local filesystem document storage in development

## Architecture

```text
React
  |
  v
Spring Boot
  |
  +-- Auth / JWT
  +-- Tenant isolation
  +-- RBAC
  +-- Users
  +-- Departments
  +-- Documents
  |     +-- Metadata -> PostgreSQL
  |     +-- Binary   -> FileStorageService -> local filesystem
  |
  v
PostgreSQL
```

Document ingestion, chunking, embeddings, pgvector retrieval, RAG, and agent workflows are intentionally deferred to later phases.

## Prerequisites

- JDK 21
- Maven 3.9+
- Docker Desktop

## Run

```bash
docker compose up -d postgres
mvn spring-boot:run
```

Backend: `http://localhost:8080`

Health: `GET /actuator/health`

## Authentication

Register the first organization/admin:

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "tenantName": "Acme Corporation",
  "tenantSlug": "acme",
  "name": "Admin User",
  "email": "admin@acme.com",
  "password": "Admin@12345"
}
```

Then log in with:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "tenantSlug": "acme",
  "email": "admin@acme.com",
  "password": "Admin@12345"
}
```

Use the returned access token as:

`Authorization: Bearer <token>`

## Current API

### Public

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /actuator/health
GET  /actuator/info
```

### Organization

```text
GET  /api/v1/tenant/me
GET  /api/v1/departments
POST /api/v1/departments
PUT  /api/v1/departments/{id}
DELETE /api/v1/departments/{id}
```

### Users

```text
GET    /api/v1/users
POST   /api/v1/users
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}   # soft-deactivation
```

### Documents

See [docs/LEVEL-2.md](docs/LEVEL-2.md) for roles, storage, lifecycle, and validation details.

```text
GET    /api/v1/documents
GET    /api/v1/documents/{id}
POST   /api/v1/documents
PUT    /api/v1/documents/{id}
PUT    /api/v1/documents/{id}/content
GET    /api/v1/documents/{id}/content
GET    /api/v1/documents/{id}/download
DELETE /api/v1/documents/{id}
```

## Database

Flyway migrations are the source of truth.

- `V1__initial_schema.sql` — tenants, departments, users
- `V2__documents.sql` — document metadata and indexes

JPA runs with `ddl-auto: validate`.

## Security model

- Tenant ID is taken from the authenticated JWT and request-scoped TenantContext.
- Every document lookup includes tenant scope.
- Role/department checks are enforced in backend services, not only in the frontend.
- Employees are read-only for documents.
- Managers are restricted to their own department for document mutations.
- Stored files are resolved beneath the configured storage root.

## Development notes

Set a strong `JWT_SECRET` in any real deployment. The fallback secret in `application.yml` is development-only.

Set `DOCUMENT_STORAGE_PATH` to move local storage elsewhere.

Do not commit `storage/documents` or production secrets.

## Verification

Backend:

```bash
mvn test
```

Frontend:

```bash
cd frontend
npm run build
```
