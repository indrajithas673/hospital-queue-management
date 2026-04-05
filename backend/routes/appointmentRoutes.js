const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const Appointment = require('../models/Appointment');
const {
  registerAppointment, registerEmergency, getMyAppointments,
  getDepartmentQueue, getDoctorHistory, updateAppointmentStatus,
  getQueuePosition, cancelAppointment, autoAssignDoctor,
  reassignPatients, rateAppointment, addDoctorNotes,
  pauseAppointment, notifyPatientReturn,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 10000, max: 100000,
  keyGenerator: (req) => req.user ? req.user._id.toString() : ipKeyGenerator(req),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// ── Static named routes first ──
router.post('/register',     protect, userLimiter, authorize('patient'), registerAppointment);
router.post('/emergency',    protect, userLimiter, authorize('doctor', 'admin'), registerEmergency);
router.post('/auto-assign',  protect, userLimiter, authorize('patient'), autoAssignDoctor);
router.post('/reassign',     protect, userLimiter, authorize('admin'), reassignPatients);
router.get('/my',            protect, userLimiter, authorize('patient'), getMyAppointments);
router.get('/history',       protect, userLimiter, authorize('doctor'), getDoctorHistory);
router.get('/queue/:department', protect, userLimiter, authorize('doctor', 'admin'), getDepartmentQueue);
// Public queue display route (for waiting room TV boards) — no auth required, sanitized data
router.get('/display/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const Appointment = require('../models/Appointment');
    const queue = await Appointment.find({
      department, status: { $in: ['WAITING', 'IN_CONSULTATION', 'ON_HOLD'] },
      appointmentDate: { $gte: today, $lt: tomorrow },
    }).populate('doctor', 'name').sort({ priority: 1, createdAt: 1 });
    // Sanitize — strip patient PII for public display
    const sanitized = queue.map(a => ({
      _id: a._id, tokenNumber: a.tokenNumber, status: a.status,
      priority: a.priority, queuePosition: a.queuePosition,
      estimatedWait: a.estimatedWait, doctor: a.doctor,
      onHoldAtDepartment: a.onHoldAtDepartment,
      consultationStartTime: a.consultationStartTime,
    }));
    res.status(200).json({ success: true, count: sanitized.length, data: { queue: sanitized } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ── Public token tracking ──
router.get('/track/:tokenNumber', async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ tokenNumber: req.params.tokenNumber })
      .populate('doctor', 'name department').select('-patient');
    if (!appointment) return res.status(404).json({ success: false, message: 'Token not found.' });
    res.status(200).json({ success: true, data: {
      tokenNumber: appointment.tokenNumber, department: appointment.department,
      doctor: appointment.doctor?.name, status: appointment.status,
      queuePosition: appointment.queuePosition, estimatedWaitMinutes: appointment.estimatedWait,
      priority: appointment.priority,
    }});
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ── Dynamic :id routes last ──
router.get('/:id/position',        protect, userLimiter, getQueuePosition);
router.patch('/:id/status',        protect, userLimiter, authorize('doctor'), updateAppointmentStatus);
router.patch('/:id/cancel',        protect, userLimiter, authorize('patient'), cancelAppointment);
router.post('/:id/rate',           protect, userLimiter, authorize('patient'), rateAppointment);
router.patch('/:id/notes',         protect, userLimiter, authorize('doctor'), addDoctorNotes);
router.patch('/:id/pause',         protect, userLimiter, authorize('patient'), pauseAppointment);
router.post('/:id/notify-return',  protect, userLimiter, authorize('patient'), notifyPatientReturn);

module.exports = router;