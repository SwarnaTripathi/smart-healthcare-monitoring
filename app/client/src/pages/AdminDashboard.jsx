import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FiUsers, FiActivity, FiAlertTriangle, FiCpu, FiFileText, FiDatabase, FiShield } from 'react-icons/fi';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data.stats)).catch(console.error).finally(() => setLoading(false));
    const interval = setInterval(() => {
      api.get('/admin/stats').then(r => setStats(r.data.stats)).catch(console.error);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>System Overview</h1>
          <p>Administrative dashboard — monitor all system activity</p>
        </div>
        <div className="live-indicator"><span className="live-dot"></span> SYSTEM ACTIVE</div>
      </div>

      {/* User Stats */}
      <h3 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>User Accounts</h3>
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card"><div className="stat-icon blue"><FiUsers /></div><div className="stat-value">{stats?.totalUsers || 0}</div><div className="stat-label">Total Users</div></div>
        <div className="stat-card"><div className="stat-icon purple"><FiShield /></div><div className="stat-value">{stats?.doctors || 0}</div><div className="stat-label">Doctors</div></div>
        <div className="stat-card"><div className="stat-icon green"><FiUsers /></div><div className="stat-value">{stats?.patients || 0}</div><div className="stat-label">Patient Accounts</div></div>
        <div className="stat-card"><div className="stat-icon yellow"><FiUsers /></div><div className="stat-value">{stats?.admins || 0}</div><div className="stat-label">Admins</div></div>
      </div>

      {/* Patient Stats */}
      <h3 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Patient Monitoring</h3>
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card"><div className="stat-icon blue"><FiActivity /></div><div className="stat-value">{stats?.totalPatients || 0}</div><div className="stat-label">Registered Patients</div></div>
        <div className="stat-card"><div className="stat-icon green"><FiActivity /></div><div className="stat-value">{stats?.activePatients || 0}</div><div className="stat-label">Active Patients</div></div>
        <div className="stat-card"><div className="stat-icon red"><FiAlertTriangle /></div><div className="stat-value">{stats?.criticalPatients || 0}</div><div className="stat-label">Critical Patients</div></div>
      </div>

      {/* System Stats */}
      <h3 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>System Data</h3>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><FiDatabase /></div><div className="stat-value">{stats?.totalReadings?.toLocaleString() || 0}</div><div className="stat-label">Total Sensor Readings</div></div>
        <div className="stat-card"><div className="stat-icon red"><FiAlertTriangle /></div><div className="stat-value">{stats?.pendingAlerts || 0}</div><div className="stat-label">Pending Alerts</div></div>
        <div className="stat-card"><div className="stat-icon yellow"><FiAlertTriangle /></div><div className="stat-value">{stats?.totalAlerts || 0}</div><div className="stat-label">Total Alerts</div></div>
        <div className="stat-card"><div className="stat-icon green"><FiFileText /></div><div className="stat-value">{stats?.totalReports || 0}</div><div className="stat-label">Medical Reports</div></div>
      </div>
    </>
  );
}

export default AdminDashboard;
