import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';

const STATUS = {
  WAITING:         { label: 'WAITING',         bg: '#f59e0b', icon: '⏳' },
  IN_CONSULTATION: { label: 'IN CONSULTATION', bg: '#2563eb', icon: '🩺' },
  DONE:            { label: 'DONE',            bg: '#16a34a', icon: '✅' },
  NO_SHOW:         { label: 'NO SHOW',         bg: '#dc2626', icon: '❌' },
  CANCELLED:       { label: 'CANCELLED',       bg: '#6b7280', icon: '🚫' },
};

const PRIORITY = {
  1: { dot: '🔴', label: 'Emergency' },
  2: { dot: '🟡', label: 'Priority' },
  3: { dot: '🟢', label: 'Normal' },
};

const TrackToken = () => {
  const { tokenNumber } = useParams();
  const [data, setData]               = useState(null);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchToken = async () => {
    try {
      const res = await api.get(`/appointments/track/${tokenNumber}`);
      setData(res.data.data);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Token not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    socket.connect();
    socket.emit('join_token', tokenNumber);
    socket.on('queue_updated', fetchToken);
    return () => {
      socket.off('queue_updated', fetchToken);
      socket.disconnect();
    };
  }, [tokenNumber]);

  if (loading) return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏥</div>
        <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>Looking up your token...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Token Not Found</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{error}</div>
      </div>
    </div>
  );

  const s = STATUS[data.status] || STATUS.WAITING;
  const p = PRIORITY[data.priority] || PRIORITY[3];
  const patientsAhead = Math.max((data.queuePosition || 1) - 1, 0);
  const isWaiting = data.status === 'WAITING';

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.logoText}>🏥 MediQueue</div>
        <div style={S.livePill}>
          <span style={S.liveDot} /> Live Tracking
        </div>
      </div>

      <div style={S.content}>
        <div style={S.tokenCard}>
          <div style={S.tokenLabel}>YOUR TOKEN</div>
          <div style={S.tokenNumber}>{data.tokenNumber}</div>
          <div style={S.tokenMeta}>
            <span>{data.department}</span>
            <span>·</span>
            <span>Dr. {data.doctor}</span>
            <span>·</span>
            <span>{p.dot} {p.label}</span>
          </div>
        </div>

        <div style={{ ...S.statusBadge, background: s.bg }}>
          <span style={{ fontSize: '24px' }}>{s.icon}</span>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '1px' }}>
            {s.label}
          </span>
        </div>

        {isWaiting && (
          <div style={S.statsCard}>
            <div style={S.statItem}>
              <div style={S.statNum}>#{data.queuePosition || '—'}</div>
              <div style={S.statLabel}>Your Position</div>
            </div>
            <div style={S.statDivider} />
            <div style={S.statItem}>
              <div style={S.statNum}>{patientsAhead}</div>
              <div style={S.statLabel}>Patients Ahead</div>
            </div>
            <div style={S.statDivider} />
            <div style={S.statItem}>
              <div style={S.statNum}>{data.estimatedWaitMinutes ?? 0} min</div>
              <div style={S.statLabel}>Est. Wait</div>
            </div>
          </div>
        )}

        {data.status === 'IN_CONSULTATION' && (
          <div style={S.infoCard}>🩺 Currently with the doctor</div>
        )}

        {data.status === 'DONE' && (
          <div style={{ ...S.infoCard, background: '#f0fdf4', color: '#16a34a' }}>
            ✅ Consultation complete. Thank you for using MediQueue!
          </div>
        )}

        {lastUpdated && (
          <div style={S.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
            {isWaiting && <span style={{ color: '#4ade80' }}> · Auto-updating</span>}
          </div>
        )}

        <div style={S.shareCard}>
          <div style={S.shareTitle}>📤 Share this tracking link</div>
          <div style={S.shareUrl}>{window.location.href}</div>
          <button style={{ ...S.copyBtn, background: copied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.2)', border: copied ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.3)' }}
            onClick={() => {
              const url = window.location.href;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              } else {
                const el = document.createElement('textarea');
                el.value = url;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}>
            {copied ? '✅ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

const S = {
  page:        { minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', fontFamily: '-apple-system, sans-serif' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' },
  logoText:    { fontSize: '18px', fontWeight: '800', color: '#fff' },
  livePill:    { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  liveDot:     { width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' },
  content:     { maxWidth: '480px', margin: '0 auto', padding: '16px 24px 40px' },
  center:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' },
  tokenCard:   { background: 'rgba(255,255,255,0.12)', borderRadius: '16px', padding: '28px', textAlign: 'center', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.2)' },
  tokenLabel:  { fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: '2px', marginBottom: '10px' },
  tokenNumber: { fontSize: '44px', fontWeight: '900', color: '#fff', letterSpacing: '2px', marginBottom: '12px' },
  tokenMeta:   { display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: 'rgba(255,255,255,0.75)' },
  statusBadge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', borderRadius: '12px', padding: '14px', marginBottom: '16px' },
  statsCard:   { background: '#fff', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', marginBottom: '16px' },
  statItem:    { flex: 1, textAlign: 'center' },
  statNum:     { fontSize: '28px', fontWeight: '900', color: '#0f172a' },
  statLabel:   { fontSize: '11px', color: '#94a3b8', marginTop: '3px' },
  statDivider: { width: '1px', height: '40px', background: '#e2e8f0', margin: '0 8px' },
  infoCard:    { background: '#eff6ff', color: '#1d4ed8', borderRadius: '12px', padding: '16px', textAlign: 'center', fontWeight: '600', fontSize: '15px', marginBottom: '16px' },
  lastUpdated: { textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' },
  shareCard:   { background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.15)' },
  shareTitle:  { fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '8px' },
  shareUrl:    { fontSize: '12px', color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all', marginBottom: '10px', fontFamily: 'monospace' },
  copyBtn:     { padding: '7px 16px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
};

export default TrackToken;