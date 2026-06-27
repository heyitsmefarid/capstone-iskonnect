import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import { matchesSearch } from '../utils/filtering';
import { formatPersonName } from '../utils/nameFormat';
import {
  ClipboardCheck,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  BookOpen,
  Award,
  TrendingDown,
  TrendingUp,
  FileCheck,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export default function ScholarshipEvaluation() {
  const { applicants, updateApplicant } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const activeTab = 'overall';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Pagination states for each tab
  const [overallPage, setOverallPage] = useState(1);
  const [overallItemsPerPage, setOverallItemsPerPage] = useState(10);
  const [academicPage, setAcademicPage] = useState(1);
  const [academicItemsPerPage, setAcademicItemsPerPage] = useState(10);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceItemsPerPage, setAttendanceItemsPerPage] = useState(10);

  // Sorting states for each tab
  const [overallSort, setOverallSort] = useState({ column: 'name', direction: 'asc' });
  const [academicSort, setAcademicSort] = useState({ column: 'name', direction: 'asc' });
  const [attendanceSort, setAttendanceSort] = useState({ column: 'name', direction: 'asc' });

  // Reset pagination when filters change
  useEffect(() => {
    setOverallPage(1);
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    setAcademicPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setAttendancePage(1);
  }, [searchTerm]);

  // An approved applicant becomes a City Scholar, so 'approved' must be included
  // here (matching the Scholars List) — otherwise newly approved scholars never
  // appear for evaluation.
  const scholars = applicants.filter(a =>
    ['approved', 'active', 'on-hold', 'terminated', 'graduated'].includes(a.status)
  );

  const getAttendanceMetrics = (scholar) => {
    const attendance = scholar.attendance || [];
    const total = attendance.length;
    const present = attendance.filter(a => a.present).length;
    const absences = total - present;
    const rate = total > 0 ? (present / total) * 100 : 0;

    return { total, present, absences, rate };
  };

  const getAcademicMetrics = (scholar) => {
    const gradeRecords = scholar.grades || [];
    const allSubjects = gradeRecords.flatMap(record => record.subjects || []);
    const totalSubjects = allSubjects.length;

    const passedSubjects = allSubjects.filter((subject) => {
      const gradeValue = typeof subject.grade === 'number' ? subject.grade : Number.parseFloat(subject.grade);
      return Number.isFinite(gradeValue) && gradeValue <= 3.0;
    }).length;

    const passRate = totalSubjects > 0 ? (passedSubjects / totalSubjects) * 100 : 0;

    return { totalSubjects, passedSubjects, passRate };
  };

  // Sorting handlers
  const handleOverallSort = (column) => {
    setOverallSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleAcademicSort = (column) => {
    setAcademicSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleAttendanceSort = (column) => {
    setAttendanceSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column, currentSort }) => {
    if (currentSort.column !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    }
    return currentSort.direction === 'asc' ? 
      <ArrowUp size={14} /> : 
      <ArrowDown size={14} />;
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      approved: 'ACTIVE',
      active: 'ACTIVE',
      'on-hold': 'ON-HOLD',
      terminated: 'TERMINATED',
      graduated: 'GRADUATED',
    };
    return statusMap[status] || String(status || '').toUpperCase();
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'active' || status === 'approved') return 'approved';
    if (status === 'on-hold') return 'pending';
    if (status === 'graduated') return 'completed';
    return 'rejected';
  };

  const evaluateScholar = (scholar) => {
    const gwa = scholar.gwa || 0;
    const attendanceMetrics = getAttendanceMetrics(scholar);
    const academicMetrics = getAcademicMetrics(scholar);
    const absences = attendanceMetrics.absences;
    const semestersUsed = scholar.semestersUsed || 0;

    let recommendation = 'ACTIVE';
    let reasons = [];
    let score = 100;

    if (scholar.status === 'graduated') {
      return {
        scholar,
        recommendation: 'GRADUATED',
        reasons: ['Completed scholarship program'],
        score: 100,
        gwa,
        absences,
        semestersUsed,
        attendancePresent: attendanceMetrics.present,
        attendanceTotal: attendanceMetrics.total,
        attendanceRate: attendanceMetrics.rate,
        passedSubjects: academicMetrics.passedSubjects,
        totalSubjects: academicMetrics.totalSubjects,
        passRate: academicMetrics.passRate,
      };
    }

    if (scholar.status === 'terminated' || scholar.terminationReason) {
      return {
        scholar,
        recommendation: 'TERMINATED',
        reasons: [scholar.terminationReason || 'Contract violation'],
        score: 0,
        gwa,
        absences,
        semestersUsed,
        attendancePresent: attendanceMetrics.present,
        attendanceTotal: attendanceMetrics.total,
        attendanceRate: attendanceMetrics.rate,
        passedSubjects: academicMetrics.passedSubjects,
        totalSubjects: academicMetrics.totalSubjects,
        passRate: academicMetrics.passRate,
      };
    }

    // Academic evaluation for ON-HOLD status
    if (gwa > 2.5) {
      recommendation = 'ON-HOLD';
      reasons.push('Did not meet academic requirements (GWA > 2.5)');
      score -= 25;
    } else if (gwa <= 1.5) {
      reasons.push('Excellent GWA (≤ 1.5)');
      score += 10;
    }

    // Subject passing requirement for ON-HOLD
    if (academicMetrics.totalSubjects > 0) {
      if (academicMetrics.passRate < 75) {
        recommendation = 'ON-HOLD';
        reasons.push(`Needs academic improvement (${academicMetrics.passedSubjects}/${academicMetrics.totalSubjects})`);
        score -= 20;
      }
    }

    if (semestersUsed >= 6) {
      reasons.push('Approaching semester limit');
      score -= 10;
    }

    return {
      scholar,
      recommendation,
      reasons,
      score: Math.max(0, Math.min(100, score)),
      gwa,
      absences,
      semestersUsed,
      attendancePresent: attendanceMetrics.present,
      attendanceTotal: attendanceMetrics.total,
      attendanceRate: attendanceMetrics.rate,
      passedSubjects: academicMetrics.passedSubjects,
      totalSubjects: academicMetrics.totalSubjects,
      passRate: academicMetrics.passRate,
    };
  };

  const evaluations = scholars
    .map(evaluateScholar)
    .filter(evaluation => {
      const matchesSearchTerm = matchesSearch(
        [
          formatPersonName(evaluation.scholar),
          evaluation.scholar.scholarId,
          evaluation.scholar.email,
          evaluation.scholar.school,
        ],
        searchTerm
      );
      const matchesStatus = !filterStatus || evaluation.scholar.status === filterStatus;

      return matchesSearchTerm && matchesStatus;
    })
    .sort((a, b) => {
      const { column, direction } = overallSort;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      switch (column) {
        case 'name':
          const nameA = formatPersonName(a.scholar).toLowerCase();
          const nameB = formatPersonName(b.scholar).toLowerCase();
          return nameA.localeCompare(nameB) * multiplier;
        case 'scholarId':
          return a.scholar.scholarId.localeCompare(b.scholar.scholarId) * multiplier;
        case 'school':
          return a.scholar.school.localeCompare(b.scholar.school) * multiplier;
        case 'status':
          return (a.scholar.status || '').localeCompare(b.scholar.status || '') * multiplier;
        case 'gwa':
          return (a.gwa - b.gwa) * multiplier;
        case 'attendanceProgress':
          return (a.attendanceRate - b.attendanceRate) * multiplier;
        case 'academicProgress':
          return (a.passRate - b.passRate) * multiplier;
        case 'absences':
          return (a.absences - b.absences) * multiplier;
        case 'semesters':
          return (a.semestersUsed - b.semestersUsed) * multiplier;
        case 'score':
          return (a.score - b.score) * multiplier;
        case 'recommendation':
          return a.recommendation.localeCompare(b.recommendation) * multiplier;
        default:
          return 0;
      }
    });

  const handleEditStatus = async (scholar) => {
    const statusOptions = {
      active: 'ACTIVE',
      'on-hold': 'ON-HOLD',
      terminated: 'TERMINATED',
      graduated: 'GRADUATED',
    };

    // Treat a freshly 'approved' scholar as 'active' for the dropdown default.
    const currentStatus = scholar.status === 'approved' ? 'active' : scholar.status;

    const { value: selectedStatus } = await Swal.fire({
      title: 'Edit Scholarship Status',
      html: `
        <div class="status-dropdown-wrap">
          <label for="status-select" class="status-dropdown-label">Select status</label>
          <select id="status-select" class="status-dropdown">
            ${Object.entries(statusOptions)
              .map(([value, label]) => `<option value="${value}" ${currentStatus === value ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continue',
      confirmButtonColor: 'var(--primary)',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const selectElement = document.getElementById('status-select');
        return selectElement?.value;
      },
      customClass: {
        popup: 'eval-status-modal',
        actions: 'eval-status-actions',
      },
    });

    if (!selectedStatus) return;

    const statusLabel = statusOptions[selectedStatus] || selectedStatus.toUpperCase();

    const result = await Swal.fire({
      title: `Apply Status: ${statusLabel}?`,
      html: `
        <div style="text-align: left;">
          <p><strong>Scholar:</strong> ${formatPersonName(scholar)}</p>
          <p><strong>Current Status:</strong> ${scholar.status?.toUpperCase()}</p>
          <p><strong>Status to Apply:</strong> ${statusLabel}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: selectedStatus === 'terminated' ? 'var(--danger)' : 'var(--primary)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, apply it!',
      customClass: {
        popup: 'eval-status-modal',
        actions: 'eval-status-actions',
      },
    });

    if (result.isConfirmed) {
      const updates = {};

      if (selectedStatus === 'terminated') {
        updates.terminationDate = new Date().toISOString().split('T')[0];
        updates.terminationReason = scholar.terminationReason || 'Status updated by admin action';
      }

      updateApplicant(scholar.id, { status: selectedStatus, ...updates });

      Swal.fire({
        title: 'Applied!',
        text: `Scholarship status updated to ${statusLabel}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  const stats = {
    total: evaluations.length,
    active: evaluations.filter(e => e.recommendation === 'ACTIVE').length,
    onHold: evaluations.filter(e => e.recommendation === 'ON-HOLD').length,
    terminated: evaluations.filter(e => e.recommendation === 'TERMINATED').length,
    graduated: evaluations.filter(e => e.recommendation === 'GRADUATED').length,
  };

  // Academic tab data with sorting
  const academicScholars = scholars
    .filter(s => formatPersonName(s).toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const { column, direction } = academicSort;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      switch (column) {
        case 'name':
          const nameA = formatPersonName(a).toLowerCase();
          const nameB = formatPersonName(b).toLowerCase();
          return nameA.localeCompare(nameB) * multiplier;
        case 'school':
          return a.school.localeCompare(b.school) * multiplier;
        case 'program':
          return (a.program || '').localeCompare(b.program || '') * multiplier;
        case 'yearLevel':
          return (a.yearLevel || '').localeCompare(b.yearLevel || '') * multiplier;
        case 'gwa':
          return ((a.gwa || 0) - (b.gwa || 0)) * multiplier;
        case 'passedSubjects':
          return (getAcademicMetrics(a).passRate - getAcademicMetrics(b).passRate) * multiplier;
        case 'semesters':
          return ((a.semestersUsed || 0) - (b.semestersUsed || 0)) * multiplier;
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * multiplier;
        default:
          return 0;
      }
    });

  // Attendance tab data with sorting
  const attendanceScholars = scholars
    .filter(s => formatPersonName(s).toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const { column, direction } = attendanceSort;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      switch (column) {
        case 'name':
          const nameA = formatPersonName(a).toLowerCase();
          const nameB = formatPersonName(b).toLowerCase();
          return nameA.localeCompare(nameB) * multiplier;
        case 'school':
          return a.school.localeCompare(b.school) * multiplier;
        case 'total':
          return ((a.attendance || []).length - (b.attendance || []).length) * multiplier;
        case 'attended':
          const presentA = (a.attendance || []).filter(att => att.present).length;
          const presentB = (b.attendance || []).filter(att => att.present).length;
          return (presentA - presentB) * multiplier;
        case 'absences':
          const absencesA = (a.attendance || []).filter(att => !att.present).length;
          const absencesB = (b.attendance || []).filter(att => !att.present).length;
          return (absencesA - absencesB) * multiplier;
        case 'rate':
          const rateA = (a.attendance || []).length > 0 ? 
            ((a.attendance || []).filter(att => att.present).length / (a.attendance || []).length * 100) : 0;
          const rateB = (b.attendance || []).length > 0 ? 
            ((b.attendance || []).filter(att => att.present).length / (b.attendance || []).length * 100) : 0;
          return (rateA - rateB) * multiplier;
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * multiplier;
        default:
          return 0;
      }
    });

  return (
    <div className="page evaluation-page">
      <Header
        title="Scholarship Evaluation & Decisions"
        subtitle="Review scholar progress and update scholarship status"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Overall Evaluation Tab */}
        {activeTab === 'overall' && (
          <>
        {/* Stats */}
        <div className="stats-grid evaluation-stats-grid">
          <div className="stat-card stat-card-blue">
            <ClipboardCheck size={24} />
            <div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total for Evaluation</div>
            </div>
          </div>
          <div className="stat-card stat-card-green">
            <CheckCircle size={24} />
            <div>
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
          </div>
          <div className="stat-card stat-card-yellow">
            <AlertTriangle size={24} />
            <div>
              <div className="stat-value">{stats.onHold}</div>
              <div className="stat-label">On-Hold</div>
            </div>
          </div>
          <div className="stat-card stat-card-red">
            <XCircle size={24} />
            <div>
              <div className="stat-value">{stats.terminated}</div>
              <div className="stat-label">Terminated</div>
            </div>
          </div>
          <div className="stat-card stat-card-blue">
            <Award size={24} />
            <div>
              <div className="stat-value">{stats.graduated}</div>
              <div className="stat-label">Graduated</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search scholars..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">ACTIVE</option>
            <option value="on-hold">ON-HOLD</option>
            <option value="terminated">TERMINATED</option>
            <option value="graduated">GRADUATED</option>
          </select>
        </div>

        {/* Evaluation Table */}
        <div className="table-container evaluation-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="name-col" onClick={() => handleOverallSort('name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Scholar Name
                    <SortIcon column="name" currentSort={overallSort} />
                  </div>
                </th>
                <th className="id-col" onClick={() => handleOverallSort('scholarId')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Scholar ID
                    <SortIcon column="scholarId" currentSort={overallSort} />
                  </div>
                </th>
                <th className="school-col" onClick={() => handleOverallSort('school')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School
                    <SortIcon column="school" currentSort={overallSort} />
                  </div>
                </th>
                <th className="status-col" onClick={() => handleOverallSort('status')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Status
                    <SortIcon column="status" currentSort={overallSort} />
                  </div>
                </th>
                <th className="metric-col" onClick={() => handleOverallSort('attendanceProgress')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Attendance
                    <SortIcon column="attendanceProgress" currentSort={overallSort} />
                  </div>
                </th>
                <th className="metric-col" onClick={() => handleOverallSort('academicProgress')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Academic Records
                    <SortIcon column="academicProgress" currentSort={overallSort} />
                  </div>
                </th>
                <th className="action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {evaluations
                .slice((overallPage - 1) * overallItemsPerPage, overallPage * overallItemsPerPage)
                .map(evaluation => (
                <tr key={evaluation.scholar.id}>
                  <td className="name-col">
                    <strong>{formatPersonName(evaluation.scholar)}</strong>
                  </td>
                  <td className="id-col">
                    <code style={{ fontSize: '0.875rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                      {evaluation.scholar.scholarId}
                    </code>
                  </td>
                  <td className="school-col">{evaluation.scholar.school}</td>
                  <td className="status-col">
                    <span className={`status-badge ${getStatusBadgeClass(evaluation.scholar.status)}`}>
                      {getStatusLabel(evaluation.scholar.status)}
                    </span>
                  </td>
                  <td className="metric-col">
                    <span style={{ 
                      fontWeight: 600,
                      color: evaluation.absences > 2 ? 'var(--danger)' : 'var(--success)'
                    }}>
                      {evaluation.attendancePresent}/{evaluation.attendanceTotal}
                    </span>
                  </td>
                  <td className="metric-col">
                    <span style={{ 
                      fontWeight: 600,
                      color: evaluation.passRate < 75 ? 'var(--danger)' : 'var(--success)'
                    }}>
                      {evaluation.passedSubjects}/{evaluation.totalSubjects || 0}
                    </span>
                  </td>
                  <td className="action-col">
                    <button className="btn btn-sm btn-primary action-btn" onClick={() => handleEditStatus(evaluation.scholar)}>
                      <FileCheck size={14} />
                      Edit Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {evaluations.length === 0 && (
            <div className="empty-state">
              <ClipboardCheck size={48} />
              <p>No scholars for evaluation</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {evaluations.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((overallPage - 1) * overallItemsPerPage) + 1} to {Math.min(overallPage * overallItemsPerPage, evaluations.length)} of {evaluations.length} scholars
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setOverallPage(p => Math.max(1, p - 1))}
                disabled={overallPage === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              
              <div className="pagination-numbers">
                {[...Array(Math.ceil(evaluations.length / overallItemsPerPage))].map((_, i) => (
                  <button
                    key={i + 1}
                    className={`pagination-number ${overallPage === i + 1 ? 'active' : ''}`}
                    onClick={() => setOverallPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              
              <button
                className="pagination-btn"
                onClick={() => setOverallPage(p => Math.min(Math.ceil(evaluations.length / overallItemsPerPage), p + 1))}
                disabled={overallPage >= Math.ceil(evaluations.length / overallItemsPerPage)}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="pagination-select-container">
              <label>Items per page:</label>
              <select 
                className="pagination-select"
                value={overallItemsPerPage}
                onChange={(e) => {
                  setOverallItemsPerPage(Number(e.target.value));
                  setOverallPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}
          </>
        )}

        {/* Academic Evaluation Tab */}
        {activeTab === 'academic' && (
          <div className="tab-content">
            <div className="academic-section">
              <h2>Academic Performance Evaluation</h2>
              <p className="section-description">Review GWA and academic standing of scholars</p>
              
              {/* Search */}
              <div className="filters-bar">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search scholars..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleAcademicSort('name')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Scholar Name
                          <SortIcon column="name" currentSort={academicSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAcademicSort('school')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          School
                          <SortIcon column="school" currentSort={academicSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAcademicSort('program')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Program
                          <SortIcon column="program" currentSort={academicSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAcademicSort('yearLevel')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Year Level
                          <SortIcon column="yearLevel" currentSort={academicSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAcademicSort('gwa')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Current GWA
                          <SortIcon column="gwa" currentSort={academicSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAcademicSort('passedSubjects')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Subjects Passed
                          <SortIcon column="passedSubjects" currentSort={academicSort} />
                        </div>
                      </th>
                      <th>Academic Standing</th>
                      <th onClick={() => handleAcademicSort('semesters')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Semesters Used
                          <SortIcon column="semesters" currentSort={academicSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAcademicSort('status')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Status
                          <SortIcon column="status" currentSort={academicSort} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicScholars
                      .slice((academicPage - 1) * academicItemsPerPage, academicPage * academicItemsPerPage)
                      .map(scholar => {
                        const gwa = scholar.gwa || 0;
                        const academicMetrics = getAcademicMetrics(scholar);
                        let standing = 'Unknown';
                        let standingClass = '';
                        
                        if (gwa <= 1.5) {
                          standing = 'Excellent';
                          standingClass = 'approved';
                        } else if (gwa <= 2.0) {
                          standing = 'Very Good';
                          standingClass = 'completed';
                        } else if (gwa <= 2.5) {
                          standing = 'Good';
                          standingClass = 'pending';
                        } else if (gwa <= 3.0) {
                          standing = 'Fair';
                          standingClass = 'pending';
                        } else {
                          standing = 'Failed';
                          standingClass = 'rejected';
                        }
                        
                        return (
                          <tr key={scholar.id}>
                            <td><strong>{formatPersonName(scholar)}</strong></td>
                            <td>{scholar.school}</td>
                            <td>{scholar.program}</td>
                            <td>{scholar.yearLevel}</td>
                            <td><strong>{gwa.toFixed(2)}</strong></td>
                            <td>
                              <strong style={{ color: academicMetrics.passRate < 75 ? 'var(--danger)' : 'var(--success)' }}>
                                {academicMetrics.passedSubjects}/{academicMetrics.totalSubjects || 0}
                              </strong>
                            </td>
                            <td>
                              <span className={`status-badge ${standingClass}`}>
                                {standing}
                              </span>
                            </td>
                            <td>{scholar.semestersUsed || 0}/8</td>
                            <td>
                              <span className={`status-badge ${scholar.status}`}>
                                {scholar.status?.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {academicScholars.length > 0 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {((academicPage - 1) * academicItemsPerPage) + 1} to {Math.min(academicPage * academicItemsPerPage, academicScholars.length)} of {academicScholars.length} scholars
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => setAcademicPage(p => Math.max(1, p - 1))}
                      disabled={academicPage === 1}
                    >
                      <ChevronLeft size={18} />
                      Previous
                    </button>
                    
                    <div className="pagination-numbers">
                      {[...Array(Math.ceil(academicScholars.length / academicItemsPerPage))].map((_, i) => (
                        <button
                          key={i + 1}
                          className={`pagination-number ${academicPage === i + 1 ? 'active' : ''}`}
                          onClick={() => setAcademicPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      className="pagination-btn"
                      onClick={() => setAcademicPage(p => Math.min(Math.ceil(academicScholars.length / academicItemsPerPage), p + 1))}
                      disabled={academicPage >= Math.ceil(academicScholars.length / academicItemsPerPage)}
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="pagination-select-container">
                    <label>Items per page:</label>
                    <select 
                      className="pagination-select"
                      value={academicItemsPerPage}
                      onChange={(e) => {
                        setAcademicItemsPerPage(Number(e.target.value));
                        setAcademicPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance Evaluation Tab */}
        {activeTab === 'attendance' && (
          <div className="tab-content">
            <div className="attendance-section">
              <h2>Attendance Compliance Review</h2>
              <p className="section-description">Review attendance records and flag excessive absences</p>
              
              {/* Search */}
              <div className="filters-bar">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search scholars..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleAttendanceSort('name')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Scholar Name
                          <SortIcon column="name" currentSort={attendanceSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAttendanceSort('school')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          School
                          <SortIcon column="school" currentSort={attendanceSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAttendanceSort('total')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Attendance Progress
                          <SortIcon column="total" currentSort={attendanceSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAttendanceSort('attended')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Attended
                          <SortIcon column="attended" currentSort={attendanceSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAttendanceSort('absences')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Absences
                          <SortIcon column="absences" currentSort={attendanceSort} />
                        </div>
                      </th>
                      <th onClick={() => handleAttendanceSort('rate')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Attendance Rate
                          <SortIcon column="rate" currentSort={attendanceSort} />
                        </div>
                      </th>
                      <th>Compliance</th>
                      <th onClick={() => handleAttendanceSort('status')} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Status
                          <SortIcon column="status" currentSort={attendanceSort} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceScholars
                      .slice((attendancePage - 1) * attendanceItemsPerPage, attendancePage * attendanceItemsPerPage)
                      .map(scholar => {
                        const attendance = scholar.attendance || [];
                        const present = attendance.filter(a => a.present).length;
                        const absences = attendance.filter(a => !a.present).length;
                        const total = attendance.length;
                        const rate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
                        const isCompliant = absences <= 2;
                        
                        return (
                          <tr key={scholar.id}>
                            <td><strong>{formatPersonName(scholar)}</strong></td>
                            <td>{scholar.school}</td>
                            <td><strong>{present}/{total}</strong></td>
                            <td>{present}</td>
                            <td>
                              <strong style={{ color: absences > 2 ? 'var(--danger)' : 'var(--success)' }}>
                                {absences}
                              </strong>
                            </td>
                            <td><strong>{rate}%</strong></td>
                            <td>
                              <span className={`status-badge ${isCompliant ? 'approved' : 'pending'}`}>
                                {isCompliant ? 'Compliant' : 'Review Required'}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${scholar.status}`}>
                                {scholar.status?.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {attendanceScholars.length > 0 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {((attendancePage - 1) * attendanceItemsPerPage) + 1} to {Math.min(attendancePage * attendanceItemsPerPage, attendanceScholars.length)} of {attendanceScholars.length} scholars
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => setAttendancePage(p => Math.max(1, p - 1))}
                      disabled={attendancePage === 1}
                    >
                      <ChevronLeft size={18} />
                      Previous
                    </button>
                    
                    <div className="pagination-numbers">
                      {[...Array(Math.ceil(attendanceScholars.length / attendanceItemsPerPage))].map((_, i) => (
                        <button
                          key={i + 1}
                          className={`pagination-number ${attendancePage === i + 1 ? 'active' : ''}`}
                          onClick={() => setAttendancePage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      className="pagination-btn"
                      onClick={() => setAttendancePage(p => Math.min(Math.ceil(attendanceScholars.length / attendanceItemsPerPage), p + 1))}
                      disabled={attendancePage >= Math.ceil(attendanceScholars.length / attendanceItemsPerPage)}
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="pagination-select-container">
                    <label>Items per page:</label>
                    <select 
                      className="pagination-select"
                      value={attendanceItemsPerPage}
                      onChange={(e) => {
                        setAttendanceItemsPerPage(Number(e.target.value));
                        setAttendancePage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .evaluation-page {
          background: var(--bg-secondary);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .evaluation-stats-grid .stat-card {
          min-height: 108px;
          border-radius: 0.75rem;
        }

        .filters-bar {
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
        }

        .search-box {
          width: 100%;
          max-width: 420px;
        }

        .stat-card {
          background: var(--card-bg);
          padding: 1.5rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-card svg {
          color: var(--primary-color);
        }

        .stat-card-blue svg {
          color: var(--primary);
        }

        .stat-card-green svg {
          color: var(--success);
        }

        .stat-card-yellow svg {
          color: #eab308;
        }

        .stat-card-red svg {
          color: var(--danger);
        }

        .stat-value {
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .table-container {
          background: var(--card-bg);
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
          overflow-x: auto;
          margin-bottom: 1.5rem;
        }

        .evaluation-table-wrap {
          border-radius: 0.9rem;
        }

        .table-container .data-table {
          width: 100%;
        }

        .evaluation-page .data-table th,
        .evaluation-page .data-table td {
          vertical-align: middle;
        }

        .evaluation-page .data-table tbody tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.01);
        }

        .name-col {
          min-width: 210px;
        }

        .id-col {
          min-width: 130px;
          text-align: center;
        }

        .school-col {
          min-width: 200px;
        }

        .status-col {
          min-width: 145px;
          text-align: center;
          white-space: nowrap;
        }

        .evaluation-page .data-table th.id-col div {
          justify-content: center;
        }

        .evaluation-page .data-table th.status-col div {
          justify-content: center;
        }

        .data-table th[style*="cursor: pointer"]:hover {
          background: var(--hover-bg);
        }

        .data-table th[style*="cursor: pointer"] {
          user-select: none;
          transition: background 0.2s;
        }

        .data-table th div {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 0.5rem;
          white-space: nowrap;
        }

        .metric-col {
          text-align: center;
          white-space: nowrap;
        }

        .data-table th.metric-col div {
          justify-content: center;
        }

        .action-col {
          text-align: center;
          width: 160px;
          white-space: nowrap;
        }

        .action-btn {
          min-width: 124px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          border-radius: 999px;
        }

        :global(.swal2-popup.eval-status-modal) {
          width: 460px !important;
          border-radius: 16px !important;
          padding: 1.6rem 1.4rem 1.2rem !important;
        }

        :global(.swal2-popup.eval-status-modal .swal2-title) {
          font-size: 1.9rem;
          margin-bottom: 0.9rem !important;
        }

        :global(.swal2-popup.eval-status-modal .status-dropdown-wrap) {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-top: 0.2rem;
          text-align: left;
        }

        :global(.swal2-popup.eval-status-modal .status-dropdown-label) {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.01em;
        }

        :global(.swal2-popup.eval-status-modal .status-dropdown) {
          width: 100% !important;
          min-height: 46px;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 0.95rem;
          background: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
          border: 1px solid var(--border-color) !important;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--text-secondary) 50%), linear-gradient(135deg, var(--text-secondary) 50%, transparent 50%);
          background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          color-scheme: dark;
        }

        :global(.swal2-popup.eval-status-modal .status-dropdown:focus) {
          outline: none;
          border-color: var(--primary-color) !important;
          box-shadow: 0 0 0 3px rgba(45, 149, 150, 0.2) !important;
        }

        :global(.swal2-popup.eval-status-modal .status-dropdown option) {
          background: var(--card-bg);
          color: var(--text-primary);
        }

        :global(.swal2-actions.eval-status-actions) {
          width: 100%;
          justify-content: center;
          gap: 10px;
        }

        :global(.swal2-actions.eval-status-actions .swal2-confirm),
        :global(.swal2-actions.eval-status-actions .swal2-cancel) {
          min-width: 92px;
          border-radius: 10px !important;
        }

        .academic-section,
        .attendance-section {
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
        }

        .academic-section h2,
        .attendance-section h2 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .section-description {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }
      `}</style>
    </div>
  );
}
