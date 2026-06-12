const { pool } = require('./db');
const { validateRegistrationEmail } = require('./email');

const DEMO_PASSWORDS = {
  employee: 'demo',
  admin: 'admin',
};

const DEPARTMENTS = ['sales', 'engineers', 'marketing', 'vendor'];

async function lookupAccount(email) {
  const adminResult = await pool.query(
    'SELECT email, name FROM admins WHERE email = $1',
    [email]
  );
  if (adminResult.rows.length > 0) {
    return {
      email: adminResult.rows[0].email,
      name: adminResult.rows[0].name,
      department: null,
      password: DEMO_PASSWORDS.admin,
    };
  }

  for (const department of DEPARTMENTS) {
    const result = await pool.query(
      `SELECT email, name FROM ${department} WHERE email = $1`,
      [email]
    );
    if (result.rows.length > 0) {
      return {
        email: result.rows[0].email,
        name: result.rows[0].name,
        department,
        password: DEMO_PASSWORDS.employee,
      };
    }
  }

  return null;
}

function createToken(account) {
  return Buffer.from(
    JSON.stringify({
      email: account.email,
      department: account.department,
    })
  ).toString('base64url');
}

function parseToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!payload.email) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function registerEmployee(department, email, name) {
  if (!DEPARTMENTS.includes(department)) {
    throw new Error(`unknown department: ${department}`);
  }

  validateRegistrationEmail(email);

  const existing = await lookupAccount(email);
  if (existing) {
    return null;
  }

  await pool.query(`INSERT INTO ${department} (email, name) VALUES ($1, $2)`, [
    email,
    name,
  ]);

  return {
    email,
    name,
    department,
  };
}

async function login(email, password) {
  const account = await lookupAccount(email);
  if (!account) {
    return null;
  }

  if (password !== account.password) {
    return null;
  }

  return {
    email: account.email,
    department: account.department,
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

const DEMO_ACCOUNTS = [
  { email: 'alice@example.com', password: 'demo', department: 'sales' },
  { email: 'dave@example.com', password: 'demo', department: 'engineers' },
  { email: 'grace@example.com', password: 'demo', department: 'marketing' },
  { email: 'jack@example.com', password: 'demo', department: 'vendor' },
  { email: 'root@internal.corp', password: 'admin', department: null },
];

module.exports = {
  login,
  registerEmployee,
  requireAuth,
  DEMO_ACCOUNTS,
};
