import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import { validateAppointmentForm } from '../utils/validate';

const DEPARTMENTS = ['General', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'ENT'];

const PRIORITY_OPTIONS = [
  { value: 3, label: '🟢 Normal',    sub: 'Regular appointment' },
  { value: 2, label: '🟡 Priority',  sub: 'Senior citizen, Pregnant, Disabled' },
  { value: 1, label: '🔴 Emergency', sub: 'Critical / Life threatening' },
];

const PRIORITY = {
  1: { dot: '🔴', label: 'EMERGENCY', color: '#dc2626', bg: '#fff1f2', border: '#fca5a5', light: '#fff1f2' },
  2: { dot: '🟡', label: 'PRIORITY',  color: '#d97706', bg: '#fffbeb', border: '#fcd34d', light: '#fffbeb' },
  3: { dot: '🟢', label: 'Normal',    color: '#16a34a', bg: '#f0fdf4', border: '#86efac', light: '#f0fdf4' },
};

const STATUS = {
  WAITING:         { label: 'WAITING',         bg: '#f59e0b' },
  IN_CONSULTATION: { label: 'IN CONSULTATION', bg: '#2563eb' },
  ON_HOLD:         { label: 'ON HOLD',         bg: '#8b5cf6' },
  DONE:            { label: 'DONE',            bg: '#16a34a' },
  NO_SHOW:         { label: 'NO SHOW',         bg: '#dc2626' },
  CANCELLED:       { label: 'CANCELLED',       bg: '#6b7280' },
};

