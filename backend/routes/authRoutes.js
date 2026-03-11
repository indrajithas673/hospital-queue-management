const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// IP based limiters for public routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many registration attempts. Try again in an hour.' },
});

router.post('/register', registerLimiter, register);
router.post('/login', generalLimiter, login);
router.get('/me', protect, getMe);

module.exports = router;