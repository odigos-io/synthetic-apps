const { pool } = require('./db');

const DEMO_PASSWORDS = {
  employee: 'demo',
  admin: 'admin',
};

const DEPARTMENTS = ['sales', 'engineers', 'marketing'];

async function lookupAccount(email) {
  const adminResult = await pool.query(
    'SELECT email, name FROM admins WHERE email = $1',
    [email]
  );
  if (adminResult.rows.length > 0) {
    return {
      role: 'admin',
      email: adminResult.rows[0].email,
      name: adminResult.rows[0].name,
      department: null,
    };
  }

  for (const department of DEPARTMENTS) {
    const result = await pool.query(
      `SELECT email, name FROM ${department} WHERE email = $1`,
      [email]
    );
    if (result.rows.length > 0) {
      return {
        role: 'employee',
        email: result.rows[0].email,
        name: result.rows[0].name,
        department,
      };
    }
  }

  return null;
}

function createToken(account) {
  return Buffer.from(
    JSON.stringify({
      role: account.role,
      email: account.email,
      department: account.department,
    })
  ).toString('base64url');
}

function parseToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!payload.role || !payload.email) {
      return null;
    }
    if (payload.role === 'employee' && !payload.department) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function login(email, password) {
  const account = await lookupAccount(email);
  if (!account) {
    return null;
  }

  const expectedPassword =
    account.role === 'admin' ? DEMO_PASSWORDS.admin : DEMO_PASSWORDS.employee;
  if (password !== expectedPassword) {
    return null;
  }

  return {
    ...account,
    token: createToken(account),
  };
}

function requireAuth(req, res, next) {
  const header = req.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' });
  }

  const user = parseToken(header.slice('Bearer '.length));
  if (!user) {
    return res.status(401).json({ error: 'invalid token' });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin role required' });
  }
  next();
}

const DEMO_ACCOUNTS = [
  { email: 'alice@example.com', password: 'demo', role: 'employee', department: 'sales' },
  { email: 'dave@example.com', password: 'demo', role: 'employee', department: 'engineers' },
  { email: 'grace@example.com', password: 'demo', role: 'employee', department: 'marketing' },
  { email: 'root@internal.corp', password: 'admin', role: 'admin', department: null },
];

module.exports = {
  login,
  requireAuth,
  requireAdmin,
  DEMO_ACCOUNTS,
};
