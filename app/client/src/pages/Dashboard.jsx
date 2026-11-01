import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  FiUsers, FiActivity, FiAlertTriangle, FiCpu, FiHeart, FiThermometer,
  FiWind, FiShield, FiTrendingUp, FiRefreshCw, FiInfo, FiChevronRight,
  FiArrowLeft, FiCheckCircle
} from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const MAX_POINTS = 30;

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0 });
  const [alertStats, setAlertStats] = useState({ unacknowledged: 0, critical: 0 });
  const [latestVitals, setLatestVitals] = useState(null);
  const [chartData, setChartData] = useState({
    labels: [],
    hr: [],
    spo2: [],
    temp: [],
    rr: [],
    map: [],
    sysbp: [],
    etco2: []
  });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('all');
  const [mlRisk, setMlRisk] = useState(null);
  const [overviewRisks, setOverviewRisks] = useState([]);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const myPatientIdsRef = useRef(null);
  const selectedPatientRef = useRef('all');

  useEffect(() => {
    fetchStats();
    fetchMyPatientIds();
    fetchRecentAlerts();
    fetchPatients();
    fetchOverviewRisks();
    const interval = setInterval(() => {
      fetchStats();
      fetchOverviewRisks();
    }, 15000);
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

  const fetchOverviewRisks = async () => {
    setLoadingOverview(true);
    try {
      const { data } = await api.get('/health-data/overview/deterioration-risks');
      setOverviewRisks(data.risks || []);
    } catch (e) {
      console.error('Failed to fetch ML deterioration overview:', e);
    } finally {
      setLoadingOverview(false);
    }
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
          rr: [...prev.rr, data.respRate ?? 16].slice(-MAX_POINTS),
          map: [...prev.map, data.map ?? 85].slice(-MAX_POINTS),
          sysbp: [...prev.sysbp, data.sysBP ?? 120].slice(-MAX_POINTS),
          etco2: [...prev.etco2, data.etco2 ?? 38].slice(-MAX_POINTS),
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

  const fetchDeteriorationRisk = async (pid) => {
    if (!pid || pid === 'all') {
      setMlRisk(null);
      return;
    }
    setLoadingRisk(true);
    try {
      const { data } = await api.get(`/health-data/${pid}/deterioration-risk`);
      setMlRisk(data);
    } catch (e) {
      console.error('Failed to fetch ML deterioration risk:', e);
      setMlRisk(null);
    } finally {
      setLoadingRisk(false);
    }
  };

  const handlePatientSelect = (pid) => {
    setSelectedPatient(pid);
    selectedPatientRef.current = pid;
    setLatestVitals(null);
    setChartData({ labels: [], hr: [], spo2: [], temp: [], rr: [], map: [], sysbp: [], etco2: [] });
    if (pid !== 'all') {
      fetchDeteriorationRisk(pid);
    } else {
      setMlRisk(null);
      fetchOverviewRisks();
    }
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
    animation: { duration: 300 },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 6 } },
      y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } }
    },
    elements: { point: { radius: 2, hoverRadius: 5 }, line: { tension: 0.35, borderWidth: 2 } }
  };

  const vitalStatus = (val, type) => {
    if (val === undefined || val === null || val === '—') return 'normal';
    const num = Number(val);
    if (isNaN(num)) return 'normal';
    if (type === 'hr') return (num < 50 || num > 120) ? 'critical' : (num < 60 || num > 100) ? 'warning' : 'normal';
    if (type === 'spo2') return num < 90 ? 'critical' : num < 95 ? 'warning' : 'normal';
    if (type === 'temp') return (num < 35 || num > 39.5) ? 'critical' : (num < 36.1 || num > 37.5) ? 'warning' : 'normal';
    if (type === 'rr') return (num < 10 || num > 28) ? 'critical' : (num < 12 || num > 22) ? 'warning' : 'normal';
    if (type === 'map') return (num < 60 || num > 115) ? 'critical' : (num < 70 || num > 105) ? 'warning' : 'normal';
    if (type === 'sysbp') return (num < 85 || num > 160) ? 'critical' : (num < 90 || num > 140) ? 'warning' : 'normal';
    if (type === 'etco2') return (num < 28 || num > 50) ? 'critical' : (num < 35 || num > 45) ? 'warning' : 'normal';
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

      {/* Patient Selector for doctors/admins */}
      {user?.role !== 'patient' && patients.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6, display: 'block', fontWeight: 600 }}>
            Monitor Patient (Live Vitals & ML Risk)
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${selectedPatient === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: 'auto' }} onClick={() => handlePatientSelect('all')}>
              All Patients (Overview)
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

      {/* ── HealthGuard ML: All-Patients Deterioration Triage (Shown on "All Patients") ── */}
      {selectedPatient === 'all' && (
        <div className="card" style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.75) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.4), 0 0 20px -2px rgba(99, 102, 241, 0.15)',
          borderRadius: 16
        }}>
          <div className="card-header" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)', padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex'
              }}>
                <FiShield size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  HealthGuard ML — 6-Hour Deterioration Risk Triage
                  <span style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    fontWeight: 700
                  }}>LightGBM · 47 Features</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Real-time algorithmic early warning across all monitored ICU vital signs (HR, SpO2, Temp, RR, MAP, SysBP, EtCO2)
                </p>
              </div>
            </div>

            <button
              className="btn btn-sm btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'auto', fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={fetchOverviewRisks}
              disabled={loadingOverview}
            >
              <FiRefreshCw className={loadingOverview ? 'spin' : ''} />
              {loadingOverview ? 'Refreshing...' : 'Refresh AI Scores'}
            </button>
          </div>

          <div className="card-body" style={{ padding: '16px 20px' }}>
            {loadingOverview && overviewRisks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                <FiRefreshCw className="spin" size={20} style={{ marginBottom: 8, color: '#818cf8' }} />
                <p style={{ fontSize: '0.85rem' }}>Computing 6-hour LightGBM deterioration risks...</p>
              </div>
            ) : overviewRisks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                No active patient telemetry found. Run the IoT simulator to stream data.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {overviewRisks.map(r => (
                  <div key={r.patientId} style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 12,
                    border: `1px solid ${r.is_prediction_available ? (r.risk_color + '40') : 'rgba(148, 163, 184, 0.12)'}`,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, border-color 0.2s',
                  }}
                  onClick={() => handlePatientSelect(r.patientId)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <strong style={{ color: '#f8fafc', fontSize: '0.95rem', display: 'block' }}>{r.patientName}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#06d6a0', fontFamily: 'monospace' }}>{r.patientId}</span>
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 12,
                          color: r.risk_color || '#94a3b8',
                          background: `${r.risk_color || '#94a3b8'}18`,
                          border: `1px solid ${r.risk_color || '#94a3b8'}40`
                        }}>
                          {r.risk_level || 'AWAITING'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: r.risk_color || '#94a3b8' }}>
                          {r.percentage || 'N/A'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>6h deterioration probability</span>
                      </div>

                      {/* Driver */}
                      <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                        {r.key_drivers?.[0] || 'Vitals stable'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(148, 163, 184, 0.08)' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        {r.is_stale ? `Telemetry: ${r.age_minutes}m ago` : 'Real-time telemetry'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        Inspect <FiChevronRight />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HealthGuard ML: Single Patient Deep-Dive Risk Card ── */}
      {selectedPatient !== 'all' && (
        <div className="card" style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.7) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.4), 0 0 20px -2px rgba(99, 102, 241, 0.15)',
          borderRadius: 16
        }}>
          <div className="card-header" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)', padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn-icon"
                title="Back to All Patients Overview"
                onClick={() => handlePatientSelect('all')}
                style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: 'none' }}
              >
                <FiArrowLeft size={16} />
              </button>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  HealthGuard ML — 6-Hour Deterioration Prediction ({selectedPatient})
                  <span style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    fontWeight: 700
                  }}>LightGBM · 47 Features</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Forward lookahead early warning algorithm monitoring 47 dynamic physiological features & ICU vital dynamics
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'auto', fontSize: '0.75rem', padding: '6px 12px' }}
                onClick={() => fetchDeteriorationRisk(selectedPatient)}
                disabled={loadingRisk}
              >
                <FiRefreshCw className={loadingRisk ? 'spin' : ''} />
                {loadingRisk ? 'Scoring...' : 'Recalculate AI Risk'}
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: '20px' }}>
            {loadingRisk ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                <FiRefreshCw className="spin" size={24} style={{ marginBottom: 10, color: '#818cf8' }} />
                <p style={{ fontSize: '0.85rem' }}>Extracting dynamic vital trends and running LightGBM inference...</p>
              </div>
            ) : mlRisk && mlRisk.is_prediction_available ? (
              <div>
                {/* Staleness notice banner if telemetry is from an earlier recording */}
                {mlRisk.is_stale && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: '#fbbf24',
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <FiInfo size={14} />
                    <span>{mlRisk.stale_warning || `Telemetry recorded ${mlRisk.age_minutes}m ago. Displaying latest predictive analysis.`}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'center', marginBottom: 16 }}>
                  {/* Risk Score Gauge Display */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    border: '1px solid rgba(148, 163, 184, 0.08)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>6-HOUR DETERIORATION PROBABILITY</span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: 20,
                        color: mlRisk.risk_color,
                        background: `${mlRisk.risk_color}18`,
                        border: `1px solid ${mlRisk.risk_color}40`
                      }}>
                        {mlRisk.risk_level} RISK
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: '2.4rem', fontWeight: 900, color: mlRisk.risk_color, letterSpacing: '-0.5px' }}>
                        {mlRisk.percentage}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        threshold: {Math.round(mlRisk.threshold_used * 100)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: mlRisk.percentage,
                        height: '100%',
                        background: `linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)`,
                        borderRadius: 4,
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                  </div>

                  {/* Physiological Drivers */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    border: '1px solid rgba(148, 163, 184, 0.08)'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 10 }}>
                      TOP PHYSIOLOGICAL DRIVERS
                    </span>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                      {mlRisk.key_drivers?.map((driver, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>{driver}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Clinical Advisory Banner */}
                <div style={{
                  background: `${mlRisk.risk_color}12`,
                  border: `1px solid ${mlRisk.risk_color}30`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 10
                }}>
                  <FiTrendingUp style={{ color: mlRisk.risk_color, fontSize: '1.2rem', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: mlRisk.risk_color, display: 'block' }}>
                      Clinical Decision-Support Advisory
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {mlRisk.clinical_advisory || mlRisk.clinical_recommendation}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiInfo size={12} /> {mlRisk.clinical_disclaimer}
                </p>
              </div>
            ) : (
              <div style={{
                background: 'rgba(100, 116, 139, 0.08)',
                border: '1px dashed rgba(148, 163, 184, 0.2)',
                borderRadius: 12,
                padding: '16px 20px',
                color: '#94a3b8',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <FiAlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', display: 'block' }}>
                    Prediction Unavailable ({mlRisk?.reason || 'INSUFFICIENT_TELEMETRY'})
                  </span>
                  <span>{mlRisk?.clinical_recommendation || 'Insufficient continuous telemetry stream to calculate 6-hour trend risk. Please start IoT device stream.'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Live Vitals (All 7 Clinical ICU Vitals + Status) ── */}
      {latestVitals && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: 14, fontWeight: 600 }}>
            LIVE VITALS — {latestVitals.patientName || latestVitals.patientId}
          </h3>
          <div className="vitals-grid">
            {/* 1. Heart Rate */}
            <div className={`vital-card ${vitalStatus(latestVitals.heartRate, 'hr')}`}>
              <div className="vital-icon">❤️</div>
              <div className="vital-value">{latestVitals.heartRate}</div>
              <div className="vital-unit">bpm</div>
              <div className="vital-label">Heart Rate</div>
            </div>

            {/* 2. SpO2 */}
            <div className={`vital-card ${vitalStatus(latestVitals.spO2, 'spo2')}`}>
              <div className="vital-icon">🫁</div>
              <div className="vital-value">{latestVitals.spO2}</div>
              <div className="vital-unit">%</div>
              <div className="vital-label">SpO2</div>
            </div>

            {/* 3. Temperature */}
            <div className={`vital-card ${vitalStatus(latestVitals.temperature, 'temp')}`}>
              <div className="vital-icon">🌡️</div>
              <div className="vital-value">{latestVitals.temperature}</div>
              <div className="vital-unit">°C</div>
              <div className="vital-label">Temperature</div>
            </div>

            {/* 4. Respiratory Rate */}
            <div className={`vital-card ${vitalStatus(latestVitals.respRate, 'rr')}`}>
              <div className="vital-icon">💨</div>
              <div className="vital-value">{latestVitals.respRate !== undefined && latestVitals.respRate !== null ? latestVitals.respRate : '—'}</div>
              <div className="vital-unit">brpm</div>
              <div className="vital-label">Resp Rate</div>
            </div>

            {/* 5. Systolic BP */}
            <div className={`vital-card ${vitalStatus(latestVitals.sysBP, 'sysbp')}`}>
              <div className="vital-icon">🩺</div>
              <div className="vital-value">{latestVitals.sysBP !== undefined && latestVitals.sysBP !== null ? latestVitals.sysBP : '—'}</div>
              <div className="vital-unit">mmHg</div>
              <div className="vital-label">Systolic BP</div>
            </div>

            {/* 6. Mean Arterial Pressure */}
            <div className={`vital-card ${vitalStatus(latestVitals.map, 'map')}`}>
              <div className="vital-icon">💓</div>
              <div className="vital-value">{latestVitals.map !== undefined && latestVitals.map !== null ? latestVitals.map : '—'}</div>
              <div className="vital-unit">mmHg</div>
              <div className="vital-label">MAP</div>
            </div>

            {/* 7. End-Tidal CO2 */}
            <div className={`vital-card ${vitalStatus(latestVitals.etco2, 'etco2')}`}>
              <div className="vital-icon">🧪</div>
              <div className="vital-value">{latestVitals.etco2 !== undefined && latestVitals.etco2 !== null ? latestVitals.etco2 : '—'}</div>
              <div className="vital-unit">mmHg</div>
              <div className="vital-label">EtCO2</div>
            </div>

            {/* 8. Overall Status */}
            <div className={`vital-card ${latestVitals.status === 'critical' ? 'critical' : latestVitals.status === 'warning' ? 'warning' : 'normal'}`}>
              <div className="vital-icon">📊</div>
              <div className="vital-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase' }}>{latestVitals.status}</div>
              <div className="vital-unit">Status</div>
              <div className="vital-label">Overall Status</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts Grid (Expanded to All 7 ICU Vitals) ── */}
      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Heart Rate */}
        <div className="card">
          <div className="card-header"><h3><FiHeart style={{ marginRight: 8, color: '#ef4444' }} />Heart Rate (bpm)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.hr, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>

        {/* SpO2 */}
        <div className="card">
          <div className="card-header"><h3><FiWind style={{ marginRight: 8, color: '#4cc9f0' }} />SpO2 (%)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.spo2, borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>

        {/* Temperature */}
        <div className="card">
          <div className="card-header"><h3><FiThermometer style={{ marginRight: 8, color: '#fbbf24' }} />Temperature (°C)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.temp, borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>

        {/* Respiratory Rate */}
        <div className="card">
          <div className="card-header"><h3><FiActivity style={{ marginRight: 8, color: '#06d6a0' }} />Respiratory Rate (brpm)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.rr, borderColor: '#06d6a0', backgroundColor: 'rgba(6,214,160,0.08)', fill: true }] }} options={chartOpts} />
          </div></div>
        </div>

        {/* Blood Pressure & MAP */}
        <div className="card">
          <div className="card-header"><h3><FiTrendingUp style={{ marginRight: 8, color: '#a855f7' }} />Blood Pressure: SysBP & MAP (mmHg)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{
              labels: chartData.labels,
              datasets: [
                { label: 'SysBP', data: chartData.sysbp, borderColor: '#a855f7', backgroundColor: 'transparent' },
                { label: 'MAP', data: chartData.map, borderColor: '#3b82f6', backgroundColor: 'transparent', borderDash: [4, 4] }
              ]
            }} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: true, labels: { color: '#94a3b8' } } } }} />
          </div></div>
        </div>

        {/* EtCO2 */}
        <div className="card">
          <div className="card-header"><h3><FiCpu style={{ marginRight: 8, color: '#ec4899' }} />End-Tidal CO2 (mmHg)</h3></div>
          <div className="card-body"><div className="chart-container">
            <Line data={{ labels: chartData.labels, datasets: [{ data: chartData.etco2, borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.08)', fill: true }] }} options={chartOpts} />
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
        <div className="card" style={{ marginTop: 20 }}>
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>Waiting for IoT Telemetry</h3>
            <p>Start the IoT simulator to see live 7-vital streaming and real-time inference.<br />
            Run: <code style={{ color: '#06d6a0' }}>python simulator/iot_simulator.py ALL --interval 3.0</code></p>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
