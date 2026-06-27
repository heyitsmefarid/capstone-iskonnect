import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import { matchesExact, matchesSearch } from '../utils/filtering';
import { formatPersonName } from '../utils/nameFormat';
import {
  Calendar,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  Users,
  X,
  UserCheck,
  History,
  Eye,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

export default function Attendance() {
  const { applicants, schools, activities, addActivity, updateActivity, deleteActivity, updateApplicant } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showScholarDetailsModal, setShowScholarDetailsModal] = useState(false);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [activityForm, setActivityForm] = useState({ name: '', date: '', required: true });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [showActivitiesSection, setShowActivitiesSection] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ column: 'scholar', direction: 'asc' });

  // Get scholars (active, on-hold, graduated) - not applicants
  const scholars = applicants.filter(a => ['active', 'on-hold', 'graduated'].includes(a.status));

  const filteredApplicants = scholars.filter(applicant => {
    const matchesSearchTerm = matchesSearch(
      [
        formatPersonName(applicant),
        applicant.email,
        applicant.school,
        applicant.program,
      ],
      searchTerm
    );
    const matchesSchool = matchesExact(applicant.school, filterSchool);
    // St. Augustine students are exempt from attendance
    const isStAugustine = applicant.school === 'St. Augustine Academy';
    return matchesSearchTerm && matchesSchool && !isStAugustine;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSchool]);

  const handleSort = (column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.column !== column) return <ArrowUpDown size={14} style={{ opacity: 0.35 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const getAbsenceCount = (applicant) => {
    if (!applicant.attendance) return 0;
    return activities.filter(act => {
      const attended = applicant.attendance.find(a => a.activity === act.name);
      return act.required && (!attended || !attended.present);
    }).length;
  };

  const handleSaveActivity = () => {
    if (selectedActivity) {
      updateActivity(selectedActivity.id, activityForm);
      Swal.fire({
        title: 'Updated!',
        text: `${activityForm.name} has been updated.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      addActivity(activityForm);
      Swal.fire({
        title: 'Added!',
        text: `${activityForm.name} has been added successfully.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
    setShowActivityModal(false);
    setActivityForm({ name: '', date: '', required: true });
    setSelectedActivity(null);
  };

  const handleEditActivity = (activity) => {
    setSelectedActivity(activity);
    setActivityForm({ name: activity.name, date: activity.date, required: activity.required });
    setShowActivityModal(true);
  };

  const handleDeleteActivity = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Activity?',
      text: 'All attendance records for this activity will be lost!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      deleteActivity(id);
      Swal.fire({
        title: 'Deleted!',
        text: 'Activity has been deleted.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  const openAttendanceModal = (activity) => {
    setSelectedActivity(activity);
    setShowAttendanceModal(true);
  };

  const handleMarkAttendance = (applicant, activity, present) => {
    const existingAttendance = applicant.attendance || [];
    const existingRecord = existingAttendance.findIndex(a => a.activity === activity.name);
    const now = new Date();
    const timeStamp = format(now, 'yyyy-MM-dd HH:mm:ss');
    
    let updatedAttendance;
    const attendanceRecord = { 
      activity: activity.name, 
      date: activity.date, 
      present,
      timeLogged: timeStamp,
      loggedVia: 'Manual'
    };

    if (existingRecord >= 0) {
      updatedAttendance = existingAttendance.map((a, i) => 
        i === existingRecord ? attendanceRecord : a
      );
    } else {
      updatedAttendance = [...existingAttendance, attendanceRecord];
    }

    // Calculate absence count after this update
    let absenceCount = 0;
    activities.forEach(act => {
      if (act.required) {
        const attendanceForActivity = updatedAttendance.find(a => a.activity === act.name);
        if (!attendanceForActivity || !attendanceForActivity.present) {
          absenceCount++;
        }
      }
    });

    // Check if scholar should be terminated (more than 2 absences)
    let updatedStatus = applicant.status;
    if (absenceCount > 2 && (applicant.status === 'active' || applicant.status === 'approved')) {
      updatedStatus = 'terminated';
      
      // Show termination alert
      setTimeout(() => {
        Swal.fire({
          title: 'Scholar Terminated',
          html: `<strong>${formatPersonName(applicant)}</strong> has been automatically terminated due to exceeding the maximum allowed absences.<br><br><strong>Total Absences: ${absenceCount}</strong><br>Maximum Allowed: 2`,
          icon: 'error',
          confirmButtonColor: '#ef4444',
        });
      }, 300);
    }

    updateApplicant(applicant.id, { 
      attendance: updatedAttendance,
      status: updatedStatus
    });

    // Log the attendance action
    const logEntry = {
      id: Date.now(),
      applicantId: applicant.id,
      applicantName: formatPersonName(applicant),
      school: applicant.school,
      activity: activity.name,
      status: present ? 'Present' : 'Absent',
      timestamp: timeStamp,
      method: viaQR ? 'QR Scan' : 'Manual Entry'
    };

    setAttendanceLogs(prev => [logEntry, ...prev]);

    return logEntry;
  };

  const getAttendanceForActivity = (applicant, activityName) => {
    if (!applicant.attendance) return null;
    return applicant.attendance.find(a => a.activity === activityName);
  };

  const getAttendanceStats = (applicant) => {
    const att = applicant.attendance || [];
    const attended = att.filter(a => a.present).length;
    // Total counts admin-defined activities plus any recorded events (e.g. QR
    // scans) that aren't tied to a defined activity.
    const activityNames = new Set(activities.map(a => a.name));
    const extraEvents = att.filter(a => a.activity && !activityNames.has(a.activity)).length;
    return { attended, total: activities.length + extraEvents };
  };

  // Builds the rows shown in the Attendance Details modal: every admin-defined
  // activity, plus any recorded event (QR scan) that isn't a defined activity.
  const getScholarAttendanceRows = (scholar) => {
    const att = scholar.attendance || [];
    const activityNames = new Set(activities.map(a => a.name));
    const definedRows = activities.map((act) => ({
      key: `act-${act.id}`,
      name: act.name,
      date: act.date,
      record: att.find(a => a.activity === act.name) || null,
    }));
    const scannedRows = att
      .filter(a => a.activity && !activityNames.has(a.activity))
      .map((a, i) => ({
        key: `evt-${i}-${a.activity}`,
        name: a.activity,
        date: a.date || a.attendedAt || a.createdAt || null,
        record: a,
      }));
    return [...definedRows, ...scannedRows];
  };

  const sortedApplicants = [...filteredApplicants].sort((a, b) => {
    const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
    switch (sortConfig.column) {
      case 'scholar':
        return formatPersonName(a).localeCompare(formatPersonName(b)) * multiplier;
      case 'school':
        return (a.school || '').localeCompare(b.school || '') * multiplier;
      case 'program':
        return (a.program || '').localeCompare(b.program || '') * multiplier;
      case 'attendance': {
        const statsA = getAttendanceStats(a);
        const statsB = getAttendanceStats(b);
        const rateA = statsA.total > 0 ? statsA.attended / statsA.total : 0;
        const rateB = statsB.total > 0 ? statsB.attended / statsB.total : 0;
        return (rateA - rateB) * multiplier;
      }
      case 'absences':
        return (getAbsenceCount(a) - getAbsenceCount(b)) * multiplier;
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedApplicants.length / itemsPerPage);
  const paginatedApplicants = sortedApplicants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const viewScholarDetails = (applicant) => {
    setSelectedScholar(applicant);
    setShowScholarDetailsModal(true);
  };

  // Stats
  const excessiveAbsences = filteredApplicants.filter(a => getAbsenceCount(a) === 2).length;
  const overTwoAbsences = filteredApplicants.filter(a => getAbsenceCount(a) > 2).length;
  const todayLogs = attendanceLogs.filter(log => 
    log.timestamp.startsWith(format(new Date(), 'yyyy-MM-dd'))
  );

  return (
    <div className="page attendance-page">
      <Header 
        title="Attendance & Activity Management" 
        subtitle="Track scholar attendance and manage activities"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Stats */}
        <div className="attendance-stats">
          <div className="stat-card stat-card-blue">
            <div className="stat-icon">
              <Calendar size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{activities.length}</span>
              <span className="stat-label">Total Activities</span>
            </div>
          </div>
          <div className="stat-card stat-card-green">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{scholars.length}</span>
              <span className="stat-label">Active Scholars</span>
            </div>
          </div>
          <div className="stat-card stat-card-yellow">
            <div className="stat-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{excessiveAbsences}</span>
              <span className="stat-label">At Risk (2 Absences)</span>
            </div>
          </div>
          <div className="stat-card stat-card-purple">
            <div className="stat-icon">
              <UserCheck size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{overTwoAbsences}</span>
              <span className="stat-label">More than 2 Absences</span>
            </div>
          </div>
        </div>



        {/* Scholars Attendance Records */}
        <div className="section-card">
          <div className="section-header">
            <h3>Scholar Attendance Records</h3>
            <div className="actions-left">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search scholars..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
              >
                <option value="">All Schools</option>
                {schools.filter(s => s.name !== 'St. Augustine Academy').map(school => (
                  <option key={school.id} value={school.name}>{school.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('scholar')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Scholar <SortIcon column="scholar" /></div></th>
                  <th onClick={() => handleSort('school')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>School <SortIcon column="school" /></div></th>
                  <th onClick={() => handleSort('program')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Program <SortIcon column="program" /></div></th>
                  <th onClick={() => handleSort('attendance')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Attendance <SortIcon column="attendance" /></div></th>
                  <th onClick={() => handleSort('absences')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Absences <SortIcon column="absences" /></div></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedApplicants.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                      <Users size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                      <p>No scholars found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedApplicants.map(applicant => {
                    const absences = getAbsenceCount(applicant);
                    const stats = getAttendanceStats(applicant);
                    const isTerminated = absences > 2;
                    const isWarning = absences === 2;
                    
                    return (
                      <tr key={applicant.id} className={isTerminated ? 'row-danger' : isWarning ? 'row-warning' : ''}>
                        <td>
                          <div className="applicant-cell">
                            <div className="applicant-avatar">
                              {applicant.firstName[0]}{applicant.lastName[0]}
                            </div>
                            <div>
                              <div className="applicant-name">
                                {formatPersonName(applicant)}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {applicant.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{applicant.school}</td>
                        <td>{applicant.program}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: stats.attended === stats.total ? '#10b981' : stats.attended / stats.total >= 0.75 ? '#3b82f6' : 'var(--warning)'
                            }}>
                              {stats.attended}/{stats.total}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              ({stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0}%)
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`absence-count ${isTerminated ? 'danger' : isWarning ? 'warning' : ''}`}>
                            {absences}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => viewScholarDetails(applicant)}
                          >
                            <Eye size={14} /> View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {sortedApplicants.length > 0 && (
            <div className="pagination-container" style={{ marginTop: '1rem' }}>
              <div className="pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedApplicants.length)} of {sortedApplicants.length} scholars
              </div>
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft size={18} /> Previous
                </button>
                <div className="pagination-numbers">
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i + 1} className={`pagination-number ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(i + 1)}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                  Next <ChevronRight size={18} />
                </button>
              </div>
              <div className="pagination-select-container">
                <label>Items per page:</label>
                <select className="pagination-select" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <div className="info-note">
              <AlertTriangle size={16} />
              <span>Note: St. Augustine Academy scholars are exempt from attendance requirements.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedActivity ? 'Edit Activity' : 'Add Activity'}</h2>
              <button className="modal-close" onClick={() => setShowActivityModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Activity Name</label>
                <input
                  type="text"
                  value={activityForm.name}
                  onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                  placeholder="e.g., Orientation Seminar"
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={activityForm.date}
                  onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activityForm.required}
                    onChange={(e) => setActivityForm({ ...activityForm, required: e.target.checked })}
                  />
                  <span className="checkbox-custom"><CheckCircle size={14} /></span>
                  Required Activity
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowActivityModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveActivity}>
                <Save size={16} />
                {selectedActivity ? 'Update' : 'Add'} Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedActivity && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance - {selectedActivity.name}</h2>
              <button className="modal-close" onClick={() => setShowAttendanceModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="attendance-list">
                {filteredApplicants.map(applicant => {
                  const attendance = getAttendanceForActivity(applicant, selectedActivity.name);
                  
                  return (
                    <div key={applicant.id} className="attendance-row">
                      <div className="applicant-info">
                        <div className="applicant-avatar">
                          {applicant.firstName[0]}{applicant.lastName[0]}
                        </div>
                        <div className="applicant-details">
                          <span className="applicant-name">
                            {formatPersonName(applicant)}
                          </span>
                          <span className="applicant-school">{applicant.school}</span>
                        </div>
                      </div>
                      <div className="attendance-buttons">
                        <button
                          className={`attendance-btn present ${attendance?.present === true ? 'active' : ''}`}
                          onClick={() => handleMarkAttendance(applicant, selectedActivity, true)}
                        >
                          <CheckCircle size={16} /> Present
                        </button>
                        <button
                          className={`attendance-btn absent ${attendance?.present === false ? 'active' : ''}`}
                          onClick={() => handleMarkAttendance(applicant, selectedActivity, false)}
                        >
                          <XCircle size={16} /> Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowAttendanceModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Logs Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
          <div className="modal logs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <History size={24} />
                Attendance System Logs
              </h2>
              <button className="modal-close" onClick={() => setShowLogsModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="logs-stats">
                <div className="log-stat">
                  <UserCheck size={20} />
                  <div>
                    <span className="stat-value">{attendanceLogs.length}</span>
                    <span className="stat-label">Total Logs</span>
                  </div>
                </div>
                <div className="log-stat">
                  <Calendar size={20} />
                  <div>
                    <span className="stat-value">{todayLogs.length}</span>
                    <span className="stat-label">Today's Logs</span>
                  </div>
                </div>
                <div className="log-stat">
                  <Users size={20} />
                  <div>
                    <span className="stat-value">
                      {new Set(attendanceLogs.map(l => l.studentId)).size}
                    </span>
                    <span className="stat-label">Unique Students</span>
                  </div>
                </div>
              </div>

              <div className="logs-table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Student</th>
                      <th>School</th>
                      <th>Activity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                          <History size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                          <p>No attendance logs yet</p>
                        </td>
                      </tr>
                    ) : (
                      attendanceLogs.map(log => (
                        <tr key={log.id}>
                          <td>
                            <div className="log-timestamp">
                              <Calendar size={14} />
                              {log.timestamp}
                            </div>
                          </td>
                          <td>
                            <strong>{log.applicantName}</strong>
                          </td>
                          <td>{log.school}</td>
                          <td>{log.activity}</td>
                          <td>
                            <span className={`status-badge ${log.status === 'Present' ? 'status-approved' : 'status-rejected'}`}>
                              {log.status === 'Present' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={async () => {
                  const result = await Swal.fire({
                    title: 'Clear All Logs?',
                    text: 'This will permanently delete all attendance logs!',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Yes, clear all!',
                    cancelButtonText: 'Cancel'
                  });

                  if (result.isConfirmed) {
                    setAttendanceLogs([]);
                    Swal.fire({
                      title: 'Cleared!',
                      text: 'All logs have been deleted.',
                      icon: 'success',
                      timer: 2000,
                      showConfirmButton: false
                    });
                  }
                }}
              >
                Clear Logs
              </button>
              <button className="btn btn-primary" onClick={() => setShowLogsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scholar Details Modal */}
      {showScholarDetailsModal && selectedScholar && (
        <div className="modal-overlay" onClick={() => setShowScholarDetailsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <UserCheck size={24} />
                Attendance Details - {formatPersonName(selectedScholar)}
              </h2>
              <button className="modal-close" onClick={() => setShowScholarDetailsModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Scholar Info */}
              <div style={{ 
                background: 'rgba(45, 149, 150, 0.1)', 
                padding: '1rem', 
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
                border: '1px solid rgba(45, 149, 150, 0.2)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>School</div>
                    <div style={{ fontWeight: 600 }}>{selectedScholar.school}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Program</div>
                    <div style={{ fontWeight: 600 }}>{selectedScholar.program}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email</div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedScholar.email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Attendance Rate</div>
                    <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#10b981' }}>
                      {getAttendanceStats(selectedScholar).attended}/{getAttendanceStats(selectedScholar).total}
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        ({getAttendanceStats(selectedScholar).total > 0 
                          ? Math.round((getAttendanceStats(selectedScholar).attended / getAttendanceStats(selectedScholar).total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Records */}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Activity Attendance Records
              </h3>

              {(() => {
                const rows = getScholarAttendanceRows(selectedScholar);
                if (rows.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>No activities recorded yet</p>
                    </div>
                  );
                }
                const formatRowDate = (value) => {
                  if (!value) return '—';
                  const d = new Date(value);
                  return Number.isNaN(d.getTime()) ? '—' : format(d, 'MMM d, yyyy');
                };
                return (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Time Logged</th>
                          <th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => {
                          const attendance = row.record;
                          return (
                            <tr key={row.key} className={attendance?.present ? '' : 'row-warning'}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Calendar size={16} />
                                  <strong>{row.name}</strong>
                                </div>
                              </td>
                              <td>{formatRowDate(row.date)}</td>
                              <td>
                                {attendance ? (
                                  attendance.present ? (
                                    <span className="status-badge status-approved">
                                      <CheckCircle size={14} /> Present
                                    </span>
                                  ) : (
                                    <span className="status-badge status-rejected">
                                      <XCircle size={14} /> Absent
                                    </span>
                                  )
                                ) : (
                                  <span className="status-badge" style={{ background: 'rgba(100, 116, 139, 0.1)', color: 'var(--secondary)' }}>
                                    <AlertTriangle size={14} /> Not Recorded
                                  </span>
                                )}
                              </td>
                              <td>
                                {attendance ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    <Clock size={14} />
                                    {attendance.timeLogged || (attendance.date ? format(new Date(attendance.date), 'h:mm a') : 'N/A')}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                )}
                              </td>
                              <td>
                                {attendance ? (
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    background: 'rgba(45, 149, 150, 0.1)',
                                    color: 'var(--primary)',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                  }}>
                                    {attendance.loggedVia || (attendance.markedVia === 'qr_scanner' ? 'QR Scan' : attendance.markedVia) || 'Manual'}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Summary */}
              <div style={{ 
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Present</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                      {selectedScholar.attendance?.filter(a => a.present).length || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Absent</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                      {getAbsenceCount(selectedScholar)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Activities</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {activities.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowScholarDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
