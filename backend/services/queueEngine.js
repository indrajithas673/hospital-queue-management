const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');

/**
 * ============================================================
 * PRIORITY QUEUE ENGINE
 * ============================================================
 *
 * This is NOT a simple sort. It uses a 3-bucket priority system:
 *
 *   BUCKET 1 — P1 Emergency  (priority=1)
 *     - Life threatening / critical
 *     - ALWAYS goes to the front of the entire queue
 *     - Multiple P1s are ordered by arrival time (FIFO among themselves)
 *     - Example: 3 emergencies arrive → they occupy positions 1, 2, 3
 *       and all P2/P3 patients are pushed down
 *
 *   BUCKET 2 — P2 Priority   (priority=2)
 *     - Senior citizens, pregnant women, disabled patients
 *     - Always placed AFTER all P1s, BEFORE all P3s
 *     - Multiple P2s are ordered by arrival time (FIFO among themselves)
 *
 *   BUCKET 3 — P3 Normal     (priority=3)
 *     - Regular patients
 *     - Standard FIFO by arrival time
 *     - Always placed last
 *
 * INSERTION ALGORITHM (how position is assigned):
 *   1. Separate all WAITING patients into 3 buckets by priority
 *   2. Sort each bucket internally by createdAt ASC (FIFO)
 *   3. Concatenate: [...P1s, ...P2s, ...P3s]
 *   4. Assign position = index + 1 to each
 *   5. Assign estimatedWait = index * avgConsultationTime
 *
 * EXAMPLE:
 *   Queue state: [P3-Alice, P3-Bob, P2-Charlie]
 *   New P1-Emergency arrives
 *   After recalculation:
 *     #1 P1-Emergency  (wait: 0 min)
 *     #2 P2-Charlie    (wait: 10 min)
 *     #3 P3-Alice      (wait: 20 min)
 *     #4 P3-Bob        (wait: 30 min)
 *
 * WHY THIS APPROACH:
 *   - MongoDB sort({ priority: 1, createdAt: 1 }) achieves exact same result
 *     as the 3-bucket concat because priority values 1 < 2 < 3 map directly
 *     to bucket order, and secondary sort on createdAt gives FIFO within buckets
 *   - Single DB query instead of 3 separate queries
 *   - bulkWrite updates ALL positions in ONE DB call regardless of queue size
 * ============================================================
 */

const DEFAULT_AVG_MINUTES = 10; // used when doctor has no consultation history yet

/**
 * getAvgConsultationTime
 *
 * Calculates the REAL average consultation duration for a specific doctor
 * based on their last 20 completed consultations.
 *
 * This is used to compute estimated wait times dynamically.
 * A fast doctor (avg 5 min) gives shorter wait estimates than a slow one (avg 15 min).
 *
 * Falls back to DEFAULT_AVG_MINUTES if doctor has no history yet.
 */
const getAvgConsultationTime = async (doctorId) => {
  try {
    const result = await Appointment.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId.toString()),
          status: 'DONE',
          consultationStartTime: { $exists: true, $ne: null },
          consultationEndTime: { $exists: true, $ne: null },
        },
      },
      { $sort: { consultationEndTime: -1 } },
      { $limit: 20 },
      {
        $project: {
          duration: {
            $divide: [
              { $subtract: ['$consultationEndTime', '$consultationStartTime'] },
              60000, // convert milliseconds → minutes
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgMinutes: { $avg: '$duration' },
        },
      },
    ]);

    if (result.length > 0 && result[0].avgMinutes > 0) {
      return Math.ceil(result[0].avgMinutes);
    }
    return DEFAULT_AVG_MINUTES;
  } catch (err) {
    console.error('getAvgConsultationTime error:', err.message);
    return DEFAULT_AVG_MINUTES;
  }
};

/**
 * recalculateQueue
 *
 * THE CORE FUNCTION — called after every single queue-changing event:
 *   - Patient registers (P1, P2, or P3)
 *   - Doctor calls patient IN (WAITING → IN_CONSULTATION)
 *   - Doctor marks DONE or NO_SHOW
 *
 * ALGORITHM:
 * Step 1: Get this doctor's real avg consultation time (dynamic, from history)
 * Step 2: Fetch all WAITING patients for this doctor today
 *         MongoDB sorts them: priority ASC, then createdAt ASC
 *         Result: [...all P1s by time, ...all P2s by time, ...all P3s by time]
 * Step 3: Assign sequential positions (1, 2, 3...) and estimated wait times
 *         via single bulkWrite — one DB call for entire queue
 * Step 4: Return full active queue (WAITING + IN_CONSULTATION) with patient info
 *
 * @param {string} department - e.g. 'Cardiology'
 * @param {ObjectId} doctorId - doctor's MongoDB _id
 * @returns {Array} sorted queue with populated patient data
 */
