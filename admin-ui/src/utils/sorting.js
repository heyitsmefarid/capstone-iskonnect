/**
 * Common sorting helper. Avoids repeating the same sort-toggle logic
 * across every page with sortable tables.
 */
export function toggleSortDirection(currentSort, column) {
  return {
    column,
    direction: currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc',
  };
}

/**
 * Generic comparator for sortable columns. Supports string, number, and date values.
 */
export function sortComparator(a, b, column, direction) {
  let valA = a[column];
  let valB = b[column];

  // Handle null / undefined
  if (valA == null && valB == null) return 0;
  if (valA == null) return 1;
  if (valB == null) return -1;

  // Detect and sort as number
  if (typeof valA === 'number' && typeof valB === 'number') {
    return direction === 'asc' ? valA - valB : valB - valA;
  }

  // Detect and sort as date
  if (valA instanceof Date || (!isNaN(Date.parse(valA)) && String(valA).includes('-'))) {
    const dateA = new Date(valA);
    const dateB = new Date(valB);
    if (!isNaN(dateA) && !isNaN(dateB)) {
      return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
  }

  // Default: string comparison
  const strA = String(valA).toLowerCase();
  const strB = String(valB).toLowerCase();
  const cmp = strA.localeCompare(strB);
  return direction === 'asc' ? cmp : -cmp;
}
