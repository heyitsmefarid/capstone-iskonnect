import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import { StatCard } from '../components/common';
import { formatPersonName } from '../utils/nameFormat';
import {
  CheckCircle,
  Clock,
  DollarSign,
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
  const { applicants, getStats, schoolYears, events } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const stats = getStats();

  // The actual active term (set in School Year Management) — was previously
  // a hardcoded "Academic Year 2025-2026" label that never changed no matter
  // what term the admin activated.
  const activeSy = schoolYears.find((s) => s.isActive);
  const activeSem = activeSy?.semesters?.find((s) => s.isActive);
  const activeTermLabel = activeSy && activeSem
    ? `${activeSem.name}, A.Y. ${activeSy.label}`
    : 'No active term set';

  // The getReportSummary fetch that used to live here has been removed along
  // with the two card values it fed. It returns 404 (the Cloud Functions
  // codebase is not deployed for this project), so it never produced data —
  // and its fallback was not equivalent to its success path: the "Total
  // Scholars" card showed active scholars when the call succeeded but every
  // applicant, pending included, when it failed. Both cards now read from the
  // same local `applicants` collection as the rest of the page.

  /* ─── Computed metrics ─── */

  // Financial: the real disbursement ledger is enrolledSemesters (one entry
  // per granted term — see grantSemesterIfNeeded in AppContext.jsx), not
  // amountGranted (only ever holds the MOST RECENTLY granted semester's
  // amount, overwritten on every new grant, never summed) or
  // disbursementStatus (read here but never actually written to 'Completed'
  // by any current flow, so filtering on it always matched nothing — this is
  // why "Released This Semester" was stuck at ₱0). Mirrors the same
  // enrolledSemesters-based math already trusted in Scholars.jsx's own
  // "Total Granted" figure. On-hold semesters received no grant and are
  // excluded, matching that same logic.
  const grantedAmountsOf = (applicant, { termOnly } = {}) =>
    (applicant.enrolledSemesters || [])
      .filter((e) => {
        if (e.status === 'on_hold') return false;
        if (!termOnly) return true;
        return activeSy && activeSem && e.schoolYear === activeSy.label && e.semester === activeSem.name;
      })
      .reduce((sum, e) => sum + (typeof e.grantedAmount === 'number' ? e.grantedAmount : 0), 0);

  const fundsReleasedThisSemester = applicants.reduce(
    (sum, a) => sum + grantedAmountsOf(a, { termOnly: true }),
    0
  );
  const totalReleasedAllSchoolYears = applicants.reduce(
    (sum, a) => sum + grantedAmountsOf(a),
    0
  );

  // Graduation rate was dropped from the cards: its denominator counted every
  // non-pending applicant (terminated and on-hold included), so it was not a
  // success rate, and for a programme whose first cohort has not graduated it
  // reads 0.0% indefinitely. Graduated headcount remains on the status donut
  // and the status chips below.

  // Pending Interviews
  const pendingInterviews = applicants.filter(
    (a) => a.interviewStatus === 'pending'
  ).length;

  // At-risk scholars (GWA > 2.5 or high absences) — aligned with scholar-ui evaluation rules.
  //
  // Absences are counted only against events that still exist. A deleted event
  // leaves its records behind on each scholar's document, and counting those
  // kept flagging scholars for absences from events the admin had removed.
  const scheduledEventNames = new Set(events.map((e) => e.name));
  const atRiskScholars = applicants.filter((a) => {
    if (a.status !== 'active') return false;
    const absences = (a.attendance || []).filter(
      (att) => !att.present && scheduledEventNames.has(att.activity)
    ).length;
    return (a.gwa && a.gwa > 2.5) || absences >= 2;
  });

  const activeScholars = applicants.filter((a) => a.status === 'active');

  // Average GWA was dropped from the cards: it read "N/A" whenever no scholar
  // had a GWA on file, which is exactly the situation early in a term, and it
  // averaged whatever happened to be recorded rather than tracking the grade
  // workflow the office actually runs. Replaced by the submitted/evaluated
  // counts computed below.

  // Requirements completion rate
  const pendingApplicants = applicants.filter((a) => a.status === 'pending');
  const applicantsWithCompleteReqs = pendingApplicants.filter((a) =>
    Object.values(a.requirements || {}).every((v) => v)
  );
  const requirementCompletionRate =
    pendingApplicants.length > 0
      ? ((applicantsWithCompleteReqs.length / pendingApplicants.length) * 100).toFixed(0)
      : '100';

  // Grade workflow for the active term. These mirror AcademicRecords' own
  // definitions exactly so the two pages cannot drift apart: "submitted"
  // means the scholar has grade records filed against the active school year
  // + semester, "evaluated" means an admin has confirmed that term's grades
  // (status 'confirmed' — 'revision' and 'pending' do not count).
  const activeTermKey =
    activeSy && activeSem ? `${activeSy.label}::${activeSem.name}` : null;

  const gradesSubmittedCount = activeTermKey
    ? activeScholars.filter((s) =>
        (s.grades || []).some(
          (r) => r.schoolYear === activeSy.label && r.semester === activeSem.name
        )
      ).length
    : 0;

  const gradesEvaluatedCount = activeTermKey
    ? activeScholars.filter(
        (s) => (s.gradesEvaluation || {})[activeTermKey]?.status === 'confirmed'
      ).length
    : 0;

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

  // Peso amounts are shown in full rather than scaled to millions: this
  // programme disburses in the thousands-to-low-millions range, where
  // "₱0.00M" rounds every real figure away to nothing.
  const peso = (amount) => `₱${Math.round(amount || 0).toLocaleString('en-PH')}`;

  // Chosen for what the office has to act on each day, in priority order:
  // who is being supported, what is waiting in the queue, who is about to
  // lose their grant, what has been paid out, and how the cohort is doing
  // academically. Headcount by status is deliberately left to the status
  // donut chart below rather than repeated as a card.
  const statCards = [
    {
      title: 'Active Scholars',
      value: statusCounts.active,
      icon: CheckCircle,
      color: 'green',
      trend: statusCounts.approved > 0 ? `+${statusCounts.approved} awarded` : 'all enrolled',
      description: 'Currently enrolled',
    },
    {
      title: 'Pending Applications',
      value: statusCounts.pending,
      icon: Clock,
      color: 'yellow',
      // How many can actually be acted on now, which is the number that
      // decides whether it is worth opening the queue — more useful than a
      // raw interview count.
      trend: `${applicantsWithCompleteReqs.length} ready to review`,
      description: 'Awaiting review',
    },
    {
      title: 'At-Risk Scholars',
      value: atRiskScholars.length,
      icon: ShieldAlert,
      color: 'red',
      trend: statusCounts.onHold > 0 ? `${statusCounts.onHold} on hold` : 'none on hold',
      description: 'GWA above 2.5 or 2+ absences',
    },
    {
      // Current-semester figure is the badge at the top of the card (most
      // actionable — what the office released THIS term); the all-school-year
      // running total sits below as the main number, for the bigger picture.
      title: 'Total Grant Released',
      value: peso(totalReleasedAllSchoolYears),
      icon: DollarSign,
      color: 'blue',
      trend: `${peso(fundsReleasedThisSemester)} this semester`,
      description: 'All school years',
    },
    {
      title: 'Grades Submitted',
      value: gradesSubmittedCount,
      icon: TrendingUp,
      color: 'purple',
      // The gap between these two numbers is the evaluation backlog — the
      // work the office still owes this term.
      trend: `${gradesEvaluatedCount} evaluated`,
      description: activeSem
        ? `of ${activeScholars.length} active scholars`
        : 'No active term set',
    },
  ];

  const schoolData = stats.bySchool.map((s, index) => ({
    ...s,
    fill: BAR_COLORS[index % BAR_COLORS.length],
  }));

  // Standing of scholars currently in the programme: active versus on hold.
  //
  // Pending/graduated/terminated were removed. Pending in particular counts
  // *applicants*, not scholars, so including it made the chart answer a
  // different question than its title asked — and the cards above already
  // report the pending queue on their own.
  //
  // Uses statusCounts.active rather than active+approved so the slice agrees
  // with the Active Scholars card; approved-but-not-yet-enrolled scholars are
  // reported there as the "+N awarded" trend.
  //
  // Neither slice is dropped at zero: "On Hold: 0" is a useful explicit
  // statement, whereas removing the slice leaves no way to tell "none on
  // hold" apart from "not tracked".
  const statusPieData = [
    { name: 'Active', value: statusCounts.active, color: PIE_COLORS.active },
    { name: 'On Hold', value: statusCounts.onHold, color: PIE_COLORS['on-hold'] },
  ];
  const statusPieTotal = statusPieData.reduce((sum, d) => sum + d.value, 0);

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
              <span>{activeTermLabel}</span>
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

          {/* Active vs On Hold Pie Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Active vs On Hold</h3>
            <div className="chart-container">
              {statusPieTotal === 0 ? (
                // Recharts would otherwise draw an empty ring with a legend,
                // which reads as a rendering fault rather than "no scholars".
                <div
                  style={{
                    height: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No scholars are enrolled yet.
                </div>
              ) : (
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
              )}
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
                    // Same scheduled-events-only rule as the at-risk filter
                    // above, so the number quoted here matches why they were
                    // flagged.
                    const absences = (scholar.attendance || []).filter(
                      (a) => !a.present && scheduledEventNames.has(a.activity)
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
