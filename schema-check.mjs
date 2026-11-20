const supportedTypes = new Set(['string', 'integer', 'number', 'boolean', 'date', 'datetime']);

function fields(contract, label) {
  const entries = contract && typeof contract === 'object' && !Array.isArray(contract) ? Object.entries(contract) : [];
  if (!entries.length || entries.length > 60) {
    throw Object.assign(new Error(label + ' must be a JSON object with 1 to 60 fields.'), { status: 400 });
  }
  for (const [field, type] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field) || !supportedTypes.has(type)) {
      throw Object.assign(new Error(label + ' needs valid field names and supported field types.'), { status: 400 });
    }
  }
  return entries;
}

export function compareContracts(expected, incoming) {
  const planned = fields(expected, 'Expected contract');
  const received = fields(incoming, 'Incoming contract');
  return {
    missing: planned.filter(([field]) => !Object.hasOwn(incoming, field)).map(([field, type]) => ({ field, type })),
    added: received.filter(([field]) => !Object.hasOwn(expected, field)).map(([field, type]) => ({ field, type })),
    changed: planned.filter(([field, type]) => Object.hasOwn(incoming, field) && incoming[field] !== type)
      .map(([field, type]) => ({ field, expected: type, incoming: incoming[field] })),
  };
}

