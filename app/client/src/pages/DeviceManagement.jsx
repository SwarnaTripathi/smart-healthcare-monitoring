import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FiCpu, FiActivity, FiClock } from 'react-icons/fi';

function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/devices').then(r => setDevices(r.data.devices)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const isOnline = (lastActive) => {
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 60000; // active in last 60 seconds
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Device Management</h1>
          <p>Monitor all connected IoT devices and their status</p>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{devices.length} device(s) registered</span>
      </div>

      {loading ? <div className="loading-container"><div className="spinner"></div></div> : devices.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-icon"><FiCpu /></div>
          <h3>No Devices Found</h3>
          <p>IoT devices will appear here once they start sending data</p>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {devices.map(d => (
            <div className="card" key={d._id} style={{ border: `1px solid ${isOnline(d.lastActive) ? 'rgba(6,214,160,0.3)' : 'rgba(148,163,184,0.1)'}` }}>
              <div className="card-header">
                <h3><FiCpu style={{ marginRight: 8 }} />{d._id || 'Unknown Device'}</h3>
                <span className={`badge ${isOnline(d.lastActive) ? 'badge-normal' : 'badge-warning'}`}>
                  {isOnline(d.lastActive) ? '● Online' : '○ Offline'}
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Patient ID</span>
                    <span style={{ fontFamily: 'monospace', color: '#06d6a0' }}>{d.patientId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Total Readings</span>
                    <span style={{ fontWeight: 600 }}>{d.totalReadings.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Last Active</span>
                    <span style={{ fontSize: '0.8rem' }}>{new Date(d.lastActive).toLocaleString()}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(148,163,184,0.1)' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Avg HR</div>
                      <div style={{ fontWeight: 700, color: '#ef4444' }}>{Math.round(d.avgHR)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Avg SpO2</div>
                      <div style={{ fontWeight: 700, color: '#4cc9f0' }}>{d.avgSpO2.toFixed(1)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Avg Temp</div>
                      <div style={{ fontWeight: 700, color: '#fbbf24' }}>{d.avgTemp.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default DeviceManagement;
