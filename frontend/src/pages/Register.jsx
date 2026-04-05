import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateRegisterForm } from '../utils/validate';

const DEPARTMENTS = ['General', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'ENT'];

const Register = () => {
  const [form, setForm]         = useState({ name: '', email: '', password: '', phone: '', role: 'patient', department: '' });
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const { register}   = useAuth();
  const [loading, setLoading] = useState(false);
  const navigate                = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validateRegisterForm(form);
    if (errors.length > 0) { setError(errors[0]); return; }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) navigate('/patient');
    else setError(result.message);
  };

  return (
    <div style={S.page}>
      {/* Left */}
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
          <h1 style={S.leftTitle}>Join the smart<br/>queue system</h1>
          <p style={S.leftSub}>Register once. Track your position in real time. Get notified when it's your turn.</p>
          <div style={S.steps}>
            {[
              { n: '01', t: 'Create Account', d: 'Register as patient or doctor' },
              { n: '02', t: 'Join Queue',     d: 'Select department and get your token' },
              { n: '03', t: 'Track Live',     d: 'See position update in real time' },
            ].map(s => (
              <div key={s.n} style={S.step}>
                <div style={S.stepNum}>{s.n}</div>
                <div>
                  <div style={S.stepTitle}>{s.t}</div>
                  <div style={S.stepDesc}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={S.right}>
        <div style={S.card}>
          <div style={S.cardTop}>
            <h2 style={S.cardTitle}>Create account</h2>
            <p style={S.cardSub}>Fill in your details to get started</p>
          </div>

          {error && <div style={S.errorBox}><span>⚠</span> {error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={S.row}>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Full Name</label>
                <input style={S.input} type="text" placeholder="John Doe"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Phone</label>
                <input style={S.input} type="tel" placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Email Address</label>
              <input style={S.input} type="email" placeholder="you@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>

            <div style={S.field}>
              <label style={S.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...S.input, paddingRight: '44px' }}
                  type={showPass ? 'text' : 'password'} placeholder="Minimum 6 characters"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                <button type="button" style={S.eyeBtn} onClick={() => setShowPass(!showPass)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>I am registering as</label>
              <div style={S.roleRow}>
                {[
                  { value: 'patient', emoji: '🧑‍🦽', label: 'Patient' },
                  { value: 'doctor',  emoji: '👨‍⚕️', label: 'Doctor'  },
                ].map(r => (
                  <div key={r.value}
                    style={{ ...S.roleCard, ...(form.role === r.value ? S.roleCardSelected : {}) }}
                    onClick={() => setForm({ ...form, role: r.value, department: '' })}>
                    <span style={S.roleEmoji}>{r.emoji}</span>
                    <span style={S.roleLabel}>{r.label}</span>
                    {form.role === r.value && <span style={S.roleCheck}>✓</span>}
                  </div>
                ))}
              </div>
            </div>

            {form.role === 'doctor' && (
              <div style={S.field}>
                <label style={S.label}>Department</label>
                <select style={S.input} value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })} required>
                  <option value="">Select your department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            <button style={{ ...S.btn, opacity: loading ? 0.75 : 1 }} type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>

          <p style={S.switchText}>
            Already have an account?{' '}
            <Link to="/login" style={S.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const S = {
  page:           { display: 'flex', minHeight: '100vh', background: '#f1f5f9' },
  left:           { flex: 1, background: 'linear-gradient(145deg, #0f2557 0%, #1d4ed8 60%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' },
  leftContent:    { maxWidth: '400px' },
  leftLogo:       { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' },
  leftLogoIcon:   { width: '48px', height: '48px', background: 'rgba(255,255,255,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' },
  leftLogoText:   { fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' },
  leftTitle:      { fontSize: '36px', fontWeight: '800', color: '#fff', lineHeight: 1.15, marginBottom: '16px', letterSpacing: '-0.5px' },
  leftSub:        { fontSize: '15px', color: 'rgba(255,255,255,0.65)', marginBottom: '40px', lineHeight: 1.6 },
  steps:          { display: 'flex', flexDirection: 'column', gap: '20px' },
  step:           { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  stepNum:        { width: '36px', height: '36px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '0.5px' },
  stepTitle:      { fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '3px' },
  stepDesc:       { fontSize: '13px', color: 'rgba(255,255,255,0.6)' },

  right:          { width: '520px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', background: '#f1f5f9', overflowY: 'auto' },
  card:           { width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '20px', padding: '36px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08)' },
  cardTop:        { marginBottom: '24px' },
  cardTitle:      { fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.3px' },
  cardSub:        { fontSize: '14px', color: '#64748b' },

  row:            { display: 'flex', gap: '12px' },
  field:          { marginBottom: '16px' },
  label:          { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input:          { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box' },
  eyeBtn:         { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 },

  roleRow:        { display: 'flex', gap: '10px' },
  roleCard:       { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', background: '#f8fafc', position: 'relative' },
  roleCardSelected:{ border: '1.5px solid #1d4ed8', background: '#eff6ff' },
  roleEmoji:      { fontSize: '22px' },
  roleLabel:      { fontSize: '14px', fontWeight: '600', color: '#374151' },
  roleCheck:      { position: 'absolute', top: '8px', right: '10px', fontSize: '12px', color: '#1d4ed8', fontWeight: '700' },

  btn:            { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,78,216,0.3)' },
  errorBox:       { display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '11px 14px', borderRadius: '10px', marginBottom: '18px', fontSize: '13px', fontWeight: '500' },
  switchText:     { textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' },
  switchLink:     { color: '#1d4ed8', textDecoration: 'none', fontWeight: '700' },
};

export default Register;
