const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// Send token in response
const sendTokenResponse = (user, statusCode, res) => {
  const token    = signToken(user._id);
  user.password  = undefined; // Don't send password back
  res.status(statusCode).json({ success: true, token, data: { user } });
};

// @route  POST /api/auth/register
// @access Public
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role, department } = req.body;

    if (role === 'admin') return res.status(400).json({ success: false, message: 'Cannot self-register as admin.' });
    if (role === 'doctor' && !department) return res.status(400).json({ success: false, message: 'Department is required for doctors.' });

    const user = await User.create({ name, email, password, phone, role, department });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Email already registered.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// @route  POST /api/auth/login
// @access Public
// Attack 22 — Brute force protection
// Max 5 failed attempts → account locked for 15 minutes
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password.' });

    // Explicitly select password (it's select: false in schema)
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // Check if account is locked
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ success: false, message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).` });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      const attemptsLeft = 5 - user.loginAttempts;
      return res.status(401).json({
        success: false,
        message: attemptsLeft > 0
          ? `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`
          : 'Account locked for 15 minutes due to too many failed attempts.',
      });
    }

    // Successful login — reset attempts
    await user.resetLoginAttempts();
    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @route  GET /api/auth/me
// @access Private
const getMe = async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
};

module.exports = { register, login, getMe };
