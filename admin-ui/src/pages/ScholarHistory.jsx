import { useState, useMemo, useEffect, useRef } from 'react';
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
  Upload,
  Eye,
  X,
  Archive,
  GraduationCap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';

export default function ScholarHistory() {
  const { scholarHistory, restoreScholarFromHistory, importLegacyScholars } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const fileInputRef = useRef(null);

  // Restore an archived scholar (graduated or terminated) back to active.
  const handleRestore = async (entry) => {
    const wasStatus = entry.status === 'graduated' ? 'Graduated' : 'Terminated';
    const result = await Swal.fire({
      title: 'Restore scholar?',
      html: `<b>${entry.fullName || 'This scholar'}</b> (${wasStatus}) will be moved back to the active Scholars list as <b>Active</b>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Restore',
      confirmButtonColor: 'var(--primary)',
    });
    if (!result.isConfirmed) return;
    try {
      await restoreScholarFromHistory(entry);
      setSelected(null);
      Swal.fire({
        icon: 'success',
        title: 'Restored',
        text: `${entry.fullName || 'Scholar'} is active again.`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Restore failed', text: e?.message || 'Could not restore the scholar.' });
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
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

  const schoolYears = useMemo(
    () => [...new Set(scholarHistory.map((h) => h.schoolYear).filter(Boolean))].sort().reverse(),
    [scholarHistory]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return scholarHistory
      .filter((h) => {
        const matchesSearch =
          !term ||
          (h.fullName || '').toLowerCase().includes(term) ||
          (h.scholarId || '').toLowerCase().includes(term) ||
          (h.course || '').toLowerCase().includes(term) ||
          (h.school || '').toLowerCase().includes(term);
        const matchesStatus = !filterStatus || h.status === filterStatus;
        const matchesYear = !filterSchoolYear || h.schoolYear === filterSchoolYear;
        return matchesSearch && matchesStatus && matchesYear;
      })
      .sort((a, b) => {
        const { column, direction } = sortConfig;
        const mult = direction === 'asc' ? 1 : -1;
        const av = a[column] ?? '';
        const bv = b[column] ?? '';
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
      });
  }, [scholarHistory, searchTerm, filterStatus, filterSchoolYear, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSchoolYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageClamped = Math.min(currentPage, totalPages);
  const startIndex = (pageClamped - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Download a ready-to-fill Excel template with the expected headers so the
  // client can drop their old records straight into the right columns.
  const handleDownloadTemplate = () => {
    const example = [
      {
        'Scholar ID': '2019-00001',
        'Full Name': 'Juan Dela Cruz',
        Course: 'Bachelor of Science in Information Technology',
        School: 'Divine Word College',
        'School Year': '2018-2019',
        Status: 'Graduated',
        'Scholarship Start': '2015',
        'Scholarship End': '2019',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(example);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scholar History');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'scholar_history_import_template.xlsx'
    );
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file fires onChange
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        Swal.fire({ icon: 'info', title: 'Empty file', text: 'No rows were found in the first sheet.' });
        return;
      }

      const confirm = await Swal.fire({
        title: 'Import scholar history?',
        html: `Found <b>${rows.length}</b> row(s) in <b>${file.name}</b>.<br/>They'll be added to Scholar History as archived legacy scholars.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Import',
        confirmButtonColor: 'var(--primary)',
      });
      if (!confirm.isConfirmed) return;

      Swal.fire({ title: 'Importing…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await importLegacyScholars(rows);

      if (res.offline) {
        Swal.fire({ icon: 'error', title: 'Offline', text: 'Could not reach the database. Please try again.' });
        return;
      }

      Swal.fire({
        icon: 'success',
        title: 'Import complete',
        html:
          `Imported: <b>${res.imported}</b><br/>` +
          `Skipped (duplicate Scholar ID): <b>${res.skipped}</b><br/>` +
          `Invalid (missing Full Name): <b>${res.invalid}</b>`,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Import failed', text: err?.message || 'Could not read the Excel file.' });
    }
  };

  const StatusBadge = ({ status }) => (
    <span className={`history-status-badge ${status === 'graduated' ? 'graduated' : 'terminated'}`}>
      {status === 'graduated' ? 'Graduated' : 'Terminated'}
    </span>
  );

  return (
    <div className="page">
      <Header
        title="Scholar History"
        subtitle="Archived scholars — graduated, terminated, or inactive scholarships"
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
                  placeholder="Search by name, Scholar ID, course, school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="graduated">Graduated</option>
                <option value="terminated">Terminated</option>
              </select>
              <select className="filter-select" value={filterSchoolYear} onChange={(e) => setFilterSchoolYear(e.target.value)}>
                <option value="">All School Years</option>
                {schoolYears.map((sy) => (
                  <option key={sy} value={sy}>{sy}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="actions-right">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <Download size={18} />
              Template
            </button>
            <button className="btn btn-primary" onClick={handleImportClick}>
              <Upload size={18} />
              Import Excel
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('scholarId')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Scholar ID <SortIcon column="scholarId" /></div>
                </th>
                <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Full Name <SortIcon column="fullName" /></div>
                </th>
                <th onClick={() => handleSort('course')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Course <SortIcon column="course" /></div>
                </th>
                <th onClick={() => handleSort('school')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>School <SortIcon column="school" /></div>
                </th>
                <th>Start Date</th>
                <th>End Date</th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Status <SortIcon column="status" /></div>
                </th>
                <th onClick={() => handleSort('archivedDate')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Archived Date <SortIcon column="archivedDate" /></div>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((h) => (
                <tr key={h.historyId}>
                  <td>{h.scholarId || '—'}</td>
                  <td>{h.fullName || '—'}</td>
                  <td>{h.course || '—'}</td>
                  <td>{h.school || '—'}</td>
                  <td>{h.scholarshipStartDate || '—'}</td>
                  <td>{h.scholarshipEndDate || '—'}</td>
                  <td><StatusBadge status={h.status} /></td>
                  <td>{(h.archivedDate || '').split('T')[0] || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view" title="View scholar profile" onClick={() => setSelected(h)}>
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn"
                        title="Restore to active scholars"
                        onClick={() => handleRestore(h)}
                        style={{ background: 'rgba(45, 149, 150, 0.15)', color: 'var(--primary-light)' }}
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <EmptyState icon={Archive} title="No archived scholars" message="Graduated or terminated scholars will appear here." />
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
              <h2>Scholar Profile (Archived)</h2>
              <button className="modal-close" onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <GraduationCap size={22} />
                  <h3 style={{ margin: 0 }}>{selected.fullName || 'Scholar'}</h3>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="detail-grid">
                  <DetailRow label="Scholar ID" value={selected.scholarId} />
                  <DetailRow label="Course" value={selected.course} />
                  <DetailRow label="School" value={selected.school} />
                  <DetailRow label="Scholarship Start" value={selected.scholarshipStartDate} />
                  <DetailRow label="Scholarship End" value={selected.scholarshipEndDate} />
                  <DetailRow label="School Year" value={selected.schoolYear} />
                  <DetailRow label="Year Level" value={selected.snapshot?.yearLevel} />
                  <DetailRow label="Email" value={selected.snapshot?.email} />
                  <DetailRow label="Contact Number" value={selected.snapshot?.contactNumber} />
                  <DetailRow label="Archived Date" value={(selected.archivedDate || '').split('T')[0]} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => handleRestore(selected)}>
                <RotateCcw size={16} />
                Restore to Active
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
      <span className="detail-value">{value || value === 0 ? value : '—'}</span>
    </div>
  );
}
