import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';

const PRIORITY = {
  1: { dot: '🔴', label: 'EMERGENCY', color: '#dc2626', bg: '#fff1f2', border: '#fca5a5' },
  2: { dot: '🟡', label: 'PRIORITY',  color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  3: { dot: '🟢', label: 'Normal',    color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
};

const Toggle = ({ checked, onChange, label }) => (
  <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
    <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: checked ? '#16a34a' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'transform 0.2s', transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
    </div>
    <span style={{ fontSize: '13px', fontWeight: '600', color: checked ? '#16a34a' : '#dc2626' }}>{label}</span>
  </div>
);

// Feature 2 — Consultation timer
const ConsultationTimer = ({ startTime }) => {
  const start = new Date(startTime).getTime();
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - start) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600)/ 60);
  const secs = elapsed % 60;
  const isLong = elapsed > 600; // warn after 10 minutes

  return (
    <div style={{ ...S.timer, background: isLong ? '#fef2f2' : '#f0fdf4', color: isLong ? '#dc2626' : '#16a34a' }}>
      <span style={S.timerIcon}>{isLong ? '⚠️' : '⏱'}</span>
      <span style={S.timerText}>{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
      <span style={S.timerLabel}>consultation time</span>
    </div>
  );
};

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [queue, setQueue]                 = useState([]);
  const [history, setHistory]             = useState([]);
  const [tab, setTab]                     = useState('queue');
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [errorMsg, setErrorMsg]           = useState('');
  const [returnedPatients, setReturnedPatients] = useState({});
  const [isAvailable, setIsAvailable]     = useState(user.isAvailable ?? true);
  const [notes, setNotes]                 = useState({});
  const [notesSaved, setNotesSaved]       = useState({});

  useEffect(() => {
    const fetchMyAvailability = async () => {
      try {
        const res = await api.get('/auth/me');
        setIsAvailable(res.data.data.user.isAvailable ?? true);
      } catch {}
    };
    fetchMyAvailability();
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.get(`/appointments/queue/${user.department}`);
      setQueue(res.data.data.queue);
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  }, [user.department]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/appointments/history');
      setHistory(res.data.data.history);
    } catch (err) { console.error(err.message); }
  }, []);

  useEffect(() => {
    fetchQueue(); fetchHistory();
    socket.emit('join_department', user.department);
    socket.emit('join_admin');

    const handleQueueUpdate = (data) => {
      if (data.department === user.department) { fetchQueue(); fetchHistory(); }
    };
    const handleDoctorUpdate = (data) => {
      if (data.doctorId.toString() === user._id.toString()) setIsAvailable(data.isAvailable);
    };

    socket.on('queue_updated', handleQueueUpdate);
    socket.on('doctor_updated', handleDoctorUpdate);
    socket.on('patient_returned', (data) => {
      setReturnedPatients(prev => ({ ...prev, [data.appointmentId]: data }));
    });
    return () => {
      socket.off('queue_updated', handleQueueUpdate);
      socket.off('doctor_updated', handleDoctorUpdate);
    };
  }, [user.department, user._id, fetchQueue, fetchHistory]);

  const updateStatus = async (appointmentId, status) => {
    setActionLoading(appointmentId + status);
    setErrorMsg('');
    try { await api.patch(`/appointments/${appointmentId}/status`, { status }); }
    catch (err) { setErrorMsg(err.response?.data?.message || 'Failed to update status.'); }
    finally { setActionLoading(null); }
  };

  const toggleAvailability = async () => {
    try {
      const res = await api.patch('/admin/doctors/my-availability');
      setIsAvailable(res.data.data.isAvailable);
    } catch { setErrorMsg('Failed to update availability.'); }
  };

  // Feature 9 — Save doctor notes
  const saveNotes = async (appointmentId) => {
    try {
      await api.patch(`/appointments/${appointmentId}/notes`, { notes: notes[appointmentId] });
      setNotesSaved(prev => ({ ...prev, [appointmentId]: true }));
      setTimeout(() => setNotesSaved(prev => ({ ...prev, [appointmentId]: false })), 2000);
    } catch (err) { setErrorMsg('Failed to save notes.'); }
  };

  const currentPatient = queue.find(q => q.status === 'IN_CONSULTATION');
  const waitingQueue   = queue.filter(q => q.status === 'WAITING');
  const onHoldQueue    = queue.filter(q => q.status === 'ON_HOLD');
  const p1Count = waitingQueue.filter(q => q.priority === 1).length;
  const p2Count = waitingQueue.filter(q => q.priority === 2).length;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.heading}>Doctor Dashboard</h1>
          <p style={S.sub}>Dr. {user.name} · {user.department} Department</p>
        </div>
        <div style={S.headerRight}>
          <div style={S.availCard}>
            <Toggle checked={isAvailable} onChange={toggleAvailability}
              label={isAvailable ? 'Available' : 'Unavailable'} />
          </div>
          <div style={S.stats}>
            <div style={S.statCard}>
              <div style={S.statNum}>{waitingQueue.length}</div>
              <div style={S.statLabel}>Waiting</div>
            </div>
            {p1Count > 0 && (
              <div style={{ ...S.statCard, background: '#fff1f2', border: '1px solid #fca5a5' }}>
                <div style={{ ...S.statNum, color: '#dc2626' }}>{p1Count}</div>
                <div style={S.statLabel}>🔴 Emergency</div>
              </div>
            )}
            {p2Count > 0 && (
              <div style={{ ...S.statCard, background: '#fffbeb', border: '1px solid #fcd34d' }}>
                <div style={{ ...S.statNum, color: '#d97706' }}>{p2Count}</div>
                <div style={S.statLabel}>🟡 Priority</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {errorMsg && <div style={S.errorBar}>⚠ {errorMsg}</div>}

      <div style={S.tabs}>
        {[['queue', `Live Queue (${waitingQueue.length})`], ['history', `Today's History (${history.length})`]].map(([key, label]) => (
          <button key={key} style={{ ...S.tabBtn, ...(tab === key ? S.tabActive : {}) }} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div>
          {currentPatient ? (
            <div style={S.nowServingCard}>
              <div style={S.nowServingTag}>NOW SERVING</div>
              <div style={S.nowServingBody}>
                <div style={{ flex: 1 }}>
                  <div style={S.nowServingToken}>{currentPatient.tokenNumber}</div>
                  <div style={S.nowServingName}>{currentPatient.patient?.name}</div>
                  <div style={S.nowServingTags}>
                    <span style={{ ...S.priorityBadge, background: PRIORITY[currentPatient.priority].color }}>
                      {PRIORITY[currentPatient.priority].dot} {PRIORITY[currentPatient.priority].label}
                    </span>
                    {currentPatient.priorityReason && <span style={S.infoTag}>{currentPatient.priorityReason}</span>}
                    {currentPatient.symptoms && <span style={S.infoTag}>🩺 {currentPatient.symptoms}</span>}
                  </div>
                  {/* Feature 2 — Consultation timer */}
                  {currentPatient.consultationStartTime && (
                    <div style={{ marginTop: '12px' }}>
                      <ConsultationTimer startTime={currentPatient.consultationStartTime} />
                    </div>
                  )}
                  {/* Feature 9 — Doctor notes */}
                  <div style={{ marginTop: '12px' }}>
                    <textarea
                      style={S.notesInput}
                      placeholder="Add consultation notes (visible to admin only)..."
                      value={notes[currentPatient._id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [currentPatient._id]: e.target.value }))}
                    />
                    {notes[currentPatient._id] && (
                      <button style={S.notesSaveBtn} onClick={() => saveNotes(currentPatient._id)}>
                        {notesSaved[currentPatient._id] ? '✅ Saved!' : '💾 Save Notes'}
                      </button>
                    )}
                  </div>
                </div>
                <button style={S.btnDone}
                  disabled={actionLoading === currentPatient._id + 'DONE'}
                  onClick={() => updateStatus(currentPatient._id, 'DONE')}>
                  ✓ Mark Done
                </button>
              </div>
            </div>
          ) : !loading && waitingQueue.length > 0 && (
            <div style={S.callNextBanner}>No patient in consultation — call the next patient in</div>
          )}

          {loading ? (
            <div style={S.loading}>Loading queue...</div>
          ) : waitingQueue.length === 0 && !currentPatient ? (
            <div style={S.emptyCard}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Queue is empty</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>No patients waiting right now</div>
            </div>
          ) : waitingQueue.length > 0 && (
            <div style={S.queueCard}>
              <div style={S.queueCardHeader}>
                <span style={S.queueCardTitle}>Waiting Queue — {waitingQueue.length} patient{waitingQueue.length !== 1 ? 's' : ''}</span>
                <div style={S.legend}>
                  <span style={S.legendItem}>🔴 Emergency first</span>
                  <span style={S.legendItem}>🟡 Priority second</span>
                  <span style={S.legendItem}>🟢 Normal last</span>
                </div>
              </div>

              {waitingQueue.map((appt, index) => {
                const p = PRIORITY[appt.priority];
                return (
                  <div key={appt._id} style={{ ...S.queueRow, borderLeft: `4px solid ${p.color}`, background: p.bg }}>
                    <div style={S.queuePos}>
                      <div style={S.posNum}>#{index + 1}</div>
                      <div style={{ fontSize: '18px' }}>{p.dot}</div>
                    </div>
                    <div style={S.queueInfo}>
                      <div style={S.queueToken}>{appt.tokenNumber}</div>
                      <div style={S.queueName}>{appt.patient?.name}</div>
                      <div style={S.queueTags}>
                        {appt.priorityReason && <span style={{ ...S.tag, background: p.color + '20', color: p.color }}>{appt.priorityReason}</span>}
                        {appt.symptoms && <span style={S.tag}>🩺 {appt.symptoms}</span>}
                        {appt.patient?.phone && <span style={S.tag}>📱 {appt.patient.phone}</span>}
                        {appt.patient?.email && <span style={S.tag}>📧 {appt.patient.email}</span>}
                      </div>
                    </div>
                    <div style={S.waitBox}>
                      <div style={S.waitNum}>{appt.estimatedWait ?? 0}</div>
                      <div style={S.waitLabel}>min</div>
                    </div>
                    <div style={S.queueActions}>
                      <button style={S.btnCall}
                        disabled={!!currentPatient || actionLoading === appt._id + 'IN_CONSULTATION'}
                        onClick={() => updateStatus(appt._id, 'IN_CONSULTATION')}>
                        ▶ Call In
                      </button>
                      <button style={S.btnSkip}
                        disabled={actionLoading === appt._id + 'ON_HOLD'}
                        onClick={() => updateStatus(appt._id, 'ON_HOLD')}
                        title="Patient not present — pause and continue queue">
                        ⏭ Skip
                      </button>
                      <button style={S.btnNoShow}
                        disabled={actionLoading === appt._id + 'NO_SHOW'}
                        onClick={() => updateStatus(appt._id, 'NO_SHOW')}>
                        ✗ No Show
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* ON_HOLD patients — shown separately, skipped automatically */}
              {onHoldQueue.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                    ⏸ On Hold
                  </div>
                  {onHoldQueue.map(appt => {
                    const p = PRIORITY[appt.priority];
                    return (
                      <div key={appt._id} style={{ ...S.queueRow, borderLeft: '4px solid #94a3b8', background: '#f8fafc', opacity: 0.75 }}>
                        <div style={S.queuePos}>
                          <div style={{ fontSize: '18px' }}>⏸</div>
                        </div>
                        <div style={S.queueInfo}>
                          <div style={S.queueToken}>{appt.tokenNumber}</div>
                          <div style={S.queueName}>{appt.patient?.name}</div>
                          <div style={S.queueTags}>
                            {appt.onHoldAtDepartment ? (
                              <span style={{ ...S.tag, background: '#fef3c7', color: '#b45309', fontWeight: '600' }}>
                                In consultation at {appt.onHoldAtDepartment}
                              </span>
                            ) : (
                              <span style={{ ...S.tag, background: '#fff7ed', color: '#c2410c', fontWeight: '600' }}>
                                ⏭ Skipped — not present
                              </span>
                            )}
                            {appt.priorityReason && <span style={{ ...S.tag, background: p.color + '20', color: p.color }}>{appt.priorityReason}</span>}
                            {/* 🔔 Patient returned badge — shows when patient clicks I'm back */}
                            {returnedPatients[appt._id] && (
                              <span style={{ ...S.tag, background: '#f0fdf4', color: '#16a34a', fontWeight: '700', fontSize: '12px', padding: '4px 10px', animation: 'pulse 1s ease-in-out' }}>
                                🔔 Patient is back!
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={S.queueActions}>
                          {/* Only show Call Back if no one currently in consultation */}
                          <button style={{ ...S.btnCall, background: returnedPatients[appt._id] ? '#16a34a' : '#1d4ed8' }}
                            disabled={!!currentPatient || actionLoading === appt._id + 'IN_CONSULTATION'}
                            onClick={() => {
                              updateStatus(appt._id, 'IN_CONSULTATION');
                              setReturnedPatients(prev => { const n = {...prev}; delete n[appt._id]; return n; });
                            }}>
                            ▶ Call Back
                          </button>
                          {/* No Show only for skipped patients — not for multi-dept ON_HOLD */}
                          {!appt.onHoldAtDepartment && (
                            <button style={S.btnNoShow}
                              disabled={actionLoading === appt._id + 'NO_SHOW'}
                              onClick={() => updateStatus(appt._id, 'NO_SHOW')}>
                              ✗ No Show
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={S.queueCard}>
          <div style={S.queueCardTitle}>Today's Completed Appointments</div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>No completed appointments yet today.</div>
          ) : history.map(appt => {
            const p = PRIORITY[appt.priority];
            const statusColors = { DONE: '#16a34a', NO_SHOW: '#dc2626', CANCELLED: '#6b7280' };
            return (
              <div key={appt._id} style={{ ...S.queueRow, borderLeft: `4px solid ${statusColors[appt.status] || '#e2e8f0'}`, background: '#f8fafc' }}>
                <div style={S.queuePos}><div style={{ fontSize: '18px' }}>{p.dot}</div></div>
                <div style={S.queueInfo}>
                  <div style={S.queueToken}>{appt.tokenNumber}</div>
                  <div style={S.queueName}>{appt.patient?.name}</div>
                  <div style={S.queueTags}>
                    {appt.patient?.email && <span style={S.tag}>📧 {appt.patient.email}</span>}
                    {appt.patient?.phone && <span style={S.tag}>📱 {appt.patient.phone}</span>}
                    {appt.symptoms && <span style={S.tag}>🩺 {appt.symptoms}</span>}
                    {appt.patientRating && <span style={{ ...S.tag, background: '#fef3c7', color: '#b45309' }}>⭐ {appt.patientRating}/5</span>}
                    {appt.doctorNotes && <span style={{ ...S.tag, background: '#ede9fe', color: '#7c3aed' }}>📝 Has notes</span>}
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: '20px', background: statusColors[appt.status], color: '#fff', fontSize: '11px', fontWeight: '700' }}>
                  {appt.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const S = {
  page:           { maxWidth: '920px', margin: '0 auto', padding: '32px 24px' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' },
  heading:        { fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' },
  sub:            { fontSize: '14px', color: '#64748b', marginTop: '4px' },
  headerRight:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' },
  availCard:      { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  stats:          { display: 'flex', gap: '8px' },
  statCard:       { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 18px', textAlign: 'center', minWidth: '72px' },
  statNum:        { fontSize: '22px', fontWeight: '800', color: '#0f172a' },
  statLabel:      { fontSize: '11px', color: '#94a3b8', marginTop: '1px', fontWeight: '500' },
  errorBar:       { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '11px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: '500' },
  tabs:           { display: 'flex', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' },
  tabBtn:         { padding: '8px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#64748b' },
  tabActive:      { background: '#1d4ed8', color: '#fff', border: '1px solid #1d4ed8', fontWeight: '600' },
  nowServingCard: { background: 'linear-gradient(135deg, #0f2557, #1d4ed8)', borderRadius: '16px', padding: '22px 26px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(29,78,216,0.3)' },
  nowServingTag:  { fontSize: '10px', fontWeight: '800', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' },
  nowServingBody: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' },
  nowServingToken:{ fontSize: '36px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '4px' },
  nowServingName: { fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: '10px' },
  nowServingTags: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  priorityBadge:  { padding: '4px 12px', borderRadius: '20px', color: '#fff', fontSize: '11px', fontWeight: '700' },
  infoTag:        { padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', fontSize: '12px' },
  timer:          { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' },
  timerIcon:      { fontSize: '14px' },
  timerText:      { fontFamily: 'monospace', fontSize: '16px', fontWeight: '800' },
  timerLabel:     { fontSize: '11px', opacity: 0.7 },
  notesInput:     { width: '100%', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.1)', color: '#fff', resize: 'vertical', height: '70px', boxSizing: 'border-box', marginTop: '10px' },
  notesSaveBtn:   { marginTop: '6px', padding: '6px 14px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' },
  callNextBanner: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', color: '#92400e', fontSize: '13px', fontWeight: '500' },
  queueCard:      { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  queueCardHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  queueCardTitle: { fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' },
  legend:         { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  legendItem:     { fontSize: '11px', color: '#94a3b8', fontWeight: '500' },
  queueRow:       { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '10px', marginBottom: '8px', flexWrap: 'wrap' },
  queuePos:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '32px' },
  posNum:         { fontSize: '11px', color: '#94a3b8', fontWeight: '700' },
  queueInfo:      { flex: 1, minWidth: '160px' },
  queueToken:     { fontSize: '17px', fontWeight: '800', color: '#0f172a', marginBottom: '2px' },
  queueName:      { fontSize: '13px', color: '#374151', fontWeight: '500' },
  queueTags:      { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' },
  tag:            { fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontWeight: '500' },
  waitBox:        { textAlign: 'center', minWidth: '52px' },
  waitNum:        { fontSize: '20px', fontWeight: '800', color: '#0f172a' },
  waitLabel:      { fontSize: '10px', color: '#94a3b8', fontWeight: '500' },
  queueActions:   { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  btnCall:        { padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  btnSkip:        { padding: '8px 14px', background: '#fff', color: '#f59e0b', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  btnNoShow:      { padding: '8px 14px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  btnDone:        { padding: '11px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' },
  loading:        { textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' },
  emptyCard:      { textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' },
};

export default DoctorDashboard;