import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  Calendar, Plus, Trash2, CheckCircle, BookOpen, Star, Save,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useApp } from '../context/AppContext';

// Statuses that mean the applicant already cleared the cycle (became a
// scholar) or is already archived elsewhere — these are left alone when a
// term ends. Everyone else still sitting in that term is "did not make it in
// time" and moves to Applicant History.
const CLEARED_STATUSES = ['approved', 'active', 'graduated', 'terminated', 'rejected'];

const SEMESTER_OPTIONS = [
  { name: '1st Semester', order: 1 },
  { name: '2nd Semester', order: 2 },
];

export default function SchoolYearManagement() {
  const { onMenuClick } = useOutletContext() || {};
  const {
    applicants, archiveApplicant, enrollActiveScholarsInSemester,
    schoolYears, addSchoolYear, deleteSchoolYear, setActiveSchoolYear,
    addSemester, deleteSemester, setActiveSemester,
  } = useApp();

  const now = new Date().getFullYear();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ startYear: now, selectedSem: 0 });

  // Flatten the nested school-year/semester data into one row per term
  // (School Year + Semester), sorted chronologically, so each semester is its
  // own clear, separate entry instead of being buried inside a school year.
  const terms = schoolYears
    .flatMap((sy) =>
      (sy.semesters || []).map((sem) => ({
        syId: sy.id,
        semId: sem.id,
        label: sy.label,
        startYear: sy.startYear,
        semester: sem.name,
        order: sem.order,
        isActive: !!sy.isActive && !!sem.isActive,
      }))
    )
    .sort((a, b) => (a.startYear - b.startYear) || (a.order - b.order));

  const activeTerm = terms.find((t) => t.isActive);

  /* ── Add Term ── */
  const openAdd = () => {
    setForm({ startYear: now, selectedSem: 0 });
    setModalOpen(true);
  };

  const saveTerm = async () => {
    const startYear = Number(form.startYear);
    const endYear = startYear + 1;
    const label = `${startYear}-${endYear}`;
    const sem = SEMESTER_OPTIONS[form.selectedSem];

    if (!startYear) {
      Swal.fire({ title: 'Enter a start year', icon: 'warning', timer: 1500, showConfirmButton: false });
      return;
    }
    if (startYear < now) {
      Swal.fire({
        title: 'Year already passed',
        text: `You can't add a term that starts before ${now}.`,
        icon: 'warning', timer: 2200, showConfirmButton: false,
      });
      return;
    }
    // No duplicate (School Year + Semester) terms.
    const exists = terms.some((t) => t.label === label && t.semester === sem.name);
    if (exists) {
      Swal.fire({
        title: 'Term already exists',
        text: `${label} · ${sem.name} is already configured.`,
        icon: 'warning', timer: 2200, showConfirmButton: false,
      });
      return;
    }

    try {
      const existingYear = schoolYears.find((sy) => sy.label === label);
      if (existingYear) {
        await addSemester(existingYear.id, sem);
      } else {
        await addSchoolYear({ startYear, endYear, semesters: [sem] });
      }

      // Adding a term advances the program, so enroll active scholars into it.
      // Any scholar who reaches 8 semesters is auto-graduated to Scholar History.
      const { enrolled } = enrollActiveScholarsInSemester(label, sem.name);

      setModalOpen(false);
      Swal.fire({
        title: 'Term added',
        text: enrolled > 0
          ? `${label} · ${sem.name} added. ${enrolled} active scholar${enrolled !== 1 ? 's' : ''} advanced.`
          : `${label} · ${sem.name} added.`,
        icon: 'success', timer: 2000, showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ title: 'Save failed', text: err?.message || 'Could not save to the database.', icon: 'error' });
    }
  };

  /* ── Set Active Term ── */
  const setActive = async (term) => {
    if (term.isActive) return;

    // Unapproved applicants still in the outgoing active term move to History.
    const prevSy = schoolYears.find((s) => s.isActive);
    const prevSem = prevSy?.semesters?.find((s) => s.isActive);
    const carryOver = (prevSy && prevSem)
      ? applicants.filter((a) =>
          a.schoolYear === prevSy.label &&
          a.semester === prevSem.name &&
          !CLEARED_STATUSES.includes(a.status))
      : [];

    const res = await Swal.fire({
      title: `Make ${term.label} · ${term.semester} the active term?`,
      text: carryOver.length > 0
        ? `${carryOver.length} unapproved applicant${carryOver.length !== 1 ? 's' : ''} from the current term will move to Applicant History.`
        : 'This becomes the current active term.',
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Yes, set active',
    });
    if (!res.isConfirmed) return;

    await setActiveSchoolYear(term.syId);
    await setActiveSemester(term.syId, term.semId);
    carryOver.forEach((a) => archiveApplicant(a.id, 'not_approved'));

    if (carryOver.length > 0) {
      Swal.fire({
        title: 'Active term switched',
        text: `${carryOver.length} applicant${carryOver.length !== 1 ? 's' : ''} moved to Applicant History.`,
        icon: 'success', timer: 2200, showConfirmButton: false,
      });
    }
  };

  /* ── Delete Term ── */
  const removeTerm = async (term) => {
    const res = await Swal.fire({
      title: `Delete ${term.label} · ${term.semester}?`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: 'var(--danger)', confirmButtonText: 'Delete',
    });
    if (!res.isConfirmed) return;

    const sy = schoolYears.find((s) => s.id === term.syId);
    // Remove the whole school year when this was its only semester; otherwise
    // just drop the semester so the year keeps its remaining terms.
    if ((sy?.semesters || []).length <= 1) {
      await deleteSchoolYear(term.syId);
    } else {
      await deleteSemester(term.syId, term.semId);
    }
  };

  return (
    <div className="page sy-page">
      <Header
        title="School Year & Semester Management"
        subtitle="Each row is one term (school year + semester). Set which one is active."
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="sy-header">
          <div className="sy-summary">
            <span><strong>{terms.length}</strong> term{terms.length !== 1 ? 's' : ''} configured</span>
            {activeTerm && (
              <span className="active-pill">
                <Star size={12} /> Active: {activeTerm.label} · {activeTerm.semester}
              </span>
            )}
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Term
          </button>
        </div>

        {terms.length === 0 ? (
          <div className="empty-card">
            <Calendar size={48} />
            <p>No terms configured yet.</p>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add First Term
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table term-table">
              <thead>
                <tr>
                  <th>School Year</th>
                  <th>Semester</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={`${term.syId}-${term.semId}`} className={term.isActive ? 'active-row' : ''}>
                    <td>
                      <div className="term-year">
                        <Calendar size={16} /> {term.label}
                      </div>
                    </td>
                    <td>
                      <div className="term-sem">
                        <BookOpen size={15} /> {term.semester}
                      </div>
                    </td>
                    <td>
                      {term.isActive
                        ? <span className="badge-active">Active</span>
                        : <span className="badge-muted">Inactive</span>}
                    </td>
                    <td>
                      <div className="term-actions">
                        {!term.isActive && (
                          <button className="btn btn-sm btn-success" onClick={() => setActive(term)}>
                            <CheckCircle size={13} /> Set Active
                          </button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => removeTerm(term)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Term Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Term</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>School Year</label>
                <div className="year-row">
                  <input
                    type="number"
                    min={now}
                    value={form.startYear}
                    onChange={(e) => setForm((p) => ({ ...p, startYear: Number(e.target.value) }))}
                  />
                  <span className="year-dash">–</span>
                  <input type="number" value={Number(form.startYear) + 1} readOnly className="year-end" />
                </div>
              </div>

              <div className="form-group">
                <label>Semester</label>
                <div className="sem-checkboxes">
                  {SEMESTER_OPTIONS.map((opt, idx) => (
                    <label
                      key={opt.name}
                      className={`sem-chip ${form.selectedSem === idx ? 'selected' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, selectedSem: idx }))}
                    >
                      <BookOpen size={13} />
                      {opt.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTerm}>
                <Save size={15} /> Add Term
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sy-page .page-content { max-width: 820px; }
        .sy-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .sy-summary { display: flex; align-items: center; gap: 1rem; color: var(--text-secondary); font-size: 0.9rem; flex-wrap: wrap; }
        .active-pill { display: flex; align-items: center; gap: 4px; background: rgba(16,185,129,0.15); color: #10b981; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem; }
        /* The shared .data-table forces min-width:900px (for wide tables); this
           one only has 4 columns, so let it fit the container instead of
           overflowing and hiding the Actions column. */
        .data-table.term-table { min-width: 0; }
        .term-table td { vertical-align: middle; }
        .term-table th:last-child, .term-table td:last-child { text-align: right; white-space: nowrap; }
        .term-table tr.active-row { background: rgba(16,185,129,0.06); }
        .term-year, .term-sem { display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary); }
        .term-year { font-weight: 600; }
        .term-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
        .badge-active { background: rgba(16,185,129,0.15); color: #10b981; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }
        .badge-muted { background: var(--bg-secondary); color: var(--text-secondary); padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
        .empty-card { background: var(--card-bg); border: 1px dashed var(--border-color); border-radius: var(--radius); padding: 3rem; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .sem-checkboxes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
        .sem-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px; border-radius: 999px; cursor: pointer;
          border: 1.5px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 500;
          transition: all 0.15s; user-select: none;
        }
        .sem-chip:hover { border-color: var(--primary-color); color: var(--primary-light); }
        .sem-chip.selected {
          border-color: var(--primary-color);
          background: rgba(45, 149, 150, 0.15);
          color: var(--primary-light);
          font-weight: 700;
        }
        .year-row { display: flex; align-items: center; gap: 0.6rem; }
        .year-row input { width: 110px; }
        .year-dash { color: var(--text-secondary); }
        .year-end { opacity: 0.55; cursor: not-allowed; }
        .btn-success { background: #10b981; color: #fff; border: none; }
        .btn-success:hover { opacity: 0.85; }
        .btn-danger { background: var(--danger); color: #fff; border: none; }
        .btn-danger:hover { opacity: 0.85; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-box { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 2rem; min-width: 360px; max-width: 460px; width: 100%; }
        .modal-title { margin: 0 0 1.25rem; font-size: 1.1rem; color: var(--text-primary); }
        .modal-form { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 1.5rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
      `}</style>
    </div>
  );
}
