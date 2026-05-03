import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiActivity, FiMail, FiLock, FiUser, FiPhone } from 'react-icons/fi';

function Login() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      } else {
        await register({ ...form, role: 'patient' });
        toast.success('Account created! A doctor will add you to their patient list shortly.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon"><FiActivity /></span>
          <h1>HealthGuard</h1>
          <p>Smart Healthcare Monitoring System</p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label><FiUser style={{ marginRight: 6 }} />Full Name</label>
                <input className="form-control" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label><FiPhone style={{ marginRight: 6 }} />Phone</label>
                <input className="form-control" name="phone" placeholder="+91 9876543210" value={form.phone} onChange={handleChange} />
              </div>
            </>
          )}

          <div className="form-group">
            <label><FiMail style={{ marginRight: 6 }} />Email</label>
            <input className="form-control" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label><FiLock style={{ marginRight: 6 }} />Password</label>
            <input className="form-control" type="password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} required minLength={6} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
