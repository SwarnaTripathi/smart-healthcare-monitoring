import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiCheckCircle, FiAlertTriangle, FiAlertOctagon, FiBell, FiFilter } from 'react-icons/fi';

function Alerts() {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState('all');
  const myPatientIdsRef = useRef(null);

  useEffect(() => {
    fetchPatients();
    fetchAlerts();
    fetchMyPatientIds();

    socket.on('new-alert', (alert) => {
      const allowed = myPatientIdsRef.current;
      if (allowed !== null && !allowed.includes(alert.patientId)) return;
      setAlerts(prev => [alert, ...prev]);
      toast.error(alert.message, { icon: '🚨', duration: 5000 });
    });

    socket.on('alert-acknowledged', (ackAlert) => {
      setAlerts(prev => prev.map(a => a._id === ackAlert._id ? { ...a, acknowledged: true, status: 'acknowledged' } : a));
    });

    socket.on('alert-resolved', (resAlert) => {
      setAlerts(prev => prev.map(a => a._id === resAlert._id ? { ...a, resolved: true, status: 'resolved' } : a));
    });

    return () => {
      socket.off('new-alert');
      socket.off('alert-acknowledged');
      socket.off('alert-resolved');
    };
  }, []);

  const fetchMyPatientIds = async () => {
    try {
      const { data } = await api.get('/alerts/my-patient-ids');
      myPatientIdsRef.current = data.patientIds;
    } catch (e) { console.error(e); }
  };

  const fetchPatients = async () => {
    try {
      const { data } = await api.get('/patients');
      setPatients(data.patients || []);
    } catch (e) { console.error(e); }
  };

  const fetchAlerts = async (patientId) => {
    setLoading(true);
    try {
      let url = '/alerts?limit=200';
      if (patientId && patientId !== 'all') url += `&patientId=${patientId}`;
      const { data } = await api.get(url);
      setAlerts(data.alerts);
    } catch (e) { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  };

  const handlePatientFilter = (pid) => {
    setSelectedPatient(pid);
    fetchAlerts(pid);
  };

  const acknowledge = async (id) => {
    try {
      await api.put(`/alerts/${id}/acknowledge`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: true, status: 'acknowledged' } : a));
      toast.success('Alert acknowledged');
    } catch (e) { toast.error('Failed to acknowledge'); }
  };

  const resolveAlert = async (id) => {
    try {
      await api.put(`/alerts/${id}/resolve`, { resolutionReason: 'Clinician resolved alert' });
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, resolved: true, status: 'resolved' } : a));
      toast.success('Alert marked as resolved');
    } catch (e) { toast.error('Failed to resolve alert'); }
  };

  const acknowledgeAll = async () => {
    try {
      await api.put('/alerts/acknowledge-all');
      setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true, status: 'acknowledged' })));
      toast.success('All alerts acknowledged');
    } catch (e) { toast.error('Failed'); }
  };

  const filtered = alerts.filter(a => {
    if (filter === 'unacknowledged') return !a.acknowledged && a.status !== 'resolved';
    if (filter === 'resolved') return a.status === 'resolved';
    if (filter === 'critical') return a.type === 'critical';
    if (filter === 'warning') return a.type === 'warning';
    return true;
  });

  const unackCount = alerts.filter(a => !a.acknowledged && a.status !== 'resolved').length;

  // Count alerts per patient for the filter badges
  const patientAlertCounts = {};
  alerts.forEach(a => {
    const key = a.patientId;
    patientAlertCounts[key] = (patientAlertCounts[key] || 0) + 1;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{isPatient ? 'My Alerts' : 'Alerts'}</h1>
          <p>{unackCount} unacknowledged alert{unackCount !== 1 ? 's' : ''}
            {user?.role === 'doctor' && ' for your patients'}
          </p>
        </div>
        {(user?.role === 'doctor' || user?.role === 'admin') && unackCount > 0 && (
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={acknowledgeAll}>
            <FiCheckCircle /> Acknowledge All
          </button>
        )}
      </div>

      {/* Patient Filter — doctors/admins */}
      {!isPatient && patients.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>
            <FiFilter style={{ marginRight: 4 }} /> Filter by Patient
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${selectedPatient === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: 'auto' }}
              onClick={() => handlePatientFilter('all')}>
              All Patients ({alerts.length})
            </button>
            {patients.map(p => (
              <button key={p.patientId}
                className={`btn btn-sm ${selectedPatient === p.patientId ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: 'auto' }}
                onClick={() => handlePatientFilter(p.patientId)}>
                {p.name} {patientAlertCounts[p.patientId] ? `(${patientAlertCounts[p.patientId]})` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Type & Lifecycle Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'unacknowledged', 'resolved', 'critical', 'warning'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', textTransform: 'capitalize' }}
            onClick={() => setFilter(f)}>
            {f} {f === 'unacknowledged' && unackCount > 0 ? `(${unackCount})` : ''}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FiBell /></div>
            <h3>No Alerts</h3>
            <p>{isPatient ? 'No alerts for your health data' : 'No alerts to display'}</p>
          </div>
        ) : (
          filtered.map(alert => (
            <div key={alert._id} className={`alert-item ${alert.status === 'resolved' ? 'resolved' : alert.acknowledged ? 'acknowledged' : ''}`}>
              <div className={`alert-icon ${alert.type === 'critical' ? 'critical-icon' : 'warning-icon'}`}>
                {alert.type === 'critical' ? <FiAlertOctagon /> : <FiAlertTriangle />}
              </div>
              <div className="alert-content">
                <div className="alert-message">
                  {alert.message}
                  {alert.source && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: '#334155', color: '#94a3b8' }}>
                      {alert.source.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                </div>
                {alert.explanation && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                    {alert.explanation}
                  </div>
                )}
                <div className="alert-meta">
                  Patient: {alert.patientName || alert.patientId} &nbsp;·&nbsp;
                  {new Date(alert.createdAt).toLocaleString()}
                  {alert.status === 'resolved' ? (
                    <span style={{ color: '#10b981' }}> &nbsp;·&nbsp; ✓ Resolved</span>
                  ) : alert.acknowledged ? (
                    <span> &nbsp;·&nbsp; ✓ Acknowledged</span>
                  ) : (
                    <span style={{ color: '#f59e0b' }}> &nbsp;·&nbsp; Open</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!alert.acknowledged && alert.status !== 'resolved' && (user?.role === 'doctor' || user?.role === 'admin') && (
                  <button className="btn btn-sm btn-secondary" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={() => acknowledge(alert._id)}>
                    <FiCheckCircle /> Ack
                  </button>
                )}
                {alert.status !== 'resolved' && (user?.role === 'doctor' || user?.role === 'admin') && (
                  <button className="btn btn-sm btn-secondary" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={() => resolveAlert(alert._id)}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default Alerts;
