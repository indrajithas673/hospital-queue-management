const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  createDoctor, createPatient, getAllDoctors, getAllPatients,
  toggleDoctorAvailability, toggleMyAvailability, getDoctorsByDepartment,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  keyGenerator: (req, res) => req.user ? req.user._id.toString() : require('express-rate-limit').ipKeyGenerator(req, res),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Public to all logged-in users
router.get('/doctors/by-department/:department', protect, userLimiter, getDoctorsByDepartment);

// Doctor toggles own availability
router.patch('/doctors/my-availability', protect, userLimiter, authorize('doctor'), toggleMyAvailability);

// Admin only
router.use(protect, authorize('admin'));
router.post('/doctors',                   userLimiter, createDoctor);
router.post('/patients',                  userLimiter, createPatient);
router.get('/doctors',                    userLimiter, getAllDoctors);
router.get('/patients',                   userLimiter, getAllPatients);
router.patch('/doctors/:id/availability', userLimiter, toggleDoctorAvailability);

module.exports = router;