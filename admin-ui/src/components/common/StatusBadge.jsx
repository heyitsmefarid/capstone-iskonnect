/**
 * Reusable status badge component. Used across Scholars, Applications, Attendance,
 * Evaluation, and Timeline pages.
 *
 * Status styles are defined in global.css under `.status-badge.status-*` selectors.
 */
export default function StatusBadge({ status, size = 'default' }) {
  const label =
    status === 'on-hold'
      ? 'On Hold'
      : status
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : 'Unknown';

  return (
    <span className={`status-badge status-${status} ${size === 'sm' ? 'badge-sm' : ''}`}>
      {label}
    </span>
  );
}
