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
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0, discharged: 0 });
  const [alertStats, setAlertStats] = useState({ unacknowledged: 0, critical: 0 });
  const [latestVitals, setLatestVitals] = useState(null);
  const [chartData, setChartData] = useState({ labels: [], hr: [], spo2: [], temp: [] });
  const chartRef = useRef(chartData);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.on('health-data', (data) => {
      setLatestVitals(data);
      setChartData(prev => {
        const time = new Date(data.timestamp).toLocaleTimeString();
        const labels = [...prev.labels, time].slice(-MAX_POINTS);
        const hr = [...prev.hr, data.heartRate].slice(-MAX_POINTS);
        const spo2 = [...prev.spo2, data.spO2].slice(-MAX_POINTS);
        const temp = [...prev.temp, data.temperature].slice(-MAX_POINTS);
        return { labels, hr, spo2, temp };
      });
    });

    socket.on('new-alert', () => {
      setAlertStats(prev => ({ ...prev, unacknowledged: prev.unacknowledged + 1 }));
    });

    return () => { socket.off('health-data'); socket.off('new-alert'); };
  }, []);

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
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' }, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } } }
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

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.name} — here's your system overview</p>
        </div>
        <div className="live-indicator">
          <span className="live-dot"></span> LIVE
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><FiUsers /></div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Patients</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FiActivity /></div>
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active Monitoring</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiAlertTriangle /></div>
          <div className="stat-value">{stats.critical}</div>
          <div className="stat-label">Critical Patients</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FiCpu /></div>
          <div className="stat-value">{alertStats.unacknowledged}</div>
          <div className="stat-label">Pending Alerts</div>
        </div>
      </div>

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
          <div className="card-header">
            <h3><FiHeart style={{ marginRight: 8, color: '#ef4444' }} />Heart Rate (bpm)</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.hr, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true }] }} options={chartOpts} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><FiWind style={{ marginRight: 8, color: '#4cc9f0' }} />SpO2 (%)</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.spo2, borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.08)', fill: true }] }} options={chartOpts} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><FiThermometer style={{ marginRight: 8, color: '#fbbf24' }} />Temperature (°C)</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.temp, borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)', fill: true }] }} options={chartOpts} />
            </div>
          </div>
        </div>
      </div>

      {!latestVitals && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>Waiting for IoT Data</h3>
            <p>Start the IoT simulator to see real-time health data streaming here.<br />
            Run: <code style={{ color: '#06d6a0' }}>python simulator/iot_simulator.py</code></p>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
