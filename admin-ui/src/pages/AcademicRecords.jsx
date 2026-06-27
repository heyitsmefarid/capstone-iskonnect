import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
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
} from 'lucide-react';

export default function AcademicRecords() {
  const { applicants, schools, updateApplicant } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [gradeForm, setGradeForm] = useState({
    schoolYear: '2025-2026',
    semester: '1st Semester',
    subjectName: '',
    units: '3',
    grade: '',
    remarks: 'Passed',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ column: 'name', direction: 'asc' });

  const scholars = applicants.filter(a => a.status === 'active' || a.status === 'approved');

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

    updateApplicant(selectedScholar.id, { grades: existing });
    // Reflect immediately in the open modal.
    setSelectedScholar({ ...selectedScholar, grades: existing });
    setGradeForm((prev) => ({ ...prev, subjectName: '', grade: '' }));
  };

  const getPassedSubjectsCount = (subjects) => {
    if (!subjects || subjects.length === 0) return 0;
    return subjects.filter((subject) => {
      const gradeValue = typeof subject.grade === 'number' ? subject.grade : Number.parseFloat(subject.grade);
      return Number.isFinite(gradeValue) && gradeValue <= 3.0;
    }).length;
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

  const gradeStatus = (grade) => {
    const g = typeof grade === 'number' ? grade : Number.parseFloat(grade);
    if (!Number.isFinite(g)) return 'inc';
    if (g <= 1.25) return 'excellent';
    if (g <= 3.0) return 'passed';
    return 'failed';
  };

  const getGradeProgress = (scholar) => {
    const records = getScholarGradeRecords(scholar);
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
    withGrades: filteredScholars.filter(s => getScholarGradeRecords(s).length > 0).length,
    pending: filteredScholars.filter(s => getScholarGradeRecords(s).length === 0).length,
    passedAll: filteredScholars.filter((s) => {
      const progress = getGradeProgress(s);
      return progress.totalSubjects > 0 && progress.passedSubjects === progress.totalSubjects;
    }).length,
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
          <div className="stat-card stat-card-red">
            <div className="stat-icon">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="stat-value">{stats.passedAll}</div>
              <div className="stat-label">Passed All Subjects</div>
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
            {schools.map(school => (
              <option key={school.id} value={school.name}>{school.name}</option>
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
                        {getScholarGradeRecords(scholar).length > 0 ? (
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
        const allSubjects = records.flatMap(r => r.subjects || []);
        const overallGwa = computeGwa(allSubjects);
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
                    {/* Summary bar */}
                    <div className="grades-summary-bar">
                      <div className="gsb-item">
                        <span className="gsb-val">{records.length}</span>
                        <span className="gsb-lbl">Semester{records.length !== 1 ? 's' : ''}</span>
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

                    {/* Per-semester records */}
                    {records.map((gradeRecord, idx) => {
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

                          {subjects.length > 0 ? (
                            <div className="subjects-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Subject / Course</th>
                                    <th style={{ textAlign: 'center' }}>Units</th>
                                    <th style={{ textAlign: 'center' }}>Grade</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                    <th style={{ textAlign: 'center' }}>Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subjects.map((subject, subIdx) => {
                                    const status = gradeStatus(subject.grade);
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
                                        <td style={{ textAlign: 'center' }}>
                                          {status === 'failed' ? (
                                            <span className="subject-status-badge fail"><XCircle size={12} /> Failed</span>
                                          ) : status === 'inc' ? (
                                            <span className="subject-status-badge inc"><AlertTriangle size={12} /> INC</span>
                                          ) : status === 'excellent' ? (
                                            <span className="subject-status-badge excellent"><CheckCircle size={12} /> Excellent</span>
                                          ) : (
                                            <span className="subject-status-badge pass"><CheckCircle size={12} /> Passed</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{subject.remarks || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '12px 0' }}>No subjects recorded for this semester.</p>
                          )}
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

              <form className="add-grade-form" onSubmit={handleAddGrade}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Add / Encode Grade</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>School Year</label>
                    <select value={gradeForm.schoolYear} onChange={(e) => setGradeForm({ ...gradeForm, schoolYear: e.target.value })}>
                      <option value="2024-2025">2024-2025</option>
                      <option value="2025-2026">2025-2026</option>
                      <option value="2026-2027">2026-2027</option>
                      <option value="2027-2028">2027-2028</option>
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
          max-width: 860px;
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
      `}</style>
    </div>
  );
}
