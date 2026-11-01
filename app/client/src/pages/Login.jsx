import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  FiActivity, 
  FiMail, 
  FiLock, 
  FiUser, 
  FiPhone, 
  FiArrowRight,
  FiShield,
  FiZap,
  FiCheck
} from 'react-icons/fi';
import ThreeCanvas from '../components/ThreeCanvas';

function Login() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const authCardRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const setDemoCredentials = (email, password) => {
    setForm(prev => ({ ...prev, email, password }));
    setIsLogin(true);
    toast.success(`Selected ${email.split('@')[0]} credentials`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      } else {
        await register({ ...form, role: 'patient' });
        toast.success('Account created! A doctor can now assign your patient profile.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-3d-wrapper">
      {/* ── 1. Interactive 3D WebGL Canvas ── */}
      <ThreeCanvas />

      {/* ── 2. Minimalist Glass Navigation ── */}
      <header className="landing-nav-clean">
        <div className="nav-container-clean">
          <div className="nav-brand-clean">
            <span className="brand-logo-icon"><FiActivity /></span>
            <span className="brand-title-clean">HealthGuard<span className="accent-dot">.</span></span>
          </div>

          <div className="nav-status-badge">
            <span className="live-dot"></span> Telemetry Gateway Live
          </div>
        </div>
      </header>

      {/* ── 3. Clean 3D Hero Grid ── */}
      <main className="hero-clean-container">
        <div className="hero-clean-grid">
          
          {/* Left Column: Bold & Minimal Hero */}
          <div className="hero-left-clean">
            <div className="clean-pill">
              <span className="clean-pill-dot"></span>
              <span>Next-Gen Medical Telemetry</span>
            </div>

            <h1 className="hero-title-clean">
              Healthcare Intelligence. <br />
              <span className="gradient-3d-text">In Real-Time 3D.</span>
            </h1>

            <p className="hero-tagline-clean">
              Continuous patient monitoring, explainable anomaly detection, and cryptographic access control.
            </p>

            {/* Compact Glass Metric Chips */}
            <div className="chips-grid-clean">
              <div className="chip-clean">
                <span className="chip-value">99.98%</span>
                <span className="chip-label">Sensor Accuracy</span>
              </div>
              <div className="chip-clean">
                <span className="chip-value">&lt; 3.6s</span>
                <span className="chip-label">Alert Latency</span>
              </div>
              <div className="chip-clean">
                <span className="chip-value">Zero-Trust</span>
                <span className="chip-label">Role Isolation</span>
              </div>
            </div>

            {/* Minimalist 1-Click Demo Buttons */}
            <div className="demo-pills-wrap">
              <span className="demo-label"><FiZap style={{ marginRight: 4 }} /> Quick Demo:</span>
              <button 
                type="button"
                className="demo-pill doctor"
                onClick={() => setDemoCredentials('priya@healthguard.com', 'doctor123')}
              >
                🩺 Doctor
              </button>
              <button 
                type="button"
                className="demo-pill admin"
                onClick={() => setDemoCredentials('admin@healthguard.com', 'admin123')}
              >
                🔑 Admin
              </button>
              <button 
                type="button"
                className="demo-pill patient"
                onClick={() => setDemoCredentials('amit@patient.com', 'patient123')}
              >
                🧑 Patient
              </button>
            </div>
          </div>

          {/* Right Column: Sleek 3D Glass Card */}
          <div className="hero-right-clean" ref={authCardRef}>
            <div className="card-3d-clean">
              <div className="card-3d-glow"></div>

              <div className="card-clean-top">
                <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
                <div className="tab-switch-clean">
                  <button 
                    type="button" 
                    className={`tab-btn-clean ${isLogin ? 'active' : ''}`}
                    onClick={() => setIsLogin(true)}
                  >
                    Login
                  </button>
                  <button 
                    type="button" 
                    className={`tab-btn-clean ${!isLogin ? 'active' : ''}`}
                    onClick={() => setIsLogin(false)}
                  >
                    Register
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="form-clean">
                {!isLogin && (
                  <>
                    <div className="field-clean">
                      <label><FiUser /> Name</label>
                      <input 
                        className="input-clean" 
                        name="name" 
                        placeholder="John Doe" 
                        value={form.name} 
                        onChange={handleChange} 
                        required 
                      />
                    </div>
                    <div className="field-clean">
                      <label><FiPhone /> Phone</label>
                      <input 
                        className="input-clean" 
                        name="phone" 
                        placeholder="+91 9876543210" 
                        value={form.phone} 
                        onChange={handleChange} 
                      />
                    </div>
                  </>
                )}

                <div className="field-clean">
                  <label><FiMail /> Email</label>
                  <input 
                    className="input-clean" 
                    type="email" 
                    name="email" 
                    placeholder="name@hospital.com" 
                    value={form.email} 
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="field-clean">
                  <label><FiLock /> Password</label>
                  <input 
                    className="input-clean" 
                    type="password" 
                    name="password" 
                    placeholder="••••••••" 
                    value={form.password} 
                    onChange={handleChange} 
                    required 
                    minLength={6} 
                  />
                </div>

                <button className="btn-clean-submit" type="submit" disabled={loading}>
                  {loading ? 'Authenticating...' : (isLogin ? 'Access Dashboard' : 'Complete Registration')}
                  <FiArrowRight style={{ marginLeft: 8 }} />
                </button>
              </form>

              <div className="card-clean-footer">
                <FiShield style={{ color: '#06d6a0', marginRight: 6 }} />
                <span>256-Bit Encrypted &bull; 2h Token Revocation</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── 4. Minimal Footer Ribbon ── */}
      <footer className="footer-ribbon-clean">
        <span>HR: <strong>72 bpm</strong></span>
        <span>&bull;</span>
        <span>SpO2: <strong>99%</strong></span>
        <span>&bull;</span>
        <span>Temp: <strong>36.6 °C</strong></span>
        <span>&bull;</span>
        <span>IoT Node: <strong style={{ color: '#06d6a0' }}>Online</strong></span>
      </footer>
    </div>
  );
}

export default Login;
