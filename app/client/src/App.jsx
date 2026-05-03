import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientDashboard from './pages/PatientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Patients from './pages/Patients';
import History from './pages/History';
import Alerts from './pages/Alerts';
import MyReports from './pages/MyReports';
import MyProfile from './pages/MyProfile';
import UserManagement from './pages/UserManagement';
import DeviceManagement from './pages/DeviceManagement';
import AuditLogs from './pages/AuditLogs';
import Layout from './components/Layout';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'patient') return <PatientDashboard />;
  return <Dashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Dashboard — role-specific */}
      <Route path="/dashboard" element={<ProtectedRoute><Layout><RoleDashboard /></Layout></ProtectedRoute>} />

      {/* Shared routes */}
      <Route path="/history" element={<ProtectedRoute><Layout><History /></Layout></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><Layout><Alerts /></Layout></ProtectedRoute>} />

      {/* Doctor + Admin routes */}
      <Route path="/patients" element={<ProtectedRoute roles={['doctor', 'admin']}><Layout><Patients /></Layout></ProtectedRoute>} />

      {/* Reports — all roles can access */}
      <Route path="/my-reports" element={<ProtectedRoute><Layout><MyReports /></Layout></ProtectedRoute>} />
      <Route path="/my-profile" element={<ProtectedRoute roles={['patient']}><Layout><MyProfile /></Layout></ProtectedRoute>} />

      {/* Admin-only routes */}
      <Route path="/user-management" element={<ProtectedRoute roles={['admin']}><Layout><UserManagement /></Layout></ProtectedRoute>} />
      <Route path="/device-management" element={<ProtectedRoute roles={['admin']}><Layout><DeviceManagement /></Layout></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute roles={['admin']}><Layout><AuditLogs /></Layout></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.1)', fontFamily: 'Inter' },
        success: { iconTheme: { primary: '#06d6a0', secondary: '#000' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
      }} />
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
