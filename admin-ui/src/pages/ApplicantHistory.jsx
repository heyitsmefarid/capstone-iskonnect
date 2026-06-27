import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import { Pagination, EmptyState } from '../components/common';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Search,
  Download,
  Eye,
  RotateCcw,
  X,
  Archive,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export default function ApplicantHistory() {
  const { applicantHistory, restoreFromHistory } = useApp();
  const { onMenuClick } = useOutletContext() || {};

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [sortConfig, setSortConfig] = useState({ column: 'archivedDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selected, setSelected] = useState(null);

  const handleSort = (column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.column !== column) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  // Distinct school years present in the archive, for the filter dropdown.
  const schoolYears = useMemo(
    () => [...new Set(applicantHistory.map((h) => h.schoolYear).filter(Boolean))].sort().reverse(),
    [applicantHistory]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return applicantHistory
      .filter((h) => {
        const matchesSearch =
          !term ||
          (h.fullName || '').toLowerCase().includes(term) ||
          (h.email || '').toLowerCase().includes(term) ||
          (h.applicantId || '').toLowerCase().includes(term) ||
          (h.contactNumber || '').toLowerCase().includes(term);
        const matchesYear = !filterSchoolYear || h.schoolYear === filterSchoolYear;
        const matchesReason = !filterReason || h.reason === filterReason;
        return matchesSearch && matchesYear && matchesReason;
      })
      .sort((a, b) => {
        const { column, direction } = sortConfig;
        const mult = direction === 'asc' ? 1 : -1;
        const av = a[column] ?? '';
        const bv = b[column] ?? '';
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
      });
  }, [applicantHistory, searchTerm, filterSchoolYear, filterReason, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSchoolYear, filterReason]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageClamped = Math.min(currentPage, totalPages);
  const startIndex = (pageClamped - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const reasons = useMemo(
    () => [...new Set(applicantHistory.map((h) => h.reason).filter(Boolean))],
    [applicantHistory]
  );

  const handleExport = () => {
    if (filtered.length === 0) {
      Swal.fire({ icon: 'info', title: 'Nothing to export', text: 'No archived applicants match the current filters.' });
      return;
    }
    const rows = filtered.map((h) => ({
      'Applicant ID': h.applicantId || '',
      'Full Name': h.fullName || '',
      Email: h.email || '',
      'Contact Number': h.contactNumber || '',
      'Application Date': h.applicationDate || '',
      'School Year': h.schoolYear || '',
      Reason: h.reason || '',
      'Archived Date': (h.archivedDate || '').split('T')[0],
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applicant History');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `applicant_history_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const handleRestore = async (entry) => {
    const result = await Swal.fire({
      title: 'Restore Applicant?',
      text: `${entry.fullName || 'This applicant'} will be moved back to the active Applicants list.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, restore',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    await restoreFromHistory(entry);
    setSelected(null);
    Swal.fire({ icon: 'success', title: 'Restored!', text: 'Applicant moved back to the active list.', timer: 1800, showConfirmButton: false });
  };

  return (
    <div className="page">
      <Header
        title="Applicant History"
        subtitle="Archived applicants — rejected, not approved, inactive or expired"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="actions-bar">
          <div className="actions-left">
            <div className="filters-grid">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search by name, email, ID, contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select className="filter-select" value={filterSchoolYear} onChange={(e) => setFilterSchoolYear(e.target.value)}>
                <option value="">All School Years</option>
                {schoolYears.map((sy) => (
                  <option key={sy} value={sy}>{sy}</option>
                ))}
              </select>
              <select className="filter-select" value={filterReason} onChange={(e) => setFilterReason(e.target.value)}>
                <option value="">All Reasons</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="actions-right">
            <button className="btn btn-secondary" onClick={handleExport}>
              <Download size={18} />
              Export Excel
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('applicantId')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Applicant ID <SortIcon column="applicantId" /></div>
                </th>
                <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Full Name <SortIcon column="fullName" /></div>
                </th>
                <th>Email</th>
                <th>Contact Number</th>
                <th onClick={() => handleSort('applicationDate')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Application Date <SortIcon column="applicationDate" /></div>
                </th>
                <th onClick={() => handleSort('schoolYear')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>School Year <SortIcon column="schoolYear" /></div>
                </th>
                <th>Reason</th>
                <th onClick={() => handleSort('archivedDate')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Archived Date <SortIcon column="archivedDate" /></div>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((h) => (
                <tr key={h.historyId}>
                  <td title={h.applicantId} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.applicantId || '—'}
                  </td>
                  <td>{h.fullName || '—'}</td>
                  <td>{h.email || '—'}</td>
                  <td>{h.contactNumber || '—'}</td>
                  <td>{h.applicationDate || '—'}</td>
                  <td>{h.schoolYear || '—'}</td>
                  <td>
                    <span className="history-reason-badge">{h.reason || 'Inactive'}</span>
                  </td>
                  <td>{(h.archivedDate || '').split('T')[0] || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view" title="View details" onClick={() => setSelected(h)}>
                        <Eye size={16} />
                      </button>
                      <button className="action-btn" title="Restore applicant" onClick={() => handleRestore(h)}>
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <EmptyState icon={Archive} title="No archived applicants" message="Rejected, not-approved, or expired applicants will appear here." />
          )}

          {filtered.length > 0 && (
            <Pagination
              currentPage={pageClamped}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Archived Applicant Details</h2>
              <button className="modal-close" onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>{selected.fullName || 'Applicant'}</h3>
                <div className="detail-grid">
                  <DetailRow label="Applicant ID" value={selected.applicantId} />
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="Contact Number" value={selected.contactNumber} />
                  <DetailRow label="Application Date" value={selected.applicationDate} />
                  <DetailRow label="School Year" value={selected.schoolYear} />
                  <DetailRow label="Reason" value={selected.reason} />
                  <DetailRow label="Archived Date" value={(selected.archivedDate || '').split('T')[0]} />
                  <DetailRow label="School" value={selected.snapshot?.school} />
                  <DetailRow label="Program" value={selected.snapshot?.program} />
                  <DetailRow label="Gender" value={selected.snapshot?.gender} />
                  <DetailRow label="City" value={selected.snapshot?.city} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => handleRestore(selected)}>
                <RotateCcw size={16} /> Restore Applicant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '—'}</span>
    </div>
  );
}
