import { useState, useEffect } from 'react';
import api from '../utils/api';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiCheckCircle, FiAlertTriangle, FiAlertOctagon, FiBell } from 'react-icons/fi';

function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unacknowledged, critical, warning

  useEffect(() => {
    fetchAlerts();
    socket.on('new-alert', (alert) => {
      setAlerts(prev => [alert, ...prev]);
      toast.error(alert.message, { icon: '🚨', duration: 5000 });
    });
    return () => { socket.off('new-alert'); };
  }, []);

  const fetchAlerts = async () => {
    try {
      const { data } = await api.get('/alerts?limit=100');
      setAlerts(data.alerts);
    } catch (e) { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  };

  const acknowledge = async (id) => {
    try {
      await api.put(`/alerts/${id}/acknowledge`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: true } : a));
      toast.success('Alert acknowledged');
    } catch (e) { toast.error('Failed to acknowledge'); }
  };

  const acknowledgeAll = async () => {
    try {
      await api.put('/alerts/acknowledge-all');
      setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
      toast.success('All alerts acknowledged');
    } catch (e) { toast.error('Failed'); }
  };

  const filtered = alerts.filter(a => {
    if (filter === 'unacknowledged') return !a.acknowledged;
    if (filter === 'critical') return a.type === 'critical';
    if (filter === 'warning') return a.type === 'warning';
    return true;
  });

  const unackCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <p>{unackCount} unacknowledged alert{unackCount !== 1 ? 's' : ''}</p>
        </div>
        {(user?.role === 'doctor' || user?.role === 'admin') && unackCount > 0 && (
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={acknowledgeAll}>
            <FiCheckCircle /> Acknowledge All
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'unacknowledged', 'critical', 'warning'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', textTransform: 'capitalize' }}
            onClick={() => setFilter(f)}>
            {f} {f === 'unacknowledged' && unackCount > 0 ? `(${unackCount})` : ''}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="card">
        {loading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FiBell /></div>
            <h3>No Alerts</h3>
            <p>System is running normally — no alerts to display</p>
          </div>
        ) : (
          filtered.map(alert => (
            <div key={alert._id} className={`alert-item ${alert.acknowledged ? 'acknowledged' : ''}`}>
              <div className={`alert-icon ${alert.type === 'critical' ? 'critical-icon' : 'warning-icon'}`}>
                {alert.type === 'critical' ? <FiAlertOctagon /> : <FiAlertTriangle />}
              </div>
              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-meta">
                  Patient: {alert.patientName || alert.patientId} &nbsp;·&nbsp;
                  {new Date(alert.createdAt).toLocaleString()}
                  {alert.acknowledged && <span> &nbsp;·&nbsp; ✓ Acknowledged</span>}
                </div>
              </div>
              {!alert.acknowledged && (user?.role === 'doctor' || user?.role === 'admin') && (
                <button className="btn btn-sm btn-secondary" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={() => acknowledge(alert._id)}>
                  <FiCheckCircle /> Ack
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default Alerts;
