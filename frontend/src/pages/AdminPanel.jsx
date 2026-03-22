import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import socket from '../utils/socket';
import { validateDoctorForm, validatePatientForm } from '../utils/validate';

const DEPARTMENTS = ['General', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'ENT'];

const Toggle = ({ checked, onChange }) => (
  <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
    <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: checked ? '#16a34a' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'transform 0.2s', transform: checked ? 'translateX(20px)' : 'translateX(2px)' }} />
    </div>
  </div>
);

const AdminPanel = () => {
  const [tab, setTab]                 = useState('overview');
  const [summary, setSummary]         = useState([]);
  const [doctorLoad, setDoctorLoad]   = useState([]);
  const [peakHours, setPeakHours]     = useState([]);
  const [waitTime, setWaitTime]       = useState([]);
  const [ratings, setRatings]         = useState([]);
  const [doctors, setDoctors]         = useState([]);
  const [newDoctor, setNewDoctor]     = useState({ name: '', email: '', password: '', phone: '', department: '' });
  const [doctorMsg, setDoctorMsg]     = useState('');
  const [newPatient, setNewPatient]   = useState({ name: '', email: '', password: '', phone: '' });
  const [patientMsg, setPatientMsg]   = useState('');
  const [reassign, setReassign]       = useState({ fromDoctorId: '', toDoctorId: '', department: '' });
  const [reassignMsg, setReassignMsg] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [noShowRates, setNoShowRates]           = useState([]);

  useEffect(() => {
    fetchSummary(); fetchDoctors();
    DEPARTMENTS.forEach(d => socket.emit('join_department', d));
    socket.emit('join_admin');
    socket.on('queue_updated', fetchSummary);
    socket.on('doctor_updated', fetchDoctors);
    return () => {
      socket.off('queue_updated', fetchSummary);
      socket.off('doctor_updated', fetchDoctors);
    };
  }, []);

  useEffect(() => {
    if (tab === 'analytics') {
      setAnalyticsLoading(true);
      Promise.all([fetchDoctorLoad(), fetchPeakHours(), fetchWaitTime(), fetchRatings(), fetchNoShowRates()])
        .finally(() => setAnalyticsLoading(false));
    }
  }, [tab]);

  const fetchSummary    = async () => { try { const r = await api.get('/analytics/department-summary'); setSummary(r.data.data.departments); } catch {} };
  const fetchDoctors    = async () => { try { const r = await api.get('/admin/doctors'); setDoctors(r.data.data.doctors); } catch {} };
  const fetchDoctorLoad = async () => { try { const r = await api.get('/analytics/doctor-load'); setDoctorLoad(r.data.data.doctorLoad); } catch {} };
  const fetchPeakHours  = async () => { try { const r = await api.get('/analytics/peak-hours'); setPeakHours(r.data.data.peakHours); } catch {} };
  const fetchWaitTime   = async () => { try { const r = await api.get('/analytics/wait-time'); setWaitTime(r.data.data.analytics); } catch {} };
  const fetchRatings      = async () => { try { const r = await api.get('/analytics/doctor-ratings'); setRatings(r.data.data.ratings); } catch {} };
  const fetchNoShowRates  = async () => { try { const r = await api.get('/analytics/noshow-rate'); setNoShowRates(r.data.data.noShowRates); } catch {} };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    const errors = validateDoctorForm(newDoctor);
    if (errors.length > 0) { setDoctorMsg('❌ ' + errors[0]); return; }
    try {
      await api.post('/admin/doctors', newDoctor);
      setDoctorMsg('✅ Doctor account created');
      setNewDoctor({ name: '', email: '', password: '', phone: '', department: '' });
      fetchDoctors();
    } catch (err) { setDoctorMsg('❌ ' + (err.response?.data?.message || 'Failed')); }
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    const errors = validatePatientForm(newPatient);
    if (errors.length > 0) { setPatientMsg('❌ ' + errors[0]); return; }
    try {
      await api.post('/admin/patients', newPatient);
      setPatientMsg('✅ Patient account created');
      setNewPatient({ name: '', email: '', password: '', phone: '' });
    } catch (err) { setPatientMsg('❌ ' + (err.response?.data?.message || 'Failed')); }
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/appointments/reassign', reassign);
      setReassignMsg('✅ ' + res.data.message);
      setReassign({ fromDoctorId: '', toDoctorId: '', department: '' });
    } catch (err) { setReassignMsg('❌ ' + (err.response?.data?.message || 'Failed')); }
  };

  const toggleAvailability = async (id) => {
    setDoctors(prev => prev.map(d => d._id === id ? { ...d, isAvailable: !d.isAvailable } : d));
    try {
      const res = await api.patch(`/admin/doctors/${id}/availability`);
      // Show reassign message if patients were auto-reassigned
      if (res.data.data?.patientsReassigned > 0) {
        setReassignMsg('✅ ' + res.data.message);
      }
    } catch { fetchDoctors(); }
  };

  const maxPeak = Math.max(...peakHours.map(h => h.count), 1);

  const TABS = [
    { key: 'overview',  label: 'Overview',  icon: '📊' },
    { key: 'analytics', label: 'Analytics', icon: '📈' },
    { key: 'manage',    label: 'Manage',    icon: '👥' },
  ];

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Admin Panel</h1>
          <p style={S.pageSub}>Hospital management & real-time analytics</p>
        </div>
        <div style={S.liveBadge}><span style={S.liveDot} /> Live</div>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.key} style={{ ...S.tabBtn, ...(tab === t.key ? S.tabActive : {}) }} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div style={S.legendRow}>
            {[['🔴','P1 Emergency','#fff1f2','#dc2626'],['🟡','P2 Priority','#fffbeb','#d97706'],['🟢','P3 Normal','#f0fdf4','#16a34a']].map(([dot,label,bg,color]) => (
              <span key={label} style={{ ...S.legendChip, background: bg, color }}>{dot} {label}</span>
            ))}
          </div>
          {summary.length === 0 ? (
            <div style={S.emptyCard}>No appointments today yet.</div>
          ) : (
            <div style={S.deptGrid}>
              {summary.map(dept => (
                <div key={dept._id} style={S.deptCard}>
                  <div style={S.deptName}>{dept._id}</div>
                  <div style={S.pBuckets}>
                    {[['#fff1f2','#dc2626',dept.p1Count||0,'🔴 P1'],['#fffbeb','#d97706',dept.p2Count||0,'🟡 P2'],['#f0fdf4','#16a34a',dept.p3Count||0,'🟢 P3']].map(([bg,color,count,label]) => (
                      <div key={label} style={{ ...S.pBucket, background: bg }}>
                        <div style={{ ...S.pNum, color }}>{count}</div>
                        <div style={S.pLabel}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <a href={`/display/${dept._id}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', marginBottom: '10px', fontSize: '12px', color: '#1d4ed8', fontWeight: '600', textDecoration: 'none', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    📺 Open Display
                  </a>
                  <div style={S.deptStatusRow}>
                    <span><b style={{ color: '#f59e0b' }}>{dept.currentlyWaiting}</b> waiting</span>
                    <span><b style={{ color: '#2563eb' }}>{dept.inConsultation}</b> in consult</span>
                    <span><b style={{ color: '#16a34a' }}>{dept.done}</b> done</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {tab === 'analytics' && (
        <div style={{ position: 'relative' }}>
          {analyticsLoading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>⏳ Loading analytics...</div>
            </div>
          )}
          {/* Summary stat cards */}
          <div style={S.statCards}>
            <div style={S.statCard2}>
              <div style={S.statCard2Icon}>👥</div>
              <div style={S.statCard2Num}>{doctorLoad.reduce((a, d) => a + d.total, 0)}</div>
              <div style={S.statCard2Label}>Total Patients Today</div>
            </div>
            <div style={S.statCard2}>
              <div style={S.statCard2Icon}>✅</div>
              <div style={{ ...S.statCard2Num, color: '#16a34a' }}>{doctorLoad.reduce((a, d) => a + d.done, 0)}</div>
              <div style={S.statCard2Label}>Consultations Done</div>
            </div>
            <div style={S.statCard2}>
              <div style={S.statCard2Icon}>⏳</div>
              <div style={{ ...S.statCard2Num, color: '#f59e0b' }}>{doctorLoad.reduce((a, d) => a + d.waiting, 0)}</div>
              <div style={S.statCard2Label}>Currently Waiting</div>
            </div>
            <div style={S.statCard2}>
              <div style={S.statCard2Icon}>⭐</div>
              <div style={{ ...S.statCard2Num, color: '#f59e0b' }}>
                {ratings.length > 0 ? (ratings.reduce((a, r) => a + r.avgRating, 0) / ratings.length).toFixed(1) : '—'}
              </div>
              <div style={S.statCard2Label}>Avg Doctor Rating</div>
            </div>
            <div style={S.statCard2}>
              <div style={S.statCard2Icon}>🔴</div>
              <div style={{ ...S.statCard2Num, color: '#dc2626' }}>{doctorLoad.reduce((a, d) => a + (d.emergencies || 0), 0)}</div>
              <div style={S.statCard2Label}>Emergencies Today</div>
            </div>
          </div>

          {/* Doctor Load */}
          <div style={S.sectionTitle}>Doctor Load — Today</div>
          <div style={S.analyticsGrid}>
            {doctorLoad.length === 0 ? (
              <div style={{ ...S.emptyCard, gridColumn: '1 / -1' }}>No data yet</div>
            ) : doctorLoad.map(d => {
              const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
              return (
                <div key={d._id} style={S.doctorLoadCard}>
                  <div style={S.doctorLoadTop}>
                    <div style={S.doctorLoadAvatar}>{d.doctorName?.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={S.doctorLoadName}>Dr. {d.doctorName}</div>
                      <div style={S.doctorLoadDept}>{d.department}</div>
                    </div>
                    <div style={{ ...S.availDot, background: d.isAvailable ? '#16a34a' : '#dc2626' }} title={d.isAvailable ? 'Available' : 'Unavailable'} />
                  </div>
                  <div style={S.loadBar}>
                    <div style={{ ...S.loadBarFill, width: `${pct}%` }} />
                  </div>
                  <div style={S.doctorLoadStats}>
                    <span style={{ color: '#0f172a', fontWeight: '700' }}>{d.total} total</span>
                    <span style={{ color: '#16a34a' }}>✓ {d.done}</span>
                    <span style={{ color: '#f59e0b' }}>⏳ {d.waiting}</span>
                    <span style={{ color: '#dc2626' }}>✗ {d.noShow}</span>
                    {d.avgConsultationMinutes > 0 && <span style={{ color: '#64748b' }}>⏱ {d.avgConsultationMinutes}min</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wait Time */}
          <div style={{ ...S.sectionTitle, marginTop: '28px' }}>Average Wait Time by Department</div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>{['Department','Avg Wait','Avg Consult','🔴 P1','🟡 P2','🟢 P3','Patients'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {waitTime.length === 0
                  ? <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '28px' }}>No completed appointments yet</td></tr>
                  : waitTime.map(w => {
                    const waitColor = w.avgWaitMinutes < 10 ? '#16a34a' : w.avgWaitMinutes < 20 ? '#d97706' : '#dc2626';
                    return (
                      <tr key={w.department}>
                        <td style={S.td}><strong>{w.department}</strong></td>
                        <td style={{ ...S.td, fontWeight: '800', color: waitColor }}>{w.avgWaitMinutes} min</td>
                        <td style={S.td}>{w.avgConsultationMinutes} min</td>
                        <td style={{ ...S.td, color: '#dc2626', fontWeight: '600' }}>{w.avgWaitByPriority?.P1_Emergency ?? '—'} min</td>
                        <td style={{ ...S.td, color: '#d97706', fontWeight: '600' }}>{w.avgWaitByPriority?.P2_Priority ?? '—'} min</td>
                        <td style={{ ...S.td, color: '#16a34a', fontWeight: '600' }}>{w.avgWaitByPriority?.P3_Normal ?? '—'} min</td>
                        <td style={S.td}>{w.totalPatientsSeen}</td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
            {waitTime.length > 0 && (
              <div style={{ padding: '8px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#94a3b8' }}>
                🟢 &lt;10 min — good &nbsp;|&nbsp; 🟡 10–20 min — moderate &nbsp;|&nbsp; 🔴 &gt;20 min — high
              </div>
            )}
          </div>

          {/* Doctor Ratings */}
          <div style={{ ...S.sectionTitle, marginTop: '28px' }}>Doctor Ratings</div>
          {ratings.length === 0 ? (
            <div style={S.emptyCard}>No ratings yet — patients can rate after consultation</div>
          ) : (
            <div style={S.ratingsGrid}>
              {ratings.map(r => (
                <div key={r._id} style={S.ratingCard}>
                  <div style={S.ratingTop}>
                    <div style={S.ratingAvatar}>{r.doctorName?.charAt(0)}</div>
                    <div>
                      <div style={S.ratingName}>Dr. {r.doctorName}</div>
                      <div style={S.ratingDept}>{r.department}</div>
                    </div>
                    <div style={S.ratingScore}>
                      <div style={S.ratingNum}>{r.avgRating}</div>
                      <div style={S.ratingStars}>{'⭐'.repeat(Math.round(r.avgRating))}</div>
                      <div style={S.ratingTotal}>{r.totalRatings} reviews</div>
                    </div>
                  </div>
                  <div style={S.ratingBars}>
                    {[5,4,3,2,1].map(star => {
                      const count = r.distribution?.[star] || 0;
                      const pct = r.totalRatings > 0 ? Math.round((count / r.totalRatings) * 100) : 0;
                      return (
                        <div key={star} style={S.ratingBarRow}>
                          <span style={S.ratingBarLabel}>{star}★</span>
                          <div style={S.ratingBarBg}>
                            <div style={{ ...S.ratingBarFill, width: `${pct}%`, background: star >= 4 ? '#16a34a' : star === 3 ? '#f59e0b' : '#dc2626' }} />
                          </div>
                          <span style={S.ratingBarCount}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Peak Hours */}
          <div style={{ ...S.sectionTitle, marginTop: '28px' }}>
            Peak Hours
            {peakHours.length > 0 && (
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', marginLeft: '8px' }}>
                Peak: {peakHours.reduce((m, h) => h.count > m.count ? h : m, { count: 0 }).hour}:00 ({peakHours.reduce((m, h) => h.count > m.count ? h : m, { count: 0 }).count} patients)
              </span>
            )}
          </div>
          <div style={S.peakCard}>
            {peakHours.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px', fontSize: '14px' }}>No data yet</div>
            ) : (
              <div style={S.peakChart}>
                {peakHours.map(h => {
                  const isPeak = h.count === maxPeak;
                  return (
                    <div key={h.hour} style={S.peakCol}>
                      <div style={{ ...S.peakCount, color: isPeak ? '#dc2626' : '#374151', fontWeight: isPeak ? '800' : '700' }}>{h.count}</div>
                      <div style={{ ...S.peakBar, height: `${Math.max(Math.round((h.count / maxPeak) * 100), 4)}px`, background: isPeak ? 'linear-gradient(180deg, #dc2626, #f87171)' : 'linear-gradient(180deg, #1d4ed8, #60a5fa)' }} />
                      <div style={{ ...S.peakLabel, color: isPeak ? '#dc2626' : '#94a3b8', fontWeight: isPeak ? '700' : '400' }}>{h.hour}h</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MANAGE ── */}
      {tab === 'manage' && (
        <div style={S.manageLayout}>
          <div>
            <div style={S.formCard}>
              <div style={S.formCardTitle}>Create Patient Account</div>
              {patientMsg && <div style={patientMsg.startsWith('✅') ? S.successMsg : S.errorMsg}>{patientMsg}</div>}
              <form onSubmit={handleCreatePatient}>
                {[['Full Name','name','text'],['Email','email','email'],['Password','password','password'],['Phone','phone','tel']].map(([lbl,key,type]) => (
                  <div key={key} style={S.field}>
                    <label style={S.label}>{lbl}</label>
                    <input style={S.input} type={type} value={newPatient[key]}
                      onChange={e => setNewPatient({ ...newPatient, [key]: e.target.value })}
                      required={key !== 'phone'} />
                  </div>
                ))}
                <button style={S.submitBtn} type="submit">Create Patient</button>
              </form>
            </div>

            <div style={S.formCard}>
              <div style={S.formCardTitle}>Create Doctor Account</div>
              {doctorMsg && <div style={doctorMsg.startsWith('✅') ? S.successMsg : S.errorMsg}>{doctorMsg}</div>}
              <form onSubmit={handleCreateDoctor}>
                {[['Full Name','name','text'],['Email','email','email'],['Password','password','password'],['Phone','phone','tel']].map(([lbl,key,type]) => (
                  <div key={key} style={S.field}>
                    <label style={S.label}>{lbl}</label>
                    <input style={S.input} type={type} value={newDoctor[key]}
                      onChange={e => setNewDoctor({ ...newDoctor, [key]: e.target.value })}
                      required={key !== 'phone'} />
                  </div>
                ))}
                <div style={S.field}>
                  <label style={S.label}>Department</label>
                  <select style={S.input} value={newDoctor.department}
                    onChange={e => setNewDoctor({ ...newDoctor, department: e.target.value })} required>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button style={S.submitBtn} type="submit">Create Doctor</button>
              </form>
            </div>

            <div style={S.formCard}>
              <div style={S.formCardTitle}>Reassign Patients</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
                Manually move WAITING patients from one doctor to another. Note: This happens automatically when a doctor goes unavailable.
              </div>
              {reassignMsg && <div style={reassignMsg.startsWith('✅') ? S.successMsg : S.errorMsg}>{reassignMsg}</div>}
              <form onSubmit={handleReassign}>
                <div style={S.field}>
                  <label style={S.label}>Department</label>
                  <select style={S.input} value={reassign.department}
                    onChange={e => setReassign({ ...reassign, department: e.target.value })} required>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>From Doctor</label>
                  <select style={S.input} value={reassign.fromDoctorId}
                    onChange={e => setReassign({ ...reassign, fromDoctorId: e.target.value })} required>
                    <option value="">Select doctor</option>
                    {doctors.filter(d => !reassign.department || d.department === reassign.department).map(d => (
                      <option key={d._id} value={d._id}>Dr. {d.name}</option>
                    ))}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>To Doctor</label>
                  <select style={S.input} value={reassign.toDoctorId}
                    onChange={e => setReassign({ ...reassign, toDoctorId: e.target.value })} required>
                    <option value="">Select doctor</option>
                    {doctors.filter(d => d._id !== reassign.fromDoctorId && (!reassign.department || d.department === reassign.department)).map(d => (
                      <option key={d._id} value={d._id}>Dr. {d.name}</option>
                    ))}
                  </select>
                </div>
                <button style={{ ...S.submitBtn, background: 'linear-gradient(135deg, #d97706, #f59e0b)' }} type="submit">
                  Reassign Patients
                </button>
              </form>
            </div>
          </div>

          <div style={S.manageRight}>
            <div style={S.formCardTitle}>All Doctors</div>
            {doctors.map(d => (
              <div key={d._id} style={S.doctorCard}>
                <div style={S.doctorAvatar}>{d.name.charAt(0).toUpperCase()}</div>
                <div style={S.doctorInfo}>
                  <div style={S.doctorName}>Dr. {d.name}</div>
                  <div style={S.doctorDept}>{d.department}</div>
                  <div style={S.doctorEmail}>{d.email}</div>
                </div>
                <div style={S.doctorRight}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: d.isAvailable ? '#16a34a' : '#dc2626', marginBottom: '6px' }}>
                    {d.isAvailable ? '● Available' : '● Unavailable'}
                  </div>
                  <Toggle checked={d.isAvailable} onChange={() => toggleAvailability(d._id)} />
                </div>
              </div>
            ))}
            {doctors.length === 0 && <div style={S.emptyCard}>No doctors yet</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const S = {
  page:           { maxWidth: '1060px', margin: '0 auto', padding: '32px 24px' },
  pageHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' },
  pageTitle:      { fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' },
  pageSub:        { fontSize: '14px', color: '#64748b', marginTop: '4px' },
  liveBadge:      { display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', color: '#dc2626', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: '1px solid #fecaca' },
  liveDot:        { width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1.5s infinite' },
  tabs:           { display: 'flex', gap: '8px', marginBottom: '28px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' },
  tabBtn:         { padding: '9px 22px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#64748b' },
  tabActive:      { background: '#1d4ed8', color: '#fff', border: '1px solid #1d4ed8', fontWeight: '600' },
  sectionTitle:   { fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center' },
  legendRow:      { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  legendChip:     { padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid transparent' },
  deptGrid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' },
  deptCard:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  deptName:       { fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' },
  pBuckets:       { display: 'flex', gap: '8px', marginBottom: '14px' },
  pBucket:        { flex: 1, borderRadius: '10px', padding: '10px 6px', textAlign: 'center' },
  pNum:           { fontSize: '22px', fontWeight: '800' },
  pLabel:         { fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: '500' },
  deptStatusRow:  { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' },
  tableWrap:      { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: '4px' },
  table:          { width: '100%', borderCollapse: 'collapse' },
  th:             { background: '#f8fafc', padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td:             { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#374151' },
  peakCard:       { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  peakChart:      { display: 'flex', gap: '6px', alignItems: 'flex-end', height: '120px' },
  peakCol:        { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 },
  peakCount:      { fontSize: '10px', marginBottom: '3px' },
  peakBar:        { width: '100%', borderRadius: '4px 4px 0 0', minHeight: '4px' },
  peakLabel:      { fontSize: '10px', marginTop: '4px' },
  manageLayout:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  manageRight:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', alignSelf: 'start' },
  formCard:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  formCardTitle:  { fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' },
  field:          { marginBottom: '14px' },
  label:          { display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input:          { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' },
  submitBtn:      { width: '100%', padding: '11px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,78,216,0.2)' },
  doctorCard:     { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  doctorAvatar:   { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #60a5fa)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px', flexShrink: 0 },
  doctorInfo:     { flex: 1 },
  doctorName:     { fontSize: '14px', fontWeight: '700', color: '#0f172a' },
  doctorDept:     { fontSize: '12px', color: '#64748b', marginTop: '1px' },
  doctorEmail:    { fontSize: '11px', color: '#94a3b8', marginTop: '1px' },
  doctorRight:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  successMsg:     { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', fontWeight: '500' },
  errorMsg:       { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', fontWeight: '500' },
  emptyCard:      { textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '14px' },

  // Analytics stat cards
  statCards:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' },
  statCard2:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  statCard2Icon:   { fontSize: '22px', marginBottom: '8px' },
  statCard2Num:    { fontSize: '28px', fontWeight: '900', color: '#0f172a', marginBottom: '4px' },
  statCard2Label:  { fontSize: '11px', color: '#94a3b8', fontWeight: '500' },

  // Doctor load cards
  analyticsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '4px' },
  doctorLoadCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  doctorLoadTop:   { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  doctorLoadAvatar:{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #60a5fa)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  doctorLoadName:  { fontSize: '14px', fontWeight: '700', color: '#0f172a' },
  doctorLoadDept:  { fontSize: '11px', color: '#94a3b8', marginTop: '1px' },
  availDot:        { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  loadBar:         { height: '6px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '10px', overflow: 'hidden' },
  loadBarFill:     { height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #60a5fa)', borderRadius: '4px' },
  doctorLoadStats: { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px' },

  // Ratings
  ratingsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '4px' },
  ratingCard:      { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  ratingTop:       { display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' },
  ratingAvatar:    { width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  ratingName:      { fontSize: '14px', fontWeight: '700', color: '#0f172a' },
  ratingDept:      { fontSize: '11px', color: '#94a3b8', marginTop: '1px' },
  ratingScore:     { marginLeft: 'auto', textAlign: 'right' },
  ratingNum:       { fontSize: '24px', fontWeight: '900', color: '#f59e0b' },
  ratingStars:     { fontSize: '12px', marginBottom: '2px' },
  ratingTotal:     { fontSize: '11px', color: '#94a3b8' },
  ratingBars:      { display: 'flex', flexDirection: 'column', gap: '5px' },
  ratingBarRow:    { display: 'flex', alignItems: 'center', gap: '8px' },
  ratingBarLabel:  { fontSize: '11px', color: '#64748b', minWidth: '20px', textAlign: 'right' },
  ratingBarBg:     { flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' },
  ratingBarFill:   { height: '100%', borderRadius: '4px' },
  ratingBarCount:  { fontSize: '11px', color: '#94a3b8', minWidth: '16px' },
};

export default AdminPanel;
