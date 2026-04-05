const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { recalculateQueue, getNotificationTargets, sanitizeQueueForBroadcast } = require('../services/queueEngine');
const { notifyTurnApproaching, notifyNextInLine } = require('../services/notificationService');

const emitQueueUpdate = async (io, doctorId, department) => {
  const docId = new mongoose.Types.ObjectId(doctorId.toString());
  const updatedQueue = await recalculateQueue(department, docId);

  io.to(department).emit('queue_updated', {
    department,
    queue: updatedQueue,
    timestamp: new Date().toISOString(),
  });

  const { needsAt3, needsAt1 } = await getNotificationTargets(department, docId);

  const notificationPromises = [
    ...needsAt3.map(appt =>
      notifyTurnApproaching(appt)
        .then(() => Appointment.findByIdAndUpdate(appt._id, { notifiedAt3: true }))
        .catch(err => console.error(`Notify@3 failed ${appt._id}:`, err.message))
    ),
    ...needsAt1.map(appt =>
      notifyNextInLine(appt)
        .then(() => Appointment.findByIdAndUpdate(appt._id, { notifiedAt1: true }))
        .catch(err => console.error(`Notify@1 failed ${appt._id}:`, err.message))
    ),
  ];
  Promise.allSettled(notificationPromises);
};

