/**
 * Reusable empty state component for tables, lists, and card grids
 * when no data matches the current filters.
 */
export default function EmptyState({ icon: Icon, title = 'No data found', message }) {
  return (
    <div className="empty-state-container">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={48} />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
    </div>
  );
}
