export const normalizeText = (value) =>
  (value ?? '').toString().trim().toLowerCase();

export const matchesSearch = (fields, term) => {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return true;
  return fields.some(field => normalizeText(field).includes(normalizedTerm));
};

export const matchesExact = (value, filterValue) => {
  if (!filterValue) return true;
  return normalizeText(value) === normalizeText(filterValue);
};
