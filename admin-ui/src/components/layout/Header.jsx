import { Bell, User, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsername, getRoleLabel } from '../../utils/auth';

const MESSAGE_NOTIFICATION_KEY = 'ced_unread_messages';

const getInitialUnreadMessages = () => {
  if (typeof window === 'undefined') return 0;

  const saved = window.localStorage.getItem(MESSAGE_NOTIFICATION_KEY);
  if (saved !== null) {
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Seed from demo message data (3 direct student replies)
  window.localStorage.setItem(MESSAGE_NOTIFICATION_KEY, '3');
  return 3;
};

export default function Header({ title, subtitle, onMenuClick }) {
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(getInitialUnreadMessages);
  const adminUser = getUsername();
  const roleLabel = getRoleLabel();
  const adminInitials = adminUser.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  useEffect(() => {
    const syncUnread = () => {
      const saved = window.localStorage.getItem(MESSAGE_NOTIFICATION_KEY);
      const parsed = Number(saved ?? 0);
      setUnreadMessages(Number.isFinite(parsed) ? parsed : 0);
    };

    window.addEventListener('storage', syncUnread);
    window.addEventListener('message-notifications-updated', syncUnread);

    return () => {
      window.removeEventListener('storage', syncUnread);
      window.removeEventListener('message-notifications-updated', syncUnread);
    };
  }, []);

  const handleNotificationClick = () => {
    window.localStorage.setItem(MESSAGE_NOTIFICATION_KEY, '0');
    window.dispatchEvent(new Event('message-notifications-updated'));
    navigate('/messages');
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <div className="header-title-container">
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <div className="header-actions">
          <button className="notification-btn" onClick={handleNotificationClick}>
            <Bell size={20} />
            {unreadMessages > 0 && <span className="notification-badge">{unreadMessages}</span>}
          </button>

          <div className="header-divider" />

          <div className="header-user">
            <div className="header-user-avatar" title={adminUser}>
              {adminInitials}
            </div>
            <div className="header-user-details">
              <span className="header-user-name">{adminUser}</span>
              <span className="header-user-role">{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
