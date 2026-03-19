/**
 * Frontend validation utilities
 * Validates before hitting the backend — faster feedback, more professional
 */

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone) => {
  if (!phone) return true; // phone is optional
  const re = /^[+]?[\d\s\-()]{7,15}$/;
  return re.test(phone);
};

export const validatePassword = (password) => {
  return password && password.length >= 6;
};

export const validateRegisterForm = (form) => {
  const errors = [];
  if (!form.name?.trim()) errors.push('Name is required');
  if (!validateEmail(form.email)) errors.push('Valid email is required');
  if (!validatePassword(form.password)) errors.push('Password must be at least 6 characters');
  if (form.phone && !validatePhone(form.phone)) errors.push('Invalid phone number');
  if (form.role === 'doctor' && !form.department) errors.push('Department is required for doctors');
  return errors;
};

export const validateLoginForm = (form) => {
  const errors = [];
  if (!validateEmail(form.email)) errors.push('Valid email is required');
  if (!form.password) errors.push('Password is required');
  return errors;
};

export const validateAppointmentForm = (form) => {
  const errors = [];
  if (!form.department) errors.push('Please select a department');
  if (!form.autoAssign && !form.doctorId) errors.push('Please select a doctor or enable auto-assign');
  return errors;
};

export const validateDoctorForm = (form) => {
  const errors = [];
  if (!form.name?.trim()) errors.push('Name is required');
  if (!validateEmail(form.email)) errors.push('Valid email is required');
  if (!validatePassword(form.password)) errors.push('Password must be at least 6 characters');
  if (!form.department) errors.push('Department is required');
  return errors;
};

export const validatePatientForm = (form) => {
  const errors = [];
  if (!form.name?.trim()) errors.push('Name is required');
  if (!validateEmail(form.email)) errors.push('Valid email is required');
  if (!validatePassword(form.password)) errors.push('Password must be at least 6 characters');
  return errors;
};
