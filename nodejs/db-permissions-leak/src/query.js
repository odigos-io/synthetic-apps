const { pool } = require('./db');

const DEPARTMENT_TABLES = ['sales', 'engineers', 'marketing', 'vendor'];

// Public aliases for the users endpoint. admins is not intended here but still accepted.
const TABLE_ALIASES = {
  sales: 'sales',
  engineers: 'engineers',
  marketing: 'marketing',
  vendor: 'vendor',
  admins: 'admins',
};

async function searchRecords(tableAlias, emailFilter) {
  const table = TABLE_ALIASES[tableAlias];
  if (!table) {
    throw new Error(`unknown table: ${tableAlias}`);
  }

  let sql;
  if (table === 'admins') {
    sql = 'SELECT id, email, name, clearance_level FROM admins WHERE email LIKE $1';
  } else if (DEPARTMENT_TABLES.includes(table)) {
    sql = `SELECT id, email, name FROM ${table} WHERE email LIKE $1`;
  } else {
    throw new Error(`unknown table: ${tableAlias}`);
  }

  const result = await pool.query(sql, [`%${emailFilter || ''}%`]);
  return result.rows;
}

module.exports = { searchRecords };
