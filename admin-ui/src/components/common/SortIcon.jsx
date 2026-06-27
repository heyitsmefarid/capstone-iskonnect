import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Reusable sort icon component extracted from the duplicated sort-icon logic
 * found in Applications, AcademicRecords, Evaluation pages.
 */
export default function SortIcon({ column, currentSort }) {
  if (currentSort.column !== column) {
    return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
  }
  return currentSort.direction === 'asc' ? (
    <ArrowUp size={14} />
  ) : (
    <ArrowDown size={14} />
  );
}