const recalculateQueue = async (department, doctorId) => {
  const docObjectId = new mongoose.Types.ObjectId(doctorId.toString());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Step 1: Dynamic avg time for THIS doctor
  const avgMinutesPerPatient = await getAvgConsultationTime(docObjectId);

  // Step 2: Fetch WAITING queue only (not ON_HOLD — they are skipped for position)
  const waitingQueue = await Appointment.find({
    doctor: docObjectId,
    department,
    status: 'WAITING',
    appointmentDate: { $gte: today, $lt: tomorrow },
  }).sort({ priority: 1, createdAt: 1 });

  // Step 3: Assign positions only to WAITING patients
  // ON_HOLD patients keep their position but are skipped by doctor
  if (waitingQueue.length > 0) {
    const bulkOps = waitingQueue.map((appointment, index) => ({
      updateOne: {
        filter: { _id: appointment._id },
        update: {
          $set: {
            queuePosition: index + 1,
            estimatedWait: index * avgMinutesPerPatient,
          },
        },
      },
    }));
    await Appointment.bulkWrite(bulkOps);
  }

  // Step 4: Return full active queue — WAITING + IN_CONSULTATION + ON_HOLD
  // ON_HOLD patients are shown in doctor dashboard with special badge
  return await Appointment.find({
    doctor: docObjectId,
    department,
    status: { $in: ['WAITING', 'IN_CONSULTATION', 'ON_HOLD'] },
    appointmentDate: { $gte: today, $lt: tomorrow },
  })
    .populate('patient', 'name phone email')
    .sort({ priority: 1, createdAt: 1 });
};

/**
 * getNotificationTargets
 *
 * Called AFTER recalculateQueue so positions are already updated in DB.
 * Single DB query to find patients who need email/SMS alerts.
 *
 * Rules:
 *   - Position 3 and notifiedAt3 = false → send "approaching" alert
 *   - Position 1 and notifiedAt1 = false → send "you are next" alert
 *
 * Flags (notifiedAt3, notifiedAt1) prevent duplicate notifications
 * if recalculation runs multiple times at the same position.
 *
 * @returns {{ needsAt3: Array, needsAt1: Array }}
 */
const getNotificationTargets = async (department, doctorId) => {
  const docObjectId = new mongoose.Types.ObjectId(doctorId.toString());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const waitingPatients = await Appointment.find({
    doctor: docObjectId,
    department,
    status: 'WAITING',
    appointmentDate: { $gte: today, $lt: tomorrow },
    // Only fetch patients who might need notification — filter at DB level
    $or: [
      { queuePosition: 3, notifiedAt3: false },
      { queuePosition: 1, notifiedAt1: false },
    ],
  }).populate('patient', 'name email phone');

  const needsAt3 = waitingPatients.filter(a => a.queuePosition === 3 && !a.notifiedAt3);
  const needsAt1 = waitingPatients.filter(a => a.queuePosition === 1 && !a.notifiedAt1);

  return { needsAt3, needsAt1 };
};

/**
 * getQueueSnapshot
 *
 * Returns a structured breakdown of queue by priority bucket.
 * Used by admin panel to clearly show P1/P2/P3 separation.
 *
 * @param {string} department
 * @returns {{ p1: Array, p2: Array, p3: Array, total: number, avgWait: number }}
 */
const getQueueSnapshot = async (department) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queue = await Appointment.find({
    department,
    status: { $in: ['WAITING', 'IN_CONSULTATION'] },
    appointmentDate: { $gte: today, $lt: tomorrow },
  })
    .populate('patient', 'name phone email')
    .populate('doctor', 'name')
    .sort({ priority: 1, createdAt: 1 });

  const p1 = queue.filter(a => a.priority === 1);
  const p2 = queue.filter(a => a.priority === 2);
  const p3 = queue.filter(a => a.priority === 3);

  const waiting = queue.filter(a => a.status === 'WAITING');
  const avgWait = waiting.length > 0
    ? Math.round(waiting.reduce((sum, a) => sum + (a.estimatedWait || 0), 0) / waiting.length)
    : 0;

  return {
    p1,
    p2,
    p3,
    total: queue.length,
    waitingCount: waiting.length,
    avgWait,
    queue, // full sorted list for Socket.io broadcast
  };
};

/**
 * getQueueForDepartment — admin view, all doctors in a department
 */
const getQueueForDepartment = async (department) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return await Appointment.find({
    department,
    status: { $in: ['WAITING', 'IN_CONSULTATION'] },
    appointmentDate: { $gte: today, $lt: tomorrow },
  })
    .populate('patient', 'name phone email')
    .populate('doctor', 'name')
    .sort({ priority: 1, createdAt: 1 });
};

/**
 * sanitizeQueueForBroadcast
 *
 * Attack 18 — Strip patient PII from Socket.io broadcasts
 * Anyone can join a department socket room — don't expose names/phones/emails
 * Only token numbers and positions are safe to broadcast publicly
 */
const sanitizeQueueForBroadcast = (queue) => queue.map(appt => ({
  _id:                  appt._id,
  tokenNumber:          appt.tokenNumber,
  status:               appt.status,
  priority:             appt.priority,
  priorityReason:       appt.priorityReason,
  queuePosition:        appt.queuePosition,
  estimatedWait:        appt.estimatedWait,
  onHoldAtDepartment:   appt.onHoldAtDepartment,
  consultationStartTime: appt.consultationStartTime,
  doctor:               appt.doctor,
  // patient object stripped — no name/phone/email in broadcast
}));

module.exports = {
  recalculateQueue,
  sanitizeQueueForBroadcast,
  getQueueForDepartment,
  getQueueSnapshot,
  getNotificationTargets,
  getAvgConsultationTime,
};
