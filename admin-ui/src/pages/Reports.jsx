import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import {
  FileText,
  Download,
  ChevronDown,
  Users,
  DollarSign,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Award,
  UserX,
  Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { matchesExact } from '../utils/filtering';
import { fetchReportSummary } from '../services/backendApi';

const REPORT_CATEGORIES = {
  DASHBOARD: 'Dashboard Summary Reports',
  MASTER_DATA: 'Scholar Master Data Reports',
  FINANCIAL: 'Financial Reports',
  ACADEMIC: 'Academic Performance Reports',
  COMPLIANCE: 'Compliance & Documentation Reports',
  ENROLLMENT: 'Enrollment & Status Reports',
  ANALYTICAL: 'Comparative & Analytical Reports',
};

export default function Reports() {
  const { applicants, schools } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const [selectedReport, setSelectedReport] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);
  const [filterHEI, setFilterHEI] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterAY, setFilterAY] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setReportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;

    fetchReportSummary()
      .then((response) => {
        if (active) {
          setLiveSummary(response?.summary || null);
        }
      })
      .catch(() => {
        if (active) {
          setLiveSummary(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const reportTypes = [
    // VII. Dashboard Summary Reports (System-Generated)
    {
      id: 'total-active-scholars',
      name: 'Total Active Scholars Report',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: Users,
      description: 'Current count of all active scholars',
      fields: ['Total Active', 'Active %', 'Total Scholars'],
    },
    {
      id: 'funds-released-semester',
      name: 'Total Funds Released This Semester',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: DollarSign,
      description: 'Financial disbursement summary for current semester',
      fields: ['Semester', 'Academic Year', 'Total Released', 'Number of Recipients', 'Average per Scholar'],
    },
    {
      id: 'funds-remaining',
      name: 'Funds Remaining Report',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: TrendingUp,
      description: 'Budget balance and allocation status',
      fields: ['Total Budget', 'Total Released', 'Remaining Funds', 'Utilization %'],
    },
    {
      id: 'scholars-per-hei-graph',
      name: 'Scholars per HEI (Graph Data)',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: Building2,
      description: 'Distribution of scholars across partner institutions',
      fields: ['HEI Name', 'Active Scholars', 'On-Hold', 'Graduated', 'Total'],
    },
    {
      id: 'academic-standing-distribution',
      name: 'Academic Standing Distribution',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: GraduationCap,
      description: 'Performance categorization of all scholars',
      fields: ['GWA Range', 'Count', 'Percentage', 'Status'],
    },
    {
      id: 'gender-distribution',
      name: 'Gender Distribution Report',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: Users,
      description: 'Gender demographics of scholarship program',
      fields: ['Gender', 'Count', 'Percentage'],
    },
    {
      id: 'graduation-progress-rate',
      name: 'Graduation Progress Rate',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: Award,
      description: 'Track completion rates and retention',
      fields: ['Total Awarded', 'Graduated', 'Still Active', 'Terminated', 'Graduation Rate %'],
    },

    // I. Scholar Master Data Reports
    {
      id: 'master-list-all',
      name: 'Master List of Scholars (All HEIs)',
      category: REPORT_CATEGORIES.MASTER_DATA,
      icon: Users,
      description: 'Overall program monitoring - complete list of all scholars',
      fields: ['Scholar ID', 'Full Name', 'Sex', 'Date of Birth', 'Contact', 'Address', 'HEI', 'Program', 'Year Level', 'Semester & AY', 'Status', 'Year Awarded'],
    },
    {
      id: 'list-per-hei',
      name: 'Scholar List per HEI',
      category: REPORT_CATEGORIES.MASTER_DATA,
      icon: Building2,
      description: 'Monitor distribution across partner institutions',
      fields: ['HEI Name', 'Total Scholars', 'Scholar Names', 'Program', 'Year Level', 'Status', 'Total Funds Allocated'],
    },
    {
      id: 'demographic-profile',
      name: 'Scholar Demographic Profile Report',
      category: REPORT_CATEGORIES.MASTER_DATA,
      icon: Users,
      description: 'Equity and inclusion monitoring',
      fields: ['Gender Distribution', 'Age Bracket', 'Geographic Location', 'Socioeconomic Category'],
    },
    
    // II. Financial Reports
    {
      id: 'semester-disbursement',
      name: 'Semester Disbursement Report',
      category: REPORT_CATEGORIES.FINANCIAL,
      icon: DollarSign,
      description: 'Track semester payouts',
      fields: ['Academic Year', 'Semester', 'Scholar Name', 'HEI', 'Tuition Fee', 'Misc Fee', 'Total Grant', 'Date Paid', 'Payment Ref'],
    },
    {
      id: 'hei-fund-allocation',
      name: 'HEI Fund Allocation Summary',
      category: REPORT_CATEGORIES.FINANCIAL,
      icon: Building2,
      description: 'Budget tracking per partner school',
      fields: ['HEI Name', 'Number of Scholars', 'Total Required Funds', 'Total Disbursed', 'Remaining Budget'],
    },
    {
      id: 'program-financial-summary',
      name: 'Total Program Financial Summary',
      category: REPORT_CATEGORIES.FINANCIAL,
      icon: TrendingUp,
      description: 'Executive-level financial overview',
      fields: ['Total Active Scholars', 'Total Budget Required', 'Total Disbursed', 'Total Variance', 'Avg Cost per Scholar'],
    },
    {
      id: 'unused-grant',
      name: 'Unused Grant Monitoring Report',
      category: REPORT_CATEGORIES.FINANCIAL,
      icon: AlertTriangle,
      description: 'Identify scholars whose tuition is below ₱25,000',
      fields: ['Scholar Name', 'HEI', 'Actual Tuition & Misc', 'Grant Cap', 'Unused Portion'],
    },
    {
      id: 'outstanding-payment',
      name: 'Outstanding Payment Report',
      category: REPORT_CATEGORIES.FINANCIAL,
      icon: FileText,
      description: 'Monitor pending releases',
      fields: ['Scholar Name', 'HEI', 'Semester', 'Approved Amount', 'Amount Released', 'Balance', 'Status'],
    },

    // III. Academic Performance Reports
    {
      id: 'academic-performance',
      name: 'Scholar Academic Performance Report',
      category: REPORT_CATEGORIES.ACADEMIC,
      icon: GraduationCap,
      description: 'Retention and compliance monitoring',
      fields: ['Scholar Name', 'HEI', 'Program', 'Semester & AY', 'GWA', 'Academic Status', 'Remarks'],
    },
    {
      id: 'at-risk-scholars',
      name: 'At-Risk Scholars Report',
      category: REPORT_CATEGORIES.ACADEMIC,
      icon: AlertTriangle,
      description: 'Early intervention for struggling scholars',
      fields: ['Scholar Name', 'HEI', 'Program', 'GPA Below Threshold', 'Failed Subjects', 'Recommendation'],
    },
    {
      id: 'retention-continuation',
      name: 'Retention & Continuation Report',
      category: REPORT_CATEGORIES.ACADEMIC,
      icon: Award,
      description: 'Track eligibility for next semester',
      fields: ['Scholar Name', 'Previous Semester Status', 'Current Enrollment Status', 'Eligibility Result'],
    },

    // IV. Compliance & Documentation Reports
    {
      id: 'requirements-submission',
      name: 'Requirements Submission Report',
      category: REPORT_CATEGORIES.COMPLIANCE,
      icon: ClipboardCheck,
      description: 'Monitor document compliance',
      fields: ['Scholar Name', 'HEI', 'Required Documents', 'Submission Status', 'Date Submitted', 'Verified By'],
    },
    {
      id: 'agreement-monitoring',
      name: 'Scholarship Agreement Monitoring Report',
      category: REPORT_CATEGORIES.COMPLIANCE,
      icon: FileText,
      description: 'Legal compliance tracking',
      fields: ['Scholar Name', 'Date Agreement Signed', 'Parent/Guardian Signature', 'HEI Certification Status'],
    },

    // V. Enrollment & Status Reports
    {
      id: 'enrollment-verification',
      name: 'Enrollment Verification Report',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: ClipboardCheck,
      description: 'Confirm scholars are officially enrolled',
      fields: ['Scholar Name', 'HEI', 'Program', 'Units Enrolled', 'Semester', 'Enrollment Status'],
    },
    {
      id: 'status-summary',
      name: 'Scholarship Status Summary',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: Users,
      description: 'Quick overview of scholar standing',
      fields: ['Total Active', 'On Hold', 'Terminated', 'Graduated', 'Transferred'],
    },
    {
      id: 'graduation-report',
      name: 'Graduation Report',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: GraduationCap,
      description: 'Track successful scholars',
      fields: ['Scholar Name', 'HEI', 'Program', 'Date of Graduation', 'Total Semesters Funded', 'Total Amount Received'],
    },
    {
      id: 'terminated-dropped',
      name: 'Terminated / Dropped Scholars Report',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: UserX,
      description: 'Monitor attrition',
      fields: ['Scholar Name', 'HEI', 'Reason for Termination', 'Date Terminated', 'Total Funds Used'],
    },

    // VI. Comparative & Analytical Reports
    {
      id: 'year-to-year-growth',
      name: 'Year-to-Year Program Growth Report',
      category: REPORT_CATEGORIES.ANALYTICAL,
      icon: TrendingUp,
      description: 'Strategic planning and trend analysis',
      fields: ['Academic Year', 'Total Scholars', 'Total Budget', 'New Scholars Added', 'Graduates'],
    },
    {
      id: 'cost-per-graduate',
      name: 'Cost per Graduate Report',
      category: REPORT_CATEGORIES.ANALYTICAL,
      icon: DollarSign,
      description: 'Program ROI analysis',
      fields: ['Scholar Name', 'Total Semesters Funded', 'Total Amount Received', 'Graduation Status'],
    },
  ];

  // Auto-generate report data when selectedReport changes
  const [reportData, setReportData] = useState(null);

  const generateReportData = (reportId) => {
    let data = [];
    let reportName = '';
    
    switch (reportId) {
      case 'master-list-all': data = generateMasterListAll(); reportName = 'Master_List_All_HEIs'; break;
      case 'list-per-hei': data = generateListPerHEI(); reportName = 'Scholar_List_Per_HEI'; break;
      case 'demographic-profile': data = generateDemographicProfile(); reportName = 'Demographic_Profile'; break;
      case 'semester-disbursement': data = generateSemesterDisbursement(); reportName = 'Semester_Disbursement'; break;
      case 'hei-fund-allocation': data = generateHEIFundAllocation(); reportName = 'HEI_Fund_Allocation'; break;
      case 'program-financial-summary': data = generateProgramFinancialSummary(); reportName = 'Program_Financial_Summary'; break;
      case 'unused-grant': data = generateUnusedGrant(); reportName = 'Unused_Grant_Monitoring'; break;
      case 'academic-performance': data = generateAcademicPerformance(); reportName = 'Academic_Performance'; break;
      case 'at-risk-scholars': data = generateAtRiskScholars(); reportName = 'At_Risk_Scholars'; break;
      case 'retention-continuation': data = generateRetentionContinuation(); reportName = 'Retention_Continuation'; break;
      case 'requirements-submission': data = generateRequirementsSubmission(); reportName = 'Requirements_Submission'; break;
      case 'agreement-monitoring': data = generateAgreementMonitoring(); reportName = 'Agreement_Monitoring'; break;
      case 'enrollment-verification': data = generateEnrollmentVerification(); reportName = 'Enrollment_Verification'; break;
      case 'outstanding-payment': data = generateOutstandingPayments(); reportName = 'Outstanding_Payment'; break;
      case 'year-to-year-growth': data = generateYearToYearGrowth(); reportName = 'Year_To_Year_Growth'; break;
      case 'cost-per-graduate': data = generateCostPerGraduate(); reportName = 'Cost_Per_Graduate'; break;
      case 'status-summary': data = generateStatusSummary(); reportName = 'Status_Summary'; break;
      case 'graduation-report': data = generateGraduationReport(); reportName = 'Graduation_Report'; break;
      case 'terminated-dropped': data = generateTerminatedReport(); reportName = 'Terminated_Scholars'; break;
      case 'total-active-scholars': data = generateTotalActiveScholars(); reportName = 'Total_Active_Scholars'; break;
      case 'funds-released-semester': data = generateFundsReleasedSemester(); reportName = 'Funds_Released_This_Semester'; break;
      case 'funds-remaining': data = generateFundsRemaining(); reportName = 'Funds_Remaining'; break;
      case 'scholars-per-hei-graph': data = generateScholarsPerHEI(); reportName = 'Scholars_Per_HEI'; break;
      case 'academic-standing-distribution': data = generateAcademicStandingDistribution(); reportName = 'Academic_Standing_Distribution'; break;
      case 'gender-distribution': data = generateGenderDistribution(); reportName = 'Gender_Distribution'; break;
      case 'graduation-progress-rate': data = generateGraduationProgressRate(); reportName = 'Graduation_Progress_Rate'; break;
      default: data = []; reportName = 'Report';
    }
    return { data, name: reportName };
  };

  const handleReportSelect = (reportId) => {
    setSelectedReport(reportId);
    if (reportId) {
      const result = generateReportData(reportId);
      setReportData(result);
    } else {
      setReportData(null);
    }
  };

  // Auto-refresh report when filters change
  useEffect(() => {
    if (selectedReport) {
      const result = generateReportData(selectedReport);
      setReportData(result);
    }
  }, [filterHEI, filterSemester, filterAY, filterStatus]);

  const handleRefreshReport = () => {
    if (selectedReport) {
      const result = generateReportData(selectedReport);
      setReportData(result);
    }
  };

  const getSelectedReportInfo = () => reportTypes.find(r => r.id === selectedReport);

  const getFilteredScholars = () => {
    return applicants.filter(a => {
      if (!matchesExact(a.school, filterHEI)) return false;
      if (!matchesExact(a.status, filterStatus)) return false;
      if (filterAY && a.schoolYear && a.schoolYear !== filterAY) return false;
      return true;
    });
  };

  // Report Generation Functions
  const generateMasterListAll = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Full Name': `${s.firstName} ${s.middleName} ${s.lastName}`,
      'Sex': s.gender,
      'Date of Birth': s.birthDate,
      'Contact': s.phone,
      'Email': s.email,
      'Address': s.address,
      'HEI': s.school,
      'Program': s.program,
      'Year Level': s.yearLevel,
      'Semester & AY': s.schoolYear || filterAY || 'N/A',
      'Status': s.status?.toUpperCase() || 'PENDING',
      'Year Awarded': s.yearAwarded || new Date(s.createdAt).getFullYear(),
    }));
  };

  const generateListPerHEI = () => {
    const scholars = getFilteredScholars();

    return schools.flatMap(school => {
      const schoolScholars = scholars.filter(s => s.school === school.name);
      const totalFunds = schoolScholars.reduce(
        (sum, s) => sum + ((s.semestersUsed || 0) * (s.amountGranted || 0)),
        0
      );

      if (schoolScholars.length === 0) {
        return [{
          'HEI Name': school.name,
          'Total Number of Scholars': 0,
          'Scholar Name': 'N/A',
          'Program': 'N/A',
          'Year Level': 'N/A',
          'Scholarship Status': 'N/A',
          'Total Funds Allocated per HEI': '₱0',
        }];
      }

      return schoolScholars.map(s => ({
        'HEI Name': school.name,
        'Total Number of Scholars': schoolScholars.length,
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'Program': s.program,
        'Year Level': s.yearLevel,
        'Scholarship Status': s.status?.toUpperCase() || 'PENDING',
        'Total Funds Allocated per HEI': `₱${totalFunds.toLocaleString()}`,
      }));
    });
  };

  const generateDemographicProfile = () => {
    const scholars = getFilteredScholars();

    const total = scholars.length || 1;
    const nowYear = new Date().getFullYear();

    const genderMap = scholars.reduce((acc, s) => {
      const key = s.gender || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const ageBracketMap = { '17-19': 0, '20-22': 0, '23-25': 0, '26+': 0 };
    scholars.forEach(s => {
      if (!s.birthDate) return;
      const age = nowYear - Number(String(s.birthDate).slice(0, 4));
      if (age <= 19) ageBracketMap['17-19'] += 1;
      else if (age <= 22) ageBracketMap['20-22'] += 1;
      else if (age <= 25) ageBracketMap['23-25'] += 1;
      else ageBracketMap['26+'] += 1;
    });

    const locationMap = scholars.reduce((acc, s) => {
      const key = s.city || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const socioeconomicMap = scholars.reduce((acc, s) => {
      const score = s.economicScore;
      let key = 'Not Tagged';
      if (score === 1) key = 'Low Income';
      else if (score === 2) key = 'Lower-Middle Income';
      else if (score === 3) key = 'Middle Income';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const toRows = (dimension, mapObj) =>
      Object.entries(mapObj).map(([value, count]) => ({
        'Profile Dimension': dimension,
        'Category': value,
        'Count': count,
        'Percentage': `${((count / total) * 100).toFixed(1)}%`,
      }));

    return [
      ...toRows('Gender Distribution', genderMap),
      ...toRows('Age Bracket Distribution', ageBracketMap),
      ...toRows('Geographic Location', locationMap),
      ...toRows('Socioeconomic Category', socioeconomicMap),
    ];
  };

  const generateSemesterDisbursement = () => {
    const scholars = getFilteredScholars().filter(s => s.status === 'active' || s.status === 'approved');
    return scholars.map(s => ({
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Semester': filterSemester || '1st Semester',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Tuition Fee': `₱${(s.tuitionFee || 0).toLocaleString()}`,
      'Miscellaneous Fee': `₱${(s.miscFee || 0).toLocaleString()}`,
      'Total Scholarship Grant/Amount Paid': `₱${((s.tuitionFee || 0) + (s.miscFee || 0)).toLocaleString()}`,
      'Date Paid': s.paymentDate || 'Pending',
      'Payment Reference Number': s.paymentReference || 'N/A',
    }));
  };

  const generateHEIFundAllocation = () => {
    const scholars = getFilteredScholars();
    return schools.map(school => {
      const schoolScholars = scholars.filter(s => s.school === school.name);
      const totalRequired = schoolScholars.reduce((sum, s) => sum + (s.tuitionFee || 0) + (s.miscFee || 0), 0);
      const totalDisbursed = schoolScholars.reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const remaining = totalRequired - totalDisbursed;
      
      return {
        'HEI Name': school.name,
        'Number of Scholars': schoolScholars.length,
        'Total Required Funds': `₱${totalRequired.toLocaleString()}`,
        'Total Disbursed': `₱${totalDisbursed.toLocaleString()}`,
        'Remaining Budget': `₱${remaining.toLocaleString()}`,
      };
    });
  };

  const generateProgramFinancialSummary = () => {
    const activeScholars = getFilteredScholars().filter(a => a.status === 'active' || a.status === 'approved');
    const totalBudget = activeScholars.reduce((sum, s) => sum + (s.tuitionFee || 0) + (s.miscFee || 0), 0);
    const totalDisbursed = activeScholars.reduce((sum, s) => sum + (s.amountGranted || 0), 0);
    const variance = totalBudget - totalDisbursed;
    const avgCost = activeScholars.length > 0 ? totalDisbursed / activeScholars.length : 0;

    return activeScholars.map(s => ({
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Semester': filterSemester || 'All',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Total Active Scholars': activeScholars.length,
      'Total Budget Required': `₱${totalBudget.toLocaleString()}`,
      'Total Funds Disbursed': `₱${totalDisbursed.toLocaleString()}`,
      'Total Variance': `₱${variance.toLocaleString()}`,
      'Average Cost per Scholar': `₱${avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    }));
  };

  const generateUnusedGrant = () => {
    const GRANT_CAP = 25000;
    const scholars = getFilteredScholars();
    
    return scholars
      .filter(s => {
        const totalFees = (s.tuitionFee || 0) + (s.miscFee || 0);
        return totalFees < GRANT_CAP;
      })
      .map(s => {
        const totalFees = (s.tuitionFee || 0) + (s.miscFee || 0);
        const unused = GRANT_CAP - totalFees;
        
        return {
          'Scholar ID': s.scholarId || 'N/A',
          'Scholar Name': `${s.firstName} ${s.lastName}`,
          'HEI': s.school,
          'Actual Tuition & Misc': `₱${totalFees.toLocaleString()}`,
          'Grant Cap': `₱${GRANT_CAP.toLocaleString()}`,
          'Unused Portion': `₱${unused.toLocaleString()}`,
        };
      });
  };

  const generateAcademicPerformance = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => {
      const academicStatus = s.gwa <= 2.0 ? 'PASSED' : s.gwa <= 2.5 ? 'PROBATION' : 'FAILED';
      return {
        'Scholar ID': s.scholarId || 'N/A',
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Program': s.program,
        'Semester & AY': s.schoolYear || filterAY || 'N/A',
        'GWA': s.gwa || 'N/A',
        'Academic Status': academicStatus,
        'Remarks': s.notes || '',
      };
    });
  };

  const generateAtRiskScholars = () => {
    const GWA_THRESHOLD = 2.5;
    const scholars = getFilteredScholars().filter(s => s.gwa > GWA_THRESHOLD);
    
    return scholars.map(s => ({
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'GPA Below Threshold': `${s.gwa} > ${GWA_THRESHOLD}`,
      'Failed Subjects': s.grades?.[0]?.subjects?.filter(sub => sub.grade > 3.0).length || 0,
      'Recommendation': s.gwa > 3.0 ? 'Probation' : 'Warning',
    }));
  };

  const generateRetentionContinuation = () => {
    const scholars = getFilteredScholars().filter(
      s => ['active', 'on-hold', 'approved', 'graduated', 'terminated'].includes(s.status)
    );

    return scholars.map(s => {
      const previousStatus = s.status === 'active' ? 'Active' : s.status === 'on-hold' ? 'On-Hold' : s.status;
      const enrollmentStatus = s.enrollmentStatus || (s.status === 'terminated' ? 'Not Enrolled' : 'Verified');
      const eligible = s.status === 'active' && (s.gwa || 5) <= 2.5;

      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'Previous Semester Status': previousStatus?.toUpperCase(),
        'Current Enrollment Status': enrollmentStatus,
        'Eligibility Result': eligible ? 'ELIGIBLE' : s.status === 'terminated' ? 'NOT ELIGIBLE' : 'FOR REVIEW',
      };
    });
  };

  const generateRequirementsSubmission = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => {
      const status = s.status === 'active' || s.status === 'graduated' ? 'Complete' : s.status === 'terminated' ? 'Incomplete' : 'Partial';
      const submittedDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A';

      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Required Documents': 'Application Form, COR, Grades, Agreement',
        'Submission Status': status,
        'Date Submitted': submittedDate,
        'Verified By': 'CED Admin',
      };
    });
  };

  const generateAgreementMonitoring = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => ({
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'Date Agreement Signed': s.agreementDate || 'Pending',
      'Parent/Guardian Signature Status': s.parentGuardianName ? 'Signed' : 'Pending',
      'HEI Certification Status': s.enrollmentStatus || 'For Verification',
    }));
  };

  const generateEnrollmentVerification = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => ({
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'Units Enrolled': s.unitsEnrolled || 'N/A',
      'Semester': filterSemester || '1st Semester',
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Enrollment Status': s.enrollmentStatus || (s.status === 'terminated' ? 'Not Enrolled' : 'Verified'),
    }));
  };

  const generateOutstandingPayments = () => {
    const scholars = getFilteredScholars().filter(
      s => ['active', 'approved', 'on-hold'].includes(s.status)
    );

    return scholars.map(s => {
      const approvedAmount = s.amountGranted || 0;
      const released = s.disbursementStatus === 'Completed' ? approvedAmount : 0;
      const balance = approvedAmount - released;

      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Semester': filterSemester || '1st Semester',
        'Approved Amount': `₱${approvedAmount.toLocaleString()}`,
        'Amount Released': `₱${released.toLocaleString()}`,
        'Balance': `₱${balance.toLocaleString()}`,
        'Status': s.disbursementStatus || 'Pending',
      };
    });
  };

  const generateYearToYearGrowth = () => {
    const scholars = getFilteredScholars();
    const years = ['2023-2024', '2024-2025', '2025-2026'];
    return years.map((year) => {
      const yearStart = Number(year.split('-')[0]);
      const scholarsForYear = scholars.filter(a => (a.yearAwarded || new Date(a.createdAt).getFullYear()) <= yearStart);
      const totalScholars = scholarsForYear.length;
      const graduates = scholarsForYear.filter(a => a.status === 'graduated').length;
      const newScholars = scholars.filter(a => (a.yearAwarded || new Date(a.createdAt).getFullYear()) === yearStart).length;
      const budget = scholarsForYear.reduce((sum, s) => sum + (s.amountGranted || 0), 0);

      return {
        'Academic Year': year,
        'Total Scholars': totalScholars,
        'Total Budget': `₱${budget.toLocaleString()}`,
        'New Scholars Added': newScholars,
        'Graduates': graduates,
      };
    });
  };

  const generateCostPerGraduate = () => {
    const graduates = getFilteredScholars().filter(a => a.status === 'graduated');
    return graduates.map(s => {
      const fundedSemesters = s.semestersUsed || 0;
      const totalReceived = fundedSemesters * (s.amountGranted || 0);
      const avgPerSemester = fundedSemesters > 0 ? totalReceived / fundedSemesters : 0;

      return {
        'Scholar ID': s.scholarId || 'N/A',
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Program': s.program,
        'Total Semesters Funded': fundedSemesters,
        'Total Amount Received': `₱${totalReceived.toLocaleString()}`,
        'Average Cost per Semester': `₱${avgPerSemester.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        'Graduation Status': 'Graduated',
      };
    });
  };

  const generateStatusSummary = () => {
    const scholars = getFilteredScholars();
    const statusRows = [
      { key: 'active', label: 'Total Active Scholars' },
      { key: 'on-hold', label: 'On Hold' },
      { key: 'terminated', label: 'Terminated' },
      { key: 'graduated', label: 'Graduated' },
      { key: 'transferred', label: 'Transferred' },
    ];

    return statusRows.map(({ key, label }) => {
      const matching = scholars.filter(a => a.status === key);
      return {
        'Status': label,
        'Count': matching.length,
        'Sample Scholars': matching.slice(0, 8).map(s => `${s.firstName} ${s.lastName}`).join(', ') || 'N/A',
        'Total Scholars': scholars.length,
      };
    });
  };

  const generateGraduationReport = () => {
    const graduates = getFilteredScholars().filter(a => a.status === 'graduated');
    return graduates.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'Date of Graduation': s.graduationDate || 'N/A',
      'Total Semesters Funded': s.semestersUsed || 0,
      'Total Amount Received': `₱${((s.semestersUsed || 0) * (s.amountGranted || 0)).toLocaleString()}`,
    }));
  };

  const generateTerminatedReport = () => {
    const terminated = getFilteredScholars().filter(a => a.status === 'terminated');
    return terminated.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Reason for Termination': s.terminationReason || 'Not specified',
      'Date Terminated': s.terminationDate || 'N/A',
      'Total Funds Used': `₱${((s.semestersUsed || 0) * (s.amountGranted || 0)).toLocaleString()}`,
    }));
  };

  // Dashboard Summary Report Functions
  const generateTotalActiveScholars = () => {
    const scholars = getFilteredScholars();
    const activeScholars = scholars.filter(a => a.status === 'active');
    const totalScholars = scholars.length;
    const activePercentage = totalScholars > 0 ? ((activeScholars.length / totalScholars) * 100).toFixed(1) : '0.0';

    return activeScholars.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'Year Level': s.yearLevel,
      'Scholarship Status': s.status?.toUpperCase() || 'ACTIVE',
      'Total Active Scholars': activeScholars.length,
      'Total Scholars': totalScholars,
      'Active Percentage': `${activePercentage}%`,
    }));
  };

  const generateFundsReleasedSemester = () => {
    const currentSemester = filterSemester || '1st Semester';
    const recipients = getFilteredScholars().filter(a => 
      (a.status === 'active' || a.status === 'approved') && 
      a.disbursementStatus === 'Completed'
    );

    const totalReleased = recipients.reduce((sum, s) => sum + (s.amountGranted || 0), 0);
    const avgPerScholar = recipients.length > 0 ? totalReleased / recipients.length : 0;

    return recipients.map(s => ({
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Semester': currentSemester,
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Amount Released': `₱${(s.amountGranted || 0).toLocaleString()}`,
      'Date Paid': s.paymentDate || 'N/A',
      'Payment Reference': s.paymentReference || 'N/A',
      'Total Funds Released (All Recipients)': `₱${totalReleased.toLocaleString()}`,
      'Average per Scholar': `₱${avgPerScholar.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    }));
  };

  const generateFundsRemaining = () => {
    const TOTAL_BUDGET = 10000000; // ₱10M example budget
    const scholars = getFilteredScholars();
    const byHEI = schools.map(school => {
      const schoolScholars = scholars.filter(a => a.school === school.name);
      const disbursed = schoolScholars
        .filter(a => a.disbursementStatus === 'Completed')
        .reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const allocated = schoolScholars.reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const remaining = Math.max(allocated - disbursed, 0);

      return {
        'HEI': school.name,
        'Allocated Funds': `₱${allocated.toLocaleString()}`,
        'Released Funds': `₱${disbursed.toLocaleString()}`,
        'Remaining Funds': `₱${remaining.toLocaleString()}`,
      };
    });

    const totalDisbursed = byHEI.reduce((sum, row) => sum + Number(row['Released Funds'].replace(/[₱,]/g, '')), 0);
    const remaining = TOTAL_BUDGET - totalDisbursed;
    const utilizationRate = TOTAL_BUDGET > 0 ? ((totalDisbursed / TOTAL_BUDGET) * 100).toFixed(1) : '0.0';

    return byHEI.map(row => ({
      ...row,
      'Total Program Budget': `₱${TOTAL_BUDGET.toLocaleString()}`,
      'Overall Remaining Budget': `₱${remaining.toLocaleString()}`,
      'Utilization Rate': `${utilizationRate}%`,
    }));
  };

  const generateScholarsPerHEI = () => {
    const scholars = getFilteredScholars();
    return schools.map(school => {
      const schoolScholars = scholars.filter(s => s.school === school.name);
      const active = schoolScholars.filter(s => s.status === 'active').length;
      const onHold = schoolScholars.filter(s => s.status === 'on-hold').length;
      const graduated = schoolScholars.filter(s => s.status === 'graduated').length;
      const terminated = schoolScholars.filter(s => s.status === 'terminated').length;
      
      return {
        'HEI Name': school.name,
        'Active Scholars': active,
        'On-Hold': onHold,
        'Graduated': graduated,
        'Terminated': terminated,
        'Total Scholars': schoolScholars.length,
        'Active %': schoolScholars.length > 0 ? ((active / schoolScholars.length) * 100).toFixed(1) + '%' : '0%',
      };
    });
  };

  const generateAcademicStandingDistribution = () => {
    const scholarsWithGWA = getFilteredScholars().filter(a => a.gwa !== null && a.gwa !== undefined);
    
    const excellent = scholarsWithGWA.filter(s => s.gwa <= 1.5).length;
    const veryGood = scholarsWithGWA.filter(s => s.gwa > 1.5 && s.gwa <= 2.0).length;
    const good = scholarsWithGWA.filter(s => s.gwa > 2.0 && s.gwa <= 2.5).length;
    const fair = scholarsWithGWA.filter(s => s.gwa > 2.5 && s.gwa <= 3.0).length;
    const poor = scholarsWithGWA.filter(s => s.gwa > 3.0).length;
    
    const total = scholarsWithGWA.length || 1;
    
    const pct = (count) => ((count / total) * 100).toFixed(1) + '%';
    const getNames = (predicate) =>
      scholarsWithGWA
        .filter(predicate)
        .slice(0, 5)
        .map(s => `${s.firstName} ${s.lastName}`)
        .join(', ') || 'N/A';

    return [
      { 'GWA Range': '1.0 - 1.5', 'Standing': 'Excellent', 'Count': excellent, 'Percentage': pct(excellent), 'Sample Scholars': getNames(s => s.gwa <= 1.5) },
      { 'GWA Range': '1.51 - 2.0', 'Standing': 'Very Good', 'Count': veryGood, 'Percentage': pct(veryGood), 'Sample Scholars': getNames(s => s.gwa > 1.5 && s.gwa <= 2.0) },
      { 'GWA Range': '2.01 - 2.5', 'Standing': 'Good', 'Count': good, 'Percentage': pct(good), 'Sample Scholars': getNames(s => s.gwa > 2.0 && s.gwa <= 2.5) },
      { 'GWA Range': '2.51 - 3.0', 'Standing': 'Fair', 'Count': fair, 'Percentage': pct(fair), 'Sample Scholars': getNames(s => s.gwa > 2.5 && s.gwa <= 3.0) },
      { 'GWA Range': '> 3.0', 'Standing': 'Poor', 'Count': poor, 'Percentage': pct(poor), 'Sample Scholars': getNames(s => s.gwa > 3.0) },
      { 'GWA Range': 'Total', 'Standing': 'All', 'Count': scholarsWithGWA.length, 'Percentage': '100%', 'Sample Scholars': 'All Scholars' },
    ];
  };

  const generateGenderDistribution = () => {
    const scholars = getFilteredScholars();
    const maleCount = scholars.filter(a => a.gender === 'Male').length;
    const femaleCount = scholars.filter(a => a.gender === 'Female').length;
    const total = scholars.length || 1;

    const maleNames = scholars.filter(a => a.gender === 'Male').slice(0, 6).map(a => `${a.firstName} ${a.lastName}`).join(', ') || 'N/A';
    const femaleNames = scholars.filter(a => a.gender === 'Female').slice(0, 6).map(a => `${a.firstName} ${a.lastName}`).join(', ') || 'N/A';
    
    return [
      { 'Gender': 'Male', 'Count': maleCount, 'Percentage': ((maleCount / total) * 100).toFixed(1) + '%', 'Sample Scholars': maleNames },
      { 'Gender': 'Female', 'Count': femaleCount, 'Percentage': ((femaleCount / total) * 100).toFixed(1) + '%', 'Sample Scholars': femaleNames },
      { 'Gender': 'Total', 'Count': total, 'Percentage': '100%', 'Sample Scholars': 'All Scholars' },
    ];
  };

  const generateGraduationProgressRate = () => {
    const scholars = getFilteredScholars();
    const awardedScholars = scholars.filter(a => a.status !== 'pending');
    const totalAwarded = awardedScholars.length;
    const graduated = scholars.filter(a => a.status === 'graduated').length;
    const stillActive = scholars.filter(a => a.status === 'active').length;
    const terminated = scholars.filter(a => a.status === 'terminated').length;
    const onHold = scholars.filter(a => a.status === 'on-hold').length;
    
    const graduationRate = totalAwarded > 0 ? ((graduated / totalAwarded) * 100).toFixed(1) : '0';
    const retentionRate = totalAwarded > 0 ? (((graduated + stillActive) / totalAwarded) * 100).toFixed(1) : '0';
    const attritionRate = totalAwarded > 0 ? ((terminated / totalAwarded) * 100).toFixed(1) : '0';
    
    return awardedScholars.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Current Status': s.status?.toUpperCase() || 'N/A',
      'Total Scholars Awarded': totalAwarded,
      'Graduated': graduated,
      'Still Active': stillActive,
      'On-Hold': onHold,
      'Terminated': terminated,
      'Graduation Rate': graduationRate + '%',
      'Retention Rate': retentionRate + '%',
      'Attrition Rate': attritionRate + '%',
    }));
  };

  // Generic export handlers
  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  };

  const exportToPDF = (data, title, filename) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map(row => headers.map(header => row[header]));
      
      doc.autoTable({
        startY: 28,
        head: [headers],
        body: rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 77, 92] },
      });
    }
    
    doc.save(`${filename}.pdf`);
  };

  return (
    <div className="page reports-page">
      <Header
        title="Reports & Analytics"
        subtitle="Generate comprehensive reports for scholarship program monitoring"
        onMenuClick={onMenuClick}
      />

      {liveSummary && (
        <div className="dashboard-content" style={{ marginTop: '1rem' }}>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-label">Live Applications</div>
              <div className="stat-value">{liveSummary.applications}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Live Active Scholars</div>
              <div className="stat-value">{liveSummary.activeScholars}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Attendance Logs</div>
              <div className="stat-value">{liveSummary.attendanceLogs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Announcements</div>
              <div className="stat-value">{liveSummary.announcements}</div>
            </div>
          </div>
        </div>
      )}

      <div className="reports-content">
        {/* Report Selector & Filters */}
        <div className="card filter-card">
          <div className="filter-grid">
            <div className="filter-item filter-item-wide">
              <label><FileText size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />Report Type</label>
              <div className="report-dropdown" ref={dropdownRef}>
                <button
                  type="button"
                  className={`report-dropdown-trigger ${selectedReport ? 'has-value' : ''}`}
                  onClick={() => setReportDropdownOpen(prev => !prev)}
                >
                  <span>{selectedReport ? reportTypes.find(r => r.id === selectedReport)?.name : '— Select a Report —'}</span>
                  <ChevronDown size={16} className={`dropdown-chevron ${reportDropdownOpen ? 'open' : ''}`} />
                </button>
                {reportDropdownOpen && (
                  <div className="report-dropdown-menu">
                    <button
                      type="button"
                      className="report-dropdown-item placeholder-item"
                      onClick={() => { handleReportSelect(null); setReportDropdownOpen(false); }}
                    >
                      — Clear Selection —
                    </button>
                    {Object.entries(REPORT_CATEGORIES).map(([key, category]) => {
                      const categoryReports = reportTypes.filter(r => r.category === category);
                      return (
                        <div key={key} className="report-dropdown-group">
                          <div className="report-dropdown-group-label">{category}</div>
                          {categoryReports.map(r => {
                            const Icon = r.icon;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                className={`report-dropdown-item ${selectedReport === r.id ? 'active' : ''}`}
                                onClick={() => { handleReportSelect(r.id); setReportDropdownOpen(false); }}
                              >
                                <Icon size={14} />
                                <span>{r.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="filter-item">
              <label>Academic Year</label>
              <select value={filterAY} onChange={(e) => { setFilterAY(e.target.value); }}>
                <option value="">All Academic Years</option>
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>
            <div className="filter-item">
              <label>Semester</label>
              <select value={filterSemester} onChange={(e) => { setFilterSemester(e.target.value); }}>
                <option value="">All Semesters</option>
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
              </select>
            </div>
            <div className="filter-item">
              <label>HEI</label>
              <select value={filterHEI} onChange={(e) => { setFilterHEI(e.target.value); }}>
                <option value="">All HEIs</option>
                {schools.map(school => (
                  <option key={school.id} value={school.name}>{school.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Scholar Status</label>
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); }}>
                <option value="">All Statuses</option>
                <option value="active">ACTIVE</option>
                <option value="on-hold">ON-HOLD</option>
                <option value="terminated">TERMINATED</option>
                <option value="graduated">GRADUATED</option>
              </select>
            </div>
          </div>
        </div>

        {/* No report selected state */}
        {!selectedReport && (
          <div className="report-placeholder">
            <div className="report-placeholder-inner">
              <FileText size={56} strokeWidth={1} />
              <h3>Select a Report to Generate</h3>
              <p>Choose a report type from the dropdown above. You can further refine results using the Academic Year, Semester, HEI, and Status filters, then export as Excel or PDF.</p>
              <div className="report-quick-picks">
                <span className="quick-pick-label">Quick picks:</span>
                {[
                  { id: 'master-list-all', label: 'Master List' },
                  { id: 'semester-disbursement', label: 'Disbursement' },
                  { id: 'academic-performance', label: 'Academic' },
                  { id: 'status-summary', label: 'Status Summary' },
                  { id: 'scholars-per-hei-graph', label: 'Per HEI' },
                ].map(qp => (
                  <button
                    key={qp.id}
                    className="btn btn-sm btn-chip"
                    onClick={() => handleReportSelect(qp.id)}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Report Display */}
        {selectedReport && reportData && (() => {
          const info = getSelectedReportInfo();
          const Icon = info?.icon || FileText;
          return (
            <div className="report-display">
              {/* Report Header Bar */}
              <div className="report-display-header">
                <div className="report-display-title">
                  <Icon size={22} style={{ color: 'var(--primary-color)' }} />
                  <div>
                    <h3>{info?.name || reportData.name}</h3>
                    <p>{info?.description}</p>
                  </div>
                </div>
                <div className="report-display-actions">
                  <span className="report-record-count">{reportData.data.length} record{reportData.data.length !== 1 ? 's' : ''}</span>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => exportToExcel(reportData.data, reportData.name)}
                    disabled={reportData.data.length === 0}
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => exportToPDF(reportData.data, info?.name || reportData.name, reportData.name)}
                    disabled={reportData.data.length === 0}
                  >
                    <Download size={16} />
                    PDF
                  </button>
                </div>
              </div>

              {/* Report Table */}
              <div className="report-table-wrapper">
                {reportData.data.length > 0 ? (
                  <>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: '2.5rem', textAlign: 'center' }}>#</th>
                            {Object.keys(reportData.data[0]).map(header => (
                              <th key={header}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{idx + 1}</td>
                              {Object.values(row).map((val, i) => (
                                <td key={i}>{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="report-table-footer">
                      <span>Showing all {reportData.data.length} record{reportData.data.length !== 1 ? 's' : ''}</span>
                      <span>Generated: {new Date().toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>No data available for this report with the current filters.</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Try adjusting the Academic Year, HEI, or Status filters above.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <style jsx>{`
        .reports-content {
          padding: 1.5rem;
        }

        .filter-card {
          margin-bottom: 1.5rem;
          padding: 1.5rem;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }

        .filter-item-wide {
          grid-column: span 2;
        }

        .filter-item label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .filter-item select,
        .filter-item input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }

        .report-select-main {
          font-weight: 600;
          border-color: var(--primary-color) !important;
          background-color: rgba(45, 149, 150, 0.05) !important;
        }

        /* Custom Report Dropdown */
        .report-dropdown {
          position: relative;
        }

        .report-dropdown-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background-color: var(--bg-secondary);
          color: var(--text-muted);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .report-dropdown-trigger.has-value {
          color: var(--text-primary);
          font-weight: 600;
          border-color: var(--primary);
          background-color: rgba(45, 149, 150, 0.06);
        }

        .report-dropdown-trigger:hover {
          border-color: var(--primary);
        }

        .dropdown-chevron {
          transition: transform 0.2s ease;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .dropdown-chevron.open {
          transform: rotate(180deg);
        }

        .report-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 50;
          max-height: 420px;
          overflow-y: auto;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          box-shadow: var(--shadow-lg);
          padding: 0.375rem;
        }

        .report-dropdown-group {
          margin-bottom: 0.25rem;
        }

        .report-dropdown-group-label {
          padding: 0.625rem 0.75rem 0.375rem;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--primary-light);
          pointer-events: none;
          user-select: none;
          border-top: 1px solid var(--border-color);
          margin-top: 0.25rem;
        }

        .report-dropdown-group:first-child .report-dropdown-group-label {
          border-top: none;
          margin-top: 0;
        }

        .report-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: 0.25rem;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.8125rem;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .report-dropdown-item:hover {
          background: var(--hover-bg);
        }

        .report-dropdown-item.active {
          background: rgba(45, 149, 150, 0.12);
          color: var(--primary-light);
          font-weight: 600;
        }

        .report-dropdown-item.active:hover {
          background: rgba(45, 149, 150, 0.18);
        }

        .report-dropdown-item svg {
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .report-dropdown-item.active svg {
          color: var(--primary-light);
        }

        .placeholder-item {
          color: var(--text-muted);
          font-style: italic;
          font-size: 0.8125rem;
          margin-bottom: 0.25rem;
        }

        .btn-outline {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          transition: all 0.15s;
        }
        .btn-outline:hover {
          background: var(--bg-secondary);
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        /* Placeholder state */
        .report-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
        .report-placeholder-inner {
          text-align: center;
          max-width: 480px;
          color: var(--text-secondary);
        }
        .report-placeholder-inner svg {
          margin-bottom: 1.25rem;
          opacity: 0.3;
          color: var(--primary-color);
        }
        .report-placeholder-inner h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }
        .report-placeholder-inner p {
          font-size: 0.875rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        .report-quick-picks {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .quick-pick-label {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .btn-chip {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 0.375rem 0.875rem;
          border-radius: 9999px;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .btn-chip:hover {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: white;
        }

        /* Report Display */
        .report-display {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .report-display-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: rgba(45, 149, 150, 0.03);
          flex-wrap: wrap;
          gap: 1rem;
        }

        .report-display-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .report-display-title h3 {
          margin: 0;
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .report-display-title p {
          margin: 0.125rem 0 0;
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .report-display-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .report-record-count {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          margin-right: 0.25rem;
        }

        .report-table-wrapper {
          overflow-x: auto;
        }

        .table-container {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }

        .data-table th,
        .data-table td {
          padding: 0.625rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
        }

        .data-table th {
          background: var(--bg-secondary);
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          position: sticky;
          top: 0;
        }

        .data-table tbody tr:hover {
          background: var(--bg-hover);
        }

        .report-table-footer {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          font-size: 0.8125rem;
          color: var(--text-secondary);
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        .empty-state svg {
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .filter-item-wide {
            grid-column: span 1;
          }
          .report-display-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .report-display-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
