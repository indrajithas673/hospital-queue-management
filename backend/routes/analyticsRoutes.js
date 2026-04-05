const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const {
  getAverageWaitTime,
  getPeakHours,
  getDoctorLoad,
  getDepartmentSummary,
  getQueueSnapshotAPI,
  getDoctorRatings,
  getNoShowRate,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 10000, max: 100000,
  keyGenerator: (req) => req.user ? req.user._id.toString() : ipKeyGenerator(req),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

router.get('/wait-time', protect, userLimiter, authorize('admin', 'doctor'), getAverageWaitTime);
router.get('/peak-hours', protect, userLimiter, authorize('admin'), getPeakHours);
router.get('/doctor-load', protect, userLimiter, authorize('admin'), getDoctorLoad);
router.get('/department-summary', protect, userLimiter, authorize('admin', 'doctor', 'patient'), getDepartmentSummary);
router.get('/queue-snapshot/:department', protect, userLimiter, authorize('admin', 'doctor'), getQueueSnapshotAPI);
router.get('/doctor-ratings', protect, userLimiter, authorize('admin'), getDoctorRatings);
router.get('/noshow-rate',    protect, userLimiter, authorize('admin'), getNoShowRate);

module.exports = router;