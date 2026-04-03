/**
 * SEED SCRIPT — Complete demo data for MediQueue
 *
 * Active appointment map (no conflicts — max 2 active per patient):
 *   P[0]  Anil    — General P1 WAITING (Ramesh)
 *   P[1]  Meena   — General P2 WAITING (Ramesh) + Cardiology P2 WAITING (Arjun) ← multi-dept demo
 *   P[2]  Ravi    — General P3 IN_CONSULTATION (Ramesh) + Neurology ON_HOLD (Sunita) ← ON_HOLD pre-seeded
 *   P[3]  Sita    — General P3 WAITING (Ramesh) + ENT P2 WAITING (Kavya) ← multi-dept demo
 *   P[4]  Karan   — Cardiology P3 WAITING (Arjun) + Orthopedics P3 WAITING (Mohan) ← multi-dept demo
 *   P[5]  Pooja   — General P2 WAITING (Priya)
 *   P[6]  Deepak  — Neurology P3 WAITING (Sunita)
 *   P[7]  Anjali  — ENT P1 WAITING (Kavya)
 *   P[8]  Suresh  — Orthopedics P1 WAITING (Mohan)
 *   P[9]  Lakshmi — Pediatrics P3 WAITING (Vikram)
 *   P[10] Harish  — General P3 WAITING (Ramesh) ← auto-escalation demo (75min old)
 *   P[11] Rekha   — Cardiology P3 WAITING (Arjun)
 *
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Appointment = require('./models/Appointment');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital-queue';

const doctors = [
  // General — 3 doctors (load balancing demo)
  { name: 'Ramesh Kumar',   email: 'ramesh@hospital.com',   password: 'doctor123', department: 'General',     phone: '+919876543201' }, // D[0]
  { name: 'Priya Sharma',   email: 'priya@hospital.com',    password: 'doctor123', department: 'General',     phone: '+919876543202' }, // D[1]
  { name: 'Nikhil Bose',    email: 'nikhil@hospital.com',   password: 'doctor123', department: 'General',     phone: '+919876543203' }, // D[2]
  // Cardiology — 2 doctors
  { name: 'Arjun Mehta',    email: 'arjun@hospital.com',    password: 'doctor123', department: 'Cardiology',  phone: '+919876543204' }, // D[3]
  { name: 'Divya Pillai',   email: 'divya@hospital.com',    password: 'doctor123', department: 'Cardiology',  phone: '+919876543205' }, // D[4]
  // Orthopedics — 2 doctors
  { name: 'Mohan Das',      email: 'mohan@hospital.com',    password: 'doctor123', department: 'Orthopedics', phone: '+919876543206' }, // D[5]
  { name: 'Sneha Kulkarni', email: 'sneha@hospital.com',    password: 'doctor123', department: 'Orthopedics', phone: '+919876543207' }, // D[6]
  // Neurology — 2 doctors (Sunita for auto-reassign demo)
  { name: 'Sunita Rao',     email: 'sunita@hospital.com',   password: 'doctor123', department: 'Neurology',   phone: '+919876543208' }, // D[7]
  { name: 'Rahul Menon',    email: 'rahul@hospital.com',    password: 'doctor123', department: 'Neurology',   phone: '+919876543209' }, // D[8]
  // Pediatrics — 2 doctors
  { name: 'Vikram Nair',    email: 'vikram@hospital.com',   password: 'doctor123', department: 'Pediatrics',  phone: '+919876543210' }, // D[9]
  { name: 'Ananya Ghosh',   email: 'ananya@hospital.com',   password: 'doctor123', department: 'Pediatrics',  phone: '+919876543211' }, // D[10]
  // ENT — 2 doctors
  { name: 'Kavya Reddy',    email: 'kavya@hospital.com',    password: 'doctor123', department: 'ENT',         phone: '+919876543212' }, // D[11]
  { name: 'Suresh Iyer',    email: 'suresh@hospital.com',   password: 'doctor123', department: 'ENT',         phone: '+919876543213' }, // D[12]
];

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
    const now   = new Date();
    const mins  = (m) => new Date(now - m * 60000);

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

    const appointments = [

      // ══════════════════════════════════════════════════════════════
      // GENERAL — Dr. Ramesh (D[0]) — heavy load
      // P1 Anil, P2 Meena, P3 Ravi IN_CONSULTATION, P3 Sita, P3 Harish
      // ══════════════════════════════════════════════════════════════
      a(P[0],  D[0], 'General', 1, 'WAITING',         { reason: 'Emergency — chest pain',           symptoms: 'Severe chest pain, difficulty breathing', at: mins(5)  }),
      a(P[1],  D[0], 'General', 2, 'WAITING',         { reason: 'Senior Citizen',                   symptoms: 'High fever, body ache',                   at: mins(20) }),
      a(P[2],  D[0], 'General', 3, 'IN_CONSULTATION', {                                              symptoms: 'Headache and nausea',          start: mins(8)          }),
      a(P[3],  D[0], 'General', 3, 'WAITING',         {                                              symptoms: 'Cold and cough',                          at: mins(30) }),
      a(P[10], D[0], 'General', 3, 'WAITING',         {                                              symptoms: 'Back pain — auto-escalates (75min)',       at: mins(75) }),
      a(P[11], D[0], 'General', 3, 'DONE', {
        symptoms: 'Stomach infection',
        start: mins(150), end: mins(138), rating: 4,
        notes: 'Prescribed antibiotics. Review in 5 days.', at: mins(165),
      }),

      // ── Dr. Priya (D[1]) — medium load ──────────────────────────
      a(P[5], D[1], 'General', 2, 'WAITING', { reason: 'Pregnant', symptoms: 'Nausea and dizziness', at: mins(15) }),
      a(P[6], D[1], 'General', 3, 'DONE', { symptoms: 'Fatigue', start: mins(100), end: mins(91), rating: 5, at: mins(115) }),
      a(P[7], D[1], 'General', 3, 'DONE', { symptoms: 'Skin rash', start: mins(60), end: mins(52), rating: 4, at: mins(75) }),

      // ── Dr. Nikhil (D[2]) — light load (auto-assign picks him) ──
      // 0 active patients — auto-assign will always pick Nikhil
      a(P[8], D[2], 'General', 3, 'DONE', { symptoms: 'Mild fever',  start: mins(80), end: mins(73), rating: 3, at: mins(90) }),
      a(P[9], D[2], 'General', 3, 'DONE', { symptoms: 'Throat pain', start: mins(40), end: mins(33), rating: 4, at: mins(55) }),

      // ══════════════════════════════════════════════════════════════
      // CARDIOLOGY — Dr. Arjun (D[3])
      // Active: P[1] Meena (also General), P[4] Karan (also Ortho), P[11] Rekha
      // Done: P[5], P[6], P[0]   No Show: P[7]
      // ══════════════════════════════════════════════════════════════
      a(P[5],  D[3], 'Cardiology', 2, 'DONE', {
        reason: 'Senior citizen', symptoms: 'High BP, chest tightness',
        start: mins(240), end: mins(227), rating: 5,
        notes: 'BP 160/100. Adjusted dosage. Recheck in 3 days.', at: mins(255),
      }),
      a(P[6],  D[3], 'Cardiology', 3, 'DONE', {
        symptoms: 'Irregular heartbeat',
        start: mins(180), end: mins(168), rating: 4, at: mins(195),
      }),
      a(P[0],  D[3], 'Cardiology', 1, 'DONE', {
        reason: 'Emergency cardiac', symptoms: 'Sudden chest pain, sweating',
        start: mins(120), end: mins(100), rating: 5,
        notes: 'ECG normal. Monitor 24hrs. Follow up in 1 week.', at: mins(130),
      }),
      a(P[7],  D[3], 'Cardiology', 3, 'NO_SHOW', { symptoms: 'Palpitations — did not arrive', at: mins(90) }),
      a(P[1],  D[3], 'Cardiology', 2, 'WAITING', { reason: 'Pregnant — cardiac', symptoms: 'Palpitations during pregnancy', at: mins(35) }),
      a(P[4],  D[3], 'Cardiology', 3, 'WAITING', { symptoms: 'Heart palpitations after exercise', at: mins(28) }),
      a(P[11], D[3], 'Cardiology', 3, 'WAITING', { symptoms: 'Mild chest discomfort', at: mins(10) }),

      // ── Dr. Divya (D[4]) — 0 active ─────────────────────────────
      a(P[8],  D[4], 'Cardiology', 3, 'DONE', { symptoms: 'Cholesterol checkup', start: mins(90),  end: mins(82),  rating: 4, at: mins(100) }),
      a(P[9],  D[4], 'Cardiology', 3, 'DONE', { symptoms: 'Post-op follow up',   start: mins(60),  end: mins(51),  rating: 5, at: mins(70)  }),
      a(P[10], D[4], 'Cardiology', 3, 'DONE', { symptoms: 'Routine cardiac',     start: mins(30),  end: mins(23),  rating: 3, at: mins(45)  }),

      // ══════════════════════════════════════════════════════════════
      // ORTHOPEDICS — Dr. Mohan (D[5])
      // Active: P[8] Suresh P1, P[11] Rekha P2, P[4] Karan P3 (also Cardiology)
      // Done: P[0]   No Show: P[9]
      // ══════════════════════════════════════════════════════════════
      a(P[0],  D[5], 'Orthopedics', 3, 'DONE', {
        symptoms: 'Knee pain after fall',
        start: mins(200), end: mins(188), rating: 3,
        notes: 'X-ray clear. Apply ice, rest 3 days.', at: mins(215),
      }),
      a(P[9],  D[5], 'Orthopedics', 2, 'NO_SHOW', { reason: 'Disabled',      symptoms: 'Hip replacement follow up — did not arrive',  at: mins(110) }),
      a(P[8],  D[5], 'Orthopedics', 1, 'WAITING', { reason: 'Fracture',       symptoms: 'Suspected fracture — right arm, severe pain', at: mins(4)   }),
      a(P[11], D[5], 'Orthopedics', 2, 'WAITING', { reason: 'Senior citizen', symptoms: 'Severe arthritis, difficulty walking',        at: mins(28)  }),
      a(P[4],  D[5], 'Orthopedics', 3, 'WAITING', {                           symptoms: 'Shoulder pain after gym injury',              at: mins(32)  }),

      // ── Dr. Sneha (D[6]) — 0 active ─────────────────────────────
      a(P[5], D[6], 'Orthopedics', 3, 'DONE', { symptoms: 'Sprained ankle',  start: mins(150), end: mins(141), rating: 4, at: mins(165) }),
      a(P[6], D[6], 'Orthopedics', 3, 'DONE', { symptoms: 'Elbow pain',      start: mins(90),  end: mins(82),  rating: 5, at: mins(100) }),
      a(P[7], D[6], 'Orthopedics', 3, 'DONE', { symptoms: 'Lower back pain', start: mins(40),  end: mins(33),  rating: 4, at: mins(55)  }),

      // ══════════════════════════════════════════════════════════════
      // NEUROLOGY — Dr. Sunita (D[7])
      // Active: P[2] Ravi ON_HOLD (IN_CONSULTATION General), P[3] Sita P2, P[6] Deepak P3
      // Done: P[10]
      // Toggle Sunita unavailable → Sita + Deepak + Ravi move to Rahul
      // ══════════════════════════════════════════════════════════════
      a(P[10], D[7], 'Neurology', 3, 'DONE', {
        symptoms: 'Vertigo episodes',
        start: mins(120), end: mins(109), rating: 4, at: mins(130),
      }),
      a(P[2],  D[7], 'Neurology', 3, 'ON_HOLD', { symptoms: 'Recurring migraines',        at: mins(25), onHoldAt: 'General'  }),
      a(P[3],  D[7], 'Neurology', 2, 'WAITING', { reason: 'Senior citizen', symptoms: 'Memory loss, confusion',      at: mins(38) }),
      a(P[6],  D[7], 'Neurology', 3, 'WAITING', {                           symptoms: 'Persistent migraine 3 days',  at: mins(40) }),

      // ── Dr. Rahul (D[8]) — 0 active (receives Sunita's after reassign) ──
      a(P[0], D[8], 'Neurology', 3, 'DONE', { symptoms: 'Epilepsy check — routine',    start: mins(80), end: mins(70), rating: 5, at: mins(90) }),
      a(P[5], D[8], 'Neurology', 3, 'DONE', { symptoms: 'Tingling in hands — checkup', start: mins(40), end: mins(33), rating: 4, at: mins(55) }),

      // ══════════════════════════════════════════════════════════════
      // PEDIATRICS — Dr. Vikram (D[9])
      // Active: P[9] Lakshmi P3, P[7] Anjali P1 Emergency
      // Done: P[0], P[1]   No Show: P[2]
      // ══════════════════════════════════════════════════════════════
      a(P[0], D[9], 'Pediatrics', 3, 'DONE', {
        symptoms: 'Vaccination follow up',
        start: mins(180), end: mins(173), rating: 5,
        notes: 'Vaccines given. Next due in 3 months.', at: mins(195),
      }),
      a(P[1], D[9], 'Pediatrics', 2, 'DONE', {
        reason: 'Premature baby', symptoms: 'Breathing difficulty — monitored',
        start: mins(120), end: mins(100), rating: 5, at: mins(130),
      }),
      a(P[2], D[9], 'Pediatrics', 3, 'NO_SHOW', { symptoms: 'Routine checkup — did not arrive', at: mins(90)  }),
      a(P[9], D[9], 'Pediatrics', 3, 'WAITING', { symptoms: 'Cold, cough, runny nose',          at: mins(18)  }),
      a(P[7], D[9], 'Pediatrics', 1, 'WAITING', { reason: 'Child high fever', symptoms: 'High fever 104°F, convulsions — emergency', at: mins(3) }),

      // ── Dr. Ananya (D[10]) — 0 active ───────────────────────────
      a(P[5], D[10], 'Pediatrics', 3, 'DONE', { symptoms: 'Ear infection',  start: mins(90), end: mins(83), rating: 4, at: mins(100) }),
      a(P[6], D[10], 'Pediatrics', 3, 'DONE', { symptoms: 'Stomach ache',   start: mins(60), end: mins(53), rating: 5, at: mins(70)  }),
      a(P[8], D[10], 'Pediatrics', 2, 'DONE', { reason: 'Newborn', symptoms: 'Jaundice monitoring', start: mins(30), end: mins(18), rating: 5, at: mins(45) }),

      // ══════════════════════════════════════════════════════════════
      // ENT — Dr. Kavya (D[11])
      // Active: P[7] Anjali P1, P[3] Sita P2 (also Neurology), P[10] Harish P3
      // Done: P[0], P[1]   No Show: P[11]
      // ══════════════════════════════════════════════════════════════
      a(P[0],  D[11], 'ENT', 3, 'DONE', {
        symptoms: 'Throat infection',
        start: mins(180), end: mins(172), rating: 4,
        notes: 'Prescribed antibiotics for strep throat.', at: mins(195),
      }),
      a(P[1],  D[11], 'ENT', 3, 'DONE', {
        symptoms: 'Sinusitis with headache',
        start: mins(120), end: mins(111), rating: 3, at: mins(130),
      }),
      a(P[11], D[11], 'ENT', 2, 'NO_SHOW', { reason: 'Senior citizen', symptoms: 'Vertigo — did not arrive',              at: mins(90) }),
      a(P[7],  D[11], 'ENT', 1, 'WAITING', { reason: 'Foreign body emergency', symptoms: 'Foreign body in ear, bleeding', at: mins(2)  }),
      a(P[3],  D[11], 'ENT', 2, 'WAITING', { reason: 'Senior citizen', symptoms: 'Severe tinnitus, loss of hearing',      at: mins(35) }),
      a(P[10], D[11], 'ENT', 3, 'WAITING', {                           symptoms: 'Ear pain, reduced hearing',             at: mins(12) }),

      // ── Dr. Suresh (D[12]) — 0 active ───────────────────────────
      a(P[4], D[12], 'ENT', 3, 'DONE', { symptoms: 'Ear wax removal',     start: mins(90), end: mins(84), rating: 5, at: mins(100) }),
      a(P[5], D[12], 'ENT', 3, 'DONE', { symptoms: 'Nasal polyp checkup', start: mins(60), end: mins(52), rating: 4, at: mins(75)  }),
      a(P[6], D[12], 'ENT', 3, 'DONE', { symptoms: 'Voice hoarseness',    start: mins(30), end: mins(23), rating: 4, at: mins(45)  }),
    ];

    console.log('⏳ Creating appointments...');
    for (const apptData of appointments) {
      const doc = new Appointment(apptData);
      await doc.save();
      if (apptData.createdAt) {
        await Appointment.findByIdAndUpdate(doc._id, { $set: { createdAt: apptData.createdAt } });
      }
    }

    console.log(`📋 ${appointments.length} appointments created with tokens`);
    console.log('\n✅ Seed complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:   admin@hospital.com  / admin123');
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
    console.log('Priority queue:     ramesh → P1 Anil > P2 Meena > P3 Sita/Harish');
    console.log('Consultation timer: Ravi IN_CONSULTATION 8 min ago (Ramesh)');
    console.log('Auto-escalation:    Harish P3 created 75 min ago → upgrades to P2');
    console.log('ON_HOLD pre-seeded: sunita → Ravi ⏸ "In consultation at General"');
    console.log('                    Mark Ravi DONE in ramesh → Neurology auto-resumes');
    console.log('ON_HOLD live:       Meena = General + Cardiology');
    console.log('                    Sita  = General + ENT');
    console.log('                    Karan = Cardiology + Orthopedics');
    console.log('Load balancing:     Ramesh=5, Priya=1, Nikhil=0 active');
    console.log('                    Auto-assign always picks Nikhil');
    console.log('Auto-reassign:      Admin → Toggle sunita unavailable');
    console.log('                    Ravi + Sita + Deepak move to Rahul');
    console.log('NO_SHOW monitor:    mohan, vikram, kavya each have 1 NO_SHOW');
    console.log('Ratings:            arjun → 3 DONE with ratings 4/5/5');
    console.log('Waiting room:       /display/General or /display/ENT');
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