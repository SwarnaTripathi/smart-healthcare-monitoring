import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiHeart, FiThermometer, FiWind, FiFileText, FiBell, FiActivity } from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const MAX_POINTS = 30;

function PatientDashboard() {
  const { user } = useAuth();
  const [latestVitals, setLatestVitals] = useState(null);
  const [chartData, setChartData] = useState({ labels: [], hr: [], spo2: [], temp: [] });
  const [reportsCount, setReportsCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [patientInfo, setPatientInfo] = useState(null);

  useEffect(() => {
    fetchPatientData();
    socket.on('health-data', (data) => {
      setLatestVitals(data);
      setChartData(prev => {
        const time = new Date(data.timestamp).toLocaleTimeString();
        return {
          labels: [...prev.labels, time].slice(-MAX_POINTS),
          hr: [...prev.hr, data.heartRate].slice(-MAX_POINTS),
          spo2: [...prev.spo2, data.spO2].slice(-MAX_POINTS),
          temp: [...prev.temp, data.temperature].slice(-MAX_POINTS),
        };
      });
    });
    return () => { socket.off('health-data'); };
  }, []);

  const fetchPatientData = async () => {
    try {
      const [patientsRes, alertsRes] = await Promise.all([
        api.get('/patients'),
        api.get('/alerts/stats/summary')
      ]);
      if (patientsRes.data.patients.length > 0) {
        const p = patientsRes.data.patients[0];
        setPatientInfo(p);
        const reportsRes = await api.get(`/reports/${p.patientId}`);
        setReportsCount(reportsRes.data.reports.length);
      }
      setAlertsCount(alertsRes.data.stats.unacknowledged);
    } catch (e) { console.error(e); }
  };

  const vitalStatus = (val, type) => {
    if (!val) return 'normal';
    if (type === 'hr') return (val < 50 || val > 120) ? 'critical' : (val < 60 || val > 100) ? 'warning' : 'normal';
    if (type === 'spo2') return val < 90 ? 'critical' : val < 95 ? 'warning' : 'normal';
    if (type === 'temp') return (val < 35 || val > 39.5) ? 'critical' : (val < 36.1 || val > 37.5) ? 'warning' : 'normal';
    return 'normal';
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } }
    },
    elements: { point: { radius: 2 }, line: { tension: 0.4, borderWidth: 2 } }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Welcome, {user?.name} 👋</h1>
          <p>Your personal health monitoring dashboard</p>
        </div>
        <div className="live-indicator"><span className="live-dot"></span> LIVE MONITORING</div>
      </div>

      {/* Quick Info Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><FiActivity /></div>
          <div className="stat-value">{patientInfo?.status || 'N/A'}</div>
          <div className="stat-label">Health Status</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FiFileText /></div>
          <div className="stat-value">{reportsCount}</div>
          <div className="stat-label">Medical Reports</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FiBell /></div>
          <div className="stat-value">{alertsCount}</div>
          <div className="stat-label">Active Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FiHeart /></div>
          <div className="stat-value">{patientInfo?.patientId || '—'}</div>
          <div className="stat-label">Patient ID</div>
        </div>
      </div>

      {/* Patient Info Card */}
      {patientInfo && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>📋 My Information</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div><span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase' }}>Name</span><br/><strong>{patientInfo.name}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase' }}>Age</span><br/><strong>{patientInfo.age} years</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase' }}>Gender</span><br/><strong>{patientInfo.gender}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase' }}>Blood Group</span><br/><strong>{patientInfo.bloodGroup}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase' }}>Assigned Doctor</span><br/><strong>{patientInfo.assignedDoctor?.name || '—'}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase' }}>Device</span><br/><strong style={{ fontFamily: 'monospace', color: '#06d6a0' }}>{patientInfo.deviceId || '—'}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Live Vitals */}
      {latestVitals && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: 14, fontWeight: 600 }}>LIVE VITALS</h3>
          <div className="vitals-grid">
            <div className={`vital-card ${vitalStatus(latestVitals.heartRate, 'hr')}`}>
              <div className="vital-icon">❤️</div>
              <div className="vital-value">{latestVitals.heartRate}</div>
              <div className="vital-unit">bpm</div>
              <div className="vital-label">Heart Rate</div>
            </div>
            <div className={`vital-card ${vitalStatus(latestVitals.spO2, 'spo2')}`}>
              <div className="vital-icon">🫁</div>
              <div className="vital-value">{latestVitals.spO2}</div>
              <div className="vital-unit">%</div>
              <div className="vital-label">SpO2</div>
            </div>
            <div className={`vital-card ${vitalStatus(latestVitals.temperature, 'temp')}`}>
              <div className="vital-icon">🌡️</div>
              <div className="vital-value">{latestVitals.temperature}</div>
              <div className="vital-unit">°C</div>
              <div className="vital-label">Temperature</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><h3><FiHeart style={{ marginRight: 8, color: '#ef4444' }} />Heart Rate</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.hr, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>
        <div className="card">
          <div className="card-header"><h3><FiWind style={{ marginRight: 8, color: '#4cc9f0' }} />SpO2</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.spo2, borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>
      </div>

      {!latestVitals && (
        <div className="card"><div className="empty-state">
          <div className="empty-icon">📡</div>
          <h3>Waiting for Sensor Data</h3>
          <p>Your IoT device will start streaming vitals here once connected</p>
        </div></div>
      )}
    </>
  );
}

export default PatientDashboard;