// @route POST /api/appointments/register
const registerAppointment = async (req, res) => {
  try {
    const { doctorId, department, priority, priorityReason, symptoms } = req.body;
    if (!doctorId || !department) return res.status(400).json({ success: false, message: 'doctorId and department are required.' });

    // Attack 4 — Patient cannot self-register as P1 Emergency
    if (Number(priority) === 1) {
      return res.status(403).json({ success: false, message: 'Emergency registration must be done by a doctor or admin.' });
    }

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor', department, isAvailable: true });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found or unavailable.' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    // Check for existing appointment in SAME department only
    // Multi-dept booking is allowed (for ON_HOLD demo)
    const existing = await Appointment.findOne({
      patient: req.user._id,
      department,
      status: { $in: ['WAITING', 'IN_CONSULTATION', 'ON_HOLD'] },
      appointmentDate: { $gte: today, $lt: tomorrow },
    });
    if (existing) return res.status(400).json({ success: false, message: `You already have an active appointment in ${department} (Token: ${existing.tokenNumber}). Cancel it first.` });

    // Attack 9 — NO_SHOW re-register block
    const noShow = await Appointment.findOne({
      patient: req.user._id,
      department,
      status: 'NO_SHOW',
      appointmentDate: { $gte: today, $lt: tomorrow },
    });
    if (noShow) return res.status(400).json({ success: false, message: 'You were marked No Show for this department today. Please contact the front desk.' });

    // Attack 3 — Cancel cooldown (10 minutes)
    const recentCancel = await Appointment.findOne({
      patient: req.user._id,
      department,
      status: 'CANCELLED',
      appointmentDate: { $gte: today, $lt: tomorrow },
      updatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });
    if (recentCancel) {
      const waitSecs = Math.ceil((10 * 60 * 1000 - (Date.now() - new Date(recentCancel.updatedAt).getTime())) / 1000);
      const waitMins = Math.ceil(waitSecs / 60);
      return res.status(400).json({ success: false, message: `Please wait ${waitMins} minute(s) before re-registering in ${department}.` });
    }

    // Attack 13 — Doctor queue cap (max 50 appointments per day)
    const todayCount = await Appointment.countDocuments({
      doctor: doctorId,
      appointmentDate: { $gte: today, $lt: tomorrow },
    });
    if (todayCount >= 50) {
      return res.status(400).json({ success: false, message: "This doctor's queue is full for today (50 max). Please choose another doctor." });
    }

    const appointment = await Appointment.create({
      patient: req.user._id, doctor: doctorId, department,
      priority: priority || 3, priorityReason: priorityReason || '',
      symptoms: symptoms || '', appointmentDate: new Date(), status: 'WAITING',
    });

    await appointment.populate([
      { path: 'patient', select: 'name email phone' },
      { path: 'doctor', select: 'name department' },
    ]);

    const io = req.app.get('io');
    await emitQueueUpdate(io, doctorId, department);

    res.status(201).json({ success: true, message: `Registered. Your token: ${appointment.tokenNumber}`, data: { appointment } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route POST /api/appointments/emergency
// Broadcasts to all waiting patients that an emergency arrived
const registerEmergency = async (req, res) => {
  try {
    const { patientId, doctorId, department, symptoms } = req.body;
    if (!patientId || !doctorId || !department) return res.status(400).json({ success: false, message: 'patientId, doctorId and department are required.' });

    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor', department });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    const appointment = await Appointment.create({
      patient: patientId, doctor: doctorId, department,
      priority: 1, priorityReason: 'Emergency — Critical/Life Threatening',
      symptoms: symptoms || '', appointmentDate: new Date(), status: 'WAITING',
    });

    await appointment.populate([
      { path: 'patient', select: 'name email phone' },
      { path: 'doctor', select: 'name department' },
    ]);

    const io = req.app.get('io');
    await emitQueueUpdate(io, doctorId, department);

    // Broadcast emergency alert to ALL waiting patients in this department
    io.to(department).emit('emergency_alert', {
      department,
      message: 'An emergency patient has been added to the queue. Your estimated wait time has increased.',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, message: `EMERGENCY registered. Token ${appointment.tokenNumber} is now #1 in queue.`, data: { appointment } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/appointments/my
const getMyAppointments = async (req, res) => {
  try {
    // First recalculate positions for any active appointments
    // so patient always sees accurate position on dashboard load
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const activeAppts = await Appointment.find({
      patient: req.user._id,
      status: { $in: ['WAITING', 'IN_CONSULTATION'] },
      appointmentDate: { $gte: today, $lt: tomorrow },
    }).populate('doctor', 'name department');

    // Recalculate for each unique doctor the patient is queued with
    const uniqueDoctors = [...new Map(activeAppts.map(a => [a.doctor._id.toString(), a.doctor])).values()];
    const io = req.app.get('io');
    for (const doctor of uniqueDoctors) {
      await emitQueueUpdate(io, doctor._id, doctor.department);
    }

    // Now fetch fresh data with updated positions
    const appointments = await Appointment.find({ patient: req.user._id })
      .populate('doctor', 'name department').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: appointments.length, data: { appointments } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/appointments/queue/:department
const getDepartmentQueue = async (req, res) => {
  try {
    const { department } = req.params;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const queue = await Appointment.find({
      department, status: { $in: ['WAITING', 'IN_CONSULTATION', 'ON_HOLD'] },
      appointmentDate: { $gte: today, $lt: tomorrow },
    }).populate('patient', 'name phone email').populate('doctor', 'name').sort({ priority: 1, createdAt: 1 });

    res.status(200).json({ success: true, count: queue.length, data: { queue } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/appointments/history
const getDoctorHistory = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const history = await Appointment.find({
      doctor: req.user._id,
      status: { $in: ['DONE', 'NO_SHOW', 'CANCELLED'] },
      appointmentDate: { $gte: today, $lt: tomorrow },
    }).populate('patient', 'name phone email').sort({ updatedAt: -1 });
    res.status(200).json({ success: true, count: history.length, data: { history } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route PATCH /api/appointments/:id/status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });

    const appointment = await Appointment.findById(id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.doctor.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const transitions = {
      WAITING:         ['IN_CONSULTATION', 'NO_SHOW'],
      ON_HOLD:         ['IN_CONSULTATION', 'NO_SHOW'], // doctor can still call ON_HOLD patient if they return
      IN_CONSULTATION: ['DONE'],
      DONE:            [],
      NO_SHOW:         [],
      CANCELLED:       [],
    };
    if (!transitions[appointment.status]?.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid transition: ${appointment.status} → ${status}` });
    }

    if (status === 'IN_CONSULTATION') appointment.consultationStartTime = new Date();
    if (status === 'DONE') appointment.consultationEndTime = new Date();
    appointment.status = status;
    await appointment.save();

    const io = req.app.get('io');
    await emitQueueUpdate(io, appointment.doctor, appointment.department);

    // ── ON_HOLD LOGIC ──
    // When patient goes IN_CONSULTATION → put their other WAITING appointments ON_HOLD
    // When patient is DONE → resume all their ON_HOLD appointments back to WAITING
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    if (status === 'IN_CONSULTATION') {
      // Find all other WAITING appointments for this patient today (different department)
      const otherAppts = await Appointment.find({
        patient: appointment.patient,
        _id: { $ne: appointment._id },
        status: 'WAITING',
        appointmentDate: { $gte: today, $lt: tomorrow },
      });

      if (otherAppts.length > 0) {
        for (const other of otherAppts) {
          other.status = 'ON_HOLD';
          other.onHoldAtDepartment = appointment.department;
          await other.save();
          await emitQueueUpdate(io, other.doctor, other.department);

          // Notify patient
          io.to(`patient_${appointment.patient.toString()}`).emit('appointment_on_hold', {
            department: other.department,
            heldAtDepartment: appointment.department,
            message: `Your ${other.department} appointment is ON HOLD while you are in consultation at ${appointment.department}. You will resume your position when done.`,
          });
        }
        console.log(`⏸️  Set ${otherAppts.length} appointment(s) ON_HOLD — patient in ${appointment.department}`);
      }
    }

    if (status === 'DONE') {
      // Resume all ON_HOLD appointments for this patient
      const onHoldAppts = await Appointment.find({
        patient: appointment.patient,
        status: 'ON_HOLD',
        appointmentDate: { $gte: today, $lt: tomorrow },
      });

      if (onHoldAppts.length > 0) {
        for (const other of onHoldAppts) {
          other.status = 'WAITING';
          other.onHoldAtDepartment = null;
          await other.save();
          await emitQueueUpdate(io, other.doctor, other.department);

          // Notify patient
          io.to(`patient_${appointment.patient.toString()}`).emit('appointment_resumed', {
            department: other.department,
            message: `Your ${other.department} appointment has resumed. You are back in the queue.`,
          });
        }
        console.log(`▶️  Resumed ${onHoldAppts.length} ON_HOLD appointment(s) — patient done at ${appointment.department}`);
      }
    }

    res.status(200).json({ success: true, message: `Status updated to ${status}`, data: { appointment } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/appointments/:id/position
const getQueuePosition = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name department').populate('patient', 'name');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (req.user.role === 'patient' && appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    res.status(200).json({ success: true, data: {
      tokenNumber: appointment.tokenNumber, status: appointment.status,
      queuePosition: appointment.queuePosition, estimatedWaitMinutes: appointment.estimatedWait,
      department: appointment.department, doctor: appointment.doctor.name, priority: appointment.priority,
    }});
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route PATCH /api/appointments/:id/cancel
const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.patient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (!['WAITING', 'ON_HOLD'].includes(appointment.status)) return res.status(400).json({ success: false, message: `Cannot cancel — appointment is ${appointment.status}.` });

    appointment.status = 'CANCELLED';
    await appointment.save();

    const io = req.app.get('io');
    await emitQueueUpdate(io, appointment.doctor, appointment.department);
    res.status(200).json({ success: true, message: 'Appointment cancelled.', data: { appointment } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route POST /api/appointments/auto-assign
// Feature 10 — Multi-doctor load balancing
// Assigns patient to doctor with shortest queue in department
const autoAssignDoctor = async (req, res) => {
  try {
    const { department, priority, priorityReason, symptoms } = req.body;
    if (!department) return res.status(400).json({ success: false, message: 'Department is required.' });

    // Attack 4 — Patient cannot self-register as P1 Emergency
    if (Number(priority) === 1) {
      return res.status(403).json({ success: false, message: 'Emergency registration must be done by a doctor or admin.' });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    // Check no active appointment in SAME department
    const existing = await Appointment.findOne({
      patient: req.user._id,
      department,
      status: { $in: ['WAITING', 'IN_CONSULTATION'] },
      appointmentDate: { $gte: today, $lt: tomorrow },
    });
    if (existing) return res.status(400).json({ success: false, message: `You already have an active appointment in ${department} (Token: ${existing.tokenNumber}). Cancel it first.` });

    // Get all available doctors in department
    const doctors = await User.find({ role: 'doctor', department, isAvailable: true });
    if (doctors.length === 0) return res.status(404).json({ success: false, message: 'No available doctors in this department.' });

    // Count waiting patients per doctor — assign to doctor with fewest
    const doctorLoads = await Promise.all(doctors.map(async (doc) => {
      const count = await Appointment.countDocuments({
        doctor: doc._id, status: { $in: ['WAITING', 'IN_CONSULTATION'] },
        appointmentDate: { $gte: today, $lt: tomorrow },
      });
      return { doctor: doc, count };
    }));

    // Sort by load — pick doctor with fewest patients
    doctorLoads.sort((a, b) => a.count - b.count);
    const assignedDoctor = doctorLoads[0].doctor;

    const appointment = await Appointment.create({
      patient: req.user._id, doctor: assignedDoctor._id, department,
      priority: priority || 3, priorityReason: priorityReason || '',
      symptoms: symptoms || '', appointmentDate: new Date(), status: 'WAITING',
    });

    await appointment.populate([
      { path: 'patient', select: 'name email phone' },
      { path: 'doctor', select: 'name department' },
    ]);

    const io = req.app.get('io');
    await emitQueueUpdate(io, assignedDoctor._id, department);

    res.status(201).json({
      success: true,
      message: `Auto-assigned to Dr. ${assignedDoctor.name} (${doctorLoads[0].count} patients waiting). Token: ${appointment.tokenNumber}`,
      data: { appointment, assignedDoctor: { name: assignedDoctor.name, currentLoad: doctorLoads[0].count } },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route POST /api/appointments/reassign
// Feature 12 — Admin reassigns patients from one doctor to another
const reassignPatients = async (req, res) => {
  try {
    const { fromDoctorId, toDoctorId, department } = req.body;
    if (!fromDoctorId || !toDoctorId || !department) return res.status(400).json({ success: false, message: 'fromDoctorId, toDoctorId and department are required.' });

    const toDoctor = await User.findById(toDoctorId);
    if (!toDoctor) return res.status(404).json({ success: false, message: 'Target doctor not found.' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    // Reassign all WAITING patients (not IN_CONSULTATION — can't interrupt)
    const result = await Appointment.updateMany(
      { doctor: fromDoctorId, status: 'WAITING', appointmentDate: { $gte: today, $lt: tomorrow } },
      { $set: { doctor: toDoctorId } }
    );

    const io = req.app.get('io');
    // Recalculate both doctors' queues
    await emitQueueUpdate(io, fromDoctorId, department);
    await emitQueueUpdate(io, toDoctorId, department);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} patient(s) reassigned to Dr. ${toDoctor.name}`,
      data: { reassigned: result.modifiedCount },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route POST /api/appointments/:id/rate
// Feature 8 — Patient rates doctor after DONE
const rateAppointment = async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.patient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (appointment.status !== 'DONE') return res.status(400).json({ success: false, message: 'Can only rate completed appointments.' });
    if (appointment.patientRating) return res.status(400).json({ success: false, message: 'Already rated.' });

    appointment.patientRating = rating;
    await appointment.save();

    res.status(200).json({ success: true, message: 'Thank you for your feedback!', data: { rating } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route PATCH /api/appointments/:id/notes
// Feature 9 — Doctor adds notes after consultation
const addDoctorNotes = async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes) return res.status(400).json({ success: false, message: 'Notes are required.' });

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.doctor.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (appointment.status !== 'DONE') return res.status(400).json({ success: false, message: 'Can only add notes to completed appointments.' });

    appointment.doctorNotes = notes;
    await appointment.save();

    res.status(200).json({ success: true, message: 'Notes saved.', data: { notes } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route PATCH /api/appointments/:id/pause
// Patient steps away — pauses their own position
// Attack 1 — only top 3
// Attack 2 — one step away at a time
// Attack 11 — min 2 min hold before I'm back
// Attack 21 — max 2 step aways per appointment
const pauseAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.patient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (appointment.status !== 'WAITING') return res.status(400).json({ success: false, message: `Cannot step away — appointment is ${appointment.status}.` });

    // Attack 21 — max 2 step aways per appointment
    if (appointment.stepAwayCount >= 2) {
      return res.status(400).json({ success: false, message: 'You have used your maximum step away allowance (2 times) for this appointment.' });
    }

    // Attack 1 — only available in top 3 positions
    if (appointment.queuePosition > 3) {
      return res.status(400).json({ success: false, message: `Step Away is only available when you are in the top 3. You are currently #${appointment.queuePosition}.` });
    }

    // Attack 21 — one step away at a time across all appointments
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const alreadyPaused = await Appointment.findOne({
      patient: req.user._id,
      status: 'ON_HOLD',
      onHoldAtDepartment: null,
      _id: { $ne: appointment._id },
      appointmentDate: { $gte: today, $lt: tomorrow },
    });
    if (alreadyPaused) {
      return res.status(400).json({ success: false, message: 'You already have a paused appointment. Return first before stepping away from another.' });
    }

    appointment.status = 'ON_HOLD';
    appointment.onHoldAtDepartment = null;
    appointment.stepAwayCount = (appointment.stepAwayCount || 0) + 1;
    appointment.stepAwayAt    = new Date();
    await appointment.save();

    const io = req.app.get('io');
    await emitQueueUpdate(io, appointment.doctor, appointment.department);

    io.to(appointment.department).emit('patient_stepped_away', {
      appointmentId: appointment._id,
      tokenNumber:   appointment.tokenNumber,
      patientName:   req.user.name,
      department:    appointment.department,
    });

    const remaining = 2 - appointment.stepAwayCount;
    res.status(200).json({
      success: true,
      message: `Position paused. ${remaining} step away(s) remaining. Return within 15 minutes or you will be moved to back of queue.`,
      data: { appointment, stepAwaysRemaining: remaining },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route POST /api/appointments/:id/notify-return
// Patient notifies doctor they are back after being skipped/stepped away
// Attack 6/19 — 5 minute cooldown between notifications
const notifyPatientReturn = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.patient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (appointment.status !== 'ON_HOLD') return res.status(400).json({ success: false, message: 'Appointment is not on hold.' });
    if (appointment.onHoldAtDepartment) return res.status(400).json({ success: false, message: "Use I'm back only when you were skipped — not for multi-dept hold." });

    // Attack 6/19 — 5 min cooldown between notifications
    if (appointment.patientNotifiedReturnAt) {
      const cooldown = 5 * 60 * 1000;
      const elapsed  = Date.now() - new Date(appointment.patientNotifiedReturnAt).getTime();
      if (elapsed < cooldown) {
        const secsLeft = Math.ceil((cooldown - elapsed) / 1000);
        return res.status(429).json({ success: false, message: `Please wait ${secsLeft} seconds before notifying again.` });
      }
    }

    // Attack 11 — minimum 2 min hold before I'm back
    if (appointment.stepAwayAt) {
      const minHold = 2 * 60 * 1000;
      const held    = Date.now() - new Date(appointment.stepAwayAt).getTime();
      if (held < minHold) {
        const secsLeft = Math.ceil((minHold - held) / 1000);
        return res.status(400).json({ success: false, message: `Please wait ${secsLeft} more seconds before notifying return.` });
      }
    }

    appointment.patientNotifiedReturnAt = new Date();
    await appointment.save();

    const io = req.app.get('io');
    io.to(appointment.department).emit('patient_returned', {
      appointmentId: appointment._id,
      tokenNumber:   appointment.tokenNumber,
      patientName:   req.user.name,
      department:    appointment.department,
    });

    res.status(200).json({ success: true, message: 'Doctor has been notified. Please wait to be called.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
  registerAppointment, registerEmergency, getMyAppointments,
  pauseAppointment, notifyPatientReturn,
  getDepartmentQueue, getDoctorHistory, updateAppointmentStatus,
  getQueuePosition, cancelAppointment, autoAssignDoctor,
  reassignPatients, rateAppointment, addDoctorNotes,
};
