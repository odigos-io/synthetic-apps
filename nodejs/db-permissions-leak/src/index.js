const express = require('express');
const { initDb } = require('./db');
const { searchRecords } = require('./query');
const {
  login,
  registerEmployee,
  requireAuth,
  DEMO_ACCOUNTS,
} = require('./auth');
const { authorizeTableAccess } = require('./authorize');
const { parseEmailQuery } = require('./email');

const app = express();
const PORT = process.env.PORT || 8080;
const DEMO_PASSWORD = 'demo';

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/auth/demo-accounts', (_req, res) => {
  res.json({ accounts: DEMO_ACCOUNTS });
});

app.post('/auth/register', async (req, res) => {
  const { email, name, password, department } = req.body || {};
  if (!email || !name || !password || !department) {
    return res.status(400).json({ error: 'email, name, password, and department are required' });
  }

  if (department !== 'vendor') {
    return res.status(400).json({ error: 'only vendor self-registration is enabled' });
  }

  if (password !== DEMO_PASSWORD) {
    return res.status(400).json({ error: 'registration password must be demo' });
  }

  try {
    const account = await registerEmployee(department, email, name);
    if (!account) {
      return res.status(409).json({ error: 'email already registered' });
    }

    res.status(201).json({
      email: account.email,
      name: account.name,
      department: account.department,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
    email: session.email,
    department: session.department,
  });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const parsed = parseEmailQuery(req.query.email);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const table = req.query.table || req.user.department || 'sales';

    if (!authorizeTableAccess(req.user, table)) {
      return res.status(403).json({ error: 'not authorized for this table' });
    }

    const rows = await searchRecords(table, parsed.filter);
    res.json({
      endpoint: 'users',
      caller: req.user,
      table,
      email: parsed.filter,
      count: rows.length,
      rows,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admins', requireAuth, async (req, res) => {
  try {
    const parsed = parseEmailQuery(req.query.email);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    if (!authorizeTableAccess(req.user, 'admins')) {
      return res.status(403).json({ error: 'not authorized for this table' });
    }

    const rows = await searchRecords('admins', parsed.filter);
    res.json({
      endpoint: 'admins',
      caller: req.user,
      email: parsed.filter,
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
    console.log('Vendor leak: register jack@internal.corp.evil.com, login, GET /api/users?table=admins&email=root@internal.corp');
  });
}

main().catch((err) => {
  console.error('failed to start:', err);
  process.exit(1);
});
