/**
 * SEED SCRIPT — Complete demo data for MediQueue
 *
 * Covers every feature:
 *   ✅ Priority queue  — P1/P2/P3 all in same doctor's queue
 *   ✅ Consultation timer — patient IN_CONSULTATION 8 min ago
 *   ✅ Auto-escalation — P3 patient 75+ min old
 *   ✅ ON_HOLD pre-seeded — Ravi IN_CONSULTATION in General, ON_HOLD in Neurology
 *   ✅ ON_HOLD live demo — Meena and Sita in 2 departments each
 *   ✅ Load balancing — 3 doctors in General, different loads
 *   ✅ Auto-reassign — Sunita has 3 WAITING, toggle unavailable → moves to Rahul
 *   ✅ Doctor ratings — multiple DONE with 1-5 star ratings
 *   ✅ Wait time analytics — all depts have DONE with real consultation times
 *   ✅ Peak hours — appointments spread across different hours
 *   ✅ NO_SHOW — at least 1 per major department
 *   ✅ Consultation notes — doctor notes on DONE appointments
 *   ✅ Emergency P1 — every department has at least one P1
 *   ✅ Waiting room display — every department has active queue
 *
 * Patient active appointment map (no conflicts):
 *   P[0]  Anil    — General WAITING only
 *   P[1]  Meena   — General WAITING + Cardiology WAITING (multi-dept demo)
 *   P[2]  Ravi    — General IN_CONSULTATION + Neurology ON_HOLD (ON_HOLD pre-seeded)
 *   P[3]  Sita    — General WAITING + ENT WAITING (multi-dept demo)
 *   P[4]  Karan   — Cardiology WAITING + Orthopedics WAITING (multi-dept demo)
 *   P[5]  Pooja   — Pediatrics WAITING only
 *   P[6]  Deepak  — Neurology WAITING only
 *   P[7]  Anjali  — ENT WAITING only
 *   P[8]  Suresh  — Orthopedics WAITING only
 *   P[9]  Lakshmi — Pediatrics WAITING only
 *   P[10] Harish  — General WAITING only (light load doctor)
 *   P[11] Rekha   — Cardiology WAITING only
 *
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Appointment = require('./models/Appointment');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital-queue';

const doctors = [
  // General — 3 doctors (for load balancing demo)
  { name: 'Ramesh Kumar',   email: 'ramesh@hospital.com',   password: 'doctor123', department: 'General',     phone: '+919876543201' },
  { name: 'Priya Sharma',   email: 'priya@hospital.com',    password: 'doctor123', department: 'General',     phone: '+919876543202' },
  { name: 'Nikhil Bose',    email: 'nikhil@hospital.com',   password: 'doctor123', department: 'General',     phone: '+919876543203' },
  // Cardiology — 2 doctors
  { name: 'Arjun Mehta',    email: 'arjun@hospital.com',    password: 'doctor123', department: 'Cardiology',  phone: '+919876543204' },
  { name: 'Divya Pillai',   email: 'divya@hospital.com',    password: 'doctor123', department: 'Cardiology',  phone: '+919876543205' },
  // Orthopedics — 2 doctors
  { name: 'Mohan Das',      email: 'mohan@hospital.com',    password: 'doctor123', department: 'Orthopedics', phone: '+919876543206' },
  { name: 'Sneha Kulkarni', email: 'sneha@hospital.com',    password: 'doctor123', department: 'Orthopedics', phone: '+919876543207' },
  // Neurology — 2 doctors (Sunita for auto-reassign demo)
  { name: 'Sunita Rao',     email: 'sunita@hospital.com',   password: 'doctor123', department: 'Neurology',   phone: '+919876543208' },
  { name: 'Rahul Menon',    email: 'rahul@hospital.com',    password: 'doctor123', department: 'Neurology',   phone: '+919876543209' },
  // Pediatrics — 2 doctors
  { name: 'Vikram Nair',    email: 'vikram@hospital.com',   password: 'doctor123', department: 'Pediatrics',  phone: '+919876543210' },
  { name: 'Ananya Ghosh',   email: 'ananya@hospital.com',   password: 'doctor123', department: 'Pediatrics',  phone: '+919876543211' },
  // ENT — 2 doctors
  { name: 'Kavya Reddy',    email: 'kavya@hospital.com',    password: 'doctor123', department: 'ENT',         phone: '+919876543212' },
  { name: 'Suresh Iyer',    email: 'suresh@hospital.com',   password: 'doctor123', department: 'ENT',         phone: '+919876543213' },
];

// D index map:
// General:     D[0]=Ramesh  D[1]=Priya   D[2]=Nikhil
// Cardiology:  D[3]=Arjun   D[4]=Divya
// Orthopedics: D[5]=Mohan   D[6]=Sneha
// Neurology:   D[7]=Sunita  D[8]=Rahul
// Pediatrics:  D[9]=Vikram  D[10]=Ananya
// ENT:         D[11]=Kavya  D[12]=Suresh

const patients = [
  { name: 'Anil Gupta',     email: 'anil@example.com',     password: 'patient123', phone: '+919876543221' }, // P[0]
  { name: 'Meena Joshi',    email: 'meena@example.com',    password: 'patient123', phone: '+919876543222' }, // P[1]
  { name: 'Ravi Patel',     email: 'ravi@example.com',     password: 'patient123', phone: '+919876543223' }, // P[2]
  { name: 'Sita Devi',      email: 'sita@example.com',     password: 'patient123', phone: '+919876543224' }, // P[3]
  { name: 'Karan Malhotra', email: 'karan@example.com',    password: 'patient123', phone: '+919876543225' }, // P[4]
  { name: 'Pooja Singh',    email: 'pooja@example.com',    password: 'patient123', phone: '+919876543226' }, // P[5]
  { name: 'Deepak Verma',   email: 'deepak@example.com',   password: 'patient123', phone: '+919876543227' }, // P[6]
  { name: 'Anjali Nair',    email: 'anjali@example.com',   password: 'patient123', phone: '+919876543228' }, // P[7]
  { name: 'Suresh Babu',    email: 'sureshb@example.com',  password: 'patient123', phone: '+919876543229' }, // P[8]
  { name: 'Lakshmi Iyer',   email: 'lakshmi@example.com',  password: 'patient123', phone: '+919876543230' }, // P[9]
  { name: 'Harish Nair',    email: 'harish@example.com',   password: 'patient123', phone: '+919876543231' }, // P[10]
  { name: 'Rekha Pillai',   email: 'rekha@example.com',    password: 'patient123', phone: '+919876543232' }, // P[11]
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    await User.deleteMany({});
    await Appointment.deleteMany({});
    await mongoose.connection.collection('counters').deleteMany({});
    console.log('🗑️  Cleared existing data');

    await User.create({
      name: 'Hospital Admin', email: 'admin@hospital.com',
      password: 'admin123', role: 'admin', phone: '+919876543200',
    });

    const D = await Promise.all(doctors.map(d => User.create({ ...d, role: 'doctor', isAvailable: true })));
    console.log(`👨‍⚕️  ${D.length} doctors created`);

    const P = await Promise.all(patients.map(p => User.create({ ...p, role: 'patient' })));
    console.log(`🧑‍🦽 ${P.length} patients created`);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const now = new Date();

    // Helper to build appointment data
    const a = (patient, doctor, dept, priority, status, opts = {}) => ({
      patient, doctor: doctor._id, department: dept,
      priority, status,
      priorityReason:        opts.reason   || '',
      symptoms:              opts.symptoms || '',
      appointmentDate:       today,
      createdAt:             opts.at       || now,
      consultationStartTime: opts.start    || null,
      consultationEndTime:   opts.end      || null,
      patientRating:         opts.rating   || null,
      doctorNotes:           opts.notes    || null,
      onHoldAtDepartment:    opts.onHoldAt || null,
      notifiedAt3: false, notifiedAt1: false,
    });

    const mins = (m) => new Date(now - m * 60000);

    const appointments = [

      // ═══════════════════════════════════════════════════════════════
      // GENERAL — Dr. Ramesh (D[0]) — heavy load
      // Features: P1/P2/P3 queue, consultation timer, auto-escalation
      // ═══════════════════════════════════════════════════════════════

      // P1 Emergency — will be #1 in queue
      a(P[0], D[0], 'General', 1, 'WAITING', {
        reason: 'Emergency — chest pain',
        symptoms: 'Severe chest pain, difficulty breathing',
        at: mins(5),
      }),
      // P2 Priority — will be #2
      a(P[1], D[0], 'General', 2, 'WAITING', {
        reason: 'Senior Citizen',
        symptoms: 'High fever, body ache',
        at: mins(20),
      }),
      // P3 IN_CONSULTATION — tests consultation timer (8 min ago)
      // P[2] Ravi is here so his Neurology appt is ON_HOLD
      a(P[2], D[0], 'General', 3, 'IN_CONSULTATION', {
        symptoms: 'Headache and nausea',
        start: mins(8),
      }),
      // P3 WAITING — will be #3
      a(P[3], D[0], 'General', 3, 'WAITING', {
        symptoms: 'Cold and cough',
        at: mins(30),
      }),
      // P3 WAITING — created 75 min ago — AUTO-ESCALATION to P2
      a(P[10], D[0], 'General', 3, 'WAITING', {
        symptoms: 'Back pain — will auto-escalate to P2 (75min old)',
        at: mins(75),
      }),
      // DONE — for analytics
      a(P[11], D[0], 'General', 3, 'DONE', {
        symptoms: 'Stomach infection',
        start: mins(150), end: mins(138),
        rating: 4,
        notes: 'Prescribed antibiotics. Review in 5 days.',
        at: mins(165),
      }),

      // Dr. Priya (D[1]) — medium load
      a(P[5], D[1], 'General', 2, 'WAITING', {
        reason: 'Pregnant',
        symptoms: 'Nausea and dizziness',
        at: mins(15),
      }),
      a(P[6], D[1], 'General', 3, 'WAITING', {
        symptoms: 'Fatigue and weakness',
        at: mins(22),
      }),
      a(P[7], D[1], 'General', 3, 'DONE', {
        symptoms: 'Skin rash',
        start: mins(100), end: mins(91),
        rating: 5,
        at: mins(115),
      }),

      // Dr. Nikhil (D[2]) — light load (auto-assign picks him)
      // Only 1 WAITING — fewest patients in General
      a(P[8], D[2], 'General', 3, 'WAITING', {
        symptoms: 'Mild fever',
        at: mins(8),
      }),
      a(P[9], D[2], 'General', 3, 'DONE', {
        symptoms: 'Throat pain',
        start: mins(80), end: mins(73),
        rating: 3,
        at: mins(90),
      }),

      // ═══════════════════════════════════════════════════════════════
      // CARDIOLOGY — Dr. Arjun (D[3])
      // Features: doctor ratings, wait time analytics, ON_HOLD live demo
      // P[1] Meena — multi-dept (also WAITING in General above)
      // P[4] Karan — multi-dept (also WAITING in Orthopedics below)
      // P[11] Rekha — only in Cardiology
      // ═══════════════════════════════════════════════════════════════

      // DONE history for analytics + ratings
      a(P[0], D[3], 'Cardiology', 1, 'DONE', {
        reason: 'Emergency cardiac',
        symptoms: 'Sudden chest pain, sweating',
        start: mins(240), end: mins(218),
        rating: 5,
        notes: 'ECG normal. Monitor for 24hrs. Follow up in 1 week.',
        at: mins(245),
      }),
      a(P[5], D[3], 'Cardiology', 2, 'DONE', {
        reason: 'Senior citizen',
        symptoms: 'High BP, chest tightness',
        start: mins(180), end: mins(167),
        rating: 4,
        notes: 'BP 160/100. Adjusted dosage. Recheck in 3 days.',
        at: mins(195),
      }),
      a(P[6], D[3], 'Cardiology', 3, 'DONE', {
        symptoms: 'Irregular heartbeat',
        start: mins(120), end: mins(108),
        rating: 5,
        at: mins(135),
      }),
      a(P[7], D[3], 'Cardiology', 3, 'NO_SHOW', {
        symptoms: 'Palpitations — did not arrive',
        at: mins(100),
      }),
      // Active queue
      // P[1] Meena — WAITING here AND WAITING in General above
      // When called IN in General → this goes ON_HOLD live
      a(P[1], D[3], 'Cardiology', 2, 'WAITING', {
        reason: 'Pregnant — cardiac monitoring',
        symptoms: 'Palpitations during pregnancy',
        at: mins(35),
      }),
      // P[4] Karan — WAITING here AND WAITING in Orthopedics below
      // When called IN in either → other goes ON_HOLD live
      a(P[4], D[3], 'Cardiology', 3, 'WAITING', {
        symptoms: 'Heart palpitations after exercise',
        at: mins(28),
      }),
      a(P[11], D[3], 'Cardiology', 3, 'WAITING', {
        symptoms: 'Mild chest discomfort',
        at: mins(10),
      }),

      // Dr. Divya (D[4])
      a(P[8], D[4], 'Cardiology', 3, 'DONE', {
        symptoms: 'Cholesterol checkup',
        start: mins(90), end: mins(82),
        rating: 4,
        at: mins(100),
      }),
      a(P[9], D[4], 'Cardiology', 2, 'WAITING', {
        reason: 'Disabled',
        symptoms: 'Shortness of breath',
        at: mins(25),
      }),
      a(P[10], D[4], 'Cardiology', 1, 'WAITING', {
        reason: 'Emergency — cardiac arrest risk',
        symptoms: 'Sudden dizziness, fainting episodes',
        at: mins(3),
      }),

      // ═══════════════════════════════════════════════════════════════
      // ORTHOPEDICS — Dr. Mohan (D[5])
      // Features: NO_SHOW demo, P1 emergency
      // P[4] Karan — multi-dept (also WAITING in Cardiology above)
      // ═══════════════════════════════════════════════════════════════

      a(P[0], D[5], 'Orthopedics', 3, 'DONE', {
        symptoms: 'Knee pain after fall',
        start: mins(200), end: mins(188),
        rating: 3,
        notes: 'X-ray clear. Apply ice and rest for 3 days.',
        at: mins(215),
      }),
      a(P[1], D[5], 'Orthopedics', 2, 'NO_SHOW', {
        reason: 'Disabled',
        symptoms: 'Hip replacement follow up — did not arrive',
        at: mins(110),
      }),
      a(P[8], D[5], 'Orthopedics', 1, 'WAITING', {
        reason: 'Fracture emergency',
        symptoms: 'Suspected fracture — right arm, severe pain',
        at: mins(4),
      }),
      a(P[11], D[5], 'Orthopedics', 2, 'WAITING', {
        reason: 'Senior citizen',
        symptoms: 'Severe arthritis, difficulty walking',
        at: mins(28),
      }),
      // P[4] Karan — also WAITING in Cardiology
      // Call him IN in Orthopedics → Cardiology goes ON_HOLD
      a(P[4], D[5], 'Orthopedics', 3, 'WAITING', {
        symptoms: 'Shoulder pain after gym injury',
        at: mins(32),
      }),

      // Dr. Sneha (D[6])
      a(P[5], D[6], 'Orthopedics', 3, 'DONE', {
        symptoms: 'Sprained ankle',
        start: mins(150), end: mins(141),
        rating: 4,
        at: mins(165),
      }),
      a(P[6], D[6], 'Orthopedics', 3, 'WAITING', {
        symptoms: 'Elbow pain, clicking sound',
        at: mins(20),
      }),
      a(P[7], D[6], 'Orthopedics', 3, 'WAITING', {
        symptoms: 'Lower back stiffness',
        at: mins(18),
      }),

      // ═══════════════════════════════════════════════════════════════
      // NEUROLOGY — Dr. Sunita (D[7])
      // Features: auto-reassign demo (toggle unavailable → moves to Rahul)
      // P[2] Ravi — ON_HOLD here (IN_CONSULTATION in General above)
      // ═══════════════════════════════════════════════════════════════

      // P[2] Ravi — pre-seeded ON_HOLD — he is IN_CONSULTATION in General
      // Dr. Arjun will see ⏸ badge — "In consultation at General"
      // When Ramesh marks Ravi DONE → this auto-resumes to WAITING
      a(P[2], D[7], 'Neurology', 3, 'ON_HOLD', {
        symptoms: 'Recurring migraines',
        at: mins(25),
        onHoldAt: 'General',
      }),
      // P[3] Sita — WAITING here AND WAITING in ENT below (multi-dept demo)
      // Call her IN in General → ENT goes ON_HOLD live
      a(P[3], D[7], 'Neurology', 2, 'WAITING', {
        reason: 'Senior citizen',
        symptoms: 'Memory loss episodes, confusion',
        at: mins(38),
      }),
      a(P[6], D[7], 'Neurology', 3, 'WAITING', {
        symptoms: 'Persistent migraine for 3 days',
        at: mins(40),
      }),
      a(P[9], D[7], 'Neurology', 2, 'WAITING', {
        reason: 'Disabled',
        symptoms: 'Numbness in left arm and leg',
        at: mins(55),
      }),
      a(P[10], D[7], 'Neurology', 3, 'DONE', {
        symptoms: 'Vertigo episodes',
        start: mins(120), end: mins(109),
        rating: 4,
        at: mins(130),
      }),

      // Dr. Rahul (D[8]) — receives Sunita's patients on auto-reassign
      a(P[0], D[8], 'Neurology', 3, 'DONE', {
        symptoms: 'Epilepsy check — routine',
        start: mins(80), end: mins(70),
        rating: 5,
        at: mins(90),
      }),
      a(P[5], D[8], 'Neurology', 3, 'WAITING', {
        symptoms: 'Tingling sensation in hands',
        at: mins(15),
      }),
      a(P[7], D[8], 'Neurology', 2, 'WAITING', {
        reason: 'Senior citizen',
        symptoms: 'Parkinson symptoms — tremors',
        at: mins(45),
      }),

      // ═══════════════════════════════════════════════════════════════
      // PEDIATRICS — Dr. Vikram (D[9])
      // Features: P1 emergency, multi-priority queue
      // ═══════════════════════════════════════════════════════════════

      a(P[5], D[9], 'Pediatrics', 1, 'WAITING', {
        reason: 'Child with high fever',
        symptoms: 'High fever 104°F, convulsions — emergency',
        at: mins(3),
      }),
      a(P[9], D[9], 'Pediatrics', 3, 'WAITING', {
        symptoms: 'Cold, cough, runny nose',
        at: mins(18),
      }),
      a(P[11], D[9], 'Pediatrics', 2, 'WAITING', {
        reason: 'Infant under 6 months',
        symptoms: 'High fever, not eating, crying constantly',
        at: mins(10),
      }),
      a(P[0], D[9], 'Pediatrics', 3, 'DONE', {
        symptoms: 'Vaccination follow up',
        start: mins(90), end: mins(83),
        rating: 5,
        notes: 'Vaccines administered. Next due in 3 months.',
        at: mins(100),
      }),
      a(P[1], D[9], 'Pediatrics', 2, 'DONE', {
        reason: 'Premature baby',
        symptoms: 'Breathing difficulty — monitored',
        start: mins(150), end: mins(130),
        rating: 5,
        at: mins(160),
      }),
      a(P[2], D[9], 'Pediatrics', 3, 'NO_SHOW', {
        symptoms: 'Routine checkup — did not arrive',
        at: mins(120),
      }),

      // Dr. Ananya (D[10])
      a(P[6], D[10], 'Pediatrics', 3, 'WAITING', {
        symptoms: 'Ear infection, pulling ears',
        at: mins(22),
      }),
      a(P[7], D[10], 'Pediatrics', 3, 'DONE', {
        symptoms: 'Stomach ache after food',
        start: mins(60), end: mins(53),
        rating: 4,
        at: mins(70),
      }),
      a(P[8], D[10], 'Pediatrics', 2, 'WAITING', {
        reason: 'Newborn',
        symptoms: 'Jaundice — newborn monitoring',
        at: mins(12),
      }),

      // ═══════════════════════════════════════════════════════════════
      // ENT — Dr. Kavya (D[11])
      // Features: P1 emergency, multi-priority queue
      // P[3] Sita — WAITING here AND WAITING in Neurology above
      // ═══════════════════════════════════════════════════════════════

      a(P[7], D[11], 'ENT', 1, 'WAITING', {
        reason: 'Emergency — foreign body',
        symptoms: 'Foreign body lodged in ear, bleeding',
        at: mins(2),
      }),
      a(P[3], D[11], 'ENT', 2, 'WAITING', {
        reason: 'Senior citizen',
        symptoms: 'Severe tinnitus, loss of hearing',
        at: mins(35),
      }),
      a(P[10], D[11], 'ENT', 3, 'WAITING', {
        symptoms: 'Ear pain, reduced hearing in left ear',
        at: mins(12),
      }),
      a(P[0], D[11], 'ENT', 3, 'DONE', {
        symptoms: 'Throat infection, difficulty swallowing',
        start: mins(70), end: mins(62),
        rating: 4,
        notes: 'Prescribed antibiotics for strep throat.',
        at: mins(80),
      }),
      a(P[1], D[11], 'ENT', 3, 'DONE', {
        symptoms: 'Sinusitis with headache',
        start: mins(120), end: mins(111),
        rating: 3,
        at: mins(130),
      }),
      a(P[2], D[11], 'ENT', 2, 'NO_SHOW', {
        reason: 'Senior citizen',
        symptoms: 'Vertigo and dizziness — did not arrive',
        at: mins(95),
      }),

      // Dr. Suresh (D[12])
      a(P[4], D[12], 'ENT', 3, 'DONE', {
        symptoms: 'Ear wax removal',
        start: mins(50), end: mins(44),
        rating: 5,
        at: mins(60),
      }),
      a(P[8], D[12], 'ENT', 3, 'WAITING', {
        symptoms: 'Nasal polyp — difficulty breathing',
        at: mins(18),
      }),
      a(P[9], D[12], 'ENT', 3, 'WAITING', {
        symptoms: 'Voice hoarseness for 2 weeks',
        at: mins(28),
      }),
      a(P[11], D[12], 'ENT', 2, 'WAITING', {
        reason: 'Pregnant',
        symptoms: 'Severe nasal congestion',
        at: mins(22),
      }),
    ];

    // Use save() so pre('save') hook generates tokenNumber
    console.log('⏳ Creating appointments...');
    for (const apptData of appointments) {
      const doc = new Appointment(apptData);
      await doc.save();
      // Patch createdAt after save — timestamps:true overrides it
      if (apptData.createdAt) {
        await Appointment.findByIdAndUpdate(doc._id, { $set: { createdAt: apptData.createdAt } });
      }
    }

    console.log(`📋 ${appointments.length} appointments created with tokens`);
    console.log('\n✅ Seed complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:   admin@hospital.com   / admin123');
    console.log('');
    console.log('DOCTORS — all password: doctor123');
    console.log('  General (3):      ramesh | priya | nikhil  @hospital.com');
    console.log('  Cardiology (2):   arjun  | divya           @hospital.com');
    console.log('  Orthopedics (2):  mohan  | sneha           @hospital.com');
    console.log('  Neurology (2):    sunita | rahul           @hospital.com');
    console.log('  Pediatrics (2):   vikram | ananya          @hospital.com');
    console.log('  ENT (2):          kavya  | suresh          @hospital.com');
    console.log('');
    console.log('PATIENTS — all password: patient123');
    console.log('  anil | meena | ravi | sita | karan | pooja @example.com');
    console.log('  deepak | anjali | sureshb | lakshmi | harish | rekha @example.com');
    console.log('');
    console.log('WHAT TO TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Priority queue:     Login ramesh → P1 > P2 > P3 order');
    console.log('Consultation timer: Harish is IN_CONSULTATION 8min ago');
    console.log('Auto-escalation:    Harish P3 created 75min ago → upgrades to P2');
    console.log('');
    console.log('ON_HOLD pre-seeded:');
    console.log('  Login arjun (Cardiology) → see Ravi Patel with ⏸ badge');
    console.log('  (Ravi is IN_CONSULTATION in General, ON_HOLD in Neurology)');
    console.log('  Login ramesh → mark Ravi DONE → Neurology auto-resumes');
    console.log('');
    console.log('ON_HOLD live demo:');
    console.log('  Meena — WAITING in General + Cardiology');
    console.log('  Sita  — WAITING in General + ENT (via Neurology)');
    console.log('  Karan — WAITING in Cardiology + Orthopedics');
    console.log('  Call any of them IN → other dept goes ON_HOLD live');
    console.log('');
    console.log('Load balancing:     General has 3 doctors');
    console.log('  Ramesh: 5 patients  Priya: 3 patients  Nikhil: 2 patients');
    console.log('  Auto-assign picks Nikhil');
    console.log('');
    console.log('Auto-reassign:      Admin → Manage → Toggle Sunita unavailable');
    console.log('  Her 3 WAITING patients move to Rahul automatically');
    console.log('');
    console.log('Ratings analytics:  arjun has 3 DONE with ratings 3/4/5');
    console.log('  Admin → Analytics → Doctor Ratings');
    console.log('');
    console.log('NO_SHOW:            mohan, vikram, kavya each have 1 NO_SHOW');
    console.log('  Login any → Today History tab');
    console.log('');
    console.log('Waiting room:       /display/General (or any dept)');
    console.log('Token tracking:     /track/<any-token>');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();