// QR code using Google Charts API — no extra library needed
const QRCode = ({ value, size = 120 }) => (
  <img
    src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`}
    alt="QR Code"
    style={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
  />
);

const StarRating = ({ onRate }) => {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  const handleRate = async (star) => {
    setSelected(star);
    await onRate(star);
  };

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star} style={{ fontSize: '24px', cursor: 'pointer', transition: 'transform 0.1s', transform: hovered >= star || selected >= star ? 'scale(1.2)' : 'scale(1)' }}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => handleRate(star)}>
          {hovered >= star || selected >= star ? '⭐' : '☆'}
        </span>
      ))}
    </div>
  );
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const [doctors, setDoctors]               = useState([]);
  const [deptLoads, setDeptLoads]           = useState({});
  const [myAppointments, setMyAppointments] = useState([]);
  const [form, setForm]                     = useState({ doctorId: '', department: '', priority: 3, priorityReason: '', symptoms: '', autoAssign: false });
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [cancelLoading, setCancelLoading]   = useState(null);
  const [copied, setCopied]                 = useState(false);
  const [infoMsg, setInfoMsg]               = useState('');
  const [notifiedReturn, setNotifiedReturn]   = useState({});
  const [stepAwayLoading, setStepAwayLoading] = useState(null);
  const [stepAwayInfo, setStepAwayInfo]       = useState({});
  const [confirmCancel, setConfirmCancel]   = useState(null);
  const [showForm, setShowForm]             = useState(false);
  const [showQR, setShowQR]                 = useState(null);
  const [emergencyAlert, setEmergencyAlert] = useState('');
  const [ratedAppts, setRatedAppts]         = useState({});

  const fetchMyAppointments = useCallback(async () => {
    try {
      const res = await api.get('/appointments/my');
      const appts = res.data.data.appointments;
      setMyAppointments(appts);
      const activeDepts = [...new Set(appts.filter(a => ['WAITING', 'IN_CONSULTATION'].includes(a.status)).map(a => a.department))];
      activeDepts.forEach(dept => socket.emit('join_department', dept));
    } catch (err) { console.error(err.message); }
  }, []);

  const fetchDeptLoads = useCallback(async () => {
    try {
      const res = await api.get('/analytics/department-summary');
      const loads = {};
      res.data.data.departments.forEach(d => { loads[d._id] = d.currentlyWaiting; });
      setDeptLoads(loads);
    } catch {}
  }, []);

  useEffect(() => { fetchMyAppointments(); fetchDeptLoads(); }, [fetchMyAppointments, fetchDeptLoads]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); }
  }, [error]);

  useEffect(() => {
    if (emergencyAlert) { const t = setTimeout(() => setEmergencyAlert(''), 5000); return () => clearTimeout(t); }
  }, [emergencyAlert]);

  useEffect(() => {
    socket.emit('join_admin');
    socket.on('queue_updated', fetchMyAppointments);
    socket.on('doctor_updated', () => { if (form.department) fetchDoctors(form.department); });
    // Feature 1 — Emergency broadcast listener
    socket.on('emergency_alert', (data) => { setEmergencyAlert(data.message); });
    socket.on('appointment_on_hold', (data) => {
      setInfoMsg(data.message);
      setTimeout(() => setInfoMsg(''), 8000);
    });
    socket.on('appointment_resumed', (data) => {
      setInfoMsg(data.message);
      fetchMyAppointments();
      setTimeout(() => setInfoMsg(''), 8000);
    });
    // Feature 5 — Auto-escalation notification
    socket.on('priority_escalated', (data) => { fetchMyAppointments(); });
    socket.on('step_away_expired', (data) => {
      setInfoMsg(`⚠️ ${data.message}`);
      fetchMyAppointments();
      setTimeout(() => setInfoMsg(''), 8000);
    });
    return () => {
      socket.off('queue_updated', fetchMyAppointments);
      socket.off('doctor_updated');
      socket.off('emergency_alert');
      socket.off('appointment_on_hold');
      socket.off('appointment_resumed');
      socket.off('step_away_expired');
      socket.off('priority_escalated');
    };
  }, [fetchMyAppointments, form.department]);

  const fetchDoctors = async (dept) => {
    try {
      const res = await api.get(`/admin/doctors/by-department/${dept}`);
      setDoctors(res.data.data.doctors);
    } catch { setDoctors([]); }
  };

  const handleDeptChange = (dept) => {
    setForm({ ...form, department: dept, doctorId: '' });
    setDoctors([]);
    if (dept) fetchDoctors(dept);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const errors = validateAppointmentForm(form);
    if (errors.length > 0) { setError(errors[0]); setLoading(false); return; }
    try {
      let res;
      if (form.autoAssign) {
        // Feature 10 — auto assign to least busy doctor
        res = await api.post('/appointments/auto-assign', {
          department: form.department,
          priority: Number(form.priority),
          priorityReason: form.priorityReason,
          symptoms: form.symptoms,
        });
      } else {
        res = await api.post('/appointments/register', {
          doctorId: form.doctorId, department: form.department,
          priority: Number(form.priority), priorityReason: form.priorityReason, symptoms: form.symptoms,
        });
      }
      setForm({ doctorId: '', department: '', priority: 3, priorityReason: '', symptoms: '', autoAssign: false });
      setDoctors([]);
      setShowForm(false);
      socket.emit('join_department', form.department);
      fetchMyAppointments();
      fetchDeptLoads();
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setCancelLoading(confirmCancel);
    setConfirmCancel(null);
    try {
      await api.patch(`/appointments/${confirmCancel}/cancel`);
      fetchMyAppointments(); fetchDeptLoads();
    } catch (err) { setError(err.response?.data?.message || 'Cancellation failed.'); }
    finally { setCancelLoading(null); }
  };

  const handleCopyLink = (tokenNumber) => {
    const url = `${window.location.origin}/track/${tokenNumber}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  // Patient notifies doctor they are back — goes through backend for rate limiting
  const handleNotifyReturn = async (appt) => {
    try {
      await api.post(`/appointments/${appt._id}/notify-return`);
      setNotifiedReturn(prev => ({ ...prev, [appt._id]: true }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to notify doctor.');
    }
  };

  // Patient steps away — pauses own position
  const handleStepAway = async (appt) => {
    setStepAwayLoading(appt._id);
    try {
      const res = await api.patch(`/appointments/${appt._id}/pause`);
      setStepAwayInfo(prev => ({ ...prev, [appt._id]: res.data.data?.stepAwaysRemaining }));
      fetchMyAppointments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to step away.');
    } finally { setStepAwayLoading(null); }
  };

  const handleRate = async (appointmentId, rating) => {
    try {
      await api.post(`/appointments/${appointmentId}/rate`, { rating });
      setRatedAppts(prev => ({ ...prev, [appointmentId]: rating }));
    } catch (err) { setError(err.response?.data?.message || 'Rating failed.'); }
  };

  // Feature 3 — Estimated completion time
  const getEstimatedTime = (estimatedWaitMinutes) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + (estimatedWaitMinutes || 0));
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeAppts = myAppointments.filter(a => ['WAITING', 'IN_CONSULTATION', 'ON_HOLD'].includes(a.status));
  const pastAppts   = myAppointments.filter(a => ['DONE', 'NO_SHOW', 'CANCELLED'].includes(a.status));
  // ON_HOLD appointments don't block new bookings in other departments
  const hasActive = activeAppts.some(a => ['WAITING', 'IN_CONSULTATION'].includes(a.status));
  const activeDeptAppts = activeAppts.reduce((acc, a) => { acc[a.department] = a; return acc; }, {});

  // Feature 4 — Department busy indicator
  const getBusyLabel = (count) => {
    if (count === 0) return { label: 'Available', color: '#16a34a', bg: '#f0fdf4' };
    if (count <= 5)  return { label: `${count} waiting`, color: '#d97706', bg: '#fffbeb' };
    return { label: `${count} waiting — Busy`, color: '#dc2626', bg: '#fff1f2' };
  };

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Patient Portal</h1>
          <p style={S.pageSub}>Welcome back, <strong>{user.name}</strong></p>
        </div>
        {hasActive ? (
          <div style={S.disabledBox}>
            <div style={S.disabledIcon}>🔒</div>
            <div>
              <div style={S.disabledTitle}>Active appointment exists</div>
              <div style={S.disabledSub}>Cancel current to book new</div>
            </div>
          </div>
        ) : (
          <button style={{ ...S.newBtn, background: showForm ? '#64748b' : 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
            onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : '+ New Appointment'}
          </button>
        )}
      </div>

      {/* Feature 1 — Emergency alert banner */}
      {emergencyAlert && (
        <div style={S.emergencyBanner}>
          🚨 {emergencyAlert}
        </div>
      )}

      {error && <div style={S.errorBanner}><span>⚠</span> {error}</div>}

      {/* Active appointments */}
      {activeAppts.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionTitle}>Active Queue</div>
            <div style={S.liveBadge}><span style={S.liveDot} /> Live</div>
          </div>
          {activeAppts.map(appt => {
            const p = PRIORITY[appt.priority];
            const s = STATUS[appt.status] || STATUS.WAITING;
            const patientsAhead = Math.max((appt.queuePosition || 1) - 1, 0);
            const trackUrl = `${window.location.origin}/track/${appt.tokenNumber}`;
            return (
              <div key={appt._id} style={{ ...S.activeCard, borderColor: p.border }}>
                <div style={{ ...S.activeCardHeader, background: p.light }}>
                  <div style={S.tokenArea}>
                    <div style={S.tokenNum}>{appt.tokenNumber}</div>
                    <div style={S.tokenMeta}>
                      <span style={S.metaItem}>🏥 {appt.department}</span>
                      <span style={S.metaDot}>·</span>
                      <span style={S.metaItem}>👨‍⚕️ Dr. {appt.doctor?.name}</span>
                    </div>
                  </div>
                  <div style={S.badgeRow}>
                    <span style={{ ...S.badge, background: p.color }}>{p.dot} {p.label}</span>
                    <span style={{ ...S.badge, background: s.bg }}>{s.label}</span>
                  </div>
                </div>

                {appt.status === 'WAITING' && (
                  <div style={S.activeCardBody}>
                    <div style={S.statsRow}>
                      <div style={S.stat}>
                        <div style={S.statNum}>#{appt.queuePosition || '—'}</div>
                        <div style={S.statLabel}>Position</div>
                      </div>
                      <div style={S.statDivider} />
                      <div style={S.stat}>
                        <div style={S.statNum}>{patientsAhead}</div>
                        <div style={S.statLabel}>Ahead</div>
                      </div>
                      <div style={S.statDivider} />
                      <div style={S.stat}>
                        <div style={S.statNum}>{appt.estimatedWait ?? 0} min</div>
                        <div style={S.statLabel}>Est. Wait</div>
                      </div>
                      <div style={S.statDivider} />
                      {/* Feature 3 — Estimated completion time */}
                      <div style={S.stat}>
                        <div style={{ ...S.statNum, fontSize: '16px' }}>{getEstimatedTime(appt.estimatedWait)}</div>
                        <div style={S.statLabel}>Your Turn</div>
                      </div>
                    </div>

                    <div style={S.actionRow}>
                      <button style={S.cancelBtn} disabled={cancelLoading === appt._id} onClick={() => setConfirmCancel(appt._id)}>
                        {cancelLoading === appt._id ? 'Cancelling...' : '✕ Cancel'}
                      </button>
                      <button style={{ ...S.shareBtn, background: copied ? '#f0fdf4' : '#fff', color: copied ? '#16a34a' : '#1d4ed8', borderColor: copied ? '#86efac' : '#bfdbfe' }}
                        onClick={() => handleCopyLink(appt.tokenNumber)}>
                        {copied ? '✅ Copied!' : '📤 Share Link'}
                      </button>
                      {/* Feature 11 — QR Code */}
                      {/* Step Away — only when WAITING and in top 3 */}
                      {appt.queuePosition <= 3 && (
                        <button
                          style={{
                            ...S.stepAwayBtn,
                            opacity: appt.stepAwayCount >= 2 ? 0.4 : 1,
                            cursor: appt.stepAwayCount >= 2 ? 'not-allowed' : 'pointer',
                          }}
                          disabled={appt.stepAwayCount >= 2 || stepAwayLoading === appt._id}
                          onClick={() => handleStepAway(appt)}
                          title={appt.stepAwayCount >= 2 ? 'Step away limit reached (2/2)' : 'Temporarily pause your position'}>
                          {stepAwayLoading === appt._id ? '...' : `🔄 Step Away${appt.stepAwayCount > 0 ? ` (${2 - appt.stepAwayCount} left)` : ''}`}
                        </button>
                      )}
                      <button style={S.qrBtn} onClick={() => setShowQR(showQR === appt._id ? null : appt._id)}>
                        {showQR === appt._id ? '✕ QR' : '📱 QR Code'}
                      </button>
                    </div>

                    {showQR === appt._id && (
                      <div style={S.qrBox}>
                        <QRCode value={trackUrl} size={120} />
                        <div style={S.qrText}>Scan to track your queue position</div>
                      </div>
                    )}
                  </div>
                )}

                {appt.status === 'IN_CONSULTATION' && (
                  <div style={S.inConsultRow}>🩺 You are currently with the doctor</div>
                )}

                {appt.status === 'ON_HOLD' && appt.onHoldAtDepartment && (
                  <div style={{ ...S.inConsultRow, background: '#f5f3ff', color: '#7c3aed', borderTop: '1px solid #ddd6fe' }}>
                    ⏸ Your appointment is on hold — you are in consultation at <strong>{appt.onHoldAtDepartment}</strong>. Your position is preserved and will resume automatically when done.
                  </div>
                )}

                {appt.status === 'ON_HOLD' && !appt.onHoldAtDepartment && (
                  <div style={{ ...S.inConsultRow, background: '#fff7ed', color: '#c2410c', borderTop: '1px solid #fed7aa' }}>
                    <div style={{ marginBottom: '10px' }}>
                      ⏭ You were skipped — your position is paused. Return to the waiting area and notify the doctor.
                    </div>
                    {notifiedReturn[appt._id] ? (
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>
                        ✅ Doctor has been notified — please wait to be called
                      </div>
                    ) : (
                      <button
                        style={{ padding: '8px 18px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => handleNotifyReturn(appt)}>
                        🔔 I'm back — notify doctor
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Registration form */}
      {showForm && !hasActive && (
        <div style={S.formCard}>
          <div style={S.formHeader}>
            <div style={S.formTitle}>New Appointment</div>
            <div style={S.formSub}>Fill in the details below to join the queue</div>
          </div>
          <form onSubmit={handleRegister}>
            <div style={S.formFieldFull}>
              <label style={S.label}>Department</label>
              {/* Feature 4 — Department busy indicator */}
              <div style={S.deptGrid}>
                {DEPARTMENTS.map(d => {
                  const busy = getBusyLabel(deptLoads[d] || 0);
                  return (
                    <div key={d}
                      style={{ ...S.deptOption, ...(form.department === d ? S.deptSelected : {}), borderColor: form.department === d ? '#1d4ed8' : '#e2e8f0' }}
                      onClick={() => handleDeptChange(d)}>
                      <div style={S.deptOptionName}>{d}</div>
                      <div style={{ ...S.deptBusy, background: busy.bg, color: busy.color }}>{busy.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {form.department && (
              <>
                {/* Feature 10 — Auto-assign toggle */}
                <div style={S.formFieldFull}>
                  <div style={S.autoAssignRow}>
                    <div>
                      <div style={S.autoAssignLabel}>Auto-assign to least busy doctor</div>
                      <div style={S.autoAssignSub}>System picks the doctor with fewest patients</div>
                    </div>
                    <div onClick={() => setForm({ ...form, autoAssign: !form.autoAssign, doctorId: '' })}
                      style={{ width: '44px', height: '24px', borderRadius: '12px', background: form.autoAssign ? '#16a34a' : '#cbd5e1', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'transform 0.2s', transform: form.autoAssign ? 'translateX(22px)' : 'translateX(2px)' }} />
                    </div>
                  </div>
                </div>

                {!form.autoAssign && (
                  <div style={S.formField}>
                    <label style={S.label}>Doctor</label>
                    <select style={S.select} value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} required>
                      <option value="">{doctors.length === 0 ? 'No doctors available' : 'Select Doctor'}</option>
                      {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <div style={S.formFieldFull}>
              <label style={S.label}>Priority Level</label>
              <div style={S.priorityGrid}>
                {PRIORITY_OPTIONS.map(p => (
                  <div key={p.value}
                    style={{ ...S.priorityCard, ...(Number(form.priority) === p.value ? S.priorityCardSelected : {}) }}
                    onClick={() => setForm({ ...form, priority: p.value })}>
                    <div style={S.priorityLabel}>{p.label}</div>
                    <div style={S.prioritySub}>{p.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {form.priority !== 3 && (
              <div style={S.formFieldFull}>
                <label style={S.label}>Priority Reason <span style={{ color: '#94a3b8', fontWeight: '400', textTransform: 'none' }}>(optional)</span></label>
                <input style={S.input} type="text" placeholder="e.g. Senior Citizen, Pregnant"
                  value={form.priorityReason} onChange={e => setForm({ ...form, priorityReason: e.target.value })} />
              </div>
            )}

            <div style={S.formFieldFull}>
              <label style={S.label}>Symptoms <span style={{ color: '#94a3b8', fontWeight: '400', textTransform: 'none' }}>(optional)</span></label>
              <textarea style={{ ...S.input, height: '80px', resize: 'vertical' }}
                value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })}
                placeholder="Briefly describe your symptoms..." />
            </div>

            <button style={{ ...S.submitBtn, opacity: loading ? 0.75 : 1 }} type="submit" disabled={loading}>
              {loading ? 'Registering...' : form.autoAssign ? '🎫 Auto-Assign & Get Token' : '🎫 Get My Token'}
            </button>
          </form>
        </div>
      )}

      {activeAppts.length === 0 && !showForm && (
        <div style={S.emptyState}>
          <div style={S.emptyEmoji}>🏥</div>
          <div style={S.emptyTitle}>No active appointments</div>
          <div style={S.emptySub}>Click "New Appointment" to join a queue and get your token</div>
        </div>
      )}

      {/* Past appointments with rating */}
      {pastAppts.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Past Appointments</div>
          <div style={S.pastTable}>
            <div style={S.pastTableHead}>
              <span>Token</span><span>Department</span><span>Doctor</span><span>Status</span><span>Rate</span>
            </div>
            {pastAppts.map(appt => {
              const p = PRIORITY[appt.priority];
              const s = STATUS[appt.status] || {};
              const alreadyRated = appt.patientRating || ratedAppts[appt._id];
              return (
                <div key={appt._id} style={S.pastRow}>
                  <span style={S.pastToken}>{p.dot} {appt.tokenNumber}</span>
                  <span style={S.pastCell}>{appt.department}</span>
                  <span style={S.pastCell}>Dr. {appt.doctor?.name}</span>
                  <span style={{ ...S.pastBadge, background: s.bg + '20', color: s.bg }}>{s.label}</span>
                  {/* Feature 8 — Rating */}
                  <span>
                    {appt.status === 'DONE' ? (
                      alreadyRated ? (
                        <span style={{ fontSize: '13px', color: '#f59e0b' }}>{'⭐'.repeat(alreadyRated)}</span>
                      ) : (
                        <StarRating onRate={(r) => handleRate(appt._id, r)} />
                      )
                    ) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      {confirmCancel && (
        <div style={S.overlay}>
          <div style={S.dialog}>
            <div style={S.dialogEmoji}>⚠️</div>
            <div style={S.dialogTitle}>Cancel Appointment?</div>
            <div style={S.dialogText}>You will lose your queue position. This cannot be undone.</div>
            <div style={S.dialogBtns}>
              <button style={S.dialogBtnNo} onClick={() => setConfirmCancel(null)}>Keep It</button>
              <button style={S.dialogBtnYes} onClick={handleCancel}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const S = {
  page:           { maxWidth: '860px', margin: '0 auto', padding: '32px 24px' },
  pageHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' },
  pageTitle:      { fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' },
  pageSub:        { fontSize: '14px', color: '#64748b', marginTop: '4px' },
  newBtn:         { padding: '10px 20px', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,78,216,0.25)' },
  disabledBox:    { display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px' },
  disabledIcon:   { fontSize: '20px' },
  disabledTitle:  { fontSize: '13px', fontWeight: '600', color: '#dc2626' },
  disabledSub:    { fontSize: '12px', color: '#f87171', marginTop: '1px' },
  emergencyBanner:{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', fontWeight: '600', color: '#dc2626', animation: 'pulse 1s ease-in-out' },
  errorBanner:    { display: 'flex', alignItems: 'center', gap: '10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', fontWeight: '500' },
  section:        { marginBottom: '28px' },
  sectionHeader:  { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  sectionTitle:   { fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' },
  liveBadge:      { display: 'flex', alignItems: 'center', gap: '5px', background: '#fef2f2', color: '#dc2626', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  liveDot:        { width: '5px', height: '5px', borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1.5s infinite' },
  activeCard:     { background: '#fff', border: '1.5px solid', borderRadius: '14px', overflow: 'hidden', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  activeCardHeader:{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' },
  tokenArea:      {},
  tokenNum:       { fontSize: '28px', fontWeight: '900', color: '#0f172a', letterSpacing: '1px', marginBottom: '6px' },
  tokenMeta:      { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  metaItem:       { fontSize: '13px', color: '#475569' },
  metaDot:        { color: '#cbd5e1', fontSize: '13px' },
  badgeRow:       { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  badge:          { padding: '4px 12px', borderRadius: '20px', color: '#fff', fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px' },
  activeCardBody: { padding: '16px 20px', borderTop: '1px solid #f1f5f9' },
  statsRow:       { display: 'flex', background: '#f8fafc', borderRadius: '12px', padding: '14px 20px', marginBottom: '14px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' },
  stat:           { flex: 1, textAlign: 'center', minWidth: '60px' },
  statNum:        { fontSize: '22px', fontWeight: '800', color: '#0f172a' },
  statLabel:      { fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: '500' },
  statDivider:    { width: '1px', background: '#e2e8f0', alignSelf: 'stretch' },
  actionRow:      { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  cancelBtn:      { padding: '8px 16px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  shareBtn:       { padding: '8px 16px', border: '1px solid', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  qrBtn:          { padding: '8px 16px', background: '#fff', color: '#6366f1', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  stepAwayBtn:    { padding: '8px 16px', background: '#fff', color: '#f59e0b', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '13px', fontWeight: '500' },
  qrBox:          { marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' },
  qrText:         { fontSize: '12px', color: '#64748b' },
  inConsultRow:   { padding: '14px 20px', background: '#eff6ff', color: '#1d4ed8', fontWeight: '600', fontSize: '14px', borderTop: '1px solid #dbeafe' },
  formCard:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', marginBottom: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  formHeader:     { marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' },
  formTitle:      { fontSize: '17px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' },
  formSub:        { fontSize: '13px', color: '#94a3b8' },
  formField:      { marginBottom: '16px' },
  formFieldFull:  { marginBottom: '16px' },
  label:          { display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.6px' },
  select:         { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', color: '#0f172a' },
  input:          { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' },
  deptGrid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' },
  deptOption:     { padding: '10px 12px', border: '1.5px solid', borderRadius: '10px', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.15s' },
  deptSelected:   { background: '#eff6ff' },
  deptOptionName: { fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' },
  deptBusy:       { fontSize: '11px', padding: '2px 7px', borderRadius: '10px', fontWeight: '600', display: 'inline-block' },
  autoAssignRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' },
  autoAssignLabel:{ fontSize: '13px', fontWeight: '600', color: '#0f172a' },
  autoAssignSub:  { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  priorityGrid:   { display: 'flex', flexDirection: 'column', gap: '8px' },
  priorityCard:   { padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', background: '#f8fafc' },
  priorityCardSelected: { border: '1.5px solid #1d4ed8', background: '#eff6ff' },
  priorityLabel:  { fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '2px' },
  prioritySub:    { fontSize: '12px', color: '#94a3b8' },
  submitBtn:      { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,78,216,0.25)', marginTop: '4px' },
  emptyState:     { textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: '16px', border: '1.5px dashed #e2e8f0', marginBottom: '28px' },
  emptyEmoji:     { fontSize: '48px', marginBottom: '14px' },
  emptyTitle:     { fontSize: '17px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' },
  emptySub:       { fontSize: '14px', color: '#94a3b8', maxWidth: '300px', margin: '0 auto', lineHeight: 1.6 },
  pastTable:      { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' },
  pastTableHead:  { display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  pastRow:        { display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' },
  pastToken:      { fontSize: '14px', fontWeight: '700', color: '#0f172a' },
  pastCell:       { fontSize: '13px', color: '#64748b' },
  pastBadge:      { fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', width: 'fit-content' },
  overlay:        { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  dialog:         { background: '#fff', borderRadius: '20px', padding: '36px', maxWidth: '380px', width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', textAlign: 'center' },
  dialogEmoji:    { fontSize: '40px', marginBottom: '14px' },
  dialogTitle:    { fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', letterSpacing: '-0.3px' },
  dialogText:     { fontSize: '14px', color: '#64748b', marginBottom: '28px', lineHeight: 1.6 },
  dialogBtns:     { display: 'flex', gap: '10px' },
  dialogBtnNo:    { flex: 1, padding: '12px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  dialogBtnYes:   { flex: 1, padding: '12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' },
};

export default PatientDashboard;
