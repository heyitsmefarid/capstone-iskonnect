import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import { useApp } from '../../context/AppContext';

export default function Layout({ onLogout }) {
  const { sidebarCollapsed } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        mobileMenuOpen={mobileMenuOpen} 
        onClose={closeMobileMenu}
        onMenuClick={toggleMobileMenu}
        onLogout={onLogout}
      />
      {mobileMenuOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={closeMobileMenu}
        />
      )}
      <main className="main-content">
        <Outlet context={{ onMenuClick: toggleMobileMenu }} />
      </main>
    </div>
  );
}
