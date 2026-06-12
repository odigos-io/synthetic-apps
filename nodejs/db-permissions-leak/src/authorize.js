const DEPARTMENT_TABLES = ['sales', 'engineers', 'marketing'];

function authorizeTableAccess(user, table) {
  if (user.role === 'admin') {
    return true;
  }

  if (table === 'admins') {
    return false;
  }

  if (!DEPARTMENT_TABLES.includes(table)) {
    return false;
  }

  return user.department === table;
}

module.exports = { authorizeTableAccess, DEPARTMENT_TABLES };
