import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Scholars from './pages/Scholars';
import Attendance from './pages/Attendance';
import AcademicRecords from './pages/AcademicRecords';
import ScholarshipEvaluation from './pages/ScholarshipEvaluation';
import ScholarshipTimeline from './pages/ScholarshipTimeline';
import Announcements from './pages/Announcements';
import Messages from './pages/Messages';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import SystemSettings from './pages/SystemSettings';
import StaffManagement from './pages/StaffManagement';
import SchoolYearManagement from './pages/SchoolYearManagement';
import AuditLogs from './pages/AuditLogs';
import ApplicantHistory from './pages/ApplicantHistory';
import ScholarHistory from './pages/ScholarHistory';
import { isAuthenticated as readAuth, getRole, clearSession } from './utils/auth';
import './App.css';

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ isAuthenticated, children }) {
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Restricts a route to specific roles; others are redirected to the dashboard.
function RoleRoute({ allow, role, children }) {
  if (!allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('admin');

  useEffect(() => {
    setIsAuthenticated(readAuth());
    setRole(getRole());
  }, []);

  const handleLogin = (nextRole) => {
    setIsAuthenticated(true);
    setRole(nextRole || getRole());
  };

  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
  };

  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={(
              <PublicRoute isAuthenticated={isAuthenticated}>
                <Login onLogin={handleLogin} />
              </PublicRoute>
            )}
          />

          <Route
            path="/"
            element={(
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout onLogout={handleLogout} />
              </ProtectedRoute>
            )}
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="applications" element={<Applications />} />
            <Route path="scholars" element={<Scholars />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="academic-records" element={<AcademicRecords />} />
            <Route path="evaluation" element={<ScholarshipEvaluation />} />
            <Route path="timeline" element={<ScholarshipTimeline />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="messages" element={<Messages />} />
            <Route path="reports" element={<Reports />} />
            <Route path="applicant-history" element={<ApplicantHistory />} />
            <Route path="scholar-history" element={<ScholarHistory />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route
              path="staff-management"
              element={(
                <RoleRoute allow={['admin']} role={role}>
                  <StaffManagement />
                </RoleRoute>
              )}
            />
            <Route path="school-years" element={<SchoolYearManagement />} />
            <Route
              path="audit-logs"
              element={(
                <RoleRoute allow={['admin']} role={role}>
                  <AuditLogs />
                </RoleRoute>
              )}
            />
            <Route path="system-settings" element={<SystemSettings />} />
          </Route>

          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
