/**
 * Reusable stat card component used across Dashboard, Attendance, Academic Records,
 * and Evaluation pages. Aligns with scholar-ui's dashboard card pattern.
 */
export default function StatCard({ title, value, icon: Icon, color = 'blue', trend, description }) {
  return (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-card-header">
        <div className={`stat-icon stat-icon-${color}`}>
          {Icon && <Icon size={24} />}
        </div>
        {trend && (
          <span
            className={`stat-trend ${
              typeof trend === 'string' && trend.startsWith('+')
                ? 'positive'
                : typeof trend === 'string' && trend.startsWith('-')
                  ? 'negative'
                  : ''
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
      {description && <div className="stat-description">{description}</div>}
    </div>
  );
}
