import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hovering, setHovering] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const roleConfig = {
    patient: { color: '#0ea5e9', bg: '#e0f2fe', label: 'Patient', path: '/patient' },
    doctor:  { color: '#8b5cf6', bg: '#ede9fe', label: 'Doctor',  path: '/doctor'  },
    admin:   { color: '#f59e0b', bg: '#fef3c7', label: 'Admin',   path: '/admin'   },
  };
  const rc = user ? roleConfig[user.role] : null;

  return (
    <nav style={S.nav}>
      <div style={S.inner}>
        <Link to="/" style={S.brand}>
          <div style={S.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 3v14M3 10h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={S.logoText}>MediQueue</div>
            <div style={S.logoSub}>Hospital Queue System</div>
          </div>
        </Link>
        <div style={S.right}>
          {user ? (
            <>
              <div style={{ ...S.roleBadge, background: rc.bg, color: rc.color }}>
                <div style={{ ...S.roleDot, background: rc.color }} />
                {rc.label}
              </div>
              <span style={S.userName}>{user.name}</span>
              <Link to={rc.path} style={{
                ...S.navLink,
                background: location.pathname === rc.path ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
              }}>
                {user.role === 'patient' ? 'My Queue' : user.role === 'doctor' ? 'Dashboard' : 'Admin Panel'}
              </Link>
              <button
                style={{ ...S.logoutBtn, background: hovering ? 'rgba(255,255,255,0.2)' : 'transparent' }}
                onClick={handleLogout}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={S.navLink}>Sign In</Link>
              <Link to="/register" style={S.registerBtn}>Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const S = {
  nav:        { background: 'linear-gradient(135deg, #0f2557 0%, #1d4ed8 100%)', boxShadow: '0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100 },
  inner:      { maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '60px' },
  brand:      { display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' },
  logoIcon:   { width: '36px', height: '36px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText:   { fontSize: '16px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 },
  logoSub:    { fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.3px' },
  right:      { display: 'flex', alignItems: 'center', gap: '10px' },
  roleBadge:  { display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px' },
  roleDot:    { width: '5px', height: '5px', borderRadius: '50%' },
  userName:   { fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  navLink:    { color: 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: '13px', fontWeight: '500', padding: '6px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)' },
  logoutBtn:  { color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  registerBtn:{ color: '#1d4ed8', textDecoration: 'none', fontSize: '13px', fontWeight: '700', padding: '7px 16px', borderRadius: '7px', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' },
};

export default Navbar;