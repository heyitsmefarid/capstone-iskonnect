import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  ClipboardCheck, Search, Award, TrendingUp, Users, Lock,
  ChevronLeft, ChevronRight, Star, CheckCircle, BarChart2,
  RefreshCw, Download,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useApp } from '../context/AppContext';
import { formatPersonName } from '../utils/nameFormat';
import {
  fetchRubric, submitEvaluationScore, finalizeEvaluation, fetchEvaluationRankings,
} from '../services/backendApi';

// Default rubric matching the official BFCSP criteria (used as fallback)
const DEFAULT_RUBRIC = [
  {
    id: 'requirements',
    label: 'Completion of Requirements',
    weight: 20, maxScore: 20,
    levels: [
      { label: 'Complete & Organized', points: 20, description: 'All requirements submitted on time; complete, accurate, and properly organized' },
      { label: 'Complete but Slightly Lacking', points: 15, description: 'All requirements submitted but with minor errors or formatting issues' },
      { label: 'Incomplete (Minor)', points: 10, description: 'Missing 1–2 minor requirements or with noticeable inconsistencies' },
      { label: 'Incomplete (Major)', points: 5, description: 'Several missing or incorrect documents' },
      { label: 'Non-compliant', points: 0, description: 'Failed to submit majority of required documents' },
    ],
  },
  {
    id: 'economic',
    label: 'Economic Background',
    weight: 30, maxScore: 30,
    levels: [
      { label: 'Highly Disadvantaged', points: 30, detail: 'Cedula: ₱5–₱150 | Electric Bills: ₱500 and below' },
      { label: 'Disadvantaged', points: 25, detail: 'Cedula: ₱151–₱500 | Electric Bills: ₱501–₱1,000' },
      { label: 'Moderately Disadvantaged', points: 20, detail: 'Cedula: ₱501–₱1,000 | Electric Bills: ₱1,001–₱2,000' },
      { label: 'Slightly Disadvantaged', points: 15, detail: 'Cedula: ₱1,001–₱2,000 | Electric Bills: ₱2,001–₱3,500' },
      { label: 'Financially Capable', points: 10, detail: 'Cedula: Above ₱2,000 | Electric Bills: Above ₱3,500' },
    ],
  },
  {
    id: 'examination',
    label: 'Examination',
    weight: 50, maxScore: 50,
    levels: [
      { label: 'Excellent (90–100%)', points: 50, description: 'Scored 90–100% on the scholarship examination' },
      { label: 'Very Good (80–89%)', points: 40, description: 'Scored 80–89% on the scholarship examination' },
      { label: 'Good (70–79%)', points: 30, description: 'Scored 70–79% on the scholarship examination' },
      { label: 'Fair (60–69%)', points: 20, description: 'Scored 60–69% on the scholarship examination' },
      { label: 'Poor (Below 60%)', points: 10, description: 'Scored below 60% on the scholarship examination' },
    ],
  },
];

const SCORE_COLOR = (score, max) => {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.85) return '#10b981';
  if (pct >= 0.65) return '#f59e0b';
  return '#ef4444';
};

