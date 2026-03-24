import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotFound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const homePath = user
    ? user.role === 'patient' ? '/patient'
    : user.role === 'doctor'  ? '/doctor'
    : '/admin'
    : '/login';

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.code}>404</div>
        <div style={S.title}>Page not found</div>
        <div style={S.sub}>The page you're looking for doesn't exist or has been moved.</div>
        <div style={S.actions}>
          <button style={S.backBtn} onClick={() => navigate(-1)}>← Go Back</button>
          <Link to={homePath} style={S.homeBtn}>Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
};

const S = {
  page:    { minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' },
  card:    { textAlign: 'center', padding: '60px 40px', background: '#fff', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', maxWidth: '420px', width: '90%' },
  code:    { fontSize: '80px', fontWeight: '900', color: '#e2e8f0', lineHeight: 1, marginBottom: '16px', letterSpacing: '-4px' },
  title:   { fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' },
  sub:     { fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '32px' },
  actions: { display: 'flex', gap: '10px', justifyContent: 'center' },
  backBtn: { padding: '10px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  homeBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', textDecoration: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(29,78,216,0.25)' },
};

export default NotFound;