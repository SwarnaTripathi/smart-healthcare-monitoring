import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiUpload, FiDownload, FiTrash2, FiFileText, FiFile, FiImage } from 'react-icons/fi';

function MyReports() {
  const [reports, setReports] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'lab_report', description: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const pRes = await api.get('/patients');
      setPatients(pRes.data.patients);
      if (pRes.data.patients.length > 0) {
        const rRes = await api.get(`/reports/${pRes.data.patients[0].patientId}`);
        setReports(rRes.data.reports);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    if (!patients.length) return toast.error('No patient profile found');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('patientId', patients[0].patientId);
      formData.append('title', form.title);
      formData.append('type', form.type);
      formData.append('description', form.description);

      await api.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Report uploaded successfully!');
      setShowUpload(false);
      setFile(null);
      setForm({ title: '', type: 'lab_report', description: '' });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const deleteReport = async (id) => {
    if (!confirm('Delete this report?')) return;
    try {
      await api.delete(`/reports/${id}`);
      toast.success('Report deleted');
      setReports(prev => prev.filter(r => r._id !== id));
    } catch (e) { toast.error('Failed to delete'); }
  };

  const fileIcon = (mime) => {
    if (mime?.includes('pdf')) return <FiFileText style={{ color: '#ef4444' }} />;
    if (mime?.includes('image')) return <FiImage style={{ color: '#4cc9f0' }} />;
    return <FiFile style={{ color: '#94a3b8' }} />;
  };

  const typeLabel = { lab_report: 'Lab Report', prescription: 'Prescription', imaging: 'Imaging', discharge_summary: 'Discharge Summary', other: 'Other' };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Reports</h1>
          <p>Upload and manage your medical test reports</p>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowUpload(true)}>
          <FiUpload /> Upload Report
        </button>
      </div>

      {loading ? <div className="loading-container"><div className="spinner"></div></div> : (
        <div className="card">
          {reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No Reports Yet</h3>
              <p>Upload your lab reports, prescriptions, or imaging results</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th></th><th>Title</th><th>Type</th><th>File</th><th>Size</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r._id}>
                      <td style={{ width: 40 }}>{fileIcon(r.mimeType)}</td>
                      <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.title}</td>
                      <td><span className="badge badge-active">{typeLabel[r.type] || r.type}</span></td>
                      <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{r.fileName}</td>
                      <td style={{ fontSize: '0.8rem' }}>{formatSize(r.fileSize)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a href={`/api/reports/download/${r.filePath}`} className="btn-icon" title="Download"><FiDownload /></a>
                          <button className="btn-icon" onClick={() => deleteReport(r._id)} title="Delete" style={{ color: '#ef4444' }}><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Medical Report</h3>
              <button className="btn-icon" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Report Title *</label>
                  <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Blood Test - May 2026" required />
                </div>
                <div className="form-group">
                  <label>Report Type</label>
                  <select className="form-control" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="lab_report">Lab Report</option>
                    <option value="prescription">Prescription</option>
                    <option value="imaging">Imaging (X-Ray, MRI, CT)</option>
                    <option value="discharge_summary">Discharge Summary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional notes..." style={{ resize: 'vertical' }}></textarea>
                </div>
                <div className="form-group">
                  <label>Select File * (PDF, JPG, PNG, DOC — max 10MB)</label>
                  <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} required style={{ paddingTop: 10 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default MyReports;