export default function ApplicantEvaluation() {
  const { onMenuClick } = useOutletContext() || {};
  const { applicants } = useApp();

  const [tab, setTab] = useState('scoring');     // 'scoring' | 'rankings'
  const [rubric, setRubric] = useState(DEFAULT_RUBRIC);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected applicant for scoring
  const [selected, setSelected] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const pendingApplicants = applicants.filter(a =>
    ['pending', 'submitted', 'under_review'].includes(a.status)
  );

  const filtered = pendingApplicants.filter(a => {
    const s = searchTerm.toLowerCase();
    return !s || formatPersonName(a).toLowerCase().includes(s) ||
      (a.scholarId || '').toLowerCase().includes(s);
  });

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const loadRubric = useCallback(async () => {
    try {
      const res = await fetchRubric();
      if (res.rubric?.length) setRubric(res.rubric);
    } catch { /* use default */ }
  }, []);

  const loadRankings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEvaluationRankings();
      setRankings(res.rankings || []);
    } catch { setRankings([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRubric(); }, [loadRubric]);
  useEffect(() => { if (tab === 'rankings') loadRankings(); }, [tab, loadRankings]);

  const selectApplicant = (applicant) => {
    setSelected(applicant);
    const init = {};
    rubric.forEach(c => { init[c.id] = 0; });
    setScores(init);
    setNotes('');
  };

  const setScore = (criterionId, points) => {
    setScores(p => ({ ...p, [criterionId]: points }));
  };

  const totalScore = rubric.reduce((sum, c) => sum + (scores[c.id] || 0), 0);

  const handleSaveScore = async () => {
    if (!selected) return;
    const allScored = rubric.every(c => scores[c.id] !== undefined && scores[c.id] !== null);
    if (!allScored) {
      Swal.fire({ title: 'Incomplete', text: 'Please select a level for every criterion.', icon: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await submitEvaluationScore({
        applicationId: selected.applicationId || String(selected.id),
        scores,
        notes,
      });
      Swal.fire({ title: 'Saved', text: `Score of ${totalScore}/100 recorded.`, icon: 'success', timer: 2000, showConfirmButton: false });
      setSelected(null);
      if (tab === 'rankings') loadRankings();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (applicationId) => {
    const res = await Swal.fire({
      title: 'Finalize evaluation?',
      text: 'This locks the score and prevents further edits by staff.',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Yes, finalize',
    });
    if (!res.isConfirmed) return;
    try {
      await finalizeEvaluation({ applicationId });
      Swal.fire({ title: 'Finalized', icon: 'success', timer: 1500, showConfirmButton: false });
      loadRankings();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
    }
  };

  const exportRankings = () => {
    const rows = [
      ['Rank', 'Application ID', 'Total Score', 'Finalized', 'Encoded By', 'Date'],
      ...rankings.map(r => [r.rank, r.applicationId, r.totalScore, r.finalized ? 'Yes' : 'No', r.encodedByEmail || '', r.encodedAt || '']),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bfcsp_rankings.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page eval-app-page">
      <Header
        title="Applicant Evaluation"
        subtitle="BFCSP rubric-based scoring — Requirements (20%), Economic Background (30%), Examination (50%)"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Tabs */}
        <div className="eval-tabs">
          <button className={`eval-tab ${tab === 'scoring' ? 'active' : ''}`} onClick={() => setTab('scoring')}>
            <ClipboardCheck size={15} /> Score Applicants
          </button>
          <button className={`eval-tab ${tab === 'rankings' ? 'active' : ''}`} onClick={() => setTab('rankings')}>
            <BarChart2 size={15} /> Rankings
          </button>
        </div>

        {/* ── Scoring tab ── */}
        {tab === 'scoring' && !selected && (
          <>
            <div className="eval-filters">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search applicants…"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              <span className="filter-count">{filtered.length} applicants pending evaluation</span>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>School</th>
                    <th>Program</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No applicants pending evaluation.
                      </td>
                    </tr>
                  )}
                  {paged.map(a => (
                    <tr key={a.id}>
                      <td><strong>{formatPersonName(a)}</strong></td>
                      <td>{a.school || '—'}</td>
                      <td>{a.program || '—'}</td>
                      <td>
                        <span className="status-badge pending">{(a.status || '').toUpperCase()}</span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => selectApplicant(a)}>
                          <ClipboardCheck size={13} /> Evaluate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-container">
                <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={16} /> Previous
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
                <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Rubric scoring panel ── */}
        {tab === 'scoring' && selected && (
          <div className="rubric-panel">
            <div className="rubric-header">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>
                <ChevronLeft size={14} /> Back
              </button>
              <div>
                <h2 className="rubric-name">{formatPersonName(selected)}</h2>
                <p className="rubric-sub">{selected.school} · {selected.program}</p>
              </div>
              <div className="rubric-total" style={{ color: SCORE_COLOR(totalScore, 100) }}>
                <Star size={18} />
                <span>{totalScore}</span>
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>/100</span>
              </div>
            </div>

            <div className="rubric-criteria">
              {rubric.map(criterion => (
                <div key={criterion.id} className="criterion-card">
                  <div className="criterion-header">
                    <div>
                      <h4 className="criterion-title">{criterion.label}</h4>
                      <p className="criterion-weight">Weight: {criterion.weight}% · Max: {criterion.maxScore} pts</p>
                    </div>
                    <div
                      className="criterion-score"
                      style={{ color: SCORE_COLOR(scores[criterion.id] || 0, criterion.maxScore) }}
                    >
                      {scores[criterion.id] || 0}/{criterion.maxScore}
                    </div>
                  </div>

                  <div className="criterion-levels">
                    {criterion.levels.map(level => (
                      <label
                        key={level.points}
                        className={`level-option ${scores[criterion.id] === level.points ? 'selected' : ''}`}
                        onClick={() => setScore(criterion.id, level.points)}
                      >
                        <div className="level-radio">
                          {scores[criterion.id] === level.points && <CheckCircle size={14} />}
                        </div>
                        <div className="level-body">
                          <div className="level-label">{level.label}</div>
                          <div className="level-pts">{level.points} pts</div>
                          {(level.description || level.detail) && (
                            <div className="level-desc">{level.description || level.detail}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rubric-notes">
              <label>Evaluator Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add remarks or observations about this applicant…"
                rows={3}
              />
            </div>

            <div className="rubric-actions">
              <div className="score-summary" style={{ color: SCORE_COLOR(totalScore, 100) }}>
                <TrendingUp size={18} />
                Total Score: <strong>{totalScore}/100</strong>
                {totalScore >= 75 && <span className="qualifier-chip">Qualifies</span>}
                {totalScore < 75 && <span className="disqualifier-chip">Below threshold</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveScore} disabled={saving}>
                  {saving ? 'Saving…' : <><CheckCircle size={15} /> Save Evaluation</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Rankings tab ── */}
        {tab === 'rankings' && (
          <>
            <div className="rankings-header">
              <div className="rankings-stats">
                <div className="rank-stat"><Users size={18} /><span><strong>{rankings.length}</strong> evaluated</span></div>
                <div className="rank-stat"><Lock size={18} /><span><strong>{rankings.filter(r => r.finalized).length}</strong> finalized</span></div>
                <div className="rank-stat"><Award size={18} /><span><strong>{rankings.filter(r => r.totalScore >= 75).length}</strong> qualifiers</span></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={loadRankings} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
                <button className="btn btn-secondary" onClick={exportRankings} disabled={!rankings.length}>
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Rank</th>
                    <th>Application ID</th>
                    <th>Total Score</th>
                    <th>Breakdown</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading rankings…</td></tr>
                  )}
                  {!loading && rankings.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No evaluations recorded yet.</td></tr>
                  )}
                  {!loading && rankings.map(r => (
                    <tr key={r.id} className={r.rank <= 3 ? 'top-rank' : ''}>
                      <td>
                        <div className={`rank-badge rank-${r.rank}`}>
                          {r.rank <= 3 ? <Award size={13} /> : null}
                          #{r.rank}
                        </div>
                      </td>
                      <td><code style={{ fontSize: '0.82rem' }}>{r.applicationId}</code></td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: SCORE_COLOR(r.totalScore, 100) }}>
                          {r.totalScore}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>/100</span>
                      </td>
                      <td>
                        <div className="score-breakdown">
                          {(r.scoreBreakdown || []).map(b => (
                            <span key={b.id} className="breakdown-chip" title={b.label}>
                              {b.label?.split(' ')[0]}: {b.score}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {r.finalized
                          ? <span className="status-badge approved">Finalized</span>
                          : <span className="status-badge pending">Draft</span>}
                        {r.totalScore >= 75
                          ? <span className="status-badge approved" style={{ marginLeft: 4 }}>Qualifies</span>
                          : <span className="status-badge rejected" style={{ marginLeft: 4 }}>Below Threshold</span>}
                      </td>
                      <td>
                        {!r.finalized && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleFinalize(r.applicationId)}>
                            <Lock size={12} /> Finalize
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <style>{`
        .eval-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
        .eval-tab { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.1rem; border: 1px solid transparent; border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.15s; }
        .eval-tab:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .eval-tab.active { background: var(--primary-light, rgba(99,102,241,0.1)); color: var(--primary); border-color: var(--primary); }
        .eval-filters { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .filter-count { font-size: 0.85rem; color: var(--text-secondary); }
        .search-box { display: flex; align-items: center; gap: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 0.75rem; flex: 1; max-width: 360px; }
        .search-box input { border: none; background: none; outline: none; padding: 0.45rem 0; font-size: 0.875rem; color: var(--text-primary); width: 100%; }
        /* Rubric panel */
        .rubric-panel { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 1.5rem; }
        .rubric-header { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .rubric-name { margin: 0; font-size: 1.2rem; color: var(--text-primary); }
        .rubric-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--text-secondary); }
        .rubric-total { display: flex; align-items: center; gap: 6px; font-size: 1.8rem; font-weight: 800; margin-left: auto; }
        .rubric-criteria { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 1.5rem; }
        .criterion-card { border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.1rem; background: var(--bg-secondary); }
        .criterion-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .criterion-title { margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }
        .criterion-weight { margin: 3px 0 0; font-size: 0.78rem; color: var(--text-secondary); }
        .criterion-score { font-size: 1.3rem; font-weight: 800; }
        .criterion-levels { display: flex; flex-direction: column; gap: 0.5rem; }
        .level-option { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.65rem 0.85rem; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.15s; background: var(--card-bg); }
        .level-option:hover { border-color: var(--primary); background: rgba(99,102,241,0.05); }
        .level-option.selected { border-color: var(--primary); background: rgba(99,102,241,0.12); }
        .level-radio { width: 20px; height: 20px; border: 2px solid var(--border-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; color: var(--primary); }
        .level-option.selected .level-radio { border-color: var(--primary); }
        .level-body { flex: 1; }
        .level-label { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); }
        .level-pts { font-size: 0.8rem; color: var(--primary); font-weight: 700; }
        .level-desc { font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px; }
        .rubric-notes { margin-bottom: 1.5rem; }
        .rubric-notes label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 0.5rem; }
        .rubric-notes textarea { width: 100%; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); padding: 0.75rem; font-size: 0.875rem; resize: vertical; }
        .rubric-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .score-summary { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 600; }
        .qualifier-chip { background: rgba(16,185,129,0.15); color: #10b981; padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700; margin-left: 6px; }
        .disqualifier-chip { background: rgba(239,68,68,0.12); color: #ef4444; padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700; margin-left: 6px; }
        /* Rankings */
        .rankings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem; }
        .rankings-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .rank-stat { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--text-secondary); }
        .rank-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; background: var(--bg-secondary); color: var(--text-secondary); }
        .rank-1 { background: rgba(251,191,36,0.2); color: #d97706; }
        .rank-2 { background: rgba(148,163,184,0.2); color: #64748b; }
        .rank-3 { background: rgba(180,83,9,0.15); color: #b45309; }
        .score-breakdown { display: flex; flex-wrap: wrap; gap: 4px; }
        .breakdown-chip { background: var(--bg-secondary); padding: 2px 7px; border-radius: 6px; font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap; }
        .top-rank { background: rgba(251,191,36,0.04); }
        .table-container { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); overflow-x: auto; margin-bottom: 1rem; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pagination-container { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 0.75rem 0; }
        .pagination-btn { display: flex; align-items: center; gap: 4px; padding: 0.4rem 0.85rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--card-bg); color: var(--text-secondary); cursor: pointer; font-size: 0.85rem; }
        .pagination-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
