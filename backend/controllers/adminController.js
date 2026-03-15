const User = require('../models/User');
const Appointment = require('../models/Appointment');

// @route POST /api/admin/doctors
const createDoctor = async (req, res) => {
  try {
    const { name, email, password, phone, department } = req.body;
    if (!department) return res.status(400).json({ success: false, message: 'Department is required.' });
    const doctor = await User.create({ name, email, password, phone, department, role: 'doctor' });
    doctor.password = undefined;
    res.status(201).json({ success: true, data: { doctor } });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// @route POST /api/admin/patients
const createPatient = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const patient = await User.create({ name, email, password, phone, role: 'patient' });
    patient.password = undefined;
    res.status(201).json({ success: true, data: { patient } });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// @route GET /api/admin/doctors
const getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-password');
    res.status(200).json({ success: true, count: doctors.length, data: { doctors } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/admin/doctors/by-department/:department
const getDoctorsByDepartment = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', department: req.params.department, isAvailable: true })
      .select('_id name department isAvailable');
    res.status(200).json({ success: true, count: doctors.length, data: { doctors } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/admin/patients
const getAllPatients = async (req, res) => {
  try {
    const patients = await User.find({ role: 'patient' }).select('-password');
    res.status(200).json({ success: true, count: patients.length, data: { patients } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Helper — reassign all waiting patients of a doctor to least busy available doctor
const autoReassignPatients = async (doctor, io) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // Find other available doctors in same department
  const otherDoctors = await User.find({
    _id: { $ne: doctor._id },
    role: 'doctor',
    department: doctor.department,
    isAvailable: true,
  });

  if (otherDoctors.length === 0) {
    console.log(`⚠️  No other available doctors in ${doctor.department} — patients stay in queue`);
    return 0;
  }

  // Get all waiting patients of this doctor
  const waitingPatients = await Appointment.find({
    doctor: doctor._id,
    status: 'WAITING',
    appointmentDate: { $gte: today, $lt: tomorrow },
  });

  if (waitingPatients.length === 0) return 0;

  // Reassign each patient to least busy doctor
  for (const appt of waitingPatients) {
    const loads = await Promise.all(otherDoctors.map(async d => ({
      doctor: d,
      count: await Appointment.countDocuments({
        doctor: d._id,
        status: { $in: ['WAITING', 'IN_CONSULTATION'] },
        appointmentDate: { $gte: today, $lt: tomorrow },
      }),
    })));
    loads.sort((a, b) => a.count - b.count);
    appt.doctor = loads[0].doctor._id;
    await appt.save();
  }

  console.log(`⚡ Auto-reassigned ${waitingPatients.length} patients from Dr. ${doctor.name} in ${doctor.department}`);

  // Recalculate queue for this department
  const { recalculateQueue, sanitizeQueueForBroadcast } = require('../services/queueEngine');
  for (const d of otherDoctors) {
    const updatedQueue = await recalculateQueue(doctor.department, d._id);
    // Attack 18 — Strip PII from socket broadcast
    io.to(doctor.department).emit('queue_updated', {
      department: doctor.department,
      queue: sanitizeQueueForBroadcast(updatedQueue),
      timestamp: new Date().toISOString(),
    });
  }

  return waitingPatients.length;
};

// @route PATCH /api/admin/doctors/:id/availability
// When doctor goes unavailable — auto-reassign their waiting patients
const toggleDoctorAvailability = async (req, res) => {
  try {
    const doctor = await User.findById(req.params.id);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const wasAvailable = doctor.isAvailable;
    doctor.isAvailable = !doctor.isAvailable;
    await doctor.save();

    const io = req.app.get('io');

    // Broadcast availability change
    io.to('admin_room').emit('doctor_updated', {
      doctorId: doctor._id,
      isAvailable: doctor.isAvailable,
    });
    io.to(doctor.department).emit('doctor_updated', {
      doctorId: doctor._id,
      isAvailable: doctor.isAvailable,
    });

    // Auto-reassign if doctor just went unavailable
    let reassigned = 0;
    if (wasAvailable && !doctor.isAvailable) {
      reassigned = await autoReassignPatients(doctor, io);
    }

    res.status(200).json({
      success: true,
      message: `Dr. ${doctor.name} is now ${doctor.isAvailable ? 'available' : 'unavailable'}${reassigned > 0 ? `. ${reassigned} patient(s) auto-reassigned.` : ''}`,
      data: { isAvailable: doctor.isAvailable, patientsReassigned: reassigned },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route PATCH /api/admin/doctors/my-availability
// Doctor toggles their own availability — also triggers auto-reassign
const toggleMyAvailability = async (req, res) => {
  try {
    const doctor = await User.findById(req.user._id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    const wasAvailable = doctor.isAvailable;
    doctor.isAvailable = !doctor.isAvailable;
    await doctor.save();

    const io = req.app.get('io');

    io.to('admin_room').emit('doctor_updated', {
      doctorId: doctor._id,
      isAvailable: doctor.isAvailable,
    });
    io.to(doctor.department).emit('doctor_updated', {
      doctorId: doctor._id,
      isAvailable: doctor.isAvailable,
    });

    // Auto-reassign if doctor just went unavailable
    let reassigned = 0;
    if (wasAvailable && !doctor.isAvailable) {
      reassigned = await autoReassignPatients(doctor, io);
    }

    res.status(200).json({
      success: true,
      message: `You are now ${doctor.isAvailable ? 'available' : 'unavailable'}${reassigned > 0 ? `. ${reassigned} patient(s) auto-reassigned.` : ''}`,
      data: { isAvailable: doctor.isAvailable, patientsReassigned: reassigned },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
  createDoctor, createPatient, getAllDoctors, getAllPatients,
  toggleDoctorAvailability, toggleMyAvailability, getDoctorsByDepartment,
};
