import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiSearch, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
    } catch (e) { toast.error('Failed to update'); }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}`, { role: newRole });
      toast.success('Role updated');
      fetchUsers();
    } catch (e) { toast.error('Failed to update role'); }
  };

  const deleteUser = async (userId, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted');
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (e) { toast.error('Failed to delete'); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase())
  );

  const roleBadge = (role) => {
    const classes = { doctor: 'badge-doctor', admin: 'badge-admin', patient: 'badge-patient' };
    return <span className={`badge ${classes[role] || 'badge-active'}`}>{role}</span>;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Manage all registered users, roles, and access</p>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{users.length} total users</span>
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
    </>
  );
}

export default UserManagement;
