# Node.js DB Permissions Leak

Simple Express app backed by PostgreSQL. Department tables (`sales`, `engineers`, `marketing`), an `admins` table, and bearer-token auth. The users endpoint runs a table authorization check — but passes the wrong value into it.

## Demo accounts

| Email | Password | Role | Department |
|-------|----------|------|------------|
| `alice@example.com` | `demo` | employee | sales |
| `dave@example.com` | `demo` | employee | engineers |
| `grace@example.com` | `demo` | employee | marketing |
| `root@internal.corp` | `admin` | admin | — |

List them at runtime:

```bash
curl http://localhost:8080/auth/demo-accounts
```

## Auth flow

```bash
# 1. Log in as a sales employee
curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"demo"}'

# Response includes a bearer token:
# {"token":"...","role":"employee","email":"alice@example.com","department":"sales"}
```

Use the token on protected routes:

```bash
TOKEN="<paste token>"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/users?email=alice"
```

## The bug

`authorizeTableAccess()` in `src/authorize.js` rejects admin tables and cross-department access for employees. Admins are allowed all tables. The handler uses a leftover helper from AUTH-142 that looks correct but never applies the requested table for employees:

```javascript
function directoryForAuth(user, requestedTable) {
  return user.department ?? requestedTable;
}

const table = req.query.table || req.user.department || 'sales';

if (!authorizeTableAccess(req.user, directoryForAuth(req.user, table))) {
  return res.status(403).json({ error: 'not authorized for this table' });
}
```

`??` reads like sensible null handling: use the assigned directory when present, otherwise the requested table. Employees always have a department, so `requestedTable` is ignored and the check runs against `sales` even when `table=admins`.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/users?table=admins&email="
```

Cross-department access is also unchecked (e.g. Alice querying `engineers`):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/users?table=engineers&email=dave"
```

Admins can query any table via `/api/users`:

```bash
ADMIN_TOKEN="<token from root@internal.corp login>"

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/users?table=engineers&email=dave"

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/admins"
```

## Local run

Start Postgres:

```bash
docker run --rm -p 5432:5432 \
  -e POSTGRES_USER=app \
  -e POSTGRES_PASSWORD=app \
  -e POSTGRES_DB=permissions_leak \
  postgres:16-alpine
```

Then run the app:

```bash
yarn install
node src/index.js
```

## Kubernetes

```bash
make deploy
make trigger   # logs in, runs department queries, then the admin leak
```

## Endpoints

| Path | Auth | Description |
|------|------|-------------|
| `GET /health` | — | Health check |
| `GET /auth/demo-accounts` | — | Cheat sheet of demo credentials |
| `POST /auth/login` | — | Returns bearer token |
| `GET /auth/me` | Bearer | Current session |
| `GET /api/users?email=` | Bearer | Directory search; `table` defaults to caller department |
| `GET /api/admins?email=` | Bearer (admin) | Admin directory |

## Tables

| API alias | Postgres table | Notes |
|-----------|----------------|-------|
| `sales` | `sales` | Sales team directory |
| `engineers` | `engineers` | Engineering team directory |
| `marketing` | `marketing` | Marketing team directory |
| `admins` | `admins` | Should only be reachable via `/api/admins` |
