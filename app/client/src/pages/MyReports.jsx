import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiUpload, FiDownload, FiTrash2, FiFileText, FiFile, FiImage, FiActivity, FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';

const LAB_FIELDS = [
  { section: 'Complete Blood Count', fields: [
    { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', placeholder: '13.5' },
    { key: 'wbc', label: 'WBC', unit: '×10³/µL', placeholder: '7.0' },
    { key: 'rbc', label: 'RBC', unit: '×10⁶/µL', placeholder: '5.0' },
    { key: 'platelets', label: 'Platelets', unit: '×10³/µL', placeholder: '250' },
  ]},
  { section: 'Blood Sugar', fields: [
    { key: 'glucose_fasting', label: 'Fasting Glucose', unit: 'mg/dL', placeholder: '90' },
    { key: 'glucose_pp', label: 'Post-Prandial', unit: 'mg/dL', placeholder: '120' },
    { key: 'hba1c', label: 'HbA1c', unit: '%', placeholder: '5.4' },
  ]},
  { section: 'Lipid Profile', fields: [
    { key: 'cholesterol_total', label: 'Total Cholesterol', unit: 'mg/dL', placeholder: '180' },
    { key: 'hdl', label: 'HDL', unit: 'mg/dL', placeholder: '55' },
    { key: 'ldl', label: 'LDL', unit: 'mg/dL', placeholder: '90' },
    { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', placeholder: '130' },
  ]},
  { section: 'Liver Function', fields: [
    { key: 'sgot', label: 'SGOT/AST', unit: 'U/L', placeholder: '25' },
    { key: 'sgpt', label: 'SGPT/ALT', unit: 'U/L', placeholder: '30' },
    { key: 'bilirubin', label: 'Bilirubin', unit: 'mg/dL', placeholder: '0.8' },
  ]},
  { section: 'Kidney Function', fields: [
    { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', placeholder: '1.0' },
    { key: 'urea', label: 'BUN/Urea', unit: 'mg/dL', placeholder: '14' },
    { key: 'egfr', label: 'eGFR', unit: 'mL/min', placeholder: '95' },
  ]},
  { section: 'Thyroid', fields: [
    { key: 'tsh', label: 'TSH', unit: 'mIU/L', placeholder: '2.5' },
    { key: 't3', label: 'T3', unit: 'ng/dL', placeholder: '120' },
    { key: 't4', label: 'T4', unit: 'µg/dL', placeholder: '8.0' },
  ]},
  { section: 'Vitamins & Iron', fields: [
    { key: 'vitamin_d', label: 'Vitamin D', unit: 'ng/mL', placeholder: '40' },
    { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'pg/mL', placeholder: '400' },
    { key: 'iron', label: 'Serum Iron', unit: 'µg/dL', placeholder: '100' },
    { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', placeholder: '80' },
  ]},
  { section: 'Inflammation', fields: [
    { key: 'esr', label: 'ESR', unit: 'mm/hr', placeholder: '10' },
    { key: 'crp', label: 'CRP', unit: 'mg/L', placeholder: '1.5' },
  ]},
];

function MyReports() {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
  const [reports, setReports] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'lab_report', description: '' });
  const [labValues, setLabValues] = useState({});
  const [uploading, setUploading] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);
  const [showLabFields, setShowLabFields] = useState(false);

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try {
      const pRes = await api.get('/patients');
      setPatients(pRes.data.patients);
      if (pRes.data.patients.length > 0) {
        const first = pRes.data.patients[0].patientId;
        setSelectedPatientId(first);
        fetchReports(first);
      } else {
        setLoading(false);
      }
    } catch (e) { console.error(e); setLoading(false); }
  };

  const fetchReports = async (patientId) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const rRes = await api.get(`/reports/${patientId}`);
      setReports(rRes.data.reports);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePatientChange = (pid) => {
    setSelectedPatientId(pid);
    setReports([]);
    fetchReports(pid);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    if (!selectedPatientId) return toast.error('No patient selected');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('patientId', selectedPatientId);
      formData.append('title', form.title);
      formData.append('type', form.type);
      formData.append('description', form.description);
      const filledLabs = Object.fromEntries(Object.entries(labValues).filter(([, v]) => v !== ''));
      if (Object.keys(filledLabs).length > 0) formData.append('labValues', JSON.stringify(filledLabs));
      await api.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Report uploaded & analyzed!');
      setShowUpload(false); setFile(null); setForm({ title: '', type: 'lab_report', description: '' }); setLabValues({}); setShowLabFields(false);
      fetchReports(selectedPatientId);
    } catch (e) { toast.error(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const deleteReport = async (id) => {
    if (!confirm('Delete this report?')) return;
    try { await api.delete(`/reports/${id}`); toast.success('Report deleted'); setReports(prev => prev.filter(r => r._id !== id)); }
    catch (e) { toast.error('Failed to delete'); }
  };

  const fileIcon = (mime) => {
    if (mime?.includes('pdf')) return <FiFileText style={{ color: '#ef4444' }} />;
    if (mime?.includes('image')) return <FiImage style={{ color: '#4cc9f0' }} />;
    return <FiFile style={{ color: '#94a3b8' }} />;
  };
  const typeLabel = { lab_report: 'Lab Report', prescription: 'Prescription', imaging: 'Imaging', discharge_summary: 'Discharge Summary', other: 'Other' };
  const formatSize = (bytes) => bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
  const statusColor = { normal: '#06d6a0', borderline: '#fbbf24', abnormal: '#f97316', critical: '#ef4444' };

  const selectedPatientName = patients.find(p => p.patientId === selectedPatientId)?.name || '';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{isPatient ? 'My Reports' : 'Patient Reports'}</h1>
          <p>{isPatient ? 'Upload and manage your medical test reports' : `View and manage reports for ${selectedPatientName || 'patients'}`}</p>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowUpload(true)}><FiUpload /> Upload Report</button>
      </div>

      {/* Patient Selector — doctors/admins only */}
      {!isPatient && patients.length > 0 && (
        <div style={{ marginBottom: 20, maxWidth: 400 }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6, display: 'block' }}>Select Patient</label>
          <select className="form-control" value={selectedPatientId} onChange={e => handlePatientChange(e.target.value)}>
            {patients.map(p => (
              <option key={p.patientId} value={p.patientId}>{p.name} ({p.patientId})</option>
            ))}
          </select>
        </div>
      )}

      {loading ? <div className="loading-container"><div className="spinner"></div></div> : (
        <>
          {reports.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-icon">📄</div><h3>No Reports Yet</h3><p>{isPatient ? 'Upload your lab reports to get AI-powered health analysis' : `No reports found for ${selectedPatientName}`}</p></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reports.map(r => (
                <div key={r._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.3rem' }}>{fileIcon(r.mimeType)}</div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {typeLabel[r.type] || r.type} · {formatSize(r.fileSize)} · {new Date(r.createdAt).toLocaleDateString()}
                        {r.uploadedBy && <> · Uploaded by {r.uploadedBy.name}</>}
                      </div>
                    </div>
                    {r.aiAnalysis?.overallStatus && (
                      <span style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        background: `${statusColor[r.aiAnalysis.overallStatus]}18`, color: statusColor[r.aiAnalysis.overallStatus], border: `1px solid ${statusColor[r.aiAnalysis.overallStatus]}33`
                      }}>
                        <FiActivity size={11} style={{ marginRight: 4 }} />{r.aiAnalysis.overallStatus}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.aiAnalysis && <button className="btn-icon" title="View Analysis" onClick={() => setExpandedReport(expandedReport === r._id ? null : r._id)} style={{ color: '#4cc9f0' }}>{expandedReport === r._id ? <FiChevronUp /> : <FiChevronDown />}</button>}
                      <a href={`/api/reports/download/${r.filePath}`} className="btn-icon" title="Download"><FiDownload /></a>
                      <button className="btn-icon" onClick={() => deleteReport(r._id)} title="Delete" style={{ color: '#ef4444' }}><FiTrash2 /></button>
                    </div>
                  </div>

                  {/* AI Analysis Panel */}
                  {expandedReport === r._id && r.aiAnalysis && (
                    <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', padding: '20px', background: 'rgba(15,23,42,0.4)' }}>
                      <div style={{ padding: '14px 16px', borderRadius: 10, marginBottom: 18, background: `${statusColor[r.aiAnalysis.overallStatus]}0d`, border: `1px solid ${statusColor[r.aiAnalysis.overallStatus]}25` }}>
                        <div style={{ fontWeight: 700, color: statusColor[r.aiAnalysis.overallStatus], fontSize: '0.88rem', marginBottom: 6 }}>AI Health Analysis</div>
                        <p style={{ color: '#cbd5e1', fontSize: '0.84rem', margin: 0, lineHeight: 1.6 }}>{r.aiAnalysis.summary}</p>
                      </div>
                      {r.aiAnalysis.stats && (
                        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                          {[['normal','Normal','#06d6a0'],['borderline','Borderline','#fbbf24'],['abnormal','Abnormal','#f97316'],['critical','Critical','#ef4444']].map(([k,l,c]) => (
                            <div key={k} style={{ padding: '8px 14px', borderRadius: 8, background: `${c}0d`, border: `1px solid ${c}20`, textAlign: 'center', minWidth: 80 }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: c }}>{r.aiAnalysis.stats[k]}</div>
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.aiAnalysis.details?.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <h4 style={{ color: '#e2e8f0', fontSize: '0.88rem', marginBottom: 10 }}>📋 Detailed Results</h4>
                          <div className="table-container"><table style={{ fontSize: '0.82rem' }}>
                            <thead><tr><th>Test</th><th>Value</th><th>Normal Range</th><th>Status</th></tr></thead>
                            <tbody>{r.aiAnalysis.details.map((d, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 500 }}>{d.test}</td>
                                <td style={{ fontWeight: 600, color: statusColor[d.status] || '#e2e8f0' }}>{d.value} {d.unit}</td>
                                <td style={{ color: '#94a3b8' }}>{d.normalRange} {d.unit}</td>
                                <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: `${statusColor[d.status]}18`, color: statusColor[d.status] }}>{d.status === 'normal' ? '✓ Normal' : `${d.direction === 'high' ? '↑' : '↓'} ${d.status}`}</span></td>
                              </tr>
                            ))}</tbody>
                          </table></div>
                        </div>
                      )}
                      {r.aiAnalysis.findings?.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <h4 style={{ color: '#e2e8f0', fontSize: '0.88rem', marginBottom: 10 }}>🔍 Key Findings</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {r.aiAnalysis.findings.map((f, i) => (
                              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.08)', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}
                                dangerouslySetInnerHTML={{ __html: f.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>') }} />
                            ))}
                          </div>
                        </div>
                      )}
                      {r.aiAnalysis.recommendations?.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <h4 style={{ color: '#e2e8f0', fontSize: '0.88rem', marginBottom: 10 }}>💡 Recommendations</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {r.aiAnalysis.recommendations.map((rec, i) => (
                              <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(6,214,160,0.04)', border: '1px solid rgba(6,214,160,0.12)' }}>
                                <div style={{ fontWeight: 600, color: statusColor[rec.severity] || '#e2e8f0', fontSize: '0.8rem', marginBottom: 4 }}>{rec.test}</div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>{rec.advice}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.aiAnalysis.wellnessTips?.length > 0 && (
                        <div>
                          <h4 style={{ color: '#e2e8f0', fontSize: '0.88rem', marginBottom: 10 }}>🌿 General Wellness Tips</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {r.aiAnalysis.wellnessTips.map((tip, i) => (
                              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(76,201,240,0.06)', border: '1px solid rgba(76,201,240,0.12)', fontSize: '0.78rem', color: '#94a3b8' }}>{tip}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Upload Medical Report</h3>
              <button className="btn-icon" onClick={() => setShowUpload(false)}><FiX /></button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                {/* Patient selector for doctor/admin */}
                {!isPatient && patients.length > 1 && (
                  <div className="form-group">
                    <label>Upload for Patient</label>
                    <select className="form-control" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                      {patients.map(p => <option key={p.patientId} value={p.patientId}>{p.name} ({p.patientId})</option>)}
                    </select>
                  </div>
                )}
                <div className="form-grid">
                  <div className="form-group"><label>Report Title *</label><input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Blood Test - May 2026" required /></div>
                  <div className="form-group">
                    <label>Report Type</label>
                    <select className="form-control" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option value="lab_report">Lab Report</option><option value="prescription">Prescription</option><option value="imaging">Imaging</option><option value="discharge_summary">Discharge Summary</option><option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Description</label><textarea className="form-control" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional notes..." style={{ resize: 'vertical' }}></textarea></div>
                <div className="form-group"><label>Select File * (PDF, JPG, PNG, DOC — max 10MB)</label><input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} required style={{ paddingTop: 10 }} /></div>

                {form.type === 'lab_report' && (
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => setShowLabFields(!showLabFields)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(76,201,240,0.2)', background: 'rgba(76,201,240,0.06)',
                      color: '#4cc9f0', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                    }}>
                      <FiActivity /> Enter Lab Values for AI Analysis {showLabFields ? <FiChevronUp style={{ marginLeft: 'auto' }} /> : <FiChevronDown style={{ marginLeft: 'auto' }} />}
                    </button>
                    <small style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>Fill only the values available in your report.</small>
                    {showLabFields && (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {LAB_FIELDS.map(section => (
                          <div key={section.section}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{section.section}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                              {section.fields.map(f => (
                                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <label style={{ fontSize: '0.76rem', color: '#cbd5e1', minWidth: 80, whiteSpace: 'nowrap' }}>{f.label}</label>
                                  <input className="form-control" type="number" step="any" placeholder={f.placeholder} value={labValues[f.key] || ''} onChange={e => setLabValues({...labValues, [f.key]: e.target.value})}
                                    style={{ padding: '6px 8px', fontSize: '0.8rem', textAlign: 'right' }} />
                                  <span style={{ fontSize: '0.68rem', color: '#64748b', minWidth: 40 }}>{f.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={uploading}>{uploading ? 'Analyzing...' : 'Upload & Analyze'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default MyReports;
