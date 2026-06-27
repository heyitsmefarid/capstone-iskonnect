import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import { matchesExact } from '../utils/filtering';
import { formatPersonName } from '../utils/nameFormat';
import {
  TrendingUp,
  User,
  FileText,
  Award,
  GraduationCap,
  Briefcase,
  Calendar,
  Building2,
} from 'lucide-react';

export default function ScholarshipTimeline() {
  const { applicants, schools } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const [filterSchool, setFilterSchool] = useState('');
  const [filterStage, setFilterStage] = useState('');

  const isEmployedScholar = (scholar) => {
    const notes = String(scholar.notes || '').toLowerCase();
    const employmentStatus = String(scholar.employmentStatus || '').toLowerCase();

    return (
      scholar.status === 'employed' ||
      scholar.employed === true ||
      employmentStatus === 'employed' ||
      /working as|currently working|employed/.test(notes)
    );
  };

  const isBoardPasserScholar = (scholar) => {
    const notes = String(scholar.notes || '').toLowerCase();
    const timelineNotes = String(scholar.timelineNotes || '').toLowerCase();

    return (
      scholar.status === 'board-passer' ||
      scholar.boardPassed === true ||
      scholar.boardExamPassed === true ||
      /board passer|passed board|board exam|topnotcher|top board/.test(notes) ||
      /board passer|passed board|board exam|topnotcher|top board/.test(timelineNotes)
    );
  };

  const getScholarStage = (scholar) => {
    if (isEmployedScholar(scholar)) return 'employed';
    if (isBoardPasserScholar(scholar)) return 'board-passer';
    if (scholar.status === 'graduated') return 'graduated';
    if (scholar.status === 'active' || scholar.status === 'on-hold' || scholar.status === 'approved') return 'scholar';
    if (scholar.status === 'pending') return 'applicant';
    return 'applicant';
  };

  const schoolFilteredScholars = applicants.filter(s =>
    matchesExact(s.school, filterSchool)
  );

  const filteredScholars = schoolFilteredScholars.filter(s => {
    if (filterStage && getScholarStage(s) !== filterStage) return false;
    return true;
  });

  const stages = [
    { id: 'applicant', label: 'Applicant', icon: FileText, color: '#3b82f6' },
    { id: 'scholar', label: 'Scholar', icon: User, color: '#10b981' },
    { id: 'graduated', label: 'Graduated', icon: GraduationCap, color: '#f59e0b' },
    { id: 'board-passer', label: 'Board Passer', icon: Award, color: '#8b5cf6' },
    { id: 'employed', label: 'Employed', icon: Briefcase, color: '#ec4899' },
  ];

  const getStageData = () => {
    return stages.map(stage => ({
      ...stage,
      count: schoolFilteredScholars.filter(s => getScholarStage(s) === stage.id).length,
    }));
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Not recorded';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return 'Not recorded';
    return parsed.toLocaleDateString();
  };

  const getDisplayScholarId = (scholar) => {
    if (scholar.scholarId) return scholar.scholarId;
    return `TMP-${String(scholar.id).padStart(5, '0')}`;
  };

  const getSortableTime = (dateValue) => {
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const stageData = getStageData();

  return (
    <div className="page timeline-page">
      <Header
        title="Scholarship Timeline"
        subtitle="Track scholar progress from applicant to employment"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Filter */}
        <div className="filters-bar">
          <select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All Schools</option>
            {schools.map(school => (
              <option key={school.id} value={school.name}>{school.name}</option>
            ))}
          </select>
        </div>

        {/* Timeline Stages */}
        <div className="timeline-stages">
          {stageData.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="timeline-stage">
                <div
                  className="stage-card"
                  style={{
                    borderColor: stage.color,
                    cursor: 'pointer',
                    outline: filterStage === stage.id ? `3px solid ${stage.color}` : 'none',
                    outlineOffset: '3px',
                    opacity: filterStage && filterStage !== stage.id ? 0.5 : 1,
                  }}
                  onClick={() => setFilterStage(prev => prev === stage.id ? '' : stage.id)}
                  title={filterStage === stage.id ? 'Click to clear filter' : `Filter by ${stage.label}`}
                >
                  <div className="stage-icon" style={{ background: stage.color }}>
                    <Icon size={32} color="white" />
                  </div>
                  <h3>{stage.label}</h3>
                  <div className="stage-count">{stage.count}</div>
                  <p className="stage-label">Scholars</p>
                  {filterStage === stage.id && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: stage.color, fontWeight: 600 }}>● Filtering</div>
                  )}
                </div>
                {index < stageData.length - 1 && (
                  <div className="stage-arrow">→</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scholar Timeline List */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              Scholar Timeline History
              {filterStage && (
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', fontWeight: 500, color: stages.find(s => s.id === filterStage)?.color }}>
                  — {stages.find(s => s.id === filterStage)?.label} ({filteredScholars.length})
                </span>
              )}
            </h3>
            {filterStage && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setFilterStage('')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                ✕ Clear Filter
              </button>
            )}
          </div>
          <div className="timeline-list">
            {filteredScholars
              .sort((a, b) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt))
              .map(scholar => {
                const stage = getScholarStage(scholar);
                const currentStage = stages.find(s => s.id === stage);
                const Icon = currentStage?.icon || User;
                
                return (
                  <div key={scholar.id} className="timeline-item">
                    <div className="timeline-marker" style={{ background: currentStage?.color }}>
                      <Icon size={20} color="white" />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <div>
                          <h4>{formatPersonName(scholar)}</h4>
                          <p className="scholar-id">{getDisplayScholarId(scholar)}</p>
                        </div>
                        <div className="timeline-actions">
                          <div className="stage-badge" style={{ background: currentStage?.color }}>
                            {currentStage?.label}
                          </div>
                        </div>
                      </div>
                      <div className="timeline-details">
                        <div className="detail-item">
                          <Building2 size={14} />
                          <span>{scholar.school}</span>
                        </div>
                        <div className="detail-item">
                          <Calendar size={14} />
                          <span>Started: {formatDate(scholar.createdAt)}</span>
                        </div>
                        {scholar.scholarshipGrantedDate && (
                          <div className="detail-item">
                            <Award size={14} />
                            <span>Granted: {formatDate(scholar.scholarshipGrantedDate)}</span>
                          </div>
                        )}
                        {scholar.graduationDate && (
                          <div className="detail-item">
                            <GraduationCap size={14} />
                            <span>Graduated: {formatDate(scholar.graduationDate)}</span>
                          </div>
                        )}
                        {scholar.boardExamDate && (
                          <div className="detail-item">
                            <Award size={14} />
                            <span>Board Exam: {formatDate(scholar.boardExamDate)}</span>
                          </div>
                        )}
                        {scholar.employmentDate && (
                          <div className="detail-item">
                            <Briefcase size={14} />
                            <span>Employed: {formatDate(scholar.employmentDate)}</span>
                          </div>
                        )}
                      </div>

                      {(scholar.boardExamRemarks || scholar.timelineNotes || scholar.notes) && (
                        <div className="timeline-notes">
                          {scholar.boardExamRemarks && (
                            <p><strong>🏆 Board Exam:</strong> {scholar.boardExamRemarks}</p>
                          )}
                          {scholar.timelineNotes && (
                            <p><strong>📌 Update:</strong> {scholar.timelineNotes}</p>
                          )}
                          {scholar.notes && !scholar.timelineNotes && (
                            <p><strong>📝 Notes:</strong> {scholar.notes}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Progress Bar */}
                      <div className="progress-timeline">
                        {stages.map((s, idx) => {
                          const isActive = stages.findIndex(st => st.id === stage) >= idx;
                          return (
                            <div
                              key={s.id}
                              className="progress-step"
                              style={{ background: isActive ? s.color : undefined }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .timeline-page {
          background: var(--bg-secondary);
        }

        .timeline-stages {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          margin-bottom: 3rem;
          flex-wrap: wrap;
        }

        .timeline-stage {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stage-card {
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 1rem;
          border: 3px solid;
          text-align: center;
          min-width: 180px;
          transition: all 0.3s;
        }

        .stage-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-lg);
        }

        .stage-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }

        .stage-card h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .stage-count {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary-color);
        }

        .stage-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .stage-arrow {
          font-size: 2rem;
          color: var(--text-secondary);
          font-weight: bold;
        }

        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .timeline-item {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          background: var(--bg-secondary);
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .timeline-item:hover {
          background: var(--bg-tertiary);
          box-shadow: var(--shadow-md);
        }

        .timeline-marker {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .timeline-header h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .scholar-id {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-family: 'Courier New', monospace;
        }

        .stage-badge {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .timeline-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .timeline-details {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .detail-item svg {
          color: var(--primary-color);
        }

        .timeline-notes {
          margin-top: 1rem;
          padding: 0.8rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }

        .timeline-notes p {
          margin: 0.2rem 0;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .progress-timeline {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .progress-step {
          flex: 1;
          height: 8px;
          background: var(--bg-secondary);
          border-radius: 4px;
        }

        @media (max-width: 768px) {
          .timeline-stages {
            flex-direction: column;
          }

          .timeline-header {
            flex-direction: column;
            gap: 0.75rem;
          }

          .timeline-actions {
            width: 100%;
            justify-content: space-between;
          }

          .stage-arrow {
            transform: rotate(90deg);
          }

          .timeline-details {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
