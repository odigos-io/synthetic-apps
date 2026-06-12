const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'app',
  password: process.env.PGPASSWORD || 'app',
  database: process.env.PGDATABASE || 'permissions_leak',
});

async function waitForPostgres(maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      console.log(`waiting for postgres (${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function initDb() {
  await waitForPostgres();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS engineers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketing (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      clearance_level TEXT NOT NULL
    );
  `);

  const salesCount = await pool.query('SELECT COUNT(*)::int AS count FROM sales');
  if (salesCount.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO sales (email, name) VALUES
        ('alice@example.com', 'Alice Sales'),
        ('bob@example.com', 'Bob Sales'),
        ('carol@example.com', 'Carol Sales')`
    );
  }

  const engineersCount = await pool.query('SELECT COUNT(*)::int AS count FROM engineers');
  if (engineersCount.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO engineers (email, name) VALUES
        ('dave@example.com', 'Dave Engineer'),
        ('eve@example.com', 'Eve Engineer'),
        ('frank@example.com', 'Frank Engineer')`
    );
  }

  const marketingCount = await pool.query('SELECT COUNT(*)::int AS count FROM marketing');
  if (marketingCount.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO marketing (email, name) VALUES
        ('grace@example.com', 'Grace Marketing'),
        ('henry@example.com', 'Henry Marketing'),
        ('iris@example.com', 'Iris Marketing')`
    );
  }

  const adminCount = await pool.query('SELECT COUNT(*)::int AS count FROM admins');
  if (adminCount.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO admins (email, name, clearance_level) VALUES
        ('root@internal.corp', 'Root Admin', 'superuser'),
        ('ops@internal.corp', 'Ops Admin', 'operator'),
        ('audit@internal.corp', 'Audit Admin', 'auditor')`
    );
  }
}

module.exports = { pool, initDb };
