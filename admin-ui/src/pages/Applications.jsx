import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  FileSpreadsheet,
  X,
  FileText,
  Image,
  File,
  ExternalLink,
  BookOpen,
  Calendar,
  ClipboardCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { fetchRequirements, getApplicationKey, reviewRequirement } from '../services/backendApi';
import { downloadBfcspFormPdf, toBfcspFields } from '../utils/bfcspApplicationForm';
import { fetchBfcspApplication } from '../services/scholarshipApplications';
import { generateApplicationFormPdf } from '../services/backendApi';

const REQUIREMENTS_RUBRIC = [
  { label: 'Complete & Organized', points: 20, description: 'All requirements submitted on time; complete, accurate, and properly organized' },
  { label: 'Complete but Slightly Lacking', points: 15, description: 'All requirements submitted but with minor errors or formatting issues' },
  { label: 'Incomplete (Minor)', points: 10, description: 'Missing 1-2 minor requirements or with noticeable inconsistencies' },
  { label: 'Incomplete (Major)', points: 5, description: 'Several missing or incorrect documents' },
  { label: 'Non-compliant', points: 0, description: 'Failed to submit majority of required documents' },
];

const ECONOMIC_RUBRIC = [
  { label: 'Highly Disadvantaged', points: 30, cedula: '₱5 – ₱150', electric: '₱500 and below', description: 'Very low declared income; minimal electricity use; 4+ dependents; irregular/no stable income' },
  { label: 'Disadvantaged', points: 25, cedula: '₱151 – ₱500', electric: '₱501 – ₱1,000', description: 'Low declared income; low consumption; 3-4 dependents; limited financial capacity' },
  { label: 'Moderately Disadvantaged', points: 20, cedula: '₱501 – ₱1,000', electric: '₱1,001 – ₱2,000', description: 'Modest declared income; average consumption; 1-2 dependents' },
  { label: 'Slightly Disadvantaged', points: 15, cedula: '₱1,001 – ₱2,000', electric: '₱2,001 – ₱3,500', description: 'Stable income; above-average consumption; 1-2 dependents' },
  { label: 'Financially Capable', points: 10, cedula: 'Above ₱2,000', electric: 'Above ₱3,500', description: 'Higher declared income; high consumption; few or no dependents' },
];

const REQUIREMENTS_LIST = [
  { key: 'applicationForm', label: 'Duly Accomplished Scholarship Application Form (provided by the City Education Department)' },
  { key: 'idPictures', label: 'Two (2) ID Pictures (2X2)' },
  { key: 'form137', label: 'Photocopy of Senior High School Form 137' },
  { key: 'goodMoral', label: 'Photocopy of Certificate of Good Moral Character (from Guidance Counselor)' },
  { key: 'votersId', label: "Photocopy of Parent's Voter's ID or Voter's Certification" },
  { key: 'barangayResidency', label: 'Certificate of Barangay Residency (with length of stay) of the Applicant' },
  { key: 'electricBills', label: 'Photocopy of Latest Electric Bills (February and March 2026)' },
  { key: 'cedula', label: "Photocopy of Both Parents' 2026 Community Tax Certificate (Cedula)" },
];

// The application form may only be viewed/downloaded once the applicant has
// actually submitted it. `requirements.applicationForm` is populated (by the
// context mapper) only for submitted forms, so its presence is the gate.
const hasSubmittedApplicationForm = (applicant) =>
  Boolean(applicant?.requirements?.applicationForm);

// Once an applicant is approved they become a City Scholar and belong to the
// Scholars module, not Applications. These statuses are filtered out here.
const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];

