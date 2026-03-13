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
  windowMs: 15 * 60 * 1000, max: 200,
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
router.get('/:id/position',   protect, userLimiter, getQueuePosition);
router.patch('/:id/status',   protect, userLimiter, authorize('doctor'), updateAppointmentStatus);
router.patch('/:id/cancel',   protect, userLimiter, authorize('patient'), cancelAppointment);
router.post('/:id/rate',      protect, userLimiter, authorize('patient'), rateAppointment);
router.patch('/:id/notes',    protect, userLimiter, authorize('doctor'), addDoctorNotes);

module.exports = router;