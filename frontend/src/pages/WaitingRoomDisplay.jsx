import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../utils/socket';

const DEPARTMENTS = ['General', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'ENT'];

const PRIORITY = {
  1: { dot: '🔴', label: 'EMERGENCY', color: '#dc2626' },
  2: { dot: '🟡', label: 'PRIORITY',  color: '#d97706' },
  3: { dot: '🟢', label: 'Normal',    color: '#16a34a' },
};

const WaitingRoomDisplay = () => {
  const { department } = useParams();
  const [queue, setQueue]   = useState([]);
  const [time, setTime]     = useState(new Date());
  const [loading, setLoading] = useState(true);

  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const fetchQueue = async () => {
    try {
      const res = await fetch(`${BASE_URL}/appointments/display/${department}`);
      const json = await res.json();
      setQueue(json.data.queue);
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchQueue();
    socket.connect();
    socket.emit('join_department', department);
    socket.on('queue_updated', (data) => {
      if (data.department === department) setQueue(data.queue);
    });

    // Clock
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => {
      socket.off('queue_updated');
      socket.disconnect();
      clearInterval(clock);
    };
  }, [department]);

  const currentPatient = queue.find(q => q.status === 'IN_CONSULTATION');
  const waitingQueue   = queue.filter(q => q.status === 'WAITING').slice(0, 6);
  const onHoldCount    = queue.filter(q => q.status === 'ON_HOLD').length;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoMark}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 4v20M4 14h20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={S.hospitalName}>MediQueue</div>
            <div style={S.deptName}>{department} Department</div>
          </div>
        </div>
        <div style={S.clock}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={S.liveBadge}><span style={S.liveDot} /> LIVE</div>
      </div>

      {/* Now serving — prominent */}
      <div style={S.nowServingSection}>
        <div style={S.nowServingLabel}>NOW SERVING</div>
        {currentPatient ? (
          <div style={S.nowServingCard}>
            <div style={S.nowServingToken}>{currentPatient.tokenNumber}</div>
            <div style={S.nowServingInfo}>
              <span style={S.nowServingDept}>Dr. {currentPatient.doctor?.name || department}</span>
              <span style={{ ...S.priorityPill, background: PRIORITY[currentPatient.priority]?.color }}>
                {PRIORITY[currentPatient.priority]?.dot} {PRIORITY[currentPatient.priority]?.label}
              </span>
            </div>
          </div>
        ) : (
          <div style={S.noPatient}>
            {loading ? 'Loading...' : 'No patient currently in consultation'}
          </div>
        )}
      </div>

      {/* Waiting queue */}
      <div style={S.waitingSection}>
        <div style={S.waitingLabel}>WAITING QUEUE</div>
        {waitingQueue.length === 0 ? (
          <div style={S.emptyWaiting}>✅ No patients waiting</div>
        ) : (
          <div style={S.waitingGrid}>
            {waitingQueue.map((appt, index) => {
              const p = PRIORITY[appt.priority];
              const isNext = index === 0;
              return (
                <div key={appt._id} style={{ ...S.waitingCard, ...(isNext ? S.waitingCardNext : {}), borderLeft: `6px solid ${p.color}` }}>
                  <div style={S.waitingPos}>#{index + 1}</div>
                  <div style={S.waitingToken}>{appt.tokenNumber}</div>
                  <div style={S.waitingDetails}>
                    <span style={{ ...S.waitingPriority, color: p.color }}>{p.dot} {p.label}</span>
                    {appt.estimatedWait > 0 && (
                      <span style={S.waitingTime}>~{appt.estimatedWait} min</span>
                    )}
                  </div>
                  {isNext && <div style={S.nextTag}>NEXT</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <div style={S.footerLeft}>
          🔴 Emergency · 🟡 Priority · 🟢 Normal
        </div>
        <div style={S.footerRight}>
          Queue auto-updates in real time · {queue.filter(q => q.status === 'WAITING').length} waiting{onHoldCount > 0 ? ` · ${onHoldCount} on hold` : ''}
        </div>
      </div>
    </div>
  );
};

const S = {
  page:            { minHeight: '100vh', background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" },
  header:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  headerLeft:      { display: 'flex', alignItems: 'center', gap: '16px' },
  logoMark:        { width: '48px', height: '48px', background: '#1d4ed8', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hospitalName:    { fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' },
  deptName:        { fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
  clock:           { fontSize: '28px', fontWeight: '700', color: '#fff', fontFamily: 'monospace', letterSpacing: '2px' },
  liveBadge:       { display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '800', letterSpacing: '1px' },
  liveDot:         { width: '8px', height: '8px', borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 1s infinite' },

  nowServingSection:{ padding: '40px 40px 20px', flex: '0 0 auto' },
  nowServingLabel: { fontSize: '13px', fontWeight: '800', letterSpacing: '3px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' },
  nowServingCard:  { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', borderRadius: '20px', padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  nowServingToken: { fontSize: '80px', fontWeight: '900', color: '#fff', letterSpacing: '2px', lineHeight: 1 },
  nowServingInfo:  { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' },
  nowServingDept:  { fontSize: '18px', color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  priorityPill:    { padding: '8px 20px', borderRadius: '20px', color: '#fff', fontSize: '14px', fontWeight: '700' },
  noPatient:       { background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '40px', textAlign: 'center', fontSize: '20px', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' },

  waitingSection:  { padding: '20px 40px', flex: 1 },
  waitingLabel:    { fontSize: '13px', fontWeight: '800', letterSpacing: '3px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' },
  emptyWaiting:    { textAlign: 'center', padding: '40px', fontSize: '18px', color: 'rgba(255,255,255,0.4)' },
  waitingGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  waitingCard:     { background: 'rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' },
  waitingCardNext: { background: 'rgba(29,78,216,0.2)', border: '1px solid rgba(29,78,216,0.4)' },
  waitingPos:      { fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' },
  waitingToken:    { fontSize: '32px', fontWeight: '900', color: '#fff', letterSpacing: '1px' },
  waitingDetails:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  waitingPriority: { fontSize: '13px', fontWeight: '700' },
  waitingTime:     { fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '10px' },
  nextTag:         { position: 'absolute', top: '12px', right: '16px', background: '#1d4ed8', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '3px 10px', borderRadius: '10px', letterSpacing: '1px' },

  footer:          { padding: '16px 40px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.3)' },
  footerLeft:      {},
  footerRight:     {},
};

export default WaitingRoomDisplay;