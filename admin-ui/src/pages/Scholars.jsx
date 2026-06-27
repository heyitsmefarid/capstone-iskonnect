import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Users,
  Search,
  Filter,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Pause,
  Award,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  FileText,
  Upload,
  Download,
} from 'lucide-react';
import { matchesExact, matchesSearch } from '../utils/filtering';
import { bulkCreateScholars } from '../services/backendApi';

export default function Scholars() {
  const { applicants, catalogSchools, catalogPrograms, updateApplicant } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const SCHOLARSHIP_CAP = 25000;

  const computeReflectedAmount = (tuitionFee) => {
    const normalizedTuition = Math.max(0, Number(tuitionFee) || 0);
    return Math.min(normalizedTuition, SCHOLARSHIP_CAP);
  };

  // The scholar app stores the profile photo as a full URL, a data URI, or raw
  // base64. Normalize all three into something an <img src> can render.
  const resolveImageSrc = (pic) => {
    const raw = String(pic || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
    return `data:image/jpeg;base64,${raw}`;
  };

  // Looks up the tuition cap configured for the scholar's program in the shared
  // Academic Programs catalog (Firestore-backed; matched by program name, then
  // school).
  const getProgramTuitionCap = (scholar) => {
    const programs = catalogPrograms || [];
    const match =
      programs.find((p) => p.name === scholar?.program && p.school === scholar?.school) ||
      programs.find((p) => p.name === scholar?.program);
    return Math.max(0, Number(match?.tuitionCap) || 0);
  };

  // The tuition fee to bill against: the scholar's own value when an admin has
  // set one, otherwise the program's configured cap from System Settings.
  const getEffectiveTuition = (scholar) => {
    const explicit = Math.max(0, Number(scholar?.tuitionFee) || 0);
    return explicit > 0 ? explicit : getProgramTuitionCap(scholar);
  };

  // Per-semester grant: an explicit amountGranted wins; otherwise it's the
  // capped reflection of the effective tuition (program cap).
  const getPerSemGranted = (scholar) => {
    const explicitGrant = Math.max(0, Number(scholar?.amountGranted) || 0);
    return explicitGrant > 0 ? explicitGrant : computeReflectedAmount(getEffectiveTuition(scholar));
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [filterYearAwarded, setFilterYearAwarded] = useState('');
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ column: 'name', direction: 'asc' });
  const [isEditingFinancial, setIsEditingFinancial] = useState(false);
  const [financialData, setFinancialData] = useState({ tuitionFee: 0 });

  // Helper function to convert year level to ordinal format
  const getYearLevelText = (yearLevel) => {
    const ordinals = ['1st', '2nd', '3rd', '4th'];
    return yearLevel && yearLevel <= 4 ? `${ordinals[yearLevel - 1]} Year` : `Year ${yearLevel}`;
  };

  // Year level is derived from progress: every 2 completed semesters advances
  // the scholar one year level (0-1 sems = 1st year, 2-3 = 2nd, 4-5 = 3rd,
  // 6+ = 4th). The scholarship is 4 years / 8 semesters, so there is no 5th year.
  const getEffectiveYearLevel = (scholar) => {
    const sems = Math.max(0, Number(scholar?.semestersUsed) || 0);
    return Math.min(4, Math.floor(sems / 2) + 1);
  };

  // Helper function to format academic year
  const getAcademicYear = (year) => {
    if (!year) return 'N/A';
    return `${year}-${year + 1}`;
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSchool, filterStatus, filterYearLevel, filterYearAwarded]);

  // Reset editing state when modal closes or changes
  useEffect(() => {
    setIsEditingFinancial(false);
  }, [selectedScholar]);


  // Sorting handler
  const handleSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sort icon component
  const SortIcon = ({ column }) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={14} /> : 
      <ArrowDown size={14} />;
  };

  // Filter scholars (an approved applicant becomes a City Scholar)
  const scholars = applicants.filter(a =>
    ['approved', 'active', 'on-hold', 'graduated', 'terminated'].includes(a.status)
  );

  // School filter options: the eligible-schools catalog (managed in System
  // Settings) PLUS any school that actually appears on a scholar record (covers
  // schools not in the catalog), so every school present in the data is selectable.
  const schoolFilterOptions = Array.from(new Set([
    ...(catalogSchools || []).map(s => s?.name).filter(Boolean),
    ...scholars.map(s => s?.school).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const filteredScholars = scholars.filter(scholar => {
    const matchesSearchTerm = matchesSearch(
      [
        `${scholar.firstName} ${scholar.lastName}`,
        scholar.scholarId,
        scholar.email,
        scholar.school,
      ],
      searchTerm
    );
    const matchesSchool = matchesExact(scholar.school, filterSchool);
    const matchesStatus = !filterStatus || scholar.status === filterStatus;
    const matchesYearLevel = !filterYearLevel || getEffectiveYearLevel(scholar) === Number(filterYearLevel);
    const matchesYearAwarded = !filterYearAwarded || scholar.yearAwarded === Number(filterYearAwarded);
    return matchesSearchTerm && matchesSchool && matchesStatus && matchesYearLevel && matchesYearAwarded;
  }).sort((a, b) => {
    const { column, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;
    
    switch (column) {
      case 'name':
        const nameA = `${a.lastName}, ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName}, ${b.firstName}`.toLowerCase();
        return nameA.localeCompare(nameB) * multiplier;
      case 'scholarId':
        return (a.scholarId || '').localeCompare(b.scholarId || '') * multiplier;
      case 'school':
        return a.school.localeCompare(b.school) * multiplier;
      case 'program':
        return (a.program || '').localeCompare(b.program || '') * multiplier;
      case 'yearLevel':
        return (getEffectiveYearLevel(a) - getEffectiveYearLevel(b)) * multiplier;
      case 'yearAwarded':
        return ((a.yearAwarded || 0) - (b.yearAwarded || 0)) * multiplier;
      case 'semesters':
        return ((a.semestersUsed || 0) - (b.semestersUsed || 0)) * multiplier;
      case 'status':
        return (a.status || '').localeCompare(b.status || '') * multiplier;
      default:
        return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(filteredScholars.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedScholars = filteredScholars.slice(startIndex, endIndex);

  const handleViewDetails = (scholar) => {
    setSelectedScholar(scholar);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
      case 'active':
        return <CheckCircle className="status-icon-active" size={20} />;
      case 'on-hold':
        return <Pause className="status-icon-warning" size={20} />;
      case 'graduated':
        return <Award className="status-icon-success" size={20} />;
      case 'terminated':
        return <XCircle className="status-icon-danger" size={20} />;
      default:
        return <XCircle className="status-icon-danger" size={20} />;
    }
  };

  const stats = {
    total: scholars.length,
    active: scholars.filter(s => s.status === 'active' || s.status === 'approved').length,
    onHold: scholars.filter(s => s.status === 'on-hold').length,
    graduated: scholars.filter(s => s.status === 'graduated').length,
    terminated: scholars.filter(s => s.status === 'terminated').length,
  };

  const getSemesterRecords = (scholar) => {
    const grades = scholar?.grades || [];
    const coes = scholar?.certificatesOfEnrollment || [];
    const enrolled = scholar?.enrolledSemesters || [];

    const recordMap = new Map();

    // Seed records from the semesters the scholar was enrolled into when the
    // admin advanced the active term, so they appear even before grades/COE.
    enrolled.forEach((entry) => {
      const key = `${entry.schoolYear || 'N/A'}|${entry.semester || 'N/A'}`;
      recordMap.set(key, {
        schoolYear: entry.schoolYear || 'N/A',
        semester: entry.semester || 'N/A',
        gradeValue: null,
        subjects: [],
        corStatus: null,
        corFileName: null,
      });
    });

    grades.forEach((gradeEntry) => {
      const key = `${gradeEntry.schoolYear || 'N/A'}|${gradeEntry.semester || 'N/A'}`;
      recordMap.set(key, {
        schoolYear: gradeEntry.schoolYear || 'N/A',
        semester: gradeEntry.semester || 'N/A',
        gradeValue: gradeEntry.gwa ?? null,
        subjects: gradeEntry.subjects || [],
        corStatus: null,
        corFileName: null,
      });
    });

    coes.forEach((coeEntry) => {
      const key = `${coeEntry.schoolYear || 'N/A'}|${coeEntry.semester || 'N/A'}`;
      const existing = recordMap.get(key) || {
        schoolYear: coeEntry.schoolYear || 'N/A',
        semester: coeEntry.semester || 'N/A',
        gradeValue: null,
        subjects: [],
      };

      recordMap.set(key, {
        ...existing,
        corStatus: coeEntry.status || 'pending',
        corFileName: coeEntry.fileName || null,
      });
    });

    const semOrder = { '1st Semester': 1, '2nd Semester': 2 };

    return Array.from(recordMap.values()).sort((a, b) => {
      if (a.schoolYear !== b.schoolYear) {
        return String(b.schoolYear).localeCompare(String(a.schoolYear));
      }
      return (semOrder[a.semester] || 99) - (semOrder[b.semester] || 99);
    });
  };

  // The grant breakdown reflects only the semesters the scholarship was
  // actually disbursed for (the enrolled terms) — NOT every academic record
  // (grades/COE). A scholar progresses sequentially, so each term's label is
  // derived from its chronological position: 1st granted term = "1st Semester"
  // of their starting year, 2nd = "2nd Semester", then the next school year, etc.
  const getGrantBreakdown = (scholar, perSemGranted) => {
    const enrolled = [...(scholar?.enrolledSemesters || [])].sort((a, b) =>
      String(a.enrolledAt || '').localeCompare(String(b.enrolledAt || ''))
    );
    const startYear =
      parseInt(String(scholar?.schoolYear || '').split('-')[0], 10) ||
      Number(scholar?.yearAwarded) ||
      new Date().getFullYear();

    const semesterRows = enrolled.map((entry, i) => {
      const sy = startYear + Math.floor(i / 2); // new school year every 2 sems
      return {
        schoolYear: `${sy}-${sy + 1}`,
        semester: i % 2 === 0 ? '1st Semester' : '2nd Semester',
        grantedAmount: perSemGranted || 0,
      };
    });

    const totalsByYear = semesterRows.reduce((acc, row) => {
      acc[row.schoolYear] = (acc[row.schoolYear] || 0) + row.grantedAmount;
      return acc;
    }, {});

    const yearRows = Object.entries(totalsByYear)
      .map(([schoolYear, totalGranted]) => ({ schoolYear, totalGranted }))
      .sort((a, b) => String(a.schoolYear).localeCompare(String(b.schoolYear)));

    return { semesterRows, yearRows };
  };

  // ── Bulk scholar account import ───────────────────────────────────────────
  const fileInputRef = useRef(null);
  const IMPORT_CHUNK_SIZE = 50;

  const handleDownloadTemplate = () => {
    const example = [
      {
        'Full Name': 'Juan Dela Cruz',
        Email: 'juan.delacruz@example.com',
        School: 'Divine Word College',
        Program: 'Bachelor of Science in Information Technology',
        'Year Level': 2,
        'Number of Semesters': 2,
        Status: 'Active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(example);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scholars');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'scholar_accounts_import_template.xlsx'
    );
  };

  const handleImportClick = () => fileInputRef.current?.click();

  // Builds a credentials workbook (email + temporary password) from the rows the
  // backend actually created, so the admin can distribute logins.
  const downloadCredentials = (created) => {
    const rows = created.map((r) => ({
      'Full Name': r.fullName || '',
      Email: r.email || '',
      'Temporary Password': r.password || '',
      'Scholar ID': r.scholarId || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `scholar_credentials_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
        title: 'Create scholar accounts?',
        html:
          `Found <b>${rows.length}</b> row(s) in <b>${file.name}</b>.<br/>` +
          `A login account will be created for each, with a temporary password (their last name + a fixed suffix).`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Create accounts',
        confirmButtonColor: 'var(--primary)',
      });
      if (!confirm.isConfirmed) return;

      // Send in chunks so a large migration never hits the function timeout,
      // and the admin sees live progress.
      const totals = { created: 0, skipped: 0, failed: 0 };
      const allResults = [];
      Swal.fire({
        title: 'Creating accounts…',
        html: `0 / ${rows.length}`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE);
        const res = await bulkCreateScholars(chunk);
        totals.created += res.created || 0;
        totals.skipped += res.skipped || 0;
        totals.failed += res.failed || 0;
        if (Array.isArray(res.results)) allResults.push(...res.results);
        Swal.update({
          title: 'Creating accounts…',
          html: `${Math.min(i + IMPORT_CHUNK_SIZE, rows.length)} / ${rows.length}`,
        });
        Swal.showLoading();
      }

      const createdRows = allResults.filter((r) => r.status === 'created');
      const result = await Swal.fire({
        icon: totals.failed > 0 ? 'warning' : 'success',
        title: 'Import complete',
        html:
          `Created: <b>${totals.created}</b><br/>` +
          `Skipped (email already exists): <b>${totals.skipped}</b><br/>` +
          `Failed: <b>${totals.failed}</b>`,
        showCancelButton: true,
        confirmButtonText: 'Download credentials sheet',
        cancelButtonText: 'Close',
        confirmButtonColor: 'var(--primary)',
      });
      if (result.isConfirmed && createdRows.length > 0) {
        downloadCredentials(createdRows);
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Import failed',
        text: err?.message || 'Could not process the file. Check that the backend is running.',
      });
    }
  };

  return (
    <div className="page scholars-page">
      <Header
        title="Scholars Management"
        subtitle="View and manage active scholar profiles"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Stats Cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card stat-card-blue">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total Scholars</span>
            </div>
          </div>
          <div className="stat-card stat-card-green">
            <div className="stat-icon">
              <CheckCircle size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.active}</span>
              <span className="stat-label">Active</span>
            </div>
          </div>
          <div className="stat-card stat-card-yellow">
            <div className="stat-icon">
              <Pause size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.onHold}</span>
              <span className="stat-label">On-Hold</span>
            </div>
          </div>
          <div className="stat-card stat-card-purple">
            <div className="stat-icon">
              <Award size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.graduated}</span>
              <span className="stat-label">Graduated</span>
            </div>
          </div>
          <div className="stat-card stat-card-red">
            <div className="stat-icon">
              <XCircle size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.terminated}</span>
              <span className="stat-label">Terminated</span>
            </div>
          </div>
        </div>

        {/* Bulk import toolbar */}
        <div className="actions-bar" style={{ marginBottom: '1rem' }}>
          <div className="actions-left" />
          <div className="actions-right" style={{ display: 'flex', gap: '0.5rem' }}>
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
              Import Scholars
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name or Scholar ID..."
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
          <select value={filterYearLevel} onChange={(e) => setFilterYearLevel(e.target.value)}>
            <option value="">All Year Levels</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
          <select value={filterYearAwarded} onChange={(e) => setFilterYearAwarded(e.target.value)}>
            <option value="">All Academic Years</option>
            {[...new Set(scholars.map(s => s.yearAwarded).filter(Boolean))]
              .sort((a, b) => b - a)
              .map(year => (
                <option key={year} value={year}>{getAcademicYear(year)}</option>
              ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On-Hold</option>
            <option value="graduated">Graduated</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {/* Scholars Data Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Scholar Name
                    <SortIcon column="name" />
                  </div>
                </th>
                <th onClick={() => handleSort('scholarId')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Scholar ID
                    <SortIcon column="scholarId" />
                  </div>
                </th>
                <th onClick={() => handleSort('school')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School
                    <SortIcon column="school" />
                  </div>
                </th>
                <th onClick={() => handleSort('program')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Program
                    <SortIcon column="program" />
                  </div>
                </th>
                <th onClick={() => handleSort('yearLevel')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Year Level
                    <SortIcon column="yearLevel" />
                  </div>
                </th>
                <th onClick={() => handleSort('yearAwarded')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Academic Year Granted
                    <SortIcon column="yearAwarded" />
                  </div>
                </th>
                <th onClick={() => handleSort('semesters')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Semesters
                    <SortIcon column="semesters" />
                  </div>
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Status
                    <SortIcon column="status" />
                  </div>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedScholars.map(scholar => (
                <tr key={scholar.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="scholar-avatar-small">
                        {resolveImageSrc(scholar.profilePicture) ? (
                          <img
                            src={resolveImageSrc(scholar.profilePicture)}
                            alt={`${scholar.firstName} ${scholar.lastName}`}
                            className="profile-avatar-img"
                          />
                        ) : (
                          <>{scholar.firstName[0]}{scholar.lastName[0]}</>
                        )}
                      </div>
                      <div>
                        <strong>{scholar.lastName}, {scholar.firstName}</strong>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {scholar.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code style={{ 
                      fontSize: '0.875rem', 
                      background: 'var(--bg-secondary)', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '0.25rem',
                      fontWeight: 600,
                      color: 'var(--primary-color)'
                    }}>
                      {scholar.scholarId || 'N/A'}
                    </code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Building2 size={16} style={{ color: 'var(--primary-color)' }} />
                      <span>{scholar.school}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>{scholar.program}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '0.25rem',
                      fontWeight: 600
                    }}>
                      {getYearLevelText(getEffectiveYearLevel(scholar))}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(45, 149, 150, 0.18)',
                      borderRadius: '0.25rem',
                      fontWeight: 600,
                      color: 'var(--primary-light)'
                    }}>
                      {getAcademicYear(scholar.yearAwarded)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontWeight: 700,
                      background: scholar.semestersUsed >= 6 ? 'rgba(234, 179, 8, 0.18)' : 'rgba(45, 149, 150, 0.18)',
                      color: scholar.semestersUsed >= 6 ? '#fbbf24' : 'var(--primary-light)'
                    }}>
                      {scholar.semestersUsed || 0}/8
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${scholar.status}`}>
                      {getStatusIcon(scholar.status)}
                      {scholar.status?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleViewDetails(scholar)}
                    >
                      <Eye size={16} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredScholars.length === 0 && (
            <div className="empty-state">
              <Users size={48} />
              <p>No scholars found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredScholars.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredScholars.length)} of {filteredScholars.length} scholars
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              
              <span style={{
                padding: '0 1rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)'
              }}>
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="pagination-select-container">
              <label>Items per page:</label>
              <select 
                className="pagination-select"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
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

      {/* Scholar Details Modal */}
      {selectedScholar && (
        <div className="modal-overlay" onClick={() => setSelectedScholar(null)}>
          <div className="modal-content scholar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scholar Profile</h2>
              <button className="close-btn" onClick={() => setSelectedScholar(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="profile-section">
                <div className="profile-header">
                  <div className="profile-avatar-large">
                    {resolveImageSrc(selectedScholar.profilePicture) ? (
                      <img
                        src={resolveImageSrc(selectedScholar.profilePicture)}
                        alt={`${selectedScholar.firstName} ${selectedScholar.lastName}`}
                        className="profile-avatar-img"
                      />
                    ) : (
                      <>{selectedScholar.firstName[0]}{selectedScholar.lastName[0]}</>
                    )}
                  </div>
                  <div>
                    <h3>{selectedScholar.firstName} {selectedScholar.middleName} {selectedScholar.lastName}</h3>
                    <p className="scholar-id-large">{selectedScholar.scholarId}</p>
                    <div className={`status-badge-large status-${selectedScholar.status}`}>
                      {selectedScholar.status?.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="profile-grid">
                  <div className="profile-item">
                    <Mail size={18} />
                    <div>
                      <span className="label">Email</span>
                      <span className="value">{selectedScholar.email}</span>
                    </div>
                  </div>
                  <div className="profile-item">
                    <Phone size={18} />
                    <div>
                      <span className="label">Phone</span>
                      <span className="value">{selectedScholar.phone}</span>
                    </div>
                  </div>
                  <div className="profile-item">
                    <MapPin size={18} />
                    <div>
                      <span className="label">Address</span>
                      <span className="value">{selectedScholar.address}</span>
                    </div>
                  </div>
                  <div className="profile-item">
                    <Calendar size={18} />
                    <div>
                      <span className="label">Birth Date</span>
                      <span className="value">{selectedScholar.birthDate}</span>
                    </div>
                  </div>
                </div>

                <div className="academic-section">
                  <h4>Academic Information</h4>
                  <div className="academic-grid">
                    <div className="academic-item">
                      <span className="label">School</span>
                      <span className="value">{selectedScholar.school}</span>
                    </div>
                    <div className="academic-item">
                      <span className="label">Program</span>
                      <span className="value">{selectedScholar.program}</span>
                    </div>
                    <div className="academic-item">
                      <span className="label">Year Level</span>
                      <span className="value">{getYearLevelText(getEffectiveYearLevel(selectedScholar))}</span>
                    </div>
                    <div className="academic-item">
                      <span className="label">Semester Records</span>
                      <span className="value">{getSemesterRecords(selectedScholar).length || 0}</span>
                    </div>
                    <div className="academic-item">
                      <span className="label">Semesters Used</span>
                      <span className="value">{selectedScholar.semestersUsed || 0} / 8</span>
                    </div>
                    <div className="academic-item">
                      <span className="label">Academic Year Granted</span>
                      <span className="value">{getAcademicYear(selectedScholar.yearAwarded)}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <h5 style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}>
                      Grades and COR per Semester
                    </h5>

                    {getSemesterRecords(selectedScholar).length > 0 ? (
                      <div className="semester-records-container">
                        <table className="semester-records-table">
                          <thead>
                            <tr>
                              <th>School Year</th>
                              <th>Semester</th>
                              <th>Subjects</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSemesterRecords(selectedScholar).map((record) => (
                              <tr key={`${record.schoolYear}-${record.semester}`}>
                                <td>{record.schoolYear}</td>
                                <td>{record.semester}</td>
                                <td>
                                  {record.subjects?.length ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      {record.subjects.map((subject, idx) => (
                                        <div
                                          key={`${record.schoolYear}-${record.semester}-${idx}`}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '0.5rem',
                                            fontSize: '0.8125rem',
                                          }}
                                        >
                                          <span style={{ color: 'var(--text-primary)' }}>{subject.name}</span>
                                          <span style={{ fontWeight: 700, color: 'var(--primary-light)', whiteSpace: 'nowrap' }}>
                                            {subject.grade ?? 'N/A'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                      No Subjects
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="coe-empty">
                        <BookOpen size={24} style={{ opacity: 0.3 }} />
                        <p>No semester grade/COR records yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Certificate of Enrollment Section */}
                <div className="coe-section">
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <h4 style={{ margin: 0, color: 'var(--success)', fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={20} /> Certificate of Enrollment
                    </h4>
                  </div>

                  {(selectedScholar.certificatesOfEnrollment || []).length > 0 ? (
                    <div className="coe-table-container">
                      <table className="coe-table">
                        <thead>
                          <tr>
                            <th>Semester</th>
                            <th>School Year</th>
                            <th>Date Submitted</th>
                            <th>View</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedScholar.certificatesOfEnrollment || []).sort((a, b) => {
                            if (a.schoolYear !== b.schoolYear) return a.schoolYear.localeCompare(b.schoolYear);
                            const semOrder = { '1st Semester': 1, '2nd Semester': 2 };
                            return (semOrder[a.semester] || 0) - (semOrder[b.semester] || 0);
                          }).map(coe => (
                            <tr key={coe.id}>
                              <td>{coe.semester}</td>
                              <td>{coe.schoolYear}</td>
                              <td>{coe.dateSubmitted}</td>
                              <td>
                                {coe.fileUrl ? (
                                  <a
                                    href={coe.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: 'var(--primary-light)',
                                      textDecoration: 'underline',
                                      fontWeight: 600,
                                      fontSize: '0.8125rem',
                                    }}
                                  >
                                    View File/Image
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>N/A</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="coe-empty">
                      <FileText size={32} style={{ opacity: 0.3 }} />
                      <p>No certificates of enrollment submitted yet.</p>
                    </div>
                  )}
                </div>

                <div className="financial-section">
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '1.5rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(45, 149, 150, 0.1)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(45, 149, 150, 0.2)'
                  }}>
                    <h4 style={{ margin: 0, color: 'var(--primary-light)', fontSize: '1.125rem', fontWeight: 700 }}>Financial Information</h4>
                    {!isEditingFinancial ? (
                      <button 
                        className="btn-edit-financial"
                        onClick={() => {
                          setIsEditingFinancial(true);
                          setFinancialData({
                            tuitionFee: getEffectiveTuition(selectedScholar),
                          });
                        }}
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-success-sm"
                          onClick={async () => {
                            try {
                              const normalizedTuition = Math.max(0, Number(financialData.tuitionFee) || 0);
                              const reflectedAmount = computeReflectedAmount(normalizedTuition);
                              await updateApplicant(selectedScholar.id, {
                                tuitionFee: normalizedTuition,
                                amountGranted: reflectedAmount,
                              });
                              setSelectedScholar({
                                ...selectedScholar,
                                tuitionFee: normalizedTuition,
                                amountGranted: reflectedAmount,
                              });
                              setIsEditingFinancial(false);
                              Swal.fire({
                                icon: 'success',
                                title: 'Updated!',
                                text: 'Financial information updated successfully',
                                timer: 1500,
                                showConfirmButton: false
                              });
                            } catch (error) {
                              Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to update financial information'
                              });
                            }
                          }}
                        >
                          <CheckCircle size={14} />
                          Save
                        </button>
                        <button 
                          className="btn btn-secondary-sm"
                          onClick={() => setIsEditingFinancial(false)}
                        >
                          <XCircle size={14} />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="financial-grid">
                    <div className="financial-item">
                      <span className="label">Tuition Fee</span>
                      {isEditingFinancial ? (
                        <input
                          type="number"
                          className="financial-input"
                          value={financialData.tuitionFee}
                          onChange={(e) => setFinancialData({ ...financialData, tuitionFee: Number(e.target.value) })}
                          placeholder="Enter tuition fee"
                        />
                      ) : (
                        <span className="value">₱{getEffectiveTuition(selectedScholar).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="financial-item">
                      <span className="label">Per Sem Granted</span>
                      <span className="value">
                        ₱{(
                          isEditingFinancial
                            ? computeReflectedAmount(financialData.tuitionFee)
                            : getPerSemGranted(selectedScholar)
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="financial-item">
                      <span className="label">Total Granted</span>
                      <span className="value" style={{ 
                        color: '#10b981', 
                        fontWeight: 700, 
                        fontSize: '1.25rem',
                        textShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
                      }}>
                        ₱{((selectedScholar.semestersUsed || 0) * (
                          isEditingFinancial
                            ? computeReflectedAmount(financialData.tuitionFee)
                            : getPerSemGranted(selectedScholar)
                        )).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const perSemGranted = isEditingFinancial
                      ? computeReflectedAmount(financialData.tuitionFee)
                      : getPerSemGranted(selectedScholar);
                    const { semesterRows } = getGrantBreakdown(selectedScholar, perSemGranted);
                    const totalGranted = semesterRows.reduce((sum, row) => sum + row.grantedAmount, 0);

                    return (
                      <div style={{ marginTop: '1rem' }}>
                        <h5 style={{
                          margin: '0 0 0.75rem 0',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)'
                        }}>
                          Granted per Semester
                        </h5>

                        {semesterRows.length > 0 ? (
                          <div className="semester-records-container">
                            <table className="semester-records-table">
                              <thead>
                                <tr>
                                  <th>School Year</th>
                                  <th>Semester</th>
                                  <th>Granted</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semesterRows.map((row, index) => (
                                  <tr key={`${row.schoolYear}-${row.semester}-${index}`}>
                                    <td>{row.schoolYear}</td>
                                    <td>{row.semester}</td>
                                    <td>₱{row.grantedAmount.toLocaleString()}</td>
                                  </tr>
                                ))}
                                <tr>
                                  <td colSpan={2} style={{ fontWeight: 700 }}>Total Granted</td>
                                  <td style={{ fontWeight: 700, color: '#10b981' }}>₱{totalGranted.toLocaleString()}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="coe-empty">
                            <p>No semester records available.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scholars-page {
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
        .stat-card-green .stat-icon { background: rgba(34, 197, 94, 0.2); color: var(--success-light); }
        .stat-card-yellow .stat-icon { background: rgba(245, 158, 11, 0.2); color: var(--warning-light); }
        .stat-card-purple .stat-icon { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
        .stat-card-red .stat-icon { background: rgba(239, 68, 68, 0.2); color: var(--danger-light); }

        .stat-icon {
          padding: 0.75rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
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

        .scholars-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .scholar-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          overflow: hidden;
          transition: all 0.2s;
        }

        .scholar-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-2px);
        }

        .scholar-card-header {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border-color);
        }

        .scholar-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .scholar-avatar-small {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          font-weight: 600;
          flex-shrink: 0;
          overflow: hidden;
        }

        .scholar-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .scholar-card-body {
          padding: 1.5rem;
        }

        .scholar-card-body h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .scholar-id {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          font-family: 'Courier New', monospace;
        }

        .scholar-info {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .info-item svg {
          color: var(--primary-color);
        }

        .scholar-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 0.375rem;
        }

        .scholar-stats > div {
          display: flex;
          flex-direction: column;
        }

        .scholar-stats .stat-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .scholar-stats .stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .scholar-card-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        .scholar-card-footer .btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .scholar-modal {
          max-width: 1100px;
          max-height: 90vh;
          overflow-y: auto;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border: 2px solid rgba(45, 149, 150, 0.3);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg), 0 0 40px rgba(45, 149, 150, 0.15);
        }

        .profile-header {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .profile-avatar-large {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          font-weight: 600;
          overflow: hidden;
          flex-shrink: 0;
        }

        .profile-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scholar-id-large {
          font-size: 1rem;
          color: var(--text-secondary);
          font-family: 'Courier New', monospace;
          margin: 0.5rem 0;
        }

        .status-badge-large {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .profile-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .profile-item svg {
          color: var(--primary-color);
          flex-shrink: 0;
        }

        .profile-item .label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }

        .profile-item .value {
          display: block;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .academic-section,
        .financial-section,
        .coe-section {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid var(--border-color);
        }

        .academic-section h4,
        .financial-section h4,
        .coe-section h4 {
          font-size: 1.125rem;
          font-weight: 700;
          margin-bottom: 1.25rem;
          color: var(--text-primary);
        }

        /* COE Styles */
        .btn-coe-add {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
        }
        .btn-coe-add:hover {
          background: #059669;
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
          transform: translateY(-1px);
        }

        .coe-form {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          padding: 1.25rem;
          margin-bottom: 1.25rem;
        }
        .coe-form-row {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .coe-form-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          flex: 1;
          min-width: 150px;
        }
        .coe-form-field label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .coe-form-field select,
        .coe-form-field input {
          padding: 0.625rem 0.75rem;
          border: 2px solid var(--border-color);
          border-radius: 0.5rem;
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.875rem;
        }
        .coe-form-field select:focus,
        .coe-form-field input:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }
        .coe-form-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          padding-bottom: 2px;
        }

        .coe-table-container {
          border-radius: 0.5rem;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }
        .coe-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .coe-table thead {
          background: var(--bg-secondary);
        }
        .coe-table th {
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          border-bottom: 1px solid var(--border-color);
        }
        .coe-table td {
          padding: 0.75rem 1rem;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }
        .coe-table tbody tr:hover {
          background: rgba(45, 149, 150, 0.05);
        }

        .coe-status {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          font-weight: 600;
        }
        .coe-status-verified {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }
        .coe-status-pending {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }
        .coe-status-rejected {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .coe-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .coe-verify-btn {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }
        .coe-verify-btn:hover {
          background: rgba(16, 185, 129, 0.3);
        }
        .coe-reject-btn {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }
        .coe-reject-btn:hover {
          background: rgba(245, 158, 11, 0.3);
        }
        .coe-delete-btn {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .coe-delete-btn:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .coe-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
          color: var(--text-secondary);
          background: var(--bg-primary);
          border-radius: 0.5rem;
          border: 1px dashed var(--border-color);
        }
        .coe-empty p {
          margin: 0;
          font-size: 0.875rem;
        }

        .academic-grid,
        .financial-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          background: var(--bg-primary);
          padding: 1.5rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
        }

        .semester-records-container {
          border-radius: 0.5rem;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }

        .semester-records-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .semester-records-table thead {
          background: var(--bg-secondary);
        }

        .semester-records-table th {
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          border-bottom: 1px solid var(--border-color);
        }

        .semester-records-table td {
          padding: 0.75rem 1rem;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }

        .semester-records-table tbody tr:hover {
          background: rgba(45, 149, 150, 0.05);
        }

        .academic-item,
        .financial-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .academic-item .label,
        .financial-item .label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin-bottom: 0.25rem;
        }

        .academic-item .value,
        .financial-item .value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .financial-input {
          padding: 0.75rem 1rem;
          border: 2px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 1rem;
          font-weight: 600;
          width: 100%;
          transition: all 0.2s ease;
        }

        .financial-input:focus {
          outline: none;
          border-color: var(--primary);
          background: var(--bg-primary);
          box-shadow: 0 0 0 3px rgba(45, 149, 150, 0.2);
        }

        .btn-edit-financial {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(45, 149, 150, 0.3);
        }

        .btn-edit-financial:hover {
          background: var(--primary-dark);
          box-shadow: 0 4px 8px rgba(45, 149, 150, 0.4);
          transform: translateY(-1px);
        }

        .btn-success-sm,
        .btn-secondary-sm {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.625rem 1.25rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-success-sm {
          background: #10b981;
          color: white;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
        }

        .btn-success-sm:hover {
          background: #059669;
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
          transform: translateY(-1px);
        }

        .btn-secondary-sm {
          background: var(--text-secondary);
          color: var(--text-primary);
          border: 1px solid var(--secondary);
        }

        .btn-secondary-sm:hover {
          background: var(--bg-tertiary);
          border-color: var(--text-muted);
          color: white;
        }


      `}</style>
    </div>
  );
}
