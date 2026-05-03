import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiUsers, FiActivity, FiAlertTriangle, FiCpu, FiHeart, FiThermometer, FiWind } from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const MAX_POINTS = 30;

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0 });
  const [alertStats, setAlertStats] = useState({ unacknowledged: 0, critical: 0 });
  const [latestVitals, setLatestVitals] = useState(null);
  const [chartData, setChartData] = useState({ labels: [], hr: [], spo2: [], temp: [] });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('all');
  const myPatientIdsRef = useRef(null);
  const selectedPatientRef = useRef('all');

  useEffect(() => {
    fetchStats();
    fetchMyPatientIds();
    fetchRecentAlerts();
    fetchPatients();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
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

  const fetchRecentAlerts = async () => {
    try {
      const { data } = await api.get('/alerts?limit=5&acknowledged=false');
      setRecentAlerts(data.alerts);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    socket.on('health-data', (data) => {
      const allowed = myPatientIdsRef.current;
      if (allowed !== null && !allowed.includes(data.patientId)) return;
      const sel = selectedPatientRef.current;
      if (sel !== 'all' && data.patientId !== sel) return;

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

    socket.on('new-alert', (alert) => {
      const allowed = myPatientIdsRef.current;
      if (allowed !== null && !allowed.includes(alert.patientId)) return;
      setAlertStats(prev => ({ ...prev, unacknowledged: prev.unacknowledged + 1 }));
      setRecentAlerts(prev => [alert, ...prev].slice(0, 5));
    });

    return () => { socket.off('health-data'); socket.off('new-alert'); };
  }, []);

  const handlePatientSelect = (pid) => {
    setSelectedPatient(pid);
    selectedPatientRef.current = pid;
    setLatestVitals(null);
    setChartData({ labels: [], hr: [], spo2: [], temp: [] });
  };

  const fetchStats = async () => {
    try {
      const [patRes, alertRes] = await Promise.all([
        api.get('/patients/stats/summary'),
        api.get('/alerts/stats/summary')
      ]);
      setStats(patRes.data.stats);
      setAlertStats(alertRes.data.stats);
    } catch (e) { console.error(e); }
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } }
    },
    elements: { point: { radius: 2, hoverRadius: 5 }, line: { tension: 0.4, borderWidth: 2 } }
  };

  const vitalStatus = (val, type) => {
    if (!val) return 'normal';
    if (type === 'hr') return (val < 50 || val > 120) ? 'critical' : (val < 60 || val > 100) ? 'warning' : 'normal';
    if (type === 'spo2') return val < 90 ? 'critical' : val < 95 ? 'warning' : 'normal';
    if (type === 'temp') return (val < 35 || val > 39.5) ? 'critical' : (val < 36.1 || val > 37.5) ? 'warning' : 'normal';
    return 'normal';
  };

  const isDoctor = user?.role === 'doctor';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.name} — here's your {isDoctor ? 'patient' : 'system'} overview</p>
        </div>
        <div className="live-indicator"><span className="live-dot"></span> LIVE</div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><FiUsers /></div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">{isDoctor ? 'My Patients' : 'Total Patients'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FiActivity /></div>
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active Monitoring</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiAlertTriangle /></div>
          <div className="stat-value">{alertStats.critical || 0}</div>
          <div className="stat-label">Critical Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FiCpu /></div>
          <div className="stat-value">{alertStats.unacknowledged || 0}</div>
          <div className="stat-label">Pending Alerts</div>
        </div>
      </div>

      {/* Patient Selector for doctors */}
      {!user?.role !== 'patient' && patients.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6, display: 'block', fontWeight: 600 }}>
            Monitor Patient (Live Vitals)
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${selectedPatient === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: 'auto' }} onClick={() => handlePatientSelect('all')}>
              All Patients
            </button>
            {patients.map(p => (
              <button key={p.patientId}
                className={`btn btn-sm ${selectedPatient === p.patientId ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: 'auto' }} onClick={() => handlePatientSelect(p.patientId)}>
                {p.name} ({p.patientId})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live Vitals */}
      {latestVitals && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: 14, fontWeight: 600 }}>
            LIVE VITALS — {latestVitals.patientName || latestVitals.patientId}
          </h3>
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
            <div className={`vital-card ${latestVitals.status === 'critical' ? 'critical' : latestVitals.status === 'warning' ? 'warning' : 'normal'}`}>
              <div className="vital-icon">📊</div>
              <div className="vital-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase' }}>{latestVitals.status}</div>
              <div className="vital-label">Overall Status</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><h3><FiHeart style={{ marginRight: 8, color: '#ef4444' }} />Heart Rate (bpm)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.hr, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>
        <div className="card">
          <div className="card-header"><h3><FiWind style={{ marginRight: 8, color: '#4cc9f0' }} />SpO2 (%)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.spo2, borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>
        <div className="card">
          <div className="card-header"><h3><FiThermometer style={{ marginRight: 8, color: '#fbbf24' }} />Temperature (°C)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.temp, borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>
      </div>

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3><FiAlertTriangle style={{ marginRight: 8, color: '#f97316' }} />Recent Alerts</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentAlerts.map(a => (
              <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                <span style={{ fontSize: '1rem' }}>{a.type === 'critical' ? '🔴' : '🟡'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{a.message}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{a.patientName || a.patientId} · {new Date(a.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!latestVitals && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>Waiting for IoT Data</h3>
            <p>Start the IoT simulator to see real-time health data streaming here.<br />
            Run: <code style={{ color: '#06d6a0' }}>python simulator/iot_simulator.py PT-00001</code></p>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
