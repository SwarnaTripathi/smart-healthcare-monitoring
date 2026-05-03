import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiGrid, FiUsers, FiClock, FiBell, FiLogOut, FiActivity, FiFileText, FiUser, FiSettings, FiCpu, FiList, FiShield } from 'react-icons/fi';
import ChatBot from './ChatBot';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;

  const handleLogout = () => { logout(); navigate('/'); };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  const patientNav = [
    { to: '/dashboard', icon: <FiGrid />, label: 'My Dashboard' },
    { to: '/my-reports', icon: <FiFileText />, label: 'My Reports' },
    { to: '/history', icon: <FiClock />, label: 'Health History' },
    { to: '/alerts', icon: <FiBell />, label: 'My Alerts' },
    { to: '/my-profile', icon: <FiUser />, label: 'My Profile' },
  ];

  const doctorNav = [
    { to: '/dashboard', icon: <FiGrid />, label: 'Dashboard' },
    { to: '/patients', icon: <FiUsers />, label: 'Patients' },
    { to: '/my-reports', icon: <FiFileText />, label: 'Patient Reports' },
    { to: '/history', icon: <FiClock />, label: 'Health History' },
    { to: '/alerts', icon: <FiBell />, label: 'Alerts' },
  ];

  const adminNav = [
    { to: '/dashboard', icon: <FiGrid />, label: 'System Overview' },
    { to: '/user-management', icon: <FiUsers />, label: 'User Management' },
    { to: '/patients', icon: <FiShield />, label: 'All Patients' },
    { to: '/my-reports', icon: <FiFileText />, label: 'Patient Reports' },
    { to: '/device-management', icon: <FiCpu />, label: 'Devices' },
    { to: '/alerts', icon: <FiBell />, label: 'All Alerts' },
    { to: '/audit-logs', icon: <FiList />, label: 'Audit Logs' },
  ];

  const navItems = role === 'admin' ? adminNav : role === 'doctor' ? doctorNav : patientNav;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiActivity style={{ fontSize: '1.4rem', color: '#06d6a0' }} />
            <div>
              <h2>HealthGuard</h2>
              <p>{role === 'admin' ? 'Admin Panel' : role === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div className="user-details">
              <div className="name">{user?.name}</div>
              <div className="role">{user?.role}</div>
            </div>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ color: '#ef4444', marginTop: '4px' }}>
            <span className="icon"><FiLogOut /></span>
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
      <ChatBot />
    </div>
  );
}

export default Layout;
