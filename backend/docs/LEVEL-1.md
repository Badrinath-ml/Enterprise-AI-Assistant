# Level 1 — Enterprise CRUD

## Scope

```text
Auth
+
Tenant
+
RBAC
+
Departments
+
Users
```

## Data model

```text
Tenant
  |
  +---- Department
  |
  +---- User
          |
          +---- Role
          |
          +---- Department
```

## Security boundary

The backend determines the tenant from the authenticated JWT.

Never accept:

```text
tenantId
```

from the client as an authorization decision.

For tenant-owned resources, the server should derive tenant identity from the authenticated principal.

## RBAC

Current roles:

- ADMIN
- MANAGER
- EMPLOYEE

Current enforcement:

- User creation: ADMIN only
- Authentication: public
- Tenant and department reads: authenticated

The role matrix should be expanded as the document module is added.

## Important design decision

The project uses **package-by-feature**:

```text
auth/
tenant/
user/
department/
common/
security/
```

Avoid converting the project into a global:

```text
controllers/
services/
repositories/
entities/
```

structure.

That will make the later document, ingestion and RAG modules easier to isolate.