export default function Applications() {
  const { applicants, schools, systemSettings, addApplicant, updateApplicant, deleteApplicant, bulkDeleteApplicants, bulkImportApplicants } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const SCHOLARSHIP_CAP = 25000;

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const computeReflectedAmount = (tuitionFee) => {
    const normalized = Math.max(0, toNumber(tuitionFee));
    return Math.min(normalized, SCHOLARSHIP_CAP);
  };

  // Auto-computed combined rubric score (out of 100):
  //   Requirements (0-20 pts = 20%) + Economic Background (0-30 pts = 30%)
  //   + Examination (exam score 0-100 weighted at 50% => examScore * 0.5).
  const computeTotalScore = (applicant) => {
    const exam = toNumber(applicant?.examScore);                 // 0-100 (50%)
    const requirements = toNumber(applicant?.requirementsScore); // 0-20  (20%)
    const economic = toNumber(applicant?.economicScore);         // 0-30  (30%)
    const total = requirements + economic + exam * 0.5;
    return Math.round(total * 10) / 10; // one decimal place
  };
  const [activeTab, setActiveTab] = useState('applications'); // applications, exams, interviews, evaluation
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [evalSearchTerm, setEvalSearchTerm] = useState('');
  const [evalFilterSchool, setEvalFilterSchool] = useState('');
  const [evalFilterTopScores, setEvalFilterTopScores] = useState(''); // '', '10', '25', '50', '100'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [evalCurrentPage, setEvalCurrentPage] = useState(1);
  const [evalItemsPerPage, setEvalItemsPerPage] = useState(10);
  const [evalSort, setEvalSort] = useState({ column: 'totalScore', direction: 'desc' });
  const [appSort, setAppSort] = useState({ column: 'name', direction: 'asc' });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add, edit, view
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());
  const [selectedIds, setSelectedIds] = useState([]);
  const [reqPreviewUrl, setReqPreviewUrl] = useState('');
  const [reqPreviewLabel, setReqPreviewLabel] = useState('');
  const [backendRequirements, setBackendRequirements] = useState([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqModalApplicant, setReqModalApplicant] = useState(null);
  const fileInputRef = useRef(null);

  // Sorting handler for evaluation table
  const handleEvalSort = (column) => {
    setEvalSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sorting handler for applications table
  const handleAppSort = (column) => {
    setAppSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sort icon component
  const SortIcon = ({ column, currentSort }) => {
    if (currentSort.column !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    }
    return currentSort.direction === 'asc' ? 
      <ArrowUp size={14} /> : 
      <ArrowDown size={14} />;
  };

  function getEmptyFormData() {
    return {
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phone: '',
      address: '',
      city: 'Calapan',
      school: '',
      program: '',
      yearLevel: 1,
      schoolYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      gender: '',
      birthDate: '',
      tuitionFee: 0,
      amountGranted: 0,
      examScore: null,
      economicScore: null,
      interviewScore: null,
      interviewStatus: 'pending',
      notes: '',
    };
  }



  const filteredApplicants = applicants.filter(applicant => {
    const matchesSearch = 
      `${applicant.firstName} ${applicant.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      applicant.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchool = !filterSchool || applicant.school === filterSchool;
    const matchesSchoolYear = !filterSchoolYear || applicant.schoolYear === filterSchoolYear;
    // Hide records that have moved on to the Scholars module.
    const isStillApplicant = !SCHOLAR_STATUSES.includes(applicant.status);
    return matchesSearch && matchesSchool && matchesSchoolYear && isStillApplicant;
  }).sort((a, b) => {
    const { column, direction } = appSort;
    const multiplier = direction === 'asc' ? 1 : -1;
    
    switch (column) {
      case 'name':
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB) * multiplier;
      case 'school':
        return a.school.localeCompare(b.school) * multiplier;
      case 'program':
        return (a.program || '').localeCompare(b.program || '') * multiplier;
      case 'schoolYear':
        return (a.schoolYear || '').localeCompare(b.schoolYear || '') * multiplier;
      case 'gender':
        return (a.gender || '').localeCompare(b.gender || '') * multiplier;
      default:
        return 0;
    }
  });

  // Pagination for Applications
  const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedApplicants = filteredApplicants.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSchool, filterSchoolYear, filterStatus]);

  // Reset evaluation page when filters change
  useEffect(() => {
    setEvalCurrentPage(1);
  }, [evalSearchTerm, evalFilterSchool, evalFilterTopScores]);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredApplicants.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleOpenModal = (mode, applicant = null) => {
    setModalMode(mode);
    setReqPreviewUrl('');
    setReqPreviewLabel('');
    setBackendRequirements([]);
    setReviewNotes({});
    if (applicant) {
      setSelectedApplicant(applicant);
      setFormData({
        ...applicant,
        tuitionFee: toNumber(applicant.tuitionFee),
        amountGranted: computeReflectedAmount(applicant.tuitionFee),
      });
    } else {
      setSelectedApplicant(null);
      setFormData(getEmptyFormData());
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedApplicant(null);
    setFormData(getEmptyFormData());
    setReqPreviewUrl('');
    setReqPreviewLabel('');
    setBackendRequirements([]);
    setReviewNotes({});
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'tuitionFee') {
      const tuitionFee = Math.max(0, toNumber(value));
      setFormData({
        ...formData,
        tuitionFee,
        amountGranted: computeReflectedAmount(tuitionFee),
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };





  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate Calapan city
    if (formData.city !== 'Calapan') {
      Swal.fire({
        title: 'Not Eligible',
        text: 'Only applicants from Calapan City are eligible for the scholarship.',
        icon: 'warning',
        confirmButtonColor: 'var(--warning)'
      });
      return;
    }

    if (modalMode === 'add') {
      addApplicant(formData);
      Swal.fire({
        title: 'Added!',
        text: `${formData.lastName}, ${formData.firstName} has been added successfully.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else if (modalMode === 'edit') {
      updateApplicant(selectedApplicant.id, formData);
      Swal.fire({
        title: 'Updated!',
        text: 'Applicant information has been updated.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
    handleCloseModal();
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Applicant?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      deleteApplicant(id);
      Swal.fire({
        title: 'Deleted!',
        text: 'Applicant has been deleted.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  // Bulk delete selected applicants
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      Swal.fire({
        title: 'No Selection',
        text: 'Please select at least one applicant to delete.',
        icon: 'info',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    const result = await Swal.fire({
      title: `Delete ${selectedIds.length} Applicant${selectedIds.length > 1 ? 's' : ''}?`,
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete all!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      const count = selectedIds.length;
      bulkDeleteApplicants(selectedIds);
      setSelectedIds([]);
      Swal.fire({
        title: 'Deleted!',
        text: `${count} applicant${count > 1 ? 's have' : ' has'} been deleted.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };


  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const importedApplicants = jsonData.map(row => ({
          firstName: row['First Name'] || row['firstName'] || '',
          lastName: row['Last Name'] || row['lastName'] || '',
          middleName: row['Middle Name'] || row['middleName'] || '',
          email: row['Email'] || row['email'] || '',
          phone: row['Phone'] || row['phone'] || '',
          address: row['Address'] || row['address'] || '',
          city: row['City'] || row['city'] || 'Calapan',
          school: row['School'] || row['school'] || '',
          program: row['Program'] || row['program'] || '',
          tuitionFee: toNumber(row['Tuition Fee'] || row['tuitionFee']),
          amountGranted: computeReflectedAmount(
            row['Tuition Fee'] || row['tuitionFee']
          ),
          yearLevel: parseInt(row['Year Level'] || row['yearLevel']) || 1,
          gender: row['Gender'] || row['gender'] || '',
          birthDate: row['Birth Date'] || row['birthDate'] || '',
          requirements: {
            applicationForm: false,
            idPictures: false,
            form137: false,
            goodMoral: false,
            votersId: false,
            barangayResidency: false,
            electricBills: false,
            cedula: false,
          },
          examScore: null,
          economicScore: null,
          interviewScore: null,
          interviewStatus: 'pending',
          notes: row['Notes'] || row['notes'] || '',
        })).filter(a => a.city === 'Calapan'); // Only import Calapan residents

        if (importedApplicants.length > 0) {
          bulkImportApplicants(importedApplicants);
          Swal.fire({
            icon: 'success',
            title: 'Import Successful',
            text: `Successfully imported ${importedApplicants.length} applicants!`,
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'No Valid Applicants',
            text: 'No valid applicants found in the file. Only Calapan residents are eligible.',
          });
        }
      } catch (error) {
        console.error('Error importing Excel:', error);
        Swal.fire({
          icon: 'error',
          title: 'Import Error',
          text: 'Error importing file. Please ensure it is a valid Excel file.',
        });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Builds the official BFCSP application form PDF (template overlay) for one
  // applicant and triggers a download. Pulls the full BFCSP record from Firestore
  // when available so every field is filled, falling back to the admin applicant.
  const handleDownloadForm = async (applicant) => {
    // Guard: never produce the form for an applicant who hasn't submitted it.
    if (!hasSubmittedApplicationForm(applicant)) {
      Swal.fire({
        icon: 'info',
        title: 'Form Not Submitted',
        text: 'This applicant has not submitted their application form yet, so it cannot be viewed or downloaded.',
      });
      return;
    }
    Swal.fire({
      title: 'Preparing application form…',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });
    try {
      const fullRecord = await fetchBfcspApplication(applicant);
      // Full BFCSP fields win; admin applicant fills any gaps (name, school, …).
      const merged = fullRecord ? { ...applicant, ...fullRecord } : applicant;

      // Prefer the shared backend generator (same one the scholar app uses); if
      // it's unreachable, fall back to the client-side pdf-lib generator.
      const blob = await generateApplicationFormPdf(merged);
      if (blob) {
        const f = toBfcspFields(merged);
        const namePart = [f.lastName, f.firstName].filter(Boolean).join('_') || 'applicant';
        const fileName = `BFCSP_Application_${namePart}.pdf`.replace(/\s+/g, '_');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        await downloadBfcspFormPdf(merged);
      }
      Swal.close();
    } catch (error) {
      console.error('Error generating application form PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: error.message || 'Unable to generate the application form PDF.',
      });
    }
  };

  const handleExcelExport = () => {
    const exportData = filteredApplicants.map(a => ({
      'First Name': a.firstName,
      'Last Name': a.lastName,
      'Middle Name': a.middleName,
      'Email': a.email,
      'Phone': a.phone,
      'Address': a.address,
      'City': a.city,
      'School': a.school,
      'Program': a.program,
      'Tuition Fee': a.tuitionFee || 0,
      'Reflected Scholarship Amount': a.amountGranted || 0,
      'Year Level': a.yearLevel,
      'Gender': a.gender,
      'Birth Date': a.birthDate,
      'Status': a.status,
      'Exam Score': a.examScore,
      'Economic Score': a.economicScore,
      'Interview Status': a.interviewStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Applicants');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `applicants_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const submittedRequirements = REQUIREMENTS_LIST.filter(
    requirement => formData.requirements?.[requirement.key]
  );

  useEffect(() => {
    if (!showModal || modalMode !== 'view' || !selectedApplicant) {
      return;
    }

    let active = true;
    const applicationId = getApplicationKey(selectedApplicant);

    setRequirementsLoading(true);
    fetchRequirements({ applicationId, userId: String(selectedApplicant.id) })
      .then((response) => {
        if (!active) return;
        setBackendRequirements(response?.requirements || []);
      })
      .catch(() => {
        if (!active) return;
        setBackendRequirements([]);
      })
      .finally(() => {
        if (active) {
          setRequirementsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [showModal, modalMode, selectedApplicant]);

  const handleBackendReview = async (requirementId, status) => {
    if (!selectedApplicant) return;

    const applicationId = getApplicationKey(selectedApplicant);
    const note = reviewNotes[requirementId] || '';

    try {
      const response = await reviewRequirement({
        applicationId,
        requirementId,
        status,
        reviewNotes: note,
      });

      setBackendRequirements((current) => current.map((item) => (
        item.id === requirementId
          ? { ...item, status: response?.status || status, reviewNotes: note, reviewedBy: 'admin' }
          : item
      )));

      Swal.fire({
        icon: 'success',
        title: 'Requirement Updated',
        text: `Requirement marked as ${status.replace('_', ' ')}.`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message || 'Unable to update requirement status.',
      });
    }
  };

  return (
    <div className="page applications-page">
      <Header 
        title="Applications Management" 
        subtitle="Manage applications, exams, interviews, and evaluations"
        onMenuClick={onMenuClick}
      />

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <div className="tabs-nav">
          <button 
            className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            <FileText size={18} />
            Applications
          </button>
          <button 
            className={`tab-btn ${activeTab === 'evaluation' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluation')}
          >
            <ClipboardCheck size={18} />
            Application Evaluation
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <>
        {/* Actions Bar */}
        <div className="actions-bar">
          <div className="actions-left">
            <div className="filters-grid">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search applicants..."
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
                {schools.map(school => (
                  <option key={school.id} value={school.name}>{school.name}</option>
                ))}
              </select>
              <select
                className="filter-select"
                value={filterSchoolYear}
                onChange={(e) => setFilterSchoolYear(e.target.value)}
              >
                <option value="">All School Years</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
              </select>
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="complete">Complete</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>
          </div>

          <div className="actions-right">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              style={{ display: 'none' }}
            />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
              <Upload size={18} />
              Import Excel
            </button>
            <button className="btn btn-secondary" onClick={handleExcelExport}>
              <Download size={18} />
              Export Excel
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenModal('add')}>
              <Plus size={18} />
              Add Applicant
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleAppSort('name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Name
                    <SortIcon column="name" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('school')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School
                    <SortIcon column="school" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('program')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Program
                    <SortIcon column="program" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('schoolYear')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School Year
                    <SortIcon column="schoolYear" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('gender')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Gender
                    <SortIcon column="gender" currentSort={appSort} />
                  </div>
                </th>
                <th>Requirements</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedApplicants.map(applicant => {
                return (
                  <tr key={applicant.id}>
                    <td>
                      <div className="applicant-cell">
                        <div className="applicant-avatar">
                          {applicant.firstName[0]}{applicant.lastName[0]}
                        </div>
                        <div className="applicant-details">
                          <span className="applicant-name">
                            {applicant.lastName}, {applicant.firstName}
                          </span>
                          <span className="applicant-email">{applicant.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{applicant.school}</td>
                    <td>{applicant.program}</td>
                    <td>{applicant.schoolYear || 'N/A'}</td>
                    <td>{applicant.gender}</td>
                    <td>
                      {(() => {
                        const total = REQUIREMENTS_LIST.length;
                        const submitted = REQUIREMENTS_LIST.filter(r => applicant.requirements?.[r.key]).length;
                        const isComplete = submitted === total;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: isComplete ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                              color: isComplete ? '#86efac' : '#fcd34d',
                            }}>
                              {submitted}/{total}
                            </span>
                            <button
                              className="action-btn view"
                              title="View Requirements"
                              onClick={() => { setReqModalApplicant(applicant); setShowReqModal(true); }}
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn view"
                          onClick={() => handleOpenModal('view', applicant)}
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn view"
                          onClick={() => handleDownloadForm(applicant)}
                          disabled={!hasSubmittedApplicationForm(applicant)}
                          title={
                            hasSubmittedApplicationForm(applicant)
                              ? 'Download Application Form (PDF)'
                              : 'Application form not submitted yet'
                          }
                          style={
                            hasSubmittedApplicationForm(applicant)
                              ? undefined
                              : { opacity: 0.4, cursor: 'not-allowed' }
                          }
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredApplicants.length === 0 && (
            <div className="empty-state">
              <FileSpreadsheet size={48} />
              <h3>No applicants found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredApplicants.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredApplicants.length)} of {filteredApplicants.length} entries
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                    return false;
                  })
                  .map((page, index, array) => (
                    <span key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="pagination-ellipsis">...</span>
                      )}
                      <button
                        className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    </span>
                  ))}
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
              <div className="pagination-size">
                <label>Items per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="pagination-select"
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

      {/* Requirements Modal */}
      {showReqModal && reqModalApplicant && (
        <div className="modal-overlay" onClick={() => setShowReqModal(false)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submitted Requirements</h2>
              <button className="modal-close" onClick={() => setShowReqModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {reqModalApplicant.lastName}, {reqModalApplicant.firstName} {reqModalApplicant.middleName}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {reqModalApplicant.school} · {reqModalApplicant.program}
                </div>
              </div>

              <div>
                {REQUIREMENTS_LIST.map((req, i) => {
                  const isSubmitted = !!reqModalApplicant.requirements?.[req.key];
                  return (
                    <div
                      key={req.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '11px 0',
                        borderBottom: i < REQUIREMENTS_LIST.length - 1 ? '1px solid var(--border-color)' : 'none',
                      }}
                    >
                      {isSubmitted
                        ? <CheckCircle size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: '1px' }} />
                        : <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                      }
                      <span style={{ fontSize: '0.85rem', flex: 1, lineHeight: 1.45, color: isSubmitted ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {req.label}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        flexShrink: 0,
                        background: isSubmitted ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                        color: isSubmitted ? '#86efac' : '#fca5a5',
                      }}>
                        {isSubmitted ? 'Submitted' : 'Missing'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const total = REQUIREMENTS_LIST.length;
                const submitted = REQUIREMENTS_LIST.filter(r => reqModalApplicant.requirements?.[r.key]).length;
                const isComplete = submitted === total;
                return (
                  <div style={{
                    marginTop: '1rem',
                    padding: '12px 16px',
                    background: isComplete ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    borderRadius: '8px',
                    border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {isComplete ? 'All requirements submitted' : 'Requirements incomplete'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: isComplete ? '#86efac' : '#fcd34d' }}>
                      {submitted}/{total}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'add' && 'Add New Applicant'}
                {modalMode === 'edit' && 'Edit Applicant'}
                {modalMode === 'view' && 'Applicant Details'}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              {modalMode === 'view' && selectedApplicant && (() => {
                const canDownload = hasSubmittedApplicationForm(selectedApplicant);
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    {!canDownload && (
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                        Available after the applicant submits their form
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDownloadForm(selectedApplicant)}
                      disabled={!canDownload}
                      title={canDownload ? 'Download Application Form' : 'Application form not submitted yet'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        ...(canDownload ? {} : { opacity: 0.5, cursor: 'not-allowed' }),
                      }}
                    >
                      <Download size={16} />
                      Download Application Form
                    </button>
                  </div>
                );
              })()}
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Birth Date</label>
                    <input
                      type="date"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                      className={formData.city !== 'Calapan' ? 'input-error' : ''}
                    />
                    {formData.city !== 'Calapan' && (
                      <span className="input-hint error">Only Calapan residents are eligible</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Academic Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>School *</label>
                    <select
                      name="school"
                      value={formData.school}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="">Select School</option>
                      {schools.map(school => (
                        <option key={school.id} value={school.name}>{school.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Program *</label>
                    <select
                      name="program"
                      value={formData.program}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="">Select Program</option>
                      {(systemSettings?.academicPrograms || []).map((program) => (
                        <option key={program} value={program}>{program}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tuition Fee (Per Semester) *</label>
                    <input
                      type="number"
                      min={0}
                      name="tuitionFee"
                      value={formData.tuitionFee}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Reflected Scholarship Amount</label>
                    <input
                      type="number"
                      name="amountGranted"
                      value={computeReflectedAmount(formData.tuitionFee)}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label>Year Level</label>
                    <select
                      name="yearLevel"
                      value={formData.yearLevel}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>School Year *</label>
                    <select
                      name="schoolYear"
                      value={formData.schoolYear}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="2024-2025">2024-2025</option>
                      <option value="2025-2026">2025-2026</option>
                      <option value="2026-2027">2026-2027</option>
                      <option value="2027-2028">2027-2028</option>
                    </select>
                  </div>
                </div>
              </div>

              {modalMode === 'view' && (
                <div className="form-section">
                  <h3>Submitted Requirements</h3>

                  {submittedRequirements.length > 0 ? (
                    <div className="submitted-requirements-list">
                      {submittedRequirements.map(requirement => {
                        const rec = formData.requirements?.[requirement.key];
                        const fileUrl = (rec && typeof rec === 'object' && rec.fileUrl)
                          ? rec.fileUrl
                          : null;
                        const fileName = (rec && typeof rec === 'object' && rec.fileName)
                          ? rec.fileName
                          : '';
                        // Image if it's a base64 image data URL or the file name
                        // (incl. URL-encoded Storage paths like ...file.png?alt=media)
                        // ends in an image extension. Storage PDFs/docs also carry
                        // `alt=media`, so that alone must NOT count as an image.
                        const isImage = fileUrl
                          ? fileUrl.startsWith('data:image/')
                            || /\.(png|jpe?g|gif|webp)(\?|$|%3F)/i.test(fileUrl)
                          : false;
                        return (
                          <div key={requirement.key} className="submitted-requirement-item">
                            <CheckCircle size={16} />
                            <span style={{ flex: 1 }}>
                              {requirement.label}
                              {fileName && (
                                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {fileName}
                                </span>
                              )}
                            </span>
                            {fileUrl ? (
                              <>
                                {isImage ? (
                                  <img
                                    src={fileUrl}
                                    alt={requirement.label}
                                    style={{
                                      width: 44, height: 44, objectFit: 'cover',
                                      borderRadius: '0.375rem', cursor: 'pointer',
                                      border: '1px solid var(--border-color)',
                                    }}
                                    onClick={() => { setReqPreviewUrl(fileUrl); setReqPreviewLabel(requirement.label); }}
                                  />
                                ) : (
                                  <div style={{
                                    width: 44, height: 44, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', borderRadius: '0.375rem',
                                    border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                                  }}>
                                    <FileText size={20} />
                                  </div>
                                )}
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-secondary"
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <Eye size={14} /> View
                                </a>
                                <a
                                  href={fileUrl}
                                  download={fileName || requirement.label}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-secondary"
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <Download size={14} /> Download
                                </a>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Submitted (no file)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-submitted-requirements">No submitted requirements found for this applicant.</p>
                  )}

                  <div style={{ marginTop: '1.5rem' }}>
                    <h3>Live Review Queue</h3>
                    <p className="input-hint">
                      Review statuses are fetched from the backend requirement tracker and can be updated here.
                    </p>

                    {requirementsLoading ? (
                      <p>Loading requirement records...</p>
                    ) : backendRequirements.length > 0 ? (
                      <div className="submitted-requirements-list">
                        {backendRequirements.map((requirement) => (
                          <div key={requirement.id} className="submitted-requirement-item" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 220 }}>
                              <strong>{requirement.requirementType || requirement.fileName || requirement.id}</strong>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Status: {requirement.status || 'submitted'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {requirement.fileName || 'No file name'}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <input
                                type="text"
                                placeholder="Review notes"
                                value={reviewNotes[requirement.id] || ''}
                                onChange={(e) => setReviewNotes((current) => ({
                                  ...current,
                                  [requirement.id]: e.target.value,
                                }))}
                                style={{ minWidth: 200 }}
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleBackendReview(requirement.id, 'under_review')}
                              >
                                Under Review
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => handleBackendReview(requirement.id, 'approved')}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => handleBackendReview(requirement.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-submitted-requirements">No live backend requirements found for this application.</p>
                    )}
                  </div>

                  {reqPreviewUrl && (
                    <div style={{
                      marginTop: '1rem', padding: '1rem',
                      background: 'var(--bg-secondary)', borderRadius: '0.5rem',
                      border: '1px solid var(--border-color)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{reqPreviewLabel}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setReqPreviewUrl(''); setReqPreviewLabel(''); }}
                        >✕ Close</button>
                      </div>
                      <img src={reqPreviewUrl} alt={reqPreviewLabel} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: '0.5rem' }} />
                    </div>
                  )}
                </div>
              )}

              {modalMode !== 'view' && (
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {modalMode === 'add' ? 'Add Applicant' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

          </>
        )}

        {/* Evaluation Tab - Combined with Exams and Interviews */}
        {activeTab === 'evaluation' && (
          <div className="tab-content">
            <div className="evaluation-section">
              <h2>Application Evaluation</h2>
              <p className="section-description">Manage exam scores, economic assessment, and application approval</p>
              
              {/* Filters Bar */}
              <div className="actions-bar" style={{ marginBottom: '1.5rem' }}>
                <div className="actions-left" style={{ width: '100%' }}>
                  <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div className="search-box">
                      <Search size={18} />
                      <input
                        type="text"
                        placeholder="Search applicants..."
                        value={evalSearchTerm}
                        onChange={(e) => setEvalSearchTerm(e.target.value)}
                      />
                    </div>
                    <select
                      className="filter-select"
                      value={evalFilterSchool}
                      onChange={(e) => setEvalFilterSchool(e.target.value)}
                    >
                      <option value="">All Schools</option>
                      {schools.map(school => (
                        <option key={school.id} value={school.name}>{school.name}</option>
                      ))}
                    </select>
                    <select
                      className="filter-select"
                      value={evalFilterTopScores}
                      onChange={(e) => setEvalFilterTopScores(e.target.value)}
                    >
                      <option value="">All Applicants</option>
                      <option value="10">Top 10 Highest Scores</option>
                      <option value="25">Top 25 Highest Scores</option>
                      <option value="50">Top 50 Highest Scores</option>
                      <option value="100">Top 100 Highest Scores</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="evaluation-content">
                <div className="evaluation-list">
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0' }}>Applicant Evaluation & Approval</h3>

                    {/* Rubrics Reference */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '1rem' }}>
                      {/* Completion of Requirements (20%) */}
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', background: 'rgba(45,149,150,0.15)', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#4db6ac' }}>COMPLETION OF REQUIREMENTS (20%)</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Level</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Pts</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {REQUIREMENTS_RUBRIC.map((r, i) => (
                              <tr key={r.points} style={{ borderBottom: i < REQUIREMENTS_RUBRIC.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                <td style={{ padding: '6px 10px', fontWeight: 600, color: r.points === 20 ? '#22c55e' : r.points === 15 ? '#3b82f6' : r.points === 10 ? '#f59e0b' : r.points === 5 ? '#f97316' : '#ef4444', whiteSpace: 'nowrap' }}>{r.label}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{r.points}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Economic Background (30%) */}
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.12)', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#a78bfa' }}>ECONOMIC BACKGROUND (30%)</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Level</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Pts</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Cedula (Both Parents)</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Electric Bills (Avg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ECONOMIC_RUBRIC.map((r, i) => (
                              <tr key={r.points} style={{ borderBottom: i < ECONOMIC_RUBRIC.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                <td style={{ padding: '6px 10px', fontWeight: 600, color: r.points === 30 ? '#22c55e' : r.points === 25 ? '#3b82f6' : r.points === 20 ? '#f59e0b' : r.points === 15 ? '#f97316' : '#ef4444', whiteSpace: 'nowrap' }}>{r.label}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{r.points}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{r.cedula}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{r.electric}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Examination (50%) */}
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fbbf24', letterSpacing: '0.08em', marginBottom: '8px' }}>EXAMINATION</div>
                          <div style={{ fontWeight: 800, fontSize: '2.5rem', color: '#fbbf24', lineHeight: 1 }}>50%</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>of total score</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    // Filter applicants for evaluation
                    let filteredEvalApplicants = applicants.filter(a => {
                      if (a.status !== 'pending') return false;
                      
                      const matchesSearch = 
                        `${a.firstName} ${a.lastName}`.toLowerCase().includes(evalSearchTerm.toLowerCase()) ||
                        a.email?.toLowerCase().includes(evalSearchTerm.toLowerCase());
                      
                      const matchesSchool = !evalFilterSchool || a.school === evalFilterSchool;
                      
                      return matchesSearch && matchesSchool;
                    });

                    // Dynamic sorting based on selected column
                    filteredEvalApplicants = filteredEvalApplicants.sort((a, b) => {
                      const { column, direction } = evalSort;
                      const multiplier = direction === 'asc' ? 1 : -1;
                      
                      switch (column) {
                        case 'name':
                          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                          return nameA.localeCompare(nameB) * multiplier;
                        case 'school':
                          return a.school.localeCompare(b.school) * multiplier;
                        case 'examScore':
                          return ((a.examScore || 0) - (b.examScore || 0)) * multiplier;
                        case 'economicScore':
                          return ((a.economicScore || 0) - (b.economicScore || 0)) * multiplier;
                        case 'requirementsScore':
                          return ((a.requirementsScore ?? -1) - (b.requirementsScore ?? -1)) * multiplier;
                        case 'totalScore':
                          return (computeTotalScore(a) - computeTotalScore(b)) * multiplier;
                        default:
                          return 0;
                      }
                    });

                    // Apply top scores filter
                    if (evalFilterTopScores) {
                      const topN = parseInt(evalFilterTopScores);
                      filteredEvalApplicants = filteredEvalApplicants.slice(0, topN);
                    }

                    // Pagination for evaluation
                    const evalTotalPages = Math.ceil(filteredEvalApplicants.length / evalItemsPerPage);
                    const evalStartIndex = (evalCurrentPage - 1) * evalItemsPerPage;
                    const evalEndIndex = evalStartIndex + evalItemsPerPage;
                    const paginatedEvalApplicants = filteredEvalApplicants.slice(evalStartIndex, evalEndIndex);

                    return (
                      <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th onClick={() => handleEvalSort('name')} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Applicant Name
                            <SortIcon column="name" currentSort={evalSort} />
                          </div>
                        </th>
                        <th onClick={() => handleEvalSort('school')} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            School
                            <SortIcon column="school" currentSort={evalSort} />
                          </div>
                        </th>
                        <th onClick={() => handleEvalSort('examScore')} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Exam Score
                            <SortIcon column="examScore" currentSort={evalSort} />
                          </div>
                        </th>
                        <th onClick={() => handleEvalSort('requirementsScore')} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Requirements (20%)
                            <SortIcon column="requirementsScore" currentSort={evalSort} />
                          </div>
                        </th>
                        <th onClick={() => handleEvalSort('economicScore')} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Economic Background (30%)
                            <SortIcon column="economicScore" currentSort={evalSort} />
                          </div>
                        </th>
                        <th onClick={() => handleEvalSort('totalScore')} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Total Score (100%)
                            <SortIcon column="totalScore" currentSort={evalSort} />
                          </div>
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEvalApplicants.map((applicant, index) => {
                        const examScore = applicant.examScore || 0;
                        const economicScore = applicant.economicScore || 0;
                        const requirementsScore = applicant.requirementsScore ?? null;
                        const rank = evalStartIndex + index + 1;
                        const ecoEntry = ECONOMIC_RUBRIC.find(r => r.points === economicScore);
                        const reqEntry = REQUIREMENTS_RUBRIC.find(r => r.points === requirementsScore);
                        const ecoColor = economicScore === 30 ? '#22c55e' : economicScore === 25 ? '#3b82f6' : economicScore === 20 ? '#f59e0b' : economicScore === 15 ? '#f97316' : '#ef4444';
                        const reqColor = requirementsScore === 20 ? '#22c55e' : requirementsScore === 15 ? '#3b82f6' : requirementsScore === 10 ? '#f59e0b' : requirementsScore === 5 ? '#f97316' : '#ef4444';
                        // Auto-computed combined rubric score (out of 100)
                        const totalScore = computeTotalScore(applicant);
                        const isFullyScored = examScore > 0 && economicScore > 0 && requirementsScore !== null;
                        const totalColor = totalScore >= 85 ? '#22c55e' : totalScore >= 75 ? '#3b82f6' : totalScore >= 60 ? '#f59e0b' : '#ef4444';
                        
                        return (
                          <tr key={applicant.id}>
                            <td>
                              <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: rank <= 3 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 
                                           rank <= 10 ? 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)' : 
                                           'var(--bg-tertiary)',
                                color: rank <= 10 ? '#fff' : 'var(--text-primary)',
                                fontWeight: '600',
                                fontSize: '0.875rem'
                              }}>
                                {rank}
                              </div>
                            </td>
                            <td>{applicant.lastName}, {applicant.firstName}</td>
                            <td>{applicant.school}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <span style={{ 
                                        fontWeight: '600', 
                                        fontSize: '1rem',
                                        color: examScore >= 90 ? '#22c55e' : 
                                               examScore >= 80 ? '#3b82f6' : 
                                               examScore >= 70 ? '#f59e0b' : 
                                               examScore >= 60 ? '#f97316' : '#ef4444'
                                      }}>
                                        {examScore}
                                      </span>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>/100</span>
                                    </div>
                                    {examScore > 0 && (
                                      <div style={{ 
                                        width: '100%', 
                                        height: '4px', 
                                        background: 'var(--bg-tertiary)', 
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{ 
                                          width: `${examScore}%`, 
                                          height: '100%',
                                          background: examScore >= 90 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 
                                                     examScore >= 80 ? 'linear-gradient(90deg, #3b82f6, #2563eb)' : 
                                                     examScore >= 70 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 
                                                     examScore >= 60 ? 'linear-gradient(90deg, #f97316, #ea580c)' : 
                                                     'linear-gradient(90deg, #ef4444, #dc2626)',
                                          transition: 'width 0.3s ease'
                                        }} />
                                      </div>
                                    )}
                                  </div>
                                  <button 
                                    className="btn btn-sm btn-primary"
                                    onClick={async () => {
                                      const { value: score } = await Swal.fire({
                                        title: 'Enter Exam Score',
                                        input: 'number',
                                        inputLabel: 'Score (0-100)',
                                        inputValue: examScore > 0 ? examScore : '',
                                        inputAttributes: { min: 0, max: 100, step: 0.1 },
                                        showCancelButton: true,
                                        confirmButtonColor: 'var(--primary)',
                                        inputValidator: (value) => {
                                          if (!value && value !== 0) return 'Please enter a score';
                                          if (value < 0 || value > 100) return 'Score must be between 0 and 100';
                                        },
                                      });
                                      if (score !== undefined) {
                                        updateApplicant(applicant.id, { examScore: parseFloat(score) });
                                      }
                                    }}
                                    style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                  >
                                    {examScore > 0 ? 'Update' : 'Record'}
                                  </button>
                                </div>
                              </div>
                            </td>
                            {/* Requirements Score (20%) */}
                            <td>
                              {requirementsScore !== null ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 700, fontSize: '1rem', color: reqColor }}>{requirementsScore}</span>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ 20 pts</span>
                                    </div>
                                    <div style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: `${reqColor}20`, color: reqColor }}>
                                      {reqEntry?.label || '—'}
                                    </div>
                                  </div>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ fontSize: '0.72em', padding: '4px 8px' }}
                                    onClick={async () => {
                                      const opts = {};
                                      REQUIREMENTS_RUBRIC.forEach(r => { opts[r.points] = `${r.points} pts — ${r.label}`; });
                                      const { value: s } = await Swal.fire({
                                        title: 'Update Requirements Score',
                                        input: 'select',
                                        inputOptions: opts,
                                        inputValue: requirementsScore ?? '',
                                        inputPlaceholder: 'Select level',
                                        showCancelButton: true,
                                        confirmButtonColor: 'var(--primary)',
                                        inputValidator: v => { if (v === '') return 'Please select a level'; },
                                      });
                                      if (s !== undefined) updateApplicant(applicant.id, { requirementsScore: parseInt(s) });
                                    }}
                                  >Update</button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.78em', padding: '6px 10px' }}
                                  onClick={async () => {
                                    const opts = {};
                                    REQUIREMENTS_RUBRIC.forEach(r => { opts[r.points] = `${r.points} pts — ${r.label}`; });
                                    const { value: s } = await Swal.fire({
                                      title: 'Score Requirements Completion',
                                      input: 'select',
                                      inputOptions: opts,
                                      inputPlaceholder: 'Select level',
                                      showCancelButton: true,
                                      confirmButtonColor: 'var(--primary)',
                                      inputValidator: v => { if (v === '') return 'Please select a level'; },
                                    });
                                    if (s !== undefined) updateApplicant(applicant.id, { requirementsScore: parseInt(s) });
                                  }}
                                >Score</button>
                              )}
                            </td>

                            {/* Economic Background (30%) */}
                            <td>
                              {economicScore > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 700, fontSize: '1rem', color: ecoColor }}>{economicScore}</span>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ 30 pts</span>
                                    </div>
                                    <div style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: `${ecoColor}20`, color: ecoColor }}>
                                      {ecoEntry?.label || '—'}
                                    </div>
                                    {ecoEntry && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                        Cedula: {ecoEntry.cedula} · Bills: {ecoEntry.electric}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ fontSize: '0.72em', padding: '4px 8px' }}
                                    onClick={async () => {
                                      const opts = {};
                                      ECONOMIC_RUBRIC.forEach(r => { opts[r.points] = `${r.points} pts — ${r.label}`; });
                                      const { value: s } = await Swal.fire({
                                        title: 'Update Economic Background',
                                        input: 'select',
                                        inputOptions: opts,
                                        inputValue: economicScore || '',
                                        inputPlaceholder: 'Select level',
                                        showCancelButton: true,
                                        confirmButtonColor: 'var(--primary)',
                                        inputValidator: v => { if (!v) return 'Please select a level'; },
                                      });
                                      if (s) updateApplicant(applicant.id, { economicScore: parseInt(s) });
                                    }}
                                  >Update</button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.78em', padding: '6px 10px' }}
                                  onClick={async () => {
                                    const opts = {};
                                    ECONOMIC_RUBRIC.forEach(r => { opts[r.points] = `${r.points} pts — ${r.label}`; });
                                    const { value: s } = await Swal.fire({
                                      title: 'Rate Economic Background',
                                      input: 'select',
                                      inputOptions: opts,
                                      inputPlaceholder: 'Select level',
                                      showCancelButton: true,
                                      confirmButtonColor: 'var(--primary)',
                                      inputValidator: v => { if (!v) return 'Please select a level'; },
                                    });
                                    if (s) updateApplicant(applicant.id, { economicScore: parseInt(s) });
                                  }}
                                >Rate</button>
                              )}
                            </td>

                            {/* Total Score (auto-computed, 100%) */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '1.25rem', color: totalColor }}>
                                    {totalScore}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/100</span>
                                </div>
                                <div style={{
                                  width: '100%',
                                  height: '5px',
                                  background: 'var(--bg-tertiary)',
                                  borderRadius: '3px',
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${Math.min(100, totalScore)}%`,
                                    height: '100%',
                                    background: totalColor,
                                    transition: 'width 0.3s ease',
                                  }} />
                                </div>
                                {isFullyScored ? (
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '1px 7px',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: `${totalColor}20`,
                                    color: totalColor,
                                  }}>
                                    {totalScore >= 75 ? 'QUALIFIES' : 'BELOW THRESHOLD'}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    Partial — scoring incomplete
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-start' }}>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: 'Approve as City Scholar?',
                                    html: `
                                      <div style="text-align: left; padding: 10px;">
                                        <h4 style="margin-bottom: 15px; color: #1f2937;">${applicant.lastName}, ${applicant.firstName}</h4>
                                        <p><strong>Rank:</strong> #${rank}</p>
                                        <p><strong>School:</strong> ${applicant.school}</p>
                                        <p><strong>Program:</strong> ${applicant.program || 'N/A'}</p>
                                        <p><strong>Tuition Fee:</strong> PHP ${(applicant.tuitionFee || 0).toLocaleString()}</p>
                                        <p><strong>Reflected Scholarship Amount:</strong> PHP ${computeReflectedAmount(applicant.tuitionFee).toLocaleString()}</p>
                                        <p><strong>Exam Score:</strong> ${examScore}/100</p>
                                        <p><strong>Requirements Score:</strong> ${requirementsScore !== null ? requirementsScore + '/20 pts — ' + (reqEntry?.label || '') : 'Not scored'}</p>
                                        <p><strong>Economic Background:</strong> ${economicScore > 0 ? economicScore + '/30 pts — ' + (ecoEntry?.label || '') : 'Not rated'}</p>
                                        <hr>
                                        <p style="font-size: 1.05rem;"><strong>Total Combined Score:</strong> <span style="color: ${totalColor}; font-weight: bold;">${totalScore}/100</span> ${isFullyScored ? (totalScore >= 75 ? '(Qualifies)' : '(Below threshold)') : '(Partial — scoring incomplete)'}</p>
                                        <hr>
                                        <p style="color: #22c55e; font-weight: bold; text-align: center;">Approve this applicant as a City Scholar?</p>
                                      </div>
                                    `,
                                    icon: 'question',
                                    showCancelButton: true,
                                    confirmButtonColor: 'var(--success)',
                                    cancelButtonColor: '#6b7280',
                                    confirmButtonText: 'Yes, Approve',
                                    cancelButtonText: 'Cancel'
                                  });
                                  if (result.isConfirmed) {
                                    updateApplicant(applicant.id, {
                                      status: 'active',
                                      amountGranted: computeReflectedAmount(applicant.tuitionFee),
                                    });
                                    Swal.fire(
                                      'Approved!', 
                                      `${applicant.lastName}, ${applicant.firstName} has been approved as a City Scholar.`, 
                                      'success'
                                    );
                                  }
                                }}
                                style={{ marginRight: '8px' }}
                              >
                                <CheckCircle size={14} /> Approve
                              </button>
                              <button 
                                className="btn btn-sm btn-danger"
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: 'Reject Application?',
                                    html: `
                                      <div style="text-align: left; padding: 10px;">
                                        <h4 style="margin-bottom: 15px; color: #1f2937;">${applicant.lastName}, ${applicant.firstName}</h4>
                                        <p><strong>Rank:</strong> #${rank}</p>
                                        <p><strong>School:</strong> ${applicant.school}</p>
                                        <p><strong>Exam Score:</strong> ${examScore}/100</p>
                                        <p><strong>Requirements Score:</strong> ${requirementsScore !== null ? requirementsScore + '/20 pts — ' + (reqEntry?.label || '') : 'Not scored'}</p>
                                        <p><strong>Economic Background:</strong> ${economicScore > 0 ? economicScore + '/30 pts — ' + (ecoEntry?.label || '') : 'Not rated'}</p>
                                        <p style="font-size: 1.05rem;"><strong>Total Combined Score:</strong> <span style="color: ${totalColor}; font-weight: bold;">${totalScore}/100</span></p>
                                        <hr>
                                        <p style="color: #ef4444; font-weight: bold; text-align: center;">Please provide a reason for rejection:</p>
                                      </div>
                                    `,
                                    input: 'textarea',
                                    inputLabel: 'Reason for Rejection',
                                    inputPlaceholder: 'Enter detailed reason for rejection...',
                                    inputAttributes: {
                                      'aria-label': 'Rejection reason'
                                    },
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonColor: 'var(--danger)',
                                    cancelButtonColor: '#6b7280',
                                    confirmButtonText: 'Yes, Reject',
                                    cancelButtonText: 'Cancel',
                                    inputValidator: (value) => {
                                      if (!value) {
                                        return 'You must provide a reason for rejection!'
                                      }
                                    }
                                  });
                                  if (result.isConfirmed) {
                                    updateApplicant(applicant.id, { 
                                      status: 'rejected',
                                      rejectionReason: result.value
                                    });
                                    Swal.fire(
                                      'Rejected!', 
                                      `Application for ${applicant.lastName}, ${applicant.firstName} has been rejected.`, 
                                      'success'
                                    );
                                  }
                                }}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination Controls for Evaluation */}
                  {filteredEvalApplicants.length > 0 && (
                    <div className="pagination-container">
                      <div className="pagination-info">
                        Showing {evalStartIndex + 1} to {Math.min(evalEndIndex, filteredEvalApplicants.length)} of {filteredEvalApplicants.length} entries
                      </div>
                      <div className="pagination-controls">
                        <button
                          className="pagination-btn"
                          onClick={() => setEvalCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={evalCurrentPage === 1}
                        >
                          Previous
                        </button>
                        {Array.from({ length: evalTotalPages }, (_, i) => i + 1)
                          .filter(page => {
                            if (evalTotalPages <= 7) return true;
                            if (page === 1 || page === evalTotalPages) return true;
                            if (page >= evalCurrentPage - 1 && page <= evalCurrentPage + 1) return true;
                            return false;
                          })
                          .map((page, index, array) => (
                            <span key={page}>
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <span className="pagination-ellipsis">...</span>
                              )}
                              <button
                                className={`pagination-btn ${evalCurrentPage === page ? 'active' : ''}`}
                                onClick={() => setEvalCurrentPage(page)}
                              >
                                {page}
                              </button>
                            </span>
                          ))}
                        <button
                          className="pagination-btn"
                          onClick={() => setEvalCurrentPage(prev => Math.min(evalTotalPages, prev + 1))}
                          disabled={evalCurrentPage === evalTotalPages}
                        >
                          Next
                        </button>
                      </div>
                      <div className="pagination-size">
                        <label>Items per page:</label>
                        <select
                          value={evalItemsPerPage}
                          onChange={(e) => {
                            setEvalItemsPerPage(Number(e.target.value));
                            setEvalCurrentPage(1);
                          }}
                          className="pagination-select"
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

                  {filteredEvalApplicants.length === 0 && (
                    <div className="empty-state">
                      <FileSpreadsheet size={48} />
                      <h3>No pending applicants found</h3>
                      <p>Try adjusting your search or filters</p>
                    </div>
                  )}
                  </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
