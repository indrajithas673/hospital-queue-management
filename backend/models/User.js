const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // never return password in queries by default
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      default: 'patient',
    },
    // Doctor-specific fields
    department: {
      type: String,
      // required only if role is doctor
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Attack 22 — Brute force protection
    loginAttempts: { type: Number, default: 0 },
    lockUntil:     { type: Date,   default: null },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment failed login attempts
userSchema.methods.incLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME    = 15 * 60 * 1000; // 15 minutes

  this.loginAttempts += 1;

  if (this.loginAttempts >= MAX_ATTEMPTS) {
    this.lockUntil     = new Date(Date.now() + LOCK_TIME);
    this.loginAttempts = 0; // reset after locking
  }

  await this.save();
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil     = null;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
