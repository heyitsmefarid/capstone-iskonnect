import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Swal from 'sweetalert2';
import Header from '../components/layout/Header';
import { matchesExact, matchesSearch } from '../utils/filtering';
import { formatPersonName } from '../utils/nameFormat';
import {
  BookOpen,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  School,
  Hash,
  Calendar,
  FileText,
  Edit2,
} from 'lucide-react';
import { canEdit } from '../utils/auth';
import { isFailingSubject, gradesHaveFailure, getPassedSubjectsCount } from '../utils/academicRecords';

export default function AcademicRecords() {
  const { applicants, catalogSchools, schoolYears, updateApplicant, setGradesEvaluation } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  // Viewer role: read-only on this page — every add/edit control below is
  // gated behind this.
  const editAllowed = canEdit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [selectedScholar, setSelectedScholar] = useState(null);

  // The currently active School Year + Semester (configured in School Year
  // Management) — used to default the encode-grade form to the real current
  // term instead of a hardcoded year.
  const activeTerm = (() => {
    for (const sy of schoolYears) {
      const activeSem = (sy.semesters || []).find(s => s.isActive);
      if (sy.isActive && activeSem) return { schoolYear: sy.label, semester: activeSem.name };
    }
    return null;
  })();

  // Every configured term, most recent first — for the "Submitted Grades"
  // modal's term picker (see selectedGradeTerm below).
  const termOptions = (schoolYears || [])
    .flatMap((sy) => (sy.semesters || []).map((sem) => ({
      schoolYear: sy.label,
      semester: sem.name,
      order: sem.order,
      startYear: sy.startYear,
      isActive: !!sy.isActive && !!sem.isActive,
    })))
    .sort((a, b) => (b.startYear - a.startYear) || (b.order - a.order));

  // Which term the "Submitted Grades" modal is narrowed to — `null` means
  // "All Terms" (every semester on file, the modal's original behavior).
  const [selectedGradeTerm, setSelectedGradeTerm] = useState(null);

  const [gradeForm, setGradeForm] = useState({
    schoolYear: activeTerm?.schoolYear || '',
    semester: activeTerm?.semester || '1st Semester',
    subjectName: '',
    units: '3',
    grade: '',
    remarks: 'Passed',
  });
  // Which subject row is currently being edited inline: { schoolYear, semester, index }.
  const [editingSubject, setEditingSubject] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', units: '', grade: '', remarks: 'Passed' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ column: 'name', direction: 'asc' });

  // Includes on-hold: a scholar lands on-hold specifically because a current-
  // term grade came back failing/incomplete (see AppContext.jsx's auto
  // on-hold sweep) — excluding that status here hid exactly the scholars this
  // page exists to surface, and silently excluded their grades from every
  // stat (Passed All Subjects, Failed/Incomplete/Other, etc.) below.
  const scholars = applicants.filter(a => a.status === 'active' || a.status === 'approved' || a.status === 'on-hold');

  // School filter options: the eligible-schools catalog (managed in System
  // Settings) PLUS any school that actually appears on a scholar record.
  const schoolFilterOptions = Array.from(new Set([
    ...(catalogSchools || []).map(s => s?.name).filter(Boolean),
    ...scholars.map(s => s?.school).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const filteredScholars = scholars.filter(scholar => {
    const matchesSearchTerm = matchesSearch(
      [
        formatPersonName(scholar),
        scholar.email,
        scholar.school,
        scholar.program,
      ],
      searchTerm
    );
    const matchesSchool = matchesExact(scholar.school, filterSchool);
    return matchesSearchTerm && matchesSchool;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSchool]);

  // Reset any in-progress subject edit, and re-default the encode-grade form
  // to the current active term, whenever the modal opens/closes or switches
  // to a different scholar.
  useEffect(() => {
    setEditingSubject(null);
    setSelectedGradeTerm(null);
    setGradeForm((prev) => ({
      ...prev,
      schoolYear: activeTerm?.schoolYear || prev.schoolYear,
      semester: activeTerm?.semester || prev.semester,
      subjectName: '',
      grade: '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScholar?.id]);

  const handleSort = (column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.35 }} />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const getScholarGradeRecords = (scholar) => {
    return scholar.grades || [];
  };

  // Grade records for the currently active term only — used for the table's
  // at-a-glance "Grades Status"/"Subjects Passed" columns so they reflect
  // whether the CURRENT semester's grades are in, not a scholar's entire
  // history. (The "View Grades" modal still shows full history separately.)
  const getCurrentTermRecords = (scholar) => {
    if (!activeTerm) return [];
    return getScholarGradeRecords(scholar).filter(
      (r) => r.schoolYear === activeTerm.schoolYear && r.semester === activeTerm.semester
    );
  };


  // Adds a subject grade to the selected scholar and syncs it to the database
  // (the scholar app reads these grades back).
  const handleAddGrade = (e) => {
    e.preventDefault();
    if (!selectedScholar) return;
    const name = gradeForm.subjectName.trim();
    const grade = Number.parseFloat(gradeForm.grade);
    const units = Number.parseFloat(gradeForm.units);
    if (!name || !Number.isFinite(grade) || !Number.isFinite(units)) return;

    const existing = Array.isArray(selectedScholar.grades)
      ? selectedScholar.grades.map((r) => ({ ...r, subjects: [...(r.subjects || [])] }))
      : [];
    const idx = existing.findIndex(
      (r) => r.schoolYear === gradeForm.schoolYear && r.semester === gradeForm.semester
    );
    const subject = { name, units, grade, remarks: gradeForm.remarks };
    if (idx >= 0) {
      existing[idx].subjects.push(subject);
    } else {
      existing.push({
        schoolYear: gradeForm.schoolYear,
        semester: gradeForm.semester,
        subjects: [subject],
      });
    }

    const wasActiveOrApproved =
      selectedScholar.status === 'active' || selectedScholar.status === 'approved';
    const newGradeIsFailing = isFailingSubject(subject);

    updateApplicant(selectedScholar.id, { grades: existing });
    setSelectedScholar({ ...selectedScholar, grades: existing });
    setGradeForm((prev) => ({ ...prev, subjectName: '', grade: '' }));

    // Notify the admin when a failing/INC grade triggers auto on-hold.
    if (wasActiveOrApproved && newGradeIsFailing) {
      Swal.fire({
        title: 'Scholar placed On Hold',
        text: `${selectedScholar.name || 'Scholar'} has been automatically set to On Hold due to a failing or INC grade.`,
        icon: 'warning',
        timer: 3500,
        showConfirmButton: false,
      });
    }
  };

  const startEditSubject = (schoolYear, semester, index, subject) => {
    setEditingSubject({ schoolYear, semester, index });
    setEditForm({
      name: subject.name || '',
      units: subject.units ?? '',
      grade: subject.grade ?? '',
      remarks: subject.remarks || 'Passed',
    });
  };

  const cancelEditSubject = () => {
    setEditingSubject(null);
  };

  // Updates an already-encoded subject in place and syncs it to the database
  // (mirrors handleAddGrade's persistence + auto on-hold notification).
  const saveEditSubject = () => {
    if (!selectedScholar || !editingSubject) return;
    const name = editForm.name.trim();
    const grade = Number.parseFloat(editForm.grade);
    const units = Number.parseFloat(editForm.units);
    if (!name || !Number.isFinite(grade) || !Number.isFinite(units)) return;

    const existing = Array.isArray(selectedScholar.grades)
      ? selectedScholar.grades.map((r) => ({ ...r, subjects: [...(r.subjects || [])] }))
      : [];
    const recIdx = existing.findIndex(
      (r) => r.schoolYear === editingSubject.schoolYear && r.semester === editingSubject.semester
    );
    if (recIdx < 0) return;

    const subject = { name, units, grade, remarks: editForm.remarks };
    existing[recIdx].subjects[editingSubject.index] = subject;

    const wasActiveOrApproved =
      selectedScholar.status === 'active' || selectedScholar.status === 'approved';
    const newGradeIsFailing = isFailingSubject(subject);

    updateApplicant(selectedScholar.id, { grades: existing });
    setSelectedScholar({ ...selectedScholar, grades: existing });
    setEditingSubject(null);

    if (wasActiveOrApproved && newGradeIsFailing) {
      Swal.fire({
        title: 'Scholar placed On Hold',
        text: `${selectedScholar.name || 'Scholar'} has been automatically set to On Hold due to a failing or INC grade.`,
        icon: 'warning',
        timer: 3500,
        showConfirmButton: false,
      });
    }
  };

  const periodKeyFor = (sy, sem) => `${sy}::${sem}`;

  // COG file URLs are Firestore fields, not guaranteed-safe values —
  // `users/{id}` write rules allow any signed-in session to set them.
  // Reject anything that isn't a real http(s) link before it reaches an
  // <a href>/<img src>, so a javascript: URI can't execute.
  const isSafeHttpUrl = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const isCogImage = (cog) => {
    if (!cog) return false;
    const t = (cog.fileType || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(t)) return true;
    const u = (cog.fileUrl || '').toLowerCase();
    return (
      u.startsWith('data:image/') ||
      /\.(png|jpe?g|gif|webp)(\?|$)/.test(u) ||
      u.includes('/image/upload/')
    );
  };

  const getCogForPeriod = (scholar, sy, sem) => {
    const list = Array.isArray(scholar?.cogSubmissions) ? scholar.cogSubmissions : [];
    return (
      list.find(
        (c) => (c.academicYear === sy || c.schoolYear === sy) && c.semester === sem
      ) || null
    );
  };

  const getEvaluation = (scholar, sy, sem) => {
    const ev = scholar?.gradesEvaluation || {};
    return ev[periodKeyFor(sy, sem)] || null;
  };

  // Evaluation status for the CURRENT active term only, for the at-a-glance
  // column in the records table. Scoped the same way as enrollment/on-hold —
  // a semester confirmed by the admin before a scholar was terminated (or
  // before a new term started) shouldn't keep showing "Evaluated" once a
  // fresh term begins with nothing new submitted yet.
  const getEvaluationSummary = (scholar) => {
    const activeSy = schoolYears.find((s) => s.isActive);
    const activeSem = activeSy?.semesters?.find((s) => s.isActive);
    if (!activeSy || !activeSem) return 'none';
    const records = getScholarGradeRecords(scholar);
    const current = records.find(
      (r) => r.schoolYear === activeSy.label && r.semester === activeSem.name
    );
    if (!current) return 'none';
    const status = getEvaluation(scholar, current.schoolYear, current.semester)?.status || 'pending';
    if (status === 'revision') return 'revision';
    if (status === 'confirmed') return 'evaluated';
    return 'pending';
  };

  // Confirms or flags a semester's grades for revision. Clicking the active
  // status again clears it. Confirming also grants that semester (see
  // setGradesEvaluation/grantSemesterIfNeeded in AppContext) — a scholar's
  // grades being confirmed is solid evidence it happened, so this shouldn't
  // require a separate "Evaluate Enrollment" click to count toward Semesters
  // Used / Financial Information.
  const handleEvaluateGrades = (sy, sem, status) => {
    if (!selectedScholar) return;
    const key = periodKeyFor(sy, sem);
    const current = { ...(selectedScholar.gradesEvaluation || {}) };
    let grantIfConfirmed = null;
    if (current[key]?.status === status) {
      delete current[key];
    } else {
      current[key] = { status, evaluatedAt: new Date().toISOString() };
      if (status === 'confirmed') grantIfConfirmed = { schoolYear: sy, semester: sem };
    }
    setGradesEvaluation(selectedScholar.id, current, grantIfConfirmed);
    setSelectedScholar({ ...selectedScholar, gradesEvaluation: current });
  };

  const computeGwa = (subjects) => {
    if (!subjects || subjects.length === 0) return null;
    let totalUnits = 0;
    let weightedSum = 0;
    for (const s of subjects) {
      const grade = typeof s.grade === 'number' ? s.grade : Number.parseFloat(s.grade);
      const units = typeof s.units === 'number' ? s.units : Number.parseFloat(s.units);
      if (Number.isFinite(grade) && Number.isFinite(units) && units > 0) {
        weightedSum += grade * units;
        totalUnits += units;
      }
    }
    return totalUnits > 0 ? (weightedSum / totalUnits).toFixed(2) : null;
  };

  // Color-codes the grade badge from the Remarks field, not the raw number —
  // schools/programs here use different grading scales (1.0-5.0, 0-100, ...),
  // so a numeric threshold like "> 3.0 is failing" marked a 97/100 (Passed)
  // the same red as a 72/100 (Failed) whenever both happened to be above 3.
  // Remarks is the one value that means the same thing on every scale.
  const gradeStatus = (subject) => {
    const remarks = String(subject?.remarks || '').trim().toUpperCase();
    if (remarks === 'INCOMPLETE') return 'inc';
    if (isFailingSubject(subject)) return 'failed';
    return 'passed';
  };

  const getGradeProgress = (scholar) => {
    const records = getCurrentTermRecords(scholar);
    const subjects = records.flatMap((record) => record.subjects || []);
    const totalSubjects = subjects.length;
    const passedSubjects = getPassedSubjectsCount(subjects);
    return { passedSubjects, totalSubjects };
  };

  const sortedScholars = [...filteredScholars].sort((a, b) => {
    const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
    switch (sortConfig.column) {
      case 'scholarId':
        return (a.scholarId || '').localeCompare(b.scholarId || '') * multiplier;
      case 'name':
        return formatPersonName(a).localeCompare(formatPersonName(b)) * multiplier;
      case 'school':
        return (a.school || '').localeCompare(b.school || '') * multiplier;
      case 'program':
        return (a.program || '').localeCompare(b.program || '') * multiplier;
      case 'yearLevel':
        return ((a.yearLevel || 0) - (b.yearLevel || 0)) * multiplier;
      case 'subjectsPassed': {
        const progressA = getGradeProgress(a);
        const progressB = getGradeProgress(b);
        const rateA = progressA.totalSubjects > 0 ? progressA.passedSubjects / progressA.totalSubjects : 0;
        const rateB = progressB.totalSubjects > 0 ? progressB.passedSubjects / progressB.totalSubjects : 0;
        return (rateA - rateB) * multiplier;
      }
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedScholars.length / itemsPerPage);
  const paginatedScholars = sortedScholars.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleValidateGrades = (scholar) => {
    setSelectedScholar(scholar);
  };

  const stats = {
    total: filteredScholars.length,
    withGrades: filteredScholars.filter(s => getCurrentTermRecords(s).length > 0).length,
    pending: filteredScholars.filter(s => getCurrentTermRecords(s).length === 0).length,
    passedAll: filteredScholars.filter((s) => {
      const progress = getGradeProgress(s);
      return progress.totalSubjects > 0 && progress.passedSubjects === progress.totalSubjects;
    }).length,
    // Scholars with at least one Failed/Incomplete/Other subject this term —
    // previously computed nowhere on this page, so a scholar needing follow-up
    // had no visible signal here at all.
    failedOrIncomplete: filteredScholars.filter((s) => gradesHaveFailure(getCurrentTermRecords(s))).length,
  };

  return (
    <div className="page academic-records-page">
      <Header
        title="Academic Records"
        subtitle="Review and validate submitted subjects, units, and grades"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-icon">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Scholars</div>
            </div>
          </div>
          <div className="stat-card stat-card-green">
            <div className="stat-icon">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="stat-value">{stats.withGrades}</div>
              <div className="stat-label">With Grades</div>
            </div>
          </div>
          <div className="stat-card stat-card-yellow">
            <div className="stat-icon">
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Pending Submission</div>
            </div>
          </div>
          <div className="stat-card stat-card-teal">
            <div className="stat-icon">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="stat-value">{stats.passedAll}</div>
              <div className="stat-label">Passed All Subjects</div>
            </div>
          </div>
          <div className="stat-card stat-card-red">
            <div className="stat-icon">
              <XCircle size={24} />
            </div>
            <div>
              <div className="stat-value">{stats.failedOrIncomplete}</div>
              <div className="stat-label">Failed / Incomplete / Other</div>
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
          <select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All Schools</option>
            {schoolFilterOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Records Table */}
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('scholarId')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Scholar ID <SortIcon column="scholarId" /></div></th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Name <SortIcon column="name" /></div></th>
                  <th onClick={() => handleSort('school')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>School <SortIcon column="school" /></div></th>
                  <th onClick={() => handleSort('program')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Program <SortIcon column="program" /></div></th>
                  <th onClick={() => handleSort('yearLevel')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Year <SortIcon column="yearLevel" /></div></th>
                  <th onClick={() => handleSort('subjectsPassed')} style={{ cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Subjects Passed <SortIcon column="subjectsPassed" /></div></th>
                  <th>Grades Status</th>
                  <th>Evaluation</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedScholars.map(scholar => {
                  const progress = getGradeProgress(scholar);
                  const isAllPassed = progress.totalSubjects > 0 && progress.passedSubjects === progress.totalSubjects;
                  return (
                    <tr key={scholar.id}>
                      <td>{scholar.scholarId || 'N/A'}</td>
                      <td>{formatPersonName(scholar)}</td>
                      <td>{scholar.school}</td>
                      <td>{scholar.program}</td>
                      <td>{scholar.yearLevel}</td>
                      <td>
                        <div className="gwa-cell">
                          {progress.totalSubjects > 0 ? (
                            <>
                              <CheckCircle size={16} style={{ color: isAllPassed ? 'var(--success)' : 'var(--warning)' }} />
                              <span style={{ color: isAllPassed ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                                {progress.passedSubjects}/{progress.totalSubjects}
                              </span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {getCurrentTermRecords(scholar).length > 0 ? (
                          <span className="grade-status-badge submitted">
                            <CheckCircle size={13} /> Submitted
                          </span>
                        ) : (
                          <span className="grade-status-badge pending">
                            <AlertTriangle size={13} /> Not Submitted
                          </span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const evalStatus = getEvaluationSummary(scholar);
                          if (evalStatus === 'evaluated') {
                            return (
                              <span className="eval-badge confirmed">
                                <CheckCircle size={12} /> Evaluated
                              </span>
                            );
                          }
                          if (evalStatus === 'revision') {
                            return (
                              <span className="eval-badge revision">
                                <XCircle size={12} /> Needs Revision
                              </span>
                            );
                          }
                          if (evalStatus === 'none') {
                            return (
                              <span className="eval-badge pending">
                                <AlertTriangle size={12} /> No Grades
                              </span>
                            );
                          }
                          return (
                            <span className="eval-badge pending">
                              <AlertTriangle size={12} /> Not Evaluated
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleValidateGrades(scholar)}
                        >
                          <Eye size={16} />
                          View Grades
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedScholars.length > 0 && (
            <div className="pagination-container" style={{ marginTop: '1rem' }}>
              <div className="pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedScholars.length)} of {sortedScholars.length} scholars
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
        </div>
      </div>

      {/* Grade Review Modal */}
      {selectedScholar && (() => {
        const records = getScholarGradeRecords(selectedScholar);
        // Overall GWA in the info strip below is always true lifetime GWA,
        // regardless of which term the modal is narrowed to.
        const overallGwa = computeGwa(records.flatMap(r => r.subjects || []));

        // Only offer terms this scholar actually has grades for — a picker
        // full of empty terms would just be noise.
        const scholarTermOptions = termOptions.filter((t) =>
          records.some((r) => r.schoolYear === t.schoolYear && r.semester === t.semester)
        );
        const visibleRecords = selectedGradeTerm
          ? records.filter((r) => r.schoolYear === selectedGradeTerm.schoolYear && r.semester === selectedGradeTerm.semester)
          : records;
        const allSubjects = visibleRecords.flatMap(r => r.subjects || []);
        const totalPassed = getPassedSubjectsCount(allSubjects);
        return (
          <div className="modal-overlay" onClick={() => setSelectedScholar(null)}>
            <div className="modal-content grades-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={22} style={{ color: 'var(--primary-color)' }} />
                    Submitted Grades
                  </h2>
                  <p className="modal-subtitle">{formatPersonName(selectedScholar)} · {selectedScholar.scholarId || 'No ID'}</p>
                </div>
                <button className="close-btn" onClick={() => setSelectedScholar(null)}>×</button>
              </div>

              {/* Scholar info strip */}
              <div className="scholar-info-strip">
                <div className="info-pill">
                  <School size={14} />
                  <span>{selectedScholar.school || '—'}</span>
                </div>
                <div className="info-pill">
                  <BookOpen size={14} />
                  <span>{selectedScholar.program || '—'}</span>
                </div>
                <div className="info-pill">
                  <Hash size={14} />
                  <span>Year {selectedScholar.yearLevel || '—'}</span>
                </div>
                {overallGwa && (
                  <div className="info-pill gwa-pill">
                    <span>Overall GWA:</span>
                    <strong style={{ color: Number(overallGwa) <= 2.0 ? '#22c55e' : Number(overallGwa) <= 3.0 ? '#f59e0b' : '#ef4444' }}>
                      {overallGwa}
                    </strong>
                  </div>
                )}
              </div>

              <div className="modal-body">
                {records.length > 0 ? (
                  <>
                    {/* Term picker — records are shown for every semester by
                        default; narrow to one term (old or current) to focus
                        the summary bar and blocks below on just that period. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Viewing:
                      </label>
                      <select
                        value={selectedGradeTerm ? `${selectedGradeTerm.schoolYear}::${selectedGradeTerm.semester}` : 'all'}
                        onChange={(e) => {
                          if (e.target.value === 'all') {
                            setSelectedGradeTerm(null);
                            return;
                          }
                          const [schoolYear, semester] = e.target.value.split('::');
                          setSelectedGradeTerm({ schoolYear, semester });
                        }}
                        style={{ maxWidth: 320 }}
                      >
                        <option value="all">All Terms ({records.length} semester{records.length !== 1 ? 's' : ''})</option>
                        {scholarTermOptions.map((t) => (
                          <option key={`${t.schoolYear}::${t.semester}`} value={`${t.schoolYear}::${t.semester}`}>
                            {t.semester}, A.Y. {t.schoolYear}{t.isActive ? ' (Active)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Summary bar */}
                    <div className="grades-summary-bar">
                      <div className="gsb-item">
                        <span className="gsb-val">{visibleRecords.length}</span>
                        <span className="gsb-lbl">Semester{visibleRecords.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="gsb-divider" />
                      <div className="gsb-item">
                        <span className="gsb-val">{allSubjects.length}</span>
                        <span className="gsb-lbl">Total Subjects</span>
                      </div>
                      <div className="gsb-divider" />
                      <div className="gsb-item">
                        <span className="gsb-val" style={{ color: '#22c55e' }}>{totalPassed}</span>
                        <span className="gsb-lbl">Passed</span>
                      </div>
                      <div className="gsb-divider" />
                      <div className="gsb-item">
                        <span className="gsb-val" style={{ color: '#ef4444' }}>{allSubjects.length - totalPassed}</span>
                        <span className="gsb-lbl">Failed / INC</span>
                      </div>
                    </div>

                    {visibleRecords.length === 0 && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '12px 0' }}>
                        No grades on file for this term.
                      </p>
                    )}

                    {/* Per-semester records */}
                    {visibleRecords.map((gradeRecord, idx) => {
                      const subjects = gradeRecord.subjects || [];
                      const passedCount = getPassedSubjectsCount(subjects);
                      const gwa = computeGwa(subjects);
                      const totalUnits = subjects.reduce((s, sub) => {
                        const u = typeof sub.units === 'number' ? sub.units : Number.parseFloat(sub.units);
                        return s + (Number.isFinite(u) ? u : 0);
                      }, 0);

                      return (
                        <div key={idx} className="grade-record">
                          <div className="record-header">
                            <div>
                              <h3>
                                <Calendar size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--primary-color)' }} />
                                {gradeRecord.schoolYear || 'School Year'} — {gradeRecord.semester || 'Semester'}
                              </h3>
                            </div>
                            <div className="record-meta-badges">
                              <span className="meta-badge">{totalUnits} units</span>
                              <span className={`meta-badge ${passedCount === subjects.length && subjects.length > 0 ? 'badge-green' : 'badge-yellow'}`}>
                                {passedCount}/{subjects.length} passed
                              </span>
                              {gwa && (
                                <span className={`meta-badge ${Number(gwa) <= 2.0 ? 'badge-green' : Number(gwa) <= 3.0 ? 'badge-yellow' : 'badge-red'}`}>
                                  GWA {gwa}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="record-body">
                            <div className="record-main">
                              {subjects.length > 0 ? (
                                <div className="subjects-table">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>#</th>
                                        <th>Subject / Course</th>
                                        <th style={{ textAlign: 'center' }}>Units</th>
                                        <th style={{ textAlign: 'center' }}>Grade</th>
                                        <th style={{ textAlign: 'center' }}>Remarks</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subjects.map((subject, subIdx) => {
                                        const status = gradeStatus(subject);
                                        const isEditing =
                                          editingSubject &&
                                          editingSubject.schoolYear === gradeRecord.schoolYear &&
                                          editingSubject.semester === gradeRecord.semester &&
                                          editingSubject.index === subIdx;

                                        if (isEditing) {
                                          return (
                                            <tr key={subIdx} className="subject-row-editing">
                                              <td style={{ color: 'var(--text-secondary)', width: 32 }}>{subIdx + 1}</td>
                                              <td>
                                                <input
                                                  type="text"
                                                  className="inline-edit-input"
                                                  value={editForm.name}
                                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                              </td>
                                              <td style={{ textAlign: 'center' }}>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  step="1"
                                                  className="inline-edit-input inline-edit-num"
                                                  value={editForm.units}
                                                  onChange={(e) => setEditForm({ ...editForm, units: e.target.value })}
                                                />
                                              </td>
                                              <td style={{ textAlign: 'center' }}>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  max="5"
                                                  step="0.25"
                                                  className="inline-edit-input inline-edit-num"
                                                  value={editForm.grade}
                                                  onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                                                />
                                              </td>
                                              <td style={{ textAlign: 'center' }}>
                                                <select
                                                  className="inline-edit-input"
                                                  value={editForm.remarks}
                                                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                                                >
                                                  <option value="Passed">Passed</option>
                                                  <option value="Failed">Failed</option>
                                                  <option value="Incomplete">Incomplete</option>
                                                  <option value="Other">Other</option>
                                                </select>
                                              </td>
                                              <td style={{ textAlign: 'center' }}>
                                                <div className="subject-row-actions">
                                                  <button
                                                    type="button"
                                                    className="icon-btn icon-btn-save"
                                                    title="Save"
                                                    onClick={saveEditSubject}
                                                  >
                                                    <CheckCircle size={15} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="icon-btn icon-btn-cancel"
                                                    title="Cancel"
                                                    onClick={cancelEditSubject}
                                                  >
                                                    <XCircle size={15} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        }

                                        return (
                                          <tr key={subIdx}>
                                            <td style={{ color: 'var(--text-secondary)', width: 32 }}>{subIdx + 1}</td>
                                            <td style={{ fontWeight: 500 }}>{subject.name || '—'}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{subject.units ?? '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                              <span className={`grade-value grade-${status}`}>
                                                {subject.grade ?? 'INC'}
                                              </span>
                                            </td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{subject.remarks || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                              {editAllowed && (
                                                <button
                                                  type="button"
                                                  className="icon-btn"
                                                  title="Edit grade"
                                                  onClick={() => startEditSubject(gradeRecord.schoolYear, gradeRecord.semester, subIdx, subject)}
                                                >
                                                  <Edit2 size={14} />
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '12px 0' }}>No subjects recorded for this semester.</p>
                              )}

                              {/* COG link + grade confirmation/evaluation */}
                              {(() => {
                                const sy = gradeRecord.schoolYear;
                                const sem = gradeRecord.semester;
                                const ev = getEvaluation(selectedScholar, sy, sem);
                                const cog = getCogForPeriod(selectedScholar, sy, sem);
                                return (
                                  <div className="record-eval">
                                    <div className="eval-left">
                                      {cog && isSafeHttpUrl(cog.fileUrl) ? (
                                        <a
                                          className="cog-inline"
                                          href={cog.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <FileText size={13} /> View COG
                                        </a>
                                      ) : (
                                        <span className="cog-inline missing">
                                          <AlertTriangle size={12} /> No COG for this semester
                                        </span>
                                      )}
                                      <span className="eval-sep">•</span>
                                      <span className="eval-label">
                                        Overall grades{gwa ? ` (GWA ${gwa})` : ''}:
                                      </span>
                                      {ev?.status === 'confirmed' ? (
                                        <span className="eval-badge confirmed">
                                          <CheckCircle size={12} /> Grades Confirmed
                                        </span>
                                      ) : ev?.status === 'revision' ? (
                                        <span className="eval-badge revision">
                                          <XCircle size={12} /> Needs Revision
                                        </span>
                                      ) : (
                                        <span className="eval-badge pending">
                                          <AlertTriangle size={12} /> Pending Confirmation
                                        </span>
                                      )}
                                    </div>
                                    {editAllowed && (
                                      <div className="eval-actions">
                                        <button
                                          type="button"
                                          className={`eval-btn confirm ${ev?.status === 'confirmed' ? 'active' : ''}`}
                                          onClick={() => handleEvaluateGrades(sy, sem, 'confirmed')}
                                        >
                                          <CheckCircle size={13} /> Confirm
                                        </button>
                                        <button
                                          type="button"
                                          className={`eval-btn revision ${ev?.status === 'revision' ? 'active' : ''}`}
                                          onClick={() => handleEvaluateGrades(sy, sem, 'revision')}
                                        >
                                          <XCircle size={13} /> Needs Revision
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Bigger COG preview so the admin can cross-check the
                                encoded grades against the scholar's submitted proof
                                without leaving the modal. */}
                            <div className="record-cog-preview">
                              {(() => {
                                const cog = getCogForPeriod(selectedScholar, gradeRecord.schoolYear, gradeRecord.semester);
                                if (!cog || !isSafeHttpUrl(cog.fileUrl)) {
                                  return (
                                    <div className="cog-preview-empty">
                                      <AlertTriangle size={22} />
                                      <span>No COG submitted for this semester</span>
                                    </div>
                                  );
                                }
                                if (isCogImage(cog)) {
                                  return (
                                    <a
                                      href={cog.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="cog-preview-link"
                                      title="Open full size"
                                    >
                                      <img
                                        src={cog.fileUrl}
                                        alt={`COG for ${gradeRecord.semester}, A.Y. ${gradeRecord.schoolYear}`}
                                        className="cog-preview-img"
                                      />
                                      <span className="cog-preview-caption">Click to view full size</span>
                                    </a>
                                  );
                                }
                                return (
                                  <a
                                    href={cog.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cog-preview-file"
                                  >
                                    <FileText size={32} />
                                    <span>{cog.fileName || 'COG file'}</span>
                                    <span className="cog-preview-caption">Click to open</span>
                                  </a>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="empty-state">
                    <AlertTriangle size={48} style={{ color: 'var(--warning)' }} />
                    <p style={{ fontWeight: 600, marginTop: '12px' }}>No Grades Submitted</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      This scholar has not submitted any grade records yet.
                    </p>
                  </div>
                )}
              </div>

              {editAllowed && (
              <form className="add-grade-form" onSubmit={handleAddGrade}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Add / Encode Grade</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>School Year</label>
                    <select value={gradeForm.schoolYear} onChange={(e) => setGradeForm({ ...gradeForm, schoolYear: e.target.value })}>
                      <option value="">— Select —</option>
                      {schoolYears.map(sy => (
                        <option key={sy.id} value={sy.label}>{sy.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Semester</label>
                    <select value={gradeForm.semester} onChange={(e) => setGradeForm({ ...gradeForm, semester: e.target.value })}>
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Subject</label>
                    <input type="text" value={gradeForm.subjectName} placeholder="Subject name" onChange={(e) => setGradeForm({ ...gradeForm, subjectName: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Units</label>
                    <input type="number" min="1" step="1" value={gradeForm.units} onChange={(e) => setGradeForm({ ...gradeForm, units: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Grade</label>
                    <input type="number" min="1" max="5" step="0.25" value={gradeForm.grade} placeholder="e.g. 1.75" onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Remarks</label>
                    <select value={gradeForm.remarks} onChange={(e) => setGradeForm({ ...gradeForm, remarks: e.target.value })}>
                      <option value="Passed">Passed</option>
                      <option value="Failed">Failed</option>
                      <option value="Incomplete">Incomplete</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary">Add</button>
                </div>
              </form>
              )}

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedScholar(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx>{`
        .academic-records-page {
          background: var(--bg-secondary);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
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

        .stat-card-blue .stat-icon { background: rgba(45, 149, 150, 0.2); color: var(--primary-light); }
        .stat-card-green .stat-icon { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .stat-card-yellow .stat-icon { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
        .stat-card-red .stat-icon { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .stat-card-teal .stat-icon { background: rgba(20, 184, 166, 0.2); color: #5eead4; }

        .stat-icon {
          padding: 0.75rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gwa-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* Submission status badge in table */
        .grade-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .grade-status-badge.submitted {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .grade-status-badge.pending {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        /* Modal */
        .grades-modal {
          max-width: 1560px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
        }

        .modal-subtitle {
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-top: 4px;
        }

        /* Scholar info strip */
        .scholar-info-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .info-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 999px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .info-pill.gwa-pill {
          gap: 8px;
          border-color: var(--primary-color);
          color: var(--text-primary);
        }

        /* Summary bar */
        .grades-summary-bar {
          display: flex;
          align-items: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .gsb-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 8px;
        }
        .gsb-val {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }
        .gsb-lbl {
          font-size: 0.73rem;
          color: var(--text-secondary);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .gsb-divider {
          width: 1px;
          height: 40px;
          background: var(--border-color);
        }

        /* Grade record block */
        .grade-record {
          margin-bottom: 20px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .record-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .record-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
        }

        .record-meta-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .meta-badge {
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }
        .meta-badge.badge-green { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.25); color: #22c55e; }
        .meta-badge.badge-yellow { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.25); color: #f59e0b; }
        .meta-badge.badge-red { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.25); color: #ef4444; }

        /* Grade record body: subjects table on the left, a bigger COG image
           preview on the right so the admin can evaluate grades against the
           submitted proof without opening a new tab. */
        .record-body {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .record-main {
          flex: 1;
          min-width: 0;
        }

        .record-cog-preview {
          flex: 0 0 600px;
          width: 600px;
        }

        .cog-preview-link,
        .cog-preview-file,
        .cog-preview-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--card-bg);
          padding: 10px;
          text-decoration: none;
        }

        .cog-preview-link:hover,
        .cog-preview-file:hover {
          border-color: var(--primary-color);
        }

        .cog-preview-img {
          width: 100%;
          max-height: 800px;
          object-fit: contain;
          border-radius: 6px;
          background: var(--bg-tertiary);
        }

        .cog-preview-caption {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .cog-preview-file {
          min-height: 300px;
          justify-content: center;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 500;
          text-align: center;
        }

        .cog-preview-empty {
          min-height: 300px;
          justify-content: center;
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-align: center;
        }

        @media (max-width: 760px) {
          .record-body {
            flex-direction: column;
          }
          .record-cog-preview {
            width: 100%;
            flex: 1;
          }
        }

        /* Subjects table */
        .subjects-table {
          overflow-x: auto;
        }

        .subjects-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .subjects-table th,
        .subjects-table td {
          padding: 9px 12px;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .subjects-table th {
          background: var(--bg-tertiary);
          font-weight: 600;
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .subjects-table tbody tr:hover {
          background: rgba(255,255,255,0.03);
        }

        .subjects-table td {
          font-size: 0.875rem;
        }

        /* Inline subject-grade editing */
        .subject-row-editing {
          background: rgba(45, 149, 150, 0.06);
        }

        .inline-edit-input {
          width: 100%;
          padding: 5px 8px;
          border: 1px solid var(--primary-color);
          border-radius: 5px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.8125rem;
        }

        .inline-edit-num {
          width: 70px;
          text-align: center;
        }

        .icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--card-bg);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .icon-btn:hover {
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        .subject-row-actions {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .icon-btn-save {
          color: #22c55e;
          border-color: rgba(34,197,94,0.4);
        }
        .icon-btn-save:hover {
          background: rgba(34,197,94,0.12);
        }

        .icon-btn-cancel {
          color: #ef4444;
          border-color: rgba(239,68,68,0.4);
        }
        .icon-btn-cancel:hover {
          background: rgba(239,68,68,0.12);
        }

        /* Grade value pill */
        .grade-value {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.85rem;
          min-width: 40px;
          text-align: center;
        }
        .grade-value.grade-excellent { background: rgba(34,197,94,0.15); color: #22c55e; }
        .grade-value.grade-passed { background: rgba(45,149,150,0.15); color: var(--primary-light); }
        .grade-value.grade-failed { background: rgba(239,68,68,0.15); color: #ef4444; }
        .grade-value.grade-inc { background: rgba(245,158,11,0.15); color: #f59e0b; }

        /* Subject status badge */
        .subject-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 9px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
        }
        .subject-status-badge.pass { background: rgba(45,149,150,0.12); color: var(--primary-light); }
        .subject-status-badge.excellent { background: rgba(34,197,94,0.12); color: #22c55e; }
        .subject-status-badge.fail { background: rgba(239,68,68,0.12); color: #ef4444; }
        .subject-status-badge.inc { background: rgba(245,158,11,0.12); color: #f59e0b; }

        /* Footer */
        .modal-footer {
          display: flex;
          gap: 1rem;
          padding: 16px 24px;
          border-top: 1px solid var(--border-color);
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .modal-footer .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-secondary);
        }

        /* Per-semester COG link + grade evaluation footer */
        .record-eval {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dashed var(--border-color);
        }
        .eval-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cog-inline {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--primary-light);
          text-decoration: none;
        }
        .cog-inline:hover { text-decoration: underline; }
        .cog-inline.missing {
          color: #f59e0b;
          cursor: default;
        }
        .eval-sep {
          color: var(--border-color);
          font-size: 0.8rem;
        }
        .eval-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .eval-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 600;
        }
        .eval-badge.confirmed { background: rgba(34,197,94,0.14); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
        .eval-badge.revision { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.28); }
        .eval-badge.pending { background: rgba(148,163,184,0.14); color: var(--text-secondary); border: 1px solid var(--border-color); }
        .eval-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .eval-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }
        .eval-btn.confirm:hover,
        .eval-btn.confirm.active {
          background: rgba(34,197,94,0.15);
          border-color: rgba(34,197,94,0.4);
          color: #22c55e;
        }
        .eval-btn.revision:hover,
        .eval-btn.revision.active {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.4);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}
