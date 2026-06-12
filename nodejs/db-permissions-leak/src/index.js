const express = require('express');
const { initDb } = require('./db');
const { searchRecords } = require('./query');
const { login, requireAuth, requireAdmin, DEMO_ACCOUNTS } = require('./auth');
const { authorizeTableAccess } = require('./authorize');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/auth/demo-accounts', (_req, res) => {
  res.json({ accounts: DEMO_ACCOUNTS });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  const session = await login(email, password);
  if (!session) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  res.json({
    token: session.token,
    role: session.role,
    email: session.email,
    department: session.department,
  });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// AUTH-142: employees are scoped to an assigned directory; admins fall back to the requested table.
function directoryForAuth(user, requestedTable) {
  return user.department ?? requestedTable;
}

// Authenticated directory search. Includes a table authorization check.
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const table = req.query.table || req.user.department || 'sales';

    if (!authorizeTableAccess(req.user, directoryForAuth(req.user, table))) {
      return res.status(403).json({ error: 'not authorized for this table' });
    }

    const rows = await searchRecords(table, req.query.email);
    res.json({
      endpoint: 'users',
      caller: req.user,
      table,
      count: rows.length,
      rows,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admins', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await searchRecords('admins', req.query.email);
    res.json({
      endpoint: 'admins',
      caller: req.user,
      count: rows.length,
      rows,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`db-permissions-leak listening on :${PORT}`);
    console.log('Demo accounts: GET /auth/demo-accounts');
    console.log('Login: POST /auth/login {"email":"alice@example.com","password":"demo"}');
    console.log('Leak demo: GET /api/users?table=admins&email= (with employee token)');
  });
}

main().catch((err) => {
  console.error('failed to start:', err);
  process.exit(1);
});
