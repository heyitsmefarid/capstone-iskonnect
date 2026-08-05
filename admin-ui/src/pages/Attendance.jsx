import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
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
  Save,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { canEdit } from '../utils/auth';

export default function Attendance() {
  const { applicants, catalogSchools, schoolYears, events, addEvent, updateEvent, deleteEvent, updateApplicant } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  // Viewer role: read-only on this page — every add/edit/delete control below
  // is gated behind this.
  const editAllowed = canEdit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showScholarDetailsModal, setShowScholarDetailsModal] = useState(false);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [eventForm, setEventForm] = useState({ name: '', date: '', startTime: '', endTime: '', schoolYear: '', semester: '' });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ column: 'scholar', direction: 'asc' });
  // Which term the Attendance Details modal is showing — defaults to the
  // active term (see viewScholarDetails) and reset each time it's reopened.
  // null means "All Terms" (full history).
  const [detailsTerm, setDetailsTerm] = useState(null);

  // The currently active School Year + Semester (configured in School Year
  // Management) — used to default a newly-created event to the current term.
  const activeTerm = (() => {
    for (const sy of schoolYears) {
      const activeSem = (sy.semesters || []).find(s => s.isActive);
      if (sy.isActive && activeSem) return { schoolYear: sy.label, semester: activeSem.name };
    }
    return null;
  })();

  // Every configured term (school year + semester), most recent first — for
  // the Attendance Details modal's term picker, so the admin can look up any
  // past semester's records instead of only ever seeing the current one.
  const termOptions = schoolYears
    .flatMap((sy) => (sy.semesters || []).map((sem) => ({
      schoolYear: sy.label,
      semester: sem.name,
      order: sem.order,
      startYear: sy.startYear,
      isActive: !!sy.isActive && !!sem.isActive,
    })))
    .sort((a, b) => (b.startYear - a.startYear) || (b.order - a.order));

  // Get scholars (active, on-hold, graduated) - not applicants
  const scholars = applicants.filter(a => ['active', 'on-hold', 'graduated'].includes(a.status));

  // School filter options: the eligible-schools catalog (managed in System
  // Settings) PLUS any school that actually appears on a scholar record
  // (covers schools not in the catalog).
  const schoolFilterOptions = Array.from(new Set([
    ...(catalogSchools || []).map(s => s?.name).filter(Boolean),
    ...scholars.map(s => s?.school).filter(Boolean),
  ]))
    .sort((a, b) => a.localeCompare(b));

  // St. Augustine Seminary students are exempt from attendance requirements
  // (matches student_model.dart's isStAugustine on the scholar app — the
  // school name has to match exactly what scholars actually register under,
  // not a different/legacy catalog name).
  const isExemptFromAttendance = (applicant) => applicant?.school === 'St. Augustine Seminary';

  // Search/school-matched scholars, including exempt ones — the main table
  // still shows them, just marked "Exempted" instead of a real count.
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
    return matchesSearchTerm && matchesSchool;
  });

  // Scholars actually eligible to have attendance marked/counted (excludes
  // exempt scholars) — used for the per-event marking modal and the
  // absence-based stat counters, which don't apply to exempt scholars.
  const attendanceEligibleApplicants = filteredApplicants.filter(a => !isExemptFromAttendance(a));

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

  // An event only counts toward absence once its end time has actually
  // passed — a scholar shouldn't be marked absent for an event that's still
  // upcoming or currently in progress. Events saved before this feature (or
  // left blank) fall back to end-of-day, so they still need the full day to
  // pass rather than counting absent the instant they're created.
  const hasEventEnded = (event) => {
    if (!event?.date) return false;
    const endDateTime = new Date(`${event.date}T${event.endTime || '23:59'}:00`);
    if (Number.isNaN(endDateTime.getTime())) return false;
    return Date.now() > endDateTime.getTime();
  };

  // Only events scheduled for the given term count toward absences — an
  // absence from a semester that has already ended shouldn't keep counting
  // (or trigger termination) once a new term has started. Defaults to the
  // active term (every call site outside the Attendance Details modal wants
  // that); the modal passes a specific past term, or `null` for full history.
  const getAbsenceCount = (applicant, term = activeTerm) => {
    const termEvents = term
      ? events.filter((e) => e.schoolYear === term.schoolYear && e.semester === term.semester)
      : events;
    return termEvents.filter(event => {
      if (!hasEventEnded(event)) return false;
      const attended = (applicant.attendance || []).find(a => a.activity === event.name);
      return !attended || !attended.present;
    }).length;
  };

  const openAddEventModal = () => {
    setSelectedEvent(null);
    setEventForm({
      name: '',
      date: '',
      startTime: '',
      endTime: '',
      schoolYear: activeTerm?.schoolYear || '',
      semester: activeTerm?.semester || '',
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    try {
      // Every scheduled event is mandatory — always saved as required.
      const payload = { ...eventForm, required: true };
      if (selectedEvent) {
        await updateEvent(selectedEvent.firestoreId, payload);
        Swal.fire({
          title: 'Updated!',
          text: `${eventForm.name} has been updated.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await addEvent(payload);
        Swal.fire({
          title: 'Added!',
          text: `${eventForm.name} has been added successfully.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
      setShowEventModal(false);
      setEventForm({ name: '', date: '', startTime: '', endTime: '', schoolYear: '', semester: '' });
      setSelectedEvent(null);
    } catch (error) {
      Swal.fire({
        title: 'Save failed',
        text: error?.message || 'Could not save the event.',
        icon: 'error',
      });
    }
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setEventForm({
      name: event.name,
      date: event.date,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      schoolYear: event.schoolYear || '',
      semester: event.semester || '',
    });
    setShowEventModal(true);
  };

  const handleDeleteEvent = async (firestoreId) => {
    const result = await Swal.fire({
      title: 'Delete Event?',
      text: 'All attendance records for this event will be lost!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await deleteEvent(firestoreId);
        Swal.fire({
          title: 'Deleted!',
          text: 'Event has been deleted.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          title: 'Delete failed',
          text: error?.message || 'Could not delete the event.',
          icon: 'error',
        });
      }
    }
  };

  const openAttendanceModal = (event) => {
    setSelectedEvent(event);
    setShowAttendanceModal(true);
  };

  const handleMarkAttendance = (applicant, event, present) => {
    const existingAttendance = applicant.attendance || [];
    const existingRecord = existingAttendance.findIndex(a => a.activity === event.name);
    const now = new Date();
    const timeStamp = format(now, 'yyyy-MM-dd HH:mm:ss');

    let updatedAttendance;
    const attendanceRecord = {
      activity: event.name,
      date: event.date,
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

    // Calculate absence count after this update — only events in the
    // currently active term count (see getAbsenceCount above).
    let absenceCount = 0;
    const termEvents = activeTerm
      ? events.filter((e) => e.schoolYear === activeTerm.schoolYear && e.semester === activeTerm.semester)
      : [];
    termEvents.forEach(evt => {
      if (!hasEventEnded(evt)) return;
      const attendanceForEvent = updatedAttendance.find(a => a.activity === evt.name);
      if (!attendanceForEvent || !attendanceForEvent.present) {
        absenceCount++;
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

    // Log the attendance action. This function only handles the admin's
    // manual Present/Absent marking (QR-scanned attendance is written
    // directly to Firestore by the QR scanner app, not through here).
    const logEntry = {
      id: Date.now(),
      applicantId: applicant.id,
      applicantName: formatPersonName(applicant),
      school: applicant.school,
      activity: event.name,
      status: present ? 'Present' : 'Absent',
      timestamp: timeStamp,
      method: 'Manual Entry'
    };

    setAttendanceLogs(prev => [logEntry, ...prev]);

    return logEntry;
  };

  const getAttendanceForEvent = (applicant, eventName) => {
    if (!applicant.attendance) return null;
    return applicant.attendance.find(a => a.activity === eventName);
  };

  // Attendance is counted against events for the given term (defaults to the
  // active term, so a new semester starts every scholar back at a clean
  // 0/0 instead of carrying forward a ratio built up over past semesters —
  // full history is still available via the Attendance Details modal's term
  // picker, or by passing `null` here for "All Terms").
  //
  // Within a term, this is further restricted to events that currently exist.
  // This previously added an "extra events" term for any record whose activity
  // matched no scheduled event, on the assumption those were QR scans outside
  // the schedule. They cannot be: the QR scanner reads this same `events`
  // collection, refuses to scan without a selected event, and cannot create
  // ad-hoc ones. So a record with no matching event is always left over from a
  // deleted event — and counting it made deleted events reappear in scholars'
  // totals (a "0/3" with no events on the page at all).
  //
  // deleteEvent now clears those records as it deletes, but ignoring them here
  // also corrects records orphaned before that fix, without deleting anything.
  const getAttendanceStats = (applicant, term = activeTerm) => {
    const att = applicant.attendance || [];
    const termEvents = term
      ? events.filter((e) => e.schoolYear === term.schoolYear && e.semester === term.semester)
      : events;
    const eventNames = new Set(termEvents.map(e => e.name));
    const attended = att.filter(a => a.present && eventNames.has(a.activity)).length;
    return { attended, total: termEvents.length };
  };

  // Rows for the Attendance Details modal: one per scheduled event in the
  // given term (`null` = every term on file, for browsing full history).
  // Orphaned records are omitted for the same reason they are not counted.
  const getScholarAttendanceRows = (scholar, term) => {
    const att = scholar.attendance || [];
    const termEvents = term
      ? events.filter((e) => e.schoolYear === term.schoolYear && e.semester === term.semester)
      : events;
    return termEvents.map((event) => ({
      key: `evt-${event.firestoreId}`,
      name: event.name,
      date: event.date,
      endTime: event.endTime,
      schoolYear: event.schoolYear,
      semester: event.semester,
      record: att.find(a => a.activity === event.name) || null,
    }));
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

  // Exports the currently filtered/sorted attendance records (not just the
  // current page) for the active term to an Excel report.
  const handleExportAttendance = () => {
    if (sortedApplicants.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Nothing to export',
        text: 'No scholars match the current search/filter.',
      });
      return;
    }

    const rows = sortedApplicants.map((applicant) => {
      if (isExemptFromAttendance(applicant)) {
        return {
          'Scholar ID': applicant.scholarId || '',
          'Name': formatPersonName(applicant),
          'Email': applicant.email || '',
          'School': applicant.school || '',
          'Program': applicant.program || '',
          'Present': '—',
          'Total Events': '—',
          'Attendance Rate': '—',
          'Absences': '—',
          'Status': 'Exempted',
        };
      }
      const stats = getAttendanceStats(applicant);
      const absences = getAbsenceCount(applicant);
      return {
        'Scholar ID': applicant.scholarId || '',
        'Name': formatPersonName(applicant),
        'Email': applicant.email || '',
        'School': applicant.school || '',
        'Program': applicant.program || '',
        'Present': stats.attended,
        'Total Events': stats.total,
        'Attendance Rate': stats.total > 0 ? `${Math.round((stats.attended / stats.total) * 100)}%` : '—',
        'Absences': absences,
        'Status': absences > 2 ? 'Exceeded Limit' : absences === 2 ? 'Warning' : 'Good Standing',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const termLabel = activeTerm
      ? `${activeTerm.semester}_${activeTerm.schoolYear}`.replace(/\s+/g, '_')
      : 'attendance';
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `attendance_report_${termLabel}.xlsx`
    );
  };

  const viewScholarDetails = (applicant) => {
    setSelectedScholar(applicant);
    setDetailsTerm(activeTerm);
    setShowScholarDetailsModal(true);
  };

  // Stats
  const excessiveAbsences = attendanceEligibleApplicants.filter(a => getAbsenceCount(a) === 2).length;
  const overTwoAbsences = attendanceEligibleApplicants.filter(a => getAbsenceCount(a) > 2).length;
  const todayLogs = attendanceLogs.filter(log => 
    log.timestamp.startsWith(format(new Date(), 'yyyy-MM-dd'))
  );

  return (
    <div className="page attendance-page">
      <Header
        title="Attendance & Event Management"
        subtitle="Schedule events and track scholar attendance"
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
              <span className="stat-value">{events.length}</span>
              <span className="stat-label">Total Events</span>
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

        {/* Scheduled Events */}
        <div className="section-card">
          <div className="section-header">
            <h3>Scheduled Events</h3>
            {editAllowed && (
              <div className="actions-left">
                <button className="btn btn-sm btn-primary" onClick={openAddEventModal}>
                  <Plus size={16} /> Add Event
                </button>
              </div>
            )}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Date</th>
                  <th>School Year</th>
                  <th>Semester</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                      <Calendar size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                      <p>No events scheduled yet</p>
                    </td>
                  </tr>
                ) : (
                  events.map(event => (
                    <tr key={event.firestoreId}>
                      <td><strong>{event.name}</strong></td>
                      <td>{event.date}</td>
                      <td>{event.schoolYear || '—'}</td>
                      <td>{event.semester || '—'}</td>
                      <td>
                        {editAllowed ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              title="Mark attendance for this event"
                              onClick={() => openAttendanceModal(event)}
                            >
                              <UserCheck size={14} /> Mark Attendance
                            </button>
                            <button
                              className="btn btn-sm"
                              title="Edit event"
                              onClick={() => handleEditEvent(event)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              title="Delete event"
                              onClick={() => handleDeleteEvent(event.firestoreId)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scholars Attendance Records */}
        <div className="section-card">
          <div className="section-header">
            <h3>Scholar Attendance Records</h3>
            <div className="actions-left">
              <div className="filters-grid" style={{ gridTemplateColumns: 'minmax(240px, 1.2fr) minmax(160px, 1fr) auto' }}>
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
                  {schoolFilterOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={handleExportAttendance}>
                  <Download size={16} /> Export
                </button>
              </div>
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
                    const isExempt = isExemptFromAttendance(applicant);
                    const absences = getAbsenceCount(applicant);
                    const stats = getAttendanceStats(applicant);
                    const isTerminated = !isExempt && absences > 2;
                    const isWarning = !isExempt && absences === 2;

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
                        {isExempt ? (
                          <td colSpan={2}>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                            }}>
                              Exempted
                            </span>
                          </td>
                        ) : (
                          <>
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
                          </>
                        )}
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
              <span>Note: St. Augustine Seminary scholars are exempt from attendance requirements — they're shown above marked "Exempted" rather than counted.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent ? 'Edit Event' : 'Add Event'}</h2>
              <button className="modal-close" onClick={() => setShowEventModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="e.g., Orientation Seminar"
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={eventForm.startTime}
                    onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>End Time</label>
                  <input
                    type="time"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '-0.5rem 0 0' }}>
                A scholar who hasn't scanned in by the end time is automatically counted absent.
              </p>
              <div className="form-group">
                <label>Term</label>
                <div
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }}
                >
                  {eventForm.schoolYear && eventForm.semester
                    ? `${eventForm.semester}, A.Y. ${eventForm.schoolYear}`
                    : 'No active term set'}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEventModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEvent}>
                <Save size={16} />
                {selectedEvent ? 'Update' : 'Add'} Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance - {selectedEvent.name}</h2>
              <button className="modal-close" onClick={() => setShowAttendanceModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="attendance-list">
                {attendanceEligibleApplicants.map(applicant => {
                  const attendance = getAttendanceForEvent(applicant, selectedEvent.name);

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
                          onClick={() => handleMarkAttendance(applicant, selectedEvent, true)}
                        >
                          <CheckCircle size={16} /> Present
                        </button>
                        <button
                          className={`attendance-btn absent ${attendance?.present === false ? 'active' : ''}`}
                          onClick={() => handleMarkAttendance(applicant, selectedEvent, false)}
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
                      <th>Event</th>
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
                marginBottom: '1rem',
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
                      {getAttendanceStats(selectedScholar, detailsTerm).attended}/{getAttendanceStats(selectedScholar, detailsTerm).total}
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        ({getAttendanceStats(selectedScholar, detailsTerm).total > 0
                          ? Math.round((getAttendanceStats(selectedScholar, detailsTerm).attended / getAttendanceStats(selectedScholar, detailsTerm).total) * 100)
                          : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Term picker — records reset to the active term by default;
                  pick any past term (or "All Terms") to see older records. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Viewing:
                </label>
                <select
                  className="filter-select"
                  style={{ maxWidth: 320 }}
                  value={detailsTerm ? `${detailsTerm.schoolYear}::${detailsTerm.semester}` : 'all'}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setDetailsTerm(null);
                      return;
                    }
                    const [schoolYear, semester] = e.target.value.split('::');
                    setDetailsTerm({ schoolYear, semester });
                  }}
                >
                  {termOptions.map((t) => (
                    <option key={`${t.schoolYear}::${t.semester}`} value={`${t.schoolYear}::${t.semester}`}>
                      {t.semester}, A.Y. {t.schoolYear}{t.isActive ? ' (Active)' : ''}
                    </option>
                  ))}
                  <option value="all">All Terms (Full History)</option>
                </select>
              </div>

              {/* Attendance Records */}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Event Attendance Records
              </h3>

              {(() => {
                const rows = getScholarAttendanceRows(selectedScholar, detailsTerm);
                if (rows.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>No events recorded for this term</p>
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
                          <th>Event</th>
                          <th>Date</th>
                          {!detailsTerm && <th>Term</th>}
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
                              {!detailsTerm && (
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {row.semester && row.schoolYear ? `${row.semester}, ${row.schoolYear}` : '—'}
                                </td>
                              )}
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
              {(() => {
                const stats = getAttendanceStats(selectedScholar, detailsTerm);
                const absent = getAbsenceCount(selectedScholar, detailsTerm);
                return (
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
                          {stats.attended}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Absent</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                          {absent}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Events</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {stats.total}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
