# Enterprise Knowledge Assistant — Backend

Level 1 implementation of the **Enterprise Knowledge Assistant Platform**:

- Authentication
- Multi-tenancy
- RBAC
- Departments
- Tenant-scoped users
- PostgreSQL
- Flyway migrations
- JWT access tokens
- Docker-based local database
- Spring Boot Actuator
- Spring AI baseline for later RAG integration

## Stack

- Java 21
- Spring Boot 4.1.1
- Spring AI 2.0.1
- Maven
- PostgreSQL 17 + pgvector image
- Spring Security
- JWT
- Spring Data JPA
- Flyway
- React frontend is intentionally not included in this backend-first phase

## Architecture

```text
React
  |
  v
Spring Boot
  |
  +-- Auth / JWT
  +-- Tenant
  +-- RBAC
  +-- Departments
  +-- Users
  |
  v
PostgreSQL
```

RAG, RabbitMQ, Redis and document ingestion are deliberately deferred to later levels.

## Prerequisites

- JDK 21
- Maven 3.9+
- Docker Desktop

Verify:

```bash
java -version
mvn -version
docker --version
```

## 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Check:

```bash
docker compose ps
```

To use the Aiven PostgreSQL database instead, set `DB_URL`, `DB_USERNAME`, and
`DB_PASSWORD` in the ignored `.env` file. The JDBC URL must include
`sslmode=require`; do not commit the password.

## 2. Run backend

```bash
mvn spring-boot:run
```

Backend:

```text
http://localhost:8080
```

Health:

```text
GET /actuator/health
```

## 3. Register a tenant + first admin

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

The first registration for a tenant becomes an `ADMIN`.

## 4. Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "tenantSlug": "acme",
  "email": "admin@acme.com",
  "password": "Admin@12345"
}
```

Copy the returned `accessToken`.

Use:

```text
Authorization: Bearer <accessToken>
```

## 5. Create departments

```http
POST /api/v1/departments
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Human Resources"
}
```

Then:

```http
POST /api/v1/departments
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Engineering"
}
```

## 6. Create users

Only an `ADMIN` can create users.

```http
POST /api/v1/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Engineering User",
  "email": "engineer@acme.com",
  "password": "Engineer@12345",
  "departmentId": "<ENGINEERING_DEPARTMENT_UUID>",
  "role": "EMPLOYEE"
}
```

## 7. Tenant isolation

The JWT contains:

```json
{
  "sub": "<user-id>",
  "tenant_id": "<tenant-id>",
  "role": "ADMIN",
  "department_id": "<department-id>"
}
```

The backend establishes a request-scoped `TenantContext` from the JWT.

Every tenant-owned repository query must explicitly scope by `tenant_id`.

This is intentional: **do not rely on the frontend to enforce tenant isolation.**

## Current API

### Public

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /actuator/health
GET  /actuator/info
```

### Authenticated

```text
GET  /api/v1/tenant/me
GET  /api/v1/departments
POST /api/v1/departments
```

### Admin

```text
POST /api/v1/users
```

## Next implementation

Level 1 is not finished until these are added:

1. Refresh-token rotation
2. Admin-only department management
3. User listing/update/deactivation
4. Explicit tenant authorization tests
5. Document entity + versioning
6. Document lifecycle
7. File storage abstraction
8. Integration tests with Testcontainers
9. OpenAPI
10. Audit logging

Then Level 2 can add:

```text
Document
  ↓
Async ingestion
  ↓
Chunking
  ↓
Embeddings
  ↓
pgvector
  ↓
Spring AI
  ↓
RAG
```

## Dependency rule

Do **not** manually add versions for Spring Framework, Spring Security, Hibernate, Jackson, Tomcat, etc.

Spring Boot manages those versions.

Spring AI is managed through its BOM.

Only pin a third-party dependency when there is a deliberate compatibility/security reason.
