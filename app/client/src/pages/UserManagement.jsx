import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiSearch, FiTrash2, FiToggleLeft, FiToggleRight, FiUserPlus, FiX } from 'react-icons/fi';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'doctor', specialization: '', phone: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users);
    } catch (e) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const toggleActive = async (userId, currentStatus) => {
    try {
      await api.put(`/admin/users/${userId}`, { isActive: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}`, { role: newRole });
      toast.success('Role updated');
      fetchUsers();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update role'); }
  };

  const deleteUser = async (userId, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted');
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (e) { toast.error('Failed to delete'); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/admin/users', addForm);
      toast.success(`${addForm.role.charAt(0).toUpperCase() + addForm.role.slice(1)} account created!`);
      setShowAddModal(false);
      setAddForm({ name: '', email: '', password: '', role: 'doctor', specialization: '', phone: '' });
      fetchUsers();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create user'); }
    finally { setAdding(false); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Manage all registered users, roles, and access</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{users.length} total users</span>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowAddModal(true)}>
            <FiUserPlus /> Add Doctor / Admin
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20, position: 'relative', maxWidth: 400 }}>
        <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input className="form-control" style={{ paddingLeft: 40 }} placeholder="Search users by name, email, or role..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"></div></div> : (
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto', display: 'inline' }}
                        value={u.role} onChange={e => changeRole(u._id, e.target.value)}>
                        <option value="patient">Patient</option>
                        <option value="doctor">Doctor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => toggleActive(u._id, u.isActive)} title={u.isActive ? 'Deactivate' : 'Activate'}
                        style={{ color: u.isActive ? '#06d6a0' : '#ef4444' }}>
                        {u.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                      <span style={{ fontSize: '0.75rem', marginLeft: 6, color: u.isActive ? '#06d6a0' : '#ef4444' }}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-icon" onClick={() => deleteUser(u._id, u.name)} style={{ color: '#ef4444' }} title="Delete"><FiTrash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Doctor/Admin Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Create New Account</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input className="form-control" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="Dr. John Doe" required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input className="form-control" type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="doctor@healthguard.com" required />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input className="form-control" type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} placeholder="Min 6 characters" required minLength={6} />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select className="form-control" value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                    <option value="patient">Patient</option>
                  </select>
                </div>
                {addForm.role === 'doctor' && (
                  <div className="form-group">
                    <label>Specialization</label>
                    <input className="form-control" value={addForm.specialization} onChange={e => setAddForm({...addForm, specialization: e.target.value})} placeholder="e.g. Cardiology, General Physician" />
                  </div>
                )}
                <div className="form-group">
                  <label>Phone</label>
                  <input className="form-control" value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} placeholder="+91 9876543210" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={adding}>
                  {adding ? 'Creating...' : `Create ${addForm.role.charAt(0).toUpperCase() + addForm.role.slice(1)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default UserManagement;
