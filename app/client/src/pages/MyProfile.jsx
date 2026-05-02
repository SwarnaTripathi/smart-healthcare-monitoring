import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiSave, FiUser, FiPhone, FiMapPin, FiHeart } from 'react-icons/fi';

function MyProfile() {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    phone: '', address: '', medicalHistory: '',
    emergencyContact: { name: '', phone: '', relation: '' }
  });

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/patients');
      if (data.patients.length > 0) {
        const p = data.patients[0];
        setPatient(p);
        setForm({
          phone: p.phone || '',
          address: p.address || '',
          medicalHistory: p.medicalHistory || '',
          emergencyContact: p.emergencyContact || { name: '', phone: '', relation: '' }
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      await api.put(`/patients/${patient._id}`, form);
      toast.success('Profile updated!');
      setEditing(false);
      fetchProfile();
    } catch (e) { toast.error('Failed to update'); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  if (!patient) return (
    <div className="card"><div className="empty-state">
      <div className="empty-icon"><FiUser /></div>
      <h3>No Patient Profile Found</h3>
      <p>Your profile hasn't been created by a doctor yet. Please contact your healthcare provider.</p>
    </div></div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p>View and update your personal information</p>
        </div>
        {!editing ? (
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setEditing(true)}>Edit Profile</button>
        ) : (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSave}><FiSave /> Save Changes</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Personal Info */}
        <div className="card">
          <div className="card-header"><h3><FiUser style={{ marginRight: 8 }} />Personal Information</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: 16 }}>
              <div><span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient ID</span><br/><strong style={{ fontFamily: 'monospace', color: '#06d6a0' }}>{patient.patientId}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Full Name</span><br/><strong>{patient.name}</strong></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Age</span><br/><strong>{patient.age}</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Gender</span><br/><strong>{patient.gender}</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Blood</span><br/><strong>{patient.bloodGroup}</strong></div>
              </div>
              <div className="form-group">
                <label><FiPhone style={{ marginRight: 4 }} />Phone</label>
                {editing ? <input className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /> : <div style={{ color: '#e2e8f0' }}>{patient.phone || '—'}</div>}
              </div>
              <div className="form-group">
                <label><FiMapPin style={{ marginRight: 4 }} />Address</label>
                {editing ? <input className="form-control" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /> : <div style={{ color: '#e2e8f0' }}>{patient.address || '—'}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Medical & Emergency */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h3><FiHeart style={{ marginRight: 8, color: '#ef4444' }} />Medical History</h3></div>
            <div className="card-body">
              {editing ? (
                <textarea className="form-control" rows="4" value={form.medicalHistory} onChange={e => setForm({...form, medicalHistory: e.target.value})} style={{ resize: 'vertical' }} placeholder="List your medical conditions, allergies, medications..." />
              ) : (
                <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{patient.medicalHistory || 'No medical history recorded'}</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>🆘 Emergency Contact</h3></div>
            <div className="card-body">
              {editing ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="form-group"><label>Name</label><input className="form-control" value={form.emergencyContact.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact, name: e.target.value}})} /></div>
                  <div className="form-group"><label>Phone</label><input className="form-control" value={form.emergencyContact.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact, phone: e.target.value}})} /></div>
                  <div className="form-group"><label>Relation</label><input className="form-control" value={form.emergencyContact.relation} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact, relation: e.target.value}})} /></div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div><span style={{ color: '#64748b', fontSize: '0.75rem' }}>NAME</span><br/>{patient.emergencyContact?.name || '—'}</div>
                  <div><span style={{ color: '#64748b', fontSize: '0.75rem' }}>PHONE</span><br/>{patient.emergencyContact?.phone || '—'}</div>
                  <div><span style={{ color: '#64748b', fontSize: '0.75rem' }}>RELATION</span><br/>{patient.emergencyContact?.relation || '—'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default MyProfile;
