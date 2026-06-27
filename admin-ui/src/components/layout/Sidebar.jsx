import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getRole, getUsername, getRoleLabel } from '../../utils/auth';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  Megaphone,
  MessageCircle,
  BarChart3,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  LogOut,
  Sun,
  Moon,
  CalendarDays,
  Shield,
  Award,
  Archive,
  GraduationCap,
  UserX,
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  {
    icon: FileText,
    label: 'Applications',
    submenu: [
      { path: '/applications', label: 'All Applications' },
    ],
  },
  {
    icon: Users,
    label: 'Scholars',
    submenu: [
      { path: '/scholars', label: 'Scholars List' },
      { path: '/attendance', icon: Calendar, label: 'Attendance' },
      { path: '/academic-records', icon: BookOpen, label: 'Academic Records' },
      { path: '/evaluation', icon: ClipboardCheck, label: 'Scholar Evaluation' },
      { path: '/timeline', icon: TrendingUp, label: 'Scholarship Timeline' },
    ],
  },
  { path: '/announcements', icon: Megaphone, label: 'Announcements' },
  { path: '/messages', icon: MessageCircle, label: 'Messages' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  {
    icon: Archive,
    label: 'History',
    submenu: [
      { path: '/applicant-history', icon: UserX, label: 'Applicant History' },
      { path: '/scholar-history', icon: GraduationCap, label: 'Scholar History' },
    ],
  },
  // Admin-only: staff do not manage other staff.
  { path: '/staff-management', icon: UserCog, label: 'Staff Management', roles: ['admin'] },
  { path: '/user-management', icon: UserCog, label: 'User Management' },
  {
    icon: Settings,
    label: 'Administration',
    submenu: [
      { path: '/system-settings', icon: Settings, label: 'System Settings' },
      { path: '/school-years', icon: CalendarDays, label: 'School Years' },
      // Admin-only: the audit trail is visible to administrators only.
      { path: '/audit-logs', icon: Shield, label: 'Audit Logs', roles: ['admin'] },
    ],
  },
];

// Keep nav items the current role is allowed to see; drop empty parent menus.
const visibleMenuFor = (role) =>
  menuItems
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => {
      if (!item.submenu) return item;
      const submenu = item.submenu.filter((sub) => !sub.roles || sub.roles.includes(role));
      return { ...item, submenu };
    })
    .filter((item) => !item.submenu || item.submenu.length > 0);

export default function Sidebar({ mobileMenuOpen, onClose, onLogout }) {
  const { sidebarCollapsed, setSidebarCollapsed, theme, toggleTheme } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedMenu, setExpandedMenu] = useState(null);
  const role = getRole();
  const adminUser = getUsername();
  const roleLabel = getRoleLabel();
  const visibleMenu = visibleMenuFor(role);
  const adminInitials = adminUser.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate('/login', { replace: true });
  };

  const handleNavClick = () => {
    // Close mobile menu when a nav item is clicked
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
    >
      <div className="sidebar-header">
        <div className="logo-container">
          <Building2 className="logo-icon" />
          {!sidebarCollapsed && (
            <div className="logo-text">
              <span className="logo-title">CED</span>
              <span className="logo-subtitle">City Education Department</span>
            </div>
          )}
        </div>
        <button
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const isDropdown = !!item.submenu;
            const isExpanded = expandedMenu === item.label;
            const isActive = item.path ? location.pathname === item.path : false;
            const hasActiveChild = item.submenu?.some((sub) => location.pathname === sub.path);
            
            return (
              <li key={item.label}>
                {isDropdown ? (
                  <>
                    <button
                      className={`nav-link dropdown-header ${hasActiveChild ? 'active' : ''}`}
                      onClick={() => setExpandedMenu(isExpanded ? null : item.label)}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      <Icon className="nav-icon" size={20} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="nav-label">{item.label}</span>
                          <ChevronDown
                            className={`dropdown-icon ${isExpanded ? 'expanded' : ''}`}
                            size={16}
                          />
                        </>
                      )}
                      {hasActiveChild && <div className="active-indicator" />}
                    </button>
                    {isExpanded && !sidebarCollapsed && (
                      <ul className="submenu">
                        {item.submenu.map((subitem) => {
                          const SubIcon = subitem.icon;
                          const isSubActive = location.pathname === subitem.path;
                          return (
                            <li key={subitem.path}>
                              <NavLink
                                to={subitem.path}
                                className={`nav-link submenu-link ${isSubActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                              >
                                {SubIcon && <SubIcon className="nav-icon" size={16} />}
                                <span className="nav-label">{subitem.label}</span>
                                {isSubActive && <div className="active-indicator" />}
                              </NavLink>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    title={sidebarCollapsed ? item.label : ''}
                    onClick={handleNavClick}
                  >
                    <Icon className="nav-icon" size={20} />
                    {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                    {isActive && <div className="active-indicator" />}
                  </NavLink>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {!sidebarCollapsed && (
          <div className="user-info">
            <div className="user-avatar">{adminInitials}</div>
            <div className="user-details">
              <span className="user-name">{adminUser}</span>
              <span className="user-role">{roleLabel}</span>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="user-avatar collapsed-avatar" title={adminUser}>{adminInitials}</div>
        )}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={18} />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
