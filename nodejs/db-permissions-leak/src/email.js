function parseEmailAddress(raw) {
  const at = raw.indexOf('@');
  if (at <= 0 || at !== raw.lastIndexOf('@')) {
    throw new Error('invalid email structure');
  }

  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (!local || !domain || !domain.includes('.')) {
    throw new Error('invalid email structure');
  }

  return raw;
}

function parseEmailQuery(raw) {
  if (raw === undefined) {
    return { ok: false, error: 'email query parameter is required' };
  }

  if (raw === '') {
    return { ok: false, error: 'email must not be empty' };
  }

  try {
    return { ok: true, filter: parseEmailAddress(raw) };
  } catch (err) {
    return { ok: false, error: 'email is not parseable' };
  }
}

function validateRegistrationEmail(raw) {
  return parseEmailAddress(raw);
}

function emailDomain(raw) {
  const at = raw.lastIndexOf('@');
  return at >= 0 ? raw.slice(at + 1) : raw;
}

module.exports = {
  parseEmailQuery,
  parseEmailAddress,
  validateRegistrationEmail,
  emailDomain,
};
