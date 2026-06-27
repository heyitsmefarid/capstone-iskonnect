import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import { StatCard } from '../components/common';
import { formatPersonName } from '../utils/nameFormat';
import {
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  GraduationCap,
  AlertTriangle,
  Calendar,
  BookOpen,
  TrendingUp,
  ShieldAlert,
  FileWarning,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { fetchReportSummary } from '../services/backendApi';

const BAR_COLORS = ['#2d9596', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e'];

const PIE_COLORS = {
  active: '#22c55e',
  approved: '#2d9596',
  'on-hold': '#f59e0b',
  graduated: '#8b5cf6',
  terminated: '#ef4444',
  pending: '#94a3b8',
};

export default function Dashboard() {
  const { applicants, schools, getStats } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const stats = getStats();
  const [liveSummary, setLiveSummary] = useState(null);

  useEffect(() => {
    let mounted = true;

    fetchReportSummary()
      .then((response) => {
        if (!mounted || !response?.summary) {
          return;
        }

        setLiveSummary(response.summary);
      })
      .catch(() => {
        if (mounted) {
          setLiveSummary(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  /* ─── Computed metrics ─── */

  // Financial: Funds released this semester
  const fundsReleasedThisSemester = applicants
    .filter(
      (a) =>
        (a.status === 'active' || a.status === 'approved') &&
        a.disbursementStatus === 'Completed'
    )
    .reduce((sum, s) => sum + (s.amountGranted || 0), 0);

  // Graduation progress rate
  const totalAwarded = applicants.filter((a) => a.status !== 'pending').length;
  const graduated = applicants.filter((a) => a.status === 'graduated').length;
  const graduationRate = totalAwarded > 0 ? ((graduated / totalAwarded) * 100).toFixed(1) : '0';

  // Pending Interviews
  const pendingInterviews = applicants.filter(
    (a) => a.interviewStatus === 'pending'
  ).length;

  // At-risk scholars (GWA > 2.5 or high absences) — aligned with scholar-ui evaluation rules
  const atRiskScholars = applicants.filter((a) => {
    if (a.status !== 'active') return false;
    const absences = (a.attendance || []).filter((att) => !att.present).length;
    return (a.gwa && a.gwa > 2.5) || absences >= 2;
  });

  // Average GWA of active scholars
  const activeScholars = applicants.filter((a) => a.status === 'active');
  const scholarsWithGwa = activeScholars.filter((a) => a.gwa && a.gwa > 0);
  const averageGwa =
    scholarsWithGwa.length > 0
      ? (scholarsWithGwa.reduce((sum, a) => sum + a.gwa, 0) / scholarsWithGwa.length).toFixed(2)
      : 'N/A';

  // Requirements completion rate
  const pendingApplicants = applicants.filter((a) => a.status === 'pending');
  const applicantsWithCompleteReqs = pendingApplicants.filter((a) =>
    Object.values(a.requirements || {}).every((v) => v)
  );
  const requirementCompletionRate =
    pendingApplicants.length > 0
      ? ((applicantsWithCompleteReqs.length / pendingApplicants.length) * 100).toFixed(0)
      : '100';

  const statusCounts = {
    active: applicants.filter((a) => a.status === 'active').length,
    approved: applicants.filter((a) => a.status === 'approved').length,
    onHold: applicants.filter((a) => a.status === 'on-hold').length,
    terminated: applicants.filter((a) => a.status === 'terminated').length,
    graduated: applicants.filter((a) => a.status === 'graduated').length,
    pending: applicants.filter((a) => a.status === 'pending').length,
  };

  const activeApprovedTotal = statusCounts.active + statusCounts.approved;
  const todayLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statCards = [
    {
      title: 'Total Scholars',
      value: liveSummary?.activeScholars ?? stats.total,
      icon: Users,
      color: 'blue',
      trend: `${stats.maleCount}M / ${stats.femaleCount}F`,
      description: 'All applicants & scholars',
    },
    {
      title: 'Active Scholars',
      value: stats.active,
      icon: CheckCircle,
      color: 'green',
      trend: `${activeApprovedTotal} enrolled`,
      description: 'Currently enrolled',
    },
    {
      title: 'Funds Released',
      value: `₱${(fundsReleasedThisSemester / 1000000).toFixed(2)}M`,
      icon: DollarSign,
      color: 'blue',
      trend: `₱${(stats.totalGranted / 1000000).toFixed(1)}M total`,
      description: 'This semester',
    },
    {
      title: 'Pending Applications',
      value: liveSummary?.applications ? Math.max(0, liveSummary.applications - liveSummary.activeScholars) : statusCounts.pending,
      icon: Clock,
      color: 'yellow',
      trend: `${pendingInterviews} interviews`,
      description: 'Awaiting review',
    },
    {
      title: 'Graduation Rate',
      value: `${graduationRate}%`,
      icon: GraduationCap,
      color: 'purple',
      trend: `${graduated} graduated`,
      description: 'Success rate',
    },
  ];

  const schoolData = stats.bySchool.map((s, index) => ({
    ...s,
    fill: BAR_COLORS[index % BAR_COLORS.length],
  }));

  const statusPieData = [
    { name: 'Active', value: activeApprovedTotal, color: PIE_COLORS.active },
    { name: 'On Hold', value: statusCounts.onHold, color: PIE_COLORS['on-hold'] },
    { name: 'Graduated', value: statusCounts.graduated, color: PIE_COLORS.graduated },
    { name: 'Terminated', value: statusCounts.terminated, color: PIE_COLORS.terminated },
    { name: 'Pending', value: statusCounts.pending, color: PIE_COLORS.pending },
  ].filter((d) => d.value > 0);

  // Recent applicants
  const recentApplicants = [...applicants]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  // Missing requirements alerts
  const missingReqAlerts = applicants
    .filter((a) => {
      const reqs = a.requirements || {};
      return Object.values(reqs).some((v) => !v);
    })
    .slice(0, 3);

  return (
    <div className="page dashboard-page">
      <Header
        title="Dashboard"
        subtitle="CED City Education Department — Scholarship Management Overview"
        onMenuClick={onMenuClick}
      />

      <div className="dashboard-content">
        <div className="dashboard-hero">
          <div className="hero-left">
            <div className="hero-kicker">Program Snapshot</div>
            <div className="hero-title">Scholarship Program Overview</div>
            <div className="hero-meta">
              <Calendar size={14} />
              <span>As of {todayLabel}</span>
              <span className="hero-divider" />
              <span>Academic Year 2025-2026</span>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric">
                <span className="metric-label">Active + Approved</span>
                <span className="metric-value">{activeApprovedTotal}</span>
              </div>
              <div className="hero-metric">
                <span className="metric-label">Pending Applications</span>
                <span className="metric-value">{statusCounts.pending}</span>
              </div>
              <div className="hero-metric">
                <span className="metric-label">On Hold Cases</span>
                <span className="metric-value">{statusCounts.onHold}</span>
              </div>
              <div className="hero-metric">
                <span className="metric-label">Graduated</span>
                <span className="metric-value">{statusCounts.graduated}</span>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-status-label">Scholar Status</div>
            <div className="status-chips">
              <div className="status-chip pending">
                <span className="chip-dot" />
                <span className="chip-label">Pending</span>
                <span className="chip-count">{statusCounts.pending}</span>
              </div>
              <div className="status-chip active">
                <span className="chip-dot" />
                <span className="chip-label">Active</span>
                <span className="chip-count">{activeApprovedTotal}</span>
              </div>
              <div className="status-chip hold">
                <span className="chip-dot" />
                <span className="chip-label">On Hold</span>
                <span className="chip-count">{statusCounts.onHold}</span>
              </div>
              <div className="status-chip graduated">
                <span className="chip-dot" />
                <span className="chip-label">Graduated</span>
                <span className="chip-count">{statusCounts.graduated}</span>
              </div>
              <div className="status-chip terminated">
                <span className="chip-dot" />
                <span className="chip-label">Terminated</span>
                <span className="chip-count">{statusCounts.terminated}</span>
              </div>
            </div>
            <div className="hero-status-total">
              <span className="total-label">Total</span>
              <span className="total-value">{applicants.length}</span>
            </div>
          </div>
        </div>
        {/* Stat Cards */}
        <div className="stat-cards">
          {statCards.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          <div className="chart-card">
            <h3 className="chart-title">Scholars per HEI</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={schoolData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" stroke="var(--text-secondary)" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120} 
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card-bg)', 
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                    }} 
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Scholar Status Distribution Pie Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Scholar Status Distribution</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="bottom-row">
          {/* Recent Applicants */}
          <div className="card recent-applicants">
            <h3 className="card-title">Recent Applicants</h3>
            <div className="applicant-list">
              {recentApplicants.map((applicant) => (
                <div key={applicant.id} className="applicant-item">
                  <div className="applicant-avatar">
                    {(applicant.firstName?.[0] || '')}{(applicant.lastName?.[0] || '') || (applicant.name?.[0] || '?')}
                  </div>
                  <div className="applicant-info">
                    <span className="applicant-name">
                      {formatPersonName(applicant)}
                    </span>
                    <span className="applicant-school">{applicant.school}</span>
                  </div>
                  <span className={`status-badge status-${applicant.status}`}>
                    {applicant.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="card alerts-card">
            <h3 className="card-title">
              <AlertTriangle className="title-icon" size={20} />
              Alerts & Notifications
            </h3>
            <div className="alerts-list">
              {missingReqAlerts.length === 0 && pendingInterviews === 0 && atRiskScholars.length === 0 ? (
                <p className="no-alerts">No pending alerts</p>
              ) : (
                <>
                  {/* At-risk scholars */}
                  {atRiskScholars.slice(0, 3).map((scholar) => {
                    const absences = (scholar.attendance || []).filter(
                      (a) => !a.present
                    ).length;
                    return (
                      <div key={`risk-${scholar.id}`} className="alert-item alert-danger">
                        <div className="alert-icon">
                          <ShieldAlert size={16} />
                        </div>
                        <div className="alert-content">
                          <span className="alert-title">At-Risk Scholar</span>
                          <span className="alert-desc">
                            {formatPersonName(scholar)} —{' '}
                            {scholar.gwa > 2.5
                              ? `GWA ${scholar.gwa}`
                              : `${absences} absence${absences !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Missing requirements */}
                  {missingReqAlerts.map((applicant) => (
                    <div key={applicant.id} className="alert-item">
                      <div className="alert-icon">
                        <FileWarning size={16} />
                      </div>
                      <div className="alert-content">
                        <span className="alert-title">Missing Requirements</span>
                        <span className="alert-desc">
                          {formatPersonName(applicant)} — {applicant.school}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Pending interviews */}
                  {pendingInterviews > 0 && (
                    <div className="alert-item alert-info">
                      <div className="alert-icon">
                        <Clock size={16} />
                      </div>
                      <div className="alert-content">
                        <span className="alert-title">Pending Interviews</span>
                        <span className="alert-desc">
                          {pendingInterviews} applicant{pendingInterviews > 1 ? 's' : ''} waiting for interview
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Requirements completion for pending applicants */}
                  {pendingApplicants.length > 0 && (
                    <div className="alert-item alert-info">
                      <div className="alert-icon">
                        <TrendingUp size={16} />
                      </div>
                      <div className="alert-content">
                        <span className="alert-title">Requirement Completion</span>
                        <span className="alert-desc">
                          {requirementCompletionRate}% of pending applicants have complete requirements
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
