import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  FiPlus, FiX, FiSearch, FiUserPlus, FiUser, FiMail, FiPhone, FiClock,
  FiShield, FiTrendingUp, FiActivity, FiInfo, FiRefreshCw
} from 'react-icons/fi';

function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [overviewRisks, setOverviewRisks] = useState({});
  const [selectedRiskPatient, setSelectedRiskPatient] = useState(null);
  const [loadingRiskDetail, setLoadingRiskDetail] = useState(false);

  // Unlinked users (newly registered patients)
  const [unlinkedUsers, setUnlinkedUsers] = useState([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form for additional patient details
  const [form, setForm] = useState({
    age: '', gender: 'Male', bloodGroup: 'O+', phone: '', address: '', medicalHistory: '', deviceId: ''
  });

  useEffect(() => {
    fetchPatients();
    fetchDeteriorationOverview();
  }, []);

  const fetchPatients = async () => {
    try {
      const { data } = await api.get('/patients');
      setPatients(data.patients || []);
    } catch (e) {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeteriorationOverview = async () => {
    try {
      const { data } = await api.get('/health-data/overview/deterioration-risks');
      const map = {};
      (data.risks || []).forEach(r => {
        map[r.patientId] = r;
      });
      setOverviewRisks(map);
    } catch (e) {
      console.error('Failed to load deterioration overview:', e);
    }
  };

  const openRiskModal = async (p) => {
    setSelectedRiskPatient({ ...p, loading: true });
    setLoadingRiskDetail(true);
    try {
      const { data } = await api.get(`/health-data/${p.patientId}/deterioration-risk`);
      setSelectedRiskPatient({ ...p, riskData: data, loading: false });
    } catch (e) {
      console.error('Failed to fetch patient risk detail:', e);
      setSelectedRiskPatient({ ...p, riskData: overviewRisks[p.patientId], loading: false });
    } finally {
      setLoadingRiskDetail(false);
    }
  };

  // Fetch unlinked patient users when modal opens
  const openAddModal = async () => {
    setShowModal(true);
    setSelectedUser(null);
    setForm({ age: '', gender: 'Male', bloodGroup: 'O+', phone: '', address: '', medicalHistory: '', deviceId: '' });
    setLoadingUnlinked(true);
    try {
      const { data } = await api.get('/patients/unlinked-users');
      setUnlinkedUsers(data.users || []);
    } catch (e) {
      setUnlinkedUsers([]);
      toast.error('Failed to load registered patients');
    } finally {
      setLoadingUnlinked(false);
    }
  };

  // Select a user from the unlinked list
  const selectUser = (u) => {
    setSelectedUser(u);
    setForm(prev => ({
      ...prev,
      phone: u.phone || prev.phone,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return toast.error('Please select a registered patient first');
    try {
      const payload = {
        name: selectedUser.name,
        age: parseInt(form.age),
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        phone: form.phone,
        address: form.address,
        medicalHistory: form.medicalHistory,
        deviceId: form.deviceId,
        linkedUserId: selectedUser._id,
      };
      await api.post('/patients', payload);
      toast.success(`${selectedUser.name} added to your patient list!`);
      setShowModal(false);
      setSelectedUser(null);
      fetchPatients();
      fetchDeteriorationOverview();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add patient');
    }
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.patientId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Patients</h1>
          <p>Manage and monitor registered patients with real-time 6h ML deterioration warning</p>
        </div>
        {(user?.role === 'doctor' || user?.role === 'admin') && (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddModal}>
            <FiPlus /> Add Patient
          </button>
        )}
      </div>

      {/* Search & AI Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ position: 'relative', maxWidth: 360, width: '100%' }}>
          <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input className="form-control" style={{ paddingLeft: 40 }} placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'auto' }}
          onClick={fetchDeteriorationOverview}
        >
          <FiRefreshCw size={14} /> Refresh 6h AI Risks
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No Patients Found</h3>
              <p>Click "Add Patient" to add a newly registered patient to your list</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Age / Gender</th>
                  <th>Blood</th>
                  <th>Status</th>
                  <th>6h AI Deterioration Risk</th>
                  <th>Device ID</th>
                  <th>Doctor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const risk = overviewRisks[p.patientId];
                  return (
                    <tr key={p._id}>
                      <td style={{ fontFamily: 'monospace', color: '#06d6a0', fontWeight: 600 }}>{p.patientId}</td>
                      <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{p.name}</td>
                      <td>{p.age} / {p.gender}</td>
                      <td>{p.bloodGroup}</td>
                      <td>
                        <span className={`badge badge-${p.status === 'critical' ? 'critical' : p.status === 'active' ? 'active' : 'normal'}`}>
                          {p.status}
                        </span>
                      </td>

                      {/* ── HealthGuard 6h ML Deterioration Risk Column ── */}
                      <td>
                        {risk && risk.is_prediction_available ? (
                          <div
                            onClick={() => openRiskModal(p)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 20,
                              background: `${risk.risk_color}18`,
                              border: `1px solid ${risk.risk_color}50`,
                              color: risk.risk_color,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title="Click to view full 6-hour ML deterioration assessment"
                          >
                            <FiShield size={12} />
                            <span>{risk.risk_level}</span>
                            <span style={{ opacity: 0.85 }}>({risk.percentage})</span>
                          </div>
                        ) : (
                          <span style={{
                            fontSize: '0.72rem',
                            color: '#64748b',
                            background: 'rgba(148, 163, 184, 0.08)',
                            padding: '3px 8px',
                            borderRadius: 12,
                            border: '1px solid rgba(148, 163, 184, 0.15)'
                          }}>
                            Awaiting Telemetry
                          </span>
                        )}
                      </td>

                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.deviceId || '—'}</td>
                      <td>{p.assignedDoctor?.name || '—'}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.72rem', width: 'auto' }}
                          onClick={() => openRiskModal(p)}
                        >
                          View AI Risk
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── AI Deterioration Risk Assessment Modal ── */}
      {selectedRiskPatient && (
        <div className="modal-overlay" onClick={() => setSelectedRiskPatient(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
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
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                    AI Clinical Deterioration Assessment
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {selectedRiskPatient.name} ({selectedRiskPatient.patientId}) · LightGBM 6-Hour Forward Lookahead
                  </span>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelectedRiskPatient(null)}><FiX /></button>
            </div>

            <div className="modal-body">
              {loadingRiskDetail ? (
                <div className="loading-container" style={{ padding: 40 }}><div className="spinner"></div></div>
              ) : selectedRiskPatient.riskData && selectedRiskPatient.riskData.is_prediction_available ? (
                <div>
                  {/* Gauge */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    marginBottom: 16
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>6-HOUR DETERIORATION PROBABILITY</span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 20,
                        color: selectedRiskPatient.riskData.risk_color,
                        background: `${selectedRiskPatient.riskData.risk_color}18`,
                        border: `1px solid ${selectedRiskPatient.riskData.risk_color}40`
                      }}>
                        {selectedRiskPatient.riskData.risk_level} RISK
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 900, color: selectedRiskPatient.riskData.risk_color }}>
                        {selectedRiskPatient.riskData.percentage}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        threshold: {Math.round((selectedRiskPatient.riskData.threshold_used || 0.27) * 100)}%
                      </span>
                    </div>

                    <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: selectedRiskPatient.riskData.percentage,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)',
                        borderRadius: 4
                      }} />
                    </div>
                  </div>

                  {/* Top Physiological Drivers */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                    marginBottom: 16
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                      TOP PHYSIOLOGICAL DRIVERS (47-FEATURE DYNAMICS)
                    </span>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                      {selectedRiskPatient.riskData.key_drivers?.map((driver, idx) => (
                        <li key={idx}>{driver}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Clinical Advisory */}
                  <div style={{
                    background: `${selectedRiskPatient.riskData.risk_color}12`,
                    border: `1px solid ${selectedRiskPatient.riskData.risk_color}30`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 14
                  }}>
                    <FiTrendingUp style={{ color: selectedRiskPatient.riskData.risk_color, fontSize: '1.2rem', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedRiskPatient.riskData.risk_color, display: 'block' }}>
                        Clinical Decision-Support Advisory
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        {selectedRiskPatient.riskData.clinical_advisory || selectedRiskPatient.riskData.clinical_recommendation}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiInfo size={12} /> {selectedRiskPatient.riskData.clinical_disclaimer}
                  </p>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '30px 16px' }}>
                  <div className="empty-icon">📡</div>
                  <h3>Telemetry Required</h3>
                  <p>Continuous sensor telemetry is required to compute the 6-hour dynamic risk trajectory.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRiskPatient(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: selectedUser ? 560 : 620 }}>
            <div className="modal-header">
              <h3>{selectedUser ? `Complete Profile: ${selectedUser.name}` : 'Add Patient'}</h3>
              <button className="btn-icon" onClick={() => { setShowModal(false); setSelectedUser(null); }}><FiX /></button>
            </div>

            {!selectedUser ? (
              /* Step 1: Select from newly registered patients */
              <div className="modal-body">
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 16 }}>
                  Select a newly registered patient to add to {user?.role === 'doctor' ? 'your' : 'a doctor\'s'} patient list:
                </p>

                {loadingUnlinked ? (
                  <div className="loading-container" style={{ padding: 40 }}><div className="spinner"></div></div>
                ) : unlinkedUsers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <div className="empty-icon" style={{ fontSize: '2rem' }}>✅</div>
                    <h3 style={{ fontSize: '1rem' }}>No Pending Patients</h3>
                    <p style={{ fontSize: '0.8rem' }}>All registered patients have been added. New patients will appear here after they register.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {unlinkedUsers.map(u => (
                      <div
                        key={u._id}
                        onClick={() => selectUser(u)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px', borderRadius: 10,
                          background: 'rgba(148,163,184,0.06)',
                          border: '1px solid rgba(148,163,184,0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,214,160,0.08)'; e.currentTarget.style.borderColor = 'rgba(6,214,160,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.06)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
                      >
                        <div style={{
                          width: 42, height: 42, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06d6a0 0%, #118ab2 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0
                        }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>{u.name}</div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.78rem', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiMail size={12} /> {u.email}</span>
                            {u.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiPhone size={12} /> {u.phone}</span>}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                          background: 'rgba(6,214,160,0.12)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.25)'
                        }}>
                          + Assign
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Step 2: Form to fill details */
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 8, background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)',
                    marginBottom: 16
                  }}>
                    <FiUser style={{ color: '#06d6a0' }} />
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                      Registering patient record for <strong>{selectedUser.name}</strong> ({selectedUser.email})
                    </span>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Age *</label>
                      <input className="form-control" type="number" required min="0" max="150" placeholder="e.g. 45" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Gender *</label>
                      <select className="form-control" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Blood Group</label>
                      <select className="form-control" value={form.bloodGroup} onChange={e => setForm({...form, bloodGroup: e.target.value})}>
                        {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Device ID</label>
                      <input className="form-control" placeholder="e.g. SIM-ESP32-001" value={form.deviceId} onChange={e => setForm({...form, deviceId: e.target.value})} />
                    </div>
                    <div className="form-group full-width">
                      <label>Address</label>
                      <input className="form-control" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                    </div>
                    <div className="form-group full-width">
                      <label>Medical History</label>
                      <textarea className="form-control" rows="3" value={form.medicalHistory} onChange={e => setForm({...form, medicalHistory: e.target.value})} style={{ resize: 'vertical' }} placeholder="List conditions, allergies, medications..."></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Back</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
                    <FiUserPlus style={{ marginRight: 4 }} /> Add to My Patients
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Patients;
