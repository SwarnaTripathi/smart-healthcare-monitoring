import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiSearch, FiCalendar } from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function History() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/patients').then(r => {
      setPatients(r.data.patients);
      if (r.data.patients.length > 0) setSelectedPatient(r.data.patients[0].patientId);
    });
  }, []);

  useEffect(() => {
    if (selectedPatient) fetchHistory();
  }, [selectedPatient]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/health-data/${selectedPatient}?limit=200`);
      setHealthData(data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }, tooltip: { backgroundColor: '#1e293b', borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 9, family: 'Inter' }, maxTicksLimit: 12 } },
      y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } } }
    },
    elements: { point: { radius: 1.5 }, line: { tension: 0.3, borderWidth: 2 } }
  };

  const labels = healthData.map(d => new Date(d.timestamp).toLocaleTimeString());

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Health History</h1>
          <p>View historical health data for patients</p>
        </div>
      </div>

      {/* Patient selector */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 250 }}>
          <select className="form-control" value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}>
            <option value="">Select Patient</option>
            {patients.map(p => <option key={p._id} value={p.patientId}>{p.patientId} — {p.name}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchHistory} disabled={!selectedPatient}>
          <FiCalendar /> Refresh
        </button>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{healthData.length} records loaded</span>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : healthData.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Health Data</h3>
          <p>Select a patient and run the IoT simulator to generate data</p>
        </div></div>
      ) : (
        <>
          {/* Combined Chart */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h3>📈 All Vitals Over Time</h3></div>
            <div className="card-body">
              <div style={{ height: 320 }}>
                <Line data={{
                  labels,
                  datasets: [
                    { label: 'Heart Rate (bpm)', data: healthData.map(d => d.heartRate), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)', fill: true },
                    { label: 'SpO2 (%)', data: healthData.map(d => d.spO2), borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.05)', fill: true },
                    { label: 'Temperature (°C)', data: healthData.map(d => d.temperature), borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.05)', fill: true }
                  ]
                }} options={chartOpts} />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="card">
            <div className="card-header"><h3>📊 Raw Data (Latest {Math.min(healthData.length, 50)})</h3></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Time</th><th>Heart Rate</th><th>SpO2</th><th>Temperature</th><th>Status</th></tr></thead>
                <tbody>
                  {healthData.slice(-50).reverse().map((d, i) => (
                    <tr key={i}>
                      <td>{new Date(d.timestamp).toLocaleString()}</td>
                      <td style={{ color: d.heartRate > 120 || d.heartRate < 50 ? '#ef4444' : '#e2e8f0' }}>{d.heartRate} bpm</td>
                      <td style={{ color: d.spO2 < 94 ? '#ef4444' : '#e2e8f0' }}>{d.spO2}%</td>
                      <td style={{ color: d.temperature > 38 || d.temperature < 36 ? '#fbbf24' : '#e2e8f0' }}>{d.temperature}°C</td>
                      <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default History;
