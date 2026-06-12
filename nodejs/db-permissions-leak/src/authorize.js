const DEPARTMENT_TABLES = ['sales', 'engineers', 'marketing', 'vendor'];
const INTERNAL_DOMAIN = 'internal.corp';

const { emailDomain } = require('./email');

function isInternalEmail(user) {
  // Bug: substring match — attacker domains like internal.corp.evil.com also match.
  return emailDomain(user.email).includes(INTERNAL_DOMAIN);
}

function authorizeTableAccess(user, table) {
  if (isInternalEmail(user)) {
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

module.exports = {
  authorizeTableAccess,
  DEPARTMENT_TABLES,
  INTERNAL_DOMAIN,
  isInternalEmail,
};
