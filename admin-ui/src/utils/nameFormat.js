export function formatPersonName(person) {
  if (!person) return '';

  const lastName = String(person.lastName || '').trim();
  const firstName = String(person.firstName || '').trim();

  if (lastName && firstName) return `${lastName}, ${firstName}`;
  return lastName || firstName || '';
}

export function formatNameParts(firstName, lastName) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();

  if (last && first) return `${last}, ${first}`;
  return last || first || '';
}

export function formatPersonNameWithMiddle(person) {
  if (!person) return '';

  const base = formatPersonName(person);
  const middleName = String(person.middleName || '').trim();

  if (!middleName) return base;
  return `${base} ${middleName}`.trim();
}
