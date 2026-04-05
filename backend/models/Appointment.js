const mongoose = require('mongoose');

// Token counter per department per day — auto-increments
const counterSchema = new mongoose.Schema({
  _id: String, // format: "DEPT-YYYY-MM-DD"
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

const appointmentSchema = new mongoose.Schema(
  {
    // Token number shown to patient — e.g. CARDIO-042
    tokenNumber: {
      type: String,
      unique: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    department: {
      type: String,
      required: true,
      enum: ['General', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'ENT'],
    },

    // State machine:
    // WAITING → IN_CONSULTATION → DONE / NO_SHOW / CANCELLED
    // WAITING → ON_HOLD (skipped or multi-dept)
    // ON_HOLD → IN_CONSULTATION / NO_SHOW
    status: {
      type: String,
      enum: ['WAITING', 'IN_CONSULTATION', 'DONE', 'NO_SHOW', 'CANCELLED', 'ON_HOLD'],
      default: 'WAITING',
    },

    // Populated when ON_HOLD due to multi-dept consultation
    // null = skipped by doctor or stepped away by patient
    onHoldAtDepartment: { type: String, default: null },

      // Priority queue
    // P1 = Emergency (doctor/admin only)
    // P2 = Priority (senior/pregnant/disabled)
    // P3 = Normal
    priority:       { type: Number, enum: [1, 2, 3], default: 3 },
    priorityReason: { type: String }, // e.g. "Emergency", "Senior Citizen", "Pregnant", "Disabled"

    // Queue position — recalculated dynamically
    queuePosition: { type: Number },
    estimatedWait: { type: Number, default: 0 },

    consultationStartTime: { type: Date },
    consultationEndTime:   { type: Date },
    appointmentDate:       { type: Date, required: true },
    symptoms:              { type: String, trim: true },
    doctorNotes:           { type: String, trim: true },  // Doctor notes — visible to admin only
    patientRating:         { type: Number, min: 1, max: 5 },

    // Notification flags — prevent duplicate email/SMS alerts
    notifiedAt3: { type: Boolean, default: false }, // notified when 3rd in queue
    notifiedAt1: { type: Boolean, default: false }, // notified when next in queue

    // Attack 11 — Step Away abuse: minimum hold time
    // Attack 21 — One Step Away at a time
    stepAwayCount: { type: Number, default: 0 },   // max 2
    stepAwayAt:    { type: Date,   default: null }, // when they last stepped away

    // Attack 6/19 — I'm back spam prevention
    patientNotifiedReturnAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-generate token number before save
appointmentSchema.pre('save', async function (next) {
  if (this.tokenNumber) return next(); // already has token, skip

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const counterId = `${this.department}-${today}`;

  // Atomically increment counter for this department+day
  const counter   = await Counter.findByIdAndUpdate(
    counterId, { $inc: { seq: 1 } }, { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(3, '0');
  const deptCode = this.department.substring(0, 3).toUpperCase();
  const dateCode = today.replace(/-/g, '').slice(4); // MMDD e.g. "0329"
  this.tokenNumber = `${deptCode}-${dateCode}-${paddedSeq}`;

  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);