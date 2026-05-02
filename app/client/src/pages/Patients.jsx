import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiX, FiSearch } from 'react-icons/fi';

function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '', age: '', gender: 'Male', bloodGroup: 'O+', phone: '', address: '', medicalHistory: '', deviceId: ''
  });

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try {
      const { data } = await api.get('/patients');
      setPatients(data.patients);
    } catch (e) { toast.error('Failed to load patients'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/patients', { ...form, age: parseInt(form.age) });
      toast.success('Patient registered!');
      setShowModal(false);
      setForm({ name: '', age: '', gender: 'Male', bloodGroup: 'O+', phone: '', address: '', medicalHistory: '', deviceId: '' });
      fetchPatients();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add patient'); }
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
          <p>Manage and monitor registered patients</p>
        </div>
        {(user?.role === 'doctor' || user?.role === 'admin') && (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>
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
              <p>Register a new patient to get started</p>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Patient</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className="form-control" name="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Age *</label>
                    <input className="form-control" type="number" name="age" min="0" max="150" value={form.age} onChange={e => setForm({...form, age: e.target.value})} required />
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
                    <textarea className="form-control" rows="3" value={form.medicalHistory} onChange={e => setForm({...form, medicalHistory: e.target.value})} style={{ resize: 'vertical' }}></textarea>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Register Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Patients;
