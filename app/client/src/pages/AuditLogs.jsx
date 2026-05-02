import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FiList, FiFilter } from 'react-icons/fi';

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');

  useEffect(() => { fetchLogs(); }, [category]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = category ? `?category=${category}&limit=100` : '?limit=100';
      const { data } = await api.get(`/admin/audit-logs${params}`);
      setLogs(data.logs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const severityColor = { info: '#4cc9f0', warning: '#fbbf24', critical: '#ef4444' };
  const categories = ['', 'auth', 'patient', 'health_data', 'alert', 'report', 'admin', 'system'];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p>System activity logs and security events</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiFilter style={{ color: '#64748b' }} />
        {categories.map(c => (
          <button key={c} className={`btn btn-sm ${category === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', textTransform: 'capitalize' }} onClick={() => setCategory(c)}>
            {c || 'All'}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"></div></div> : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FiList /></div>
            <h3>No Logs Found</h3>
            <p>System activity logs will appear here as actions are performed</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Time</th><th>Severity</th><th>Category</th><th>User</th><th>Action</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: severityColor[log.severity] }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: severityColor[log.severity], display: 'inline-block' }}></span>
                        {log.severity}
                      </span>
                    </td>
                    <td><span className="badge badge-active" style={{ textTransform: 'capitalize' }}>{log.category}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{log.userName || '—'} {log.userRole ? <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({log.userRole})</span> : ''}</td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default AuditLogs;
