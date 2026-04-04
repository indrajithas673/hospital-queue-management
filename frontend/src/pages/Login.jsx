import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateLoginForm } from '../utils/validate';

const Login = () => {
  const [form, setForm]         = useState({ email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);  
  const [showPass, setShowPass] = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();

const handleSubmit = async (e) => {
  e.preventDefault();
  const validationErrors = validateLoginForm(form);
  if (validationErrors.length > 0) { setError(validationErrors[0]); return; }
  setLoading(true);
  const result = await login(form.email, form.password);
  setLoading(false);
  if (result.success) {
    if (result.role === 'patient') navigate('/patient');
    else if (result.role === 'doctor') navigate('/doctor');
    else if (result.role === 'admin') navigate('/admin');
  } else {
    setError(result.message);
  }
};

  return (
    <div style={S.page}>
      {/* Left panel */}
      <div style={S.left}>
        <div style={S.leftContent}>
          <div style={S.leftLogo}>
            <div style={S.leftLogoIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4v24M4 16h24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={S.leftLogoText}>MediQueue</span>
          </div>
          <h1 style={S.leftTitle}>Smart Hospital<br/>Queue Management</h1>
          <p style={S.leftSub}>Real-time queue tracking with priority-based patient management</p>
          <div style={S.features}>
            {[
              { icon: '⚡', text: 'Real-time queue updates via Socket.io' },
              { icon: '🔴', text: '3-Level priority queue engine' },
              { icon: '📱', text: 'Email & SMS notifications' },
              { icon: '📊', text: 'Analytics & doctor load tracking' },
            ].map(f => (
              <div key={f.text} style={S.feature}>
                <span style={S.featureIcon}>{f.icon}</span>
                <span style={S.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={S.right}>
        <div style={S.card}>
          <div style={S.cardTop}>
            <h2 style={S.cardTitle}>Welcome back</h2>
            <p style={S.cardSub}>Sign in to your MediQueue account</p>
          </div>

          {error && (
            <div style={S.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={S.field}>
              <label style={S.label}>Email address</label>
              <input style={S.input} type="email" placeholder="you@hospital.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>

            <div style={S.field}>
              <label style={S.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...S.input, paddingRight: '44px' }}
                  type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <button type="button" style={S.eyeBtn} onClick={() => setShowPass(!showPass)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button style={{ ...S.btn, opacity: loading ? 0.75 : 1 }} type="submit" disabled={loading}>
  {           loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p style={S.switchText}>
            Don't have an account?{' '}
            <Link to="/register" style={S.switchLink}>Create account</Link>
          </p>

          <div style={S.demoBox}>
            <div style={S.demoTitle}>Demo Credentials</div>
            <div style={S.demoRow}>
              <span style={{ ...S.demoRole, background: '#fef3c7', color: '#b45309' }}>Admin</span>
              <span style={S.demoCredential}>admin@hospital.com / admin123</span>
            </div>
            <div style={S.demoRow}>
              <span style={{ ...S.demoRole, background: '#ede9fe', color: '#7c3aed' }}>Doctor</span>
              <span style={S.demoCredential}>ramesh@hospital.com / doctor123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const S = {
  page:            { display: 'flex', minHeight: '100vh', background: '#f1f5f9' },
  left:            { flex: 1, background: 'linear-gradient(145deg, #0f2557 0%, #1d4ed8 60%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', position: 'relative', overflow: 'hidden' },
  leftContent:     { maxWidth: '400px', position: 'relative', zIndex: 1 },
  leftLogo:        { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' },
  leftLogoIcon:    { width: '48px', height: '48px', background: 'rgba(255,255,255,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' },
  leftLogoText:    { fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' },
  leftTitle:       { fontSize: '36px', fontWeight: '800', color: '#fff', lineHeight: 1.15, marginBottom: '16px', letterSpacing: '-0.5px' },
  leftSub:         { fontSize: '15px', color: 'rgba(255,255,255,0.65)', marginBottom: '40px', lineHeight: 1.6 },
  features:        { display: 'flex', flexDirection: 'column', gap: '14px' },
  feature:         { display: 'flex', alignItems: 'center', gap: '14px' },
  featureIcon:     { width: '36px', height: '36px', background: 'rgba(255,255,255,0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' },
  featureText:     { fontSize: '14px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  right:           { width: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', background: '#f1f5f9' },
  card:            { width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '20px', padding: '36px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08)' },
  cardTop:         { marginBottom: '28px' },
  cardTitle:       { fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.3px' },
  cardSub:         { fontSize: '14px', color: '#64748b' },

  field:           { marginBottom: '18px' },
  label:           { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input:           { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#0f172a', background: '#f8fafc', transition: 'border 0.15s', boxSizing: 'border-box' },
  eyeBtn:          { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 },

  btn:             { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 4px 12px rgba(29,78,216,0.3)' },

  errorBox:        { display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '11px 14px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', fontWeight: '500' },

  switchText:      { textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' },
  switchLink:      { color: '#1d4ed8', textDecoration: 'none', fontWeight: '700' },

  demoBox:         { marginTop: '20px', background: '#f8fafc', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0' },
  demoTitle:       { fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' },
  demoRow:         { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  demoRole:        { padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', flexShrink: 0 },
  demoCredential:  { fontSize: '12px', color: '#475569', fontFamily: 'monospace' },
};

export default Login;