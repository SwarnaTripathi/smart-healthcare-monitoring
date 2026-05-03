import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiX, FiSearch, FiUserPlus, FiUser, FiMail, FiPhone, FiClock } from 'react-icons/fi';

function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  // Unlinked users (newly registered patients)
  const [unlinkedUsers, setUnlinkedUsers] = useState([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form for additional patient details
  const [form, setForm] = useState({
    age: '', gender: 'Male', bloodGroup: 'O+', phone: '', address: '', medicalHistory: '', deviceId: ''
  });

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try {
      const { data } = await api.get('/patients');
      setPatients(data.patients);
    } catch (e) { toast.error('Failed to load patients'); }
    finally { setLoading(false); }
  };

  // Fetch unlinked patient users when modal opens
  const openAddModal = async () => {
    setShowModal(true);
    setSelectedUser(null);
    setForm({ age: '', gender: 'Male', bloodGroup: 'O+', phone: '', address: '', medicalHistory: '', deviceId: '' });
    setLoadingUnlinked(true);
    try {
      const { data } = await api.get('/patients/unlinked-users');
      setUnlinkedUsers(data.users);
    } catch (e) { setUnlinkedUsers([]); toast.error('Failed to load registered patients'); }
    finally { setLoadingUnlinked(false); }
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
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add patient'); }
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.patientId.toLowerCase().includes(search.toLowerCase())
  );

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Patients</h1>
          <p>Manage and monitor registered patients</p>
        </div>
        {(user?.role === 'doctor' || user?.role === 'admin') && (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddModal}>
            <FiPlus /> Add Patient
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative', maxWidth: 400 }}>
        <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input className="form-control" style={{ paddingLeft: 40 }} placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Blood Group</th>
                  <th>Status</th>
                  <th>Device ID</th>
                  <th>Doctor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p._id}>
                    <td style={{ fontFamily: 'monospace', color: '#06d6a0' }}>{p.patientId}</td>
                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{p.name}</td>
                    <td>{p.age}</td>
                    <td>{p.gender}</td>
                    <td>{p.bloodGroup}</td>
                    <td><span className={`badge badge-${p.status === 'critical' ? 'critical' : p.status === 'active' ? 'active' : 'normal'}`}>{p.status}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.deviceId || '—'}</td>
                    <td>{p.assignedDoctor?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Patient Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: selectedUser ? 560 : 620 }}>
            <div className="modal-header">
              <h3>{selectedUser ? `Complete Profile: ${selectedUser.name}` : 'Add Patient'}</h3>
              <button className="btn-icon" onClick={() => { setShowModal(false); setSelectedUser(null); }}><FiX /></button>
            </div>

            {!selectedUser ? (
              /* ── Step 1: Select from newly registered patients ── */
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
                        {/* Avatar */}
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06d6a0, #4cc9f0)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', flexShrink: 0
                        }}>
                          {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.92rem' }}>{u.name}</div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 3 }}>
                            <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FiMail size={11} /> {u.email}
                            </span>
                            {u.phone && (
                              <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FiPhone size={11} /> {u.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Time */}
                        <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <FiClock size={11} /> {timeAgo(u.createdAt)}
                        </div>
                        {/* Add button */}
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'rgba(6,214,160,0.12)', color: '#06d6a0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <FiUserPlus size={15} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Step 2: Fill additional details for selected patient ── */
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {/* Selected user info banner */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 8, marginBottom: 18,
                    background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)'
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #06d6a0, #4cc9f0)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, color: '#0f172a', fontSize: '0.8rem'
                    }}>
                      {selectedUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#06d6a0', fontSize: '0.88rem' }}>{selectedUser.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{selectedUser.email}</div>
                    </div>
                    <button type="button" className="btn btn-sm btn-secondary" style={{ width: 'auto', fontSize: '0.72rem' }} onClick={() => setSelectedUser(null)}>
                      Change
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Age *</label>
                      <input className="form-control" type="number" min="0" max="150" value={form.age} onChange={e => setForm({...form, age: e.target.value})} required />
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
