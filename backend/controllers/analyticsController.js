const Appointment = require('../models/Appointment');
const { getQueueSnapshot } = require('../services/queueEngine');

/**
 * ANALYTICS CONTROLLER
 *
 * All metrics are COMPUTED from real data — not counts.
 * This is what separates an intelligent system from a CRUD app.
 *
 * Metrics available:
 *   1. Average wait time per department (real avg from consultationStartTime - createdAt)
 *   2. Average consultation duration per doctor (real avg from end - start)
 *   3. Peak hours — which hours have highest patient volume
 *   4. Doctor load today — patients handled per doctor with breakdown
 *   5. Department summary — live counts with priority breakdown
 *   6. Queue snapshot — P1/P2/P3 bucket view for a department
 */

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/analytics/wait-time
// @access Private (admin, doctor)
//
// Computes REAL average wait and consultation times per department
// Formula: avgWait = avg(consultationStartTime - createdAt) for all DONE appointments
// ─────────────────────────────────────────────────────────────────────────────
const getAverageWaitTime = async (req, res) => {
  try {
    const result = await Appointment.aggregate([
      {
        $match: {
          status: 'DONE',
          consultationStartTime: { $exists: true, $ne: null },
          consultationEndTime: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          department: 1,
          // Real wait = time from registration to when doctor called them in
          waitMinutes: {
            $divide: [{ $subtract: ['$consultationStartTime', '$createdAt'] }, 60000],
          },
          // Real consultation duration = time from call-in to done
          consultationMinutes: {
            $divide: [{ $subtract: ['$consultationEndTime', '$consultationStartTime'] }, 60000],
          },
          priority: 1,
        },
      },
      {
        $group: {
          _id: '$department',
          avgWaitMinutes: { $avg: '$waitMinutes' },
          avgConsultationMinutes: { $avg: '$consultationMinutes' },
          totalPatientsSeen: { $sum: 1 },
          // Also break down avg wait by priority — shows P1/P2 get faster service
          avgWaitP1: {
            $avg: { $cond: [{ $eq: ['$priority', 1] }, '$waitMinutes', null] },
          },
          avgWaitP2: {
            $avg: { $cond: [{ $eq: ['$priority', 2] }, '$waitMinutes', null] },
          },
          avgWaitP3: {
            $avg: { $cond: [{ $eq: ['$priority', 3] }, '$waitMinutes', null] },
          },
        },
      },
      {
        $project: {
          department: '$_id',
          avgWaitMinutes: { $round: ['$avgWaitMinutes', 1] },
          avgConsultationMinutes: { $round: ['$avgConsultationMinutes', 1] },
          totalPatientsSeen: 1,
          avgWaitByPriority: {
            P1_Emergency: { $round: ['$avgWaitP1', 1] },
            P2_Priority: { $round: ['$avgWaitP2', 1] },
            P3_Normal: { $round: ['$avgWaitP3', 1] },
          },
          _id: 0,
        },
      },
      { $sort: { avgWaitMinutes: -1 } },
    ]);

    res.status(200).json({ success: true, data: { analytics: result } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/analytics/peak-hours
// @access Private (admin)
//
// Groups registrations by hour of day → shows which hours are busiest
// Example output: 9:00 = 45 patients, 10:00 = 62 patients, 14:00 = 38 patients
// ─────────────────────────────────────────────────────────────────────────────
const getPeakHours = async (req, res) => {
  try {
    const result = await Appointment.aggregate([
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
          emergencies: { $sum: { $cond: [{ $eq: ['$priority', 1] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          hour: '$_id',
          count: 1,
          emergencies: 1,
          label: { $concat: [{ $toString: '$_id' }, ':00'] },
          _id: 0,
        },
      },
    ]);

    // Find peak hour
    const peak = result.reduce((max, h) => (h.count > max.count ? h : max), { count: 0, hour: 0 });

    res.status(200).json({
      success: true,
      data: {
        peakHours: result,
        peakHour: peak.label,
        peakCount: peak.count,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/analytics/doctor-load
// @access Private (admin)
//
// Shows today's patient load per doctor with full status breakdown
// ─────────────────────────────────────────────────────────────────────────────
const getDoctorLoad = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await Appointment.aggregate([
      { $match: { appointmentDate: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: '$doctor',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
          waiting: { $sum: { $cond: [{ $eq: ['$status', 'WAITING'] }, 1, 0] } },
          inConsultation: { $sum: { $cond: [{ $eq: ['$status', 'IN_CONSULTATION'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
          emergencies: { $sum: { $cond: [{ $eq: ['$priority', 1] }, 1, 0] } },
          // Avg consultation time for this doctor today
          totalConsultMs: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$status', 'DONE'] },
                  { $ne: ['$consultationStartTime', null] },
                  { $ne: ['$consultationEndTime', null] },
                ]},
                { $subtract: ['$consultationEndTime', '$consultationStartTime'] },
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctorInfo',
        },
      },
      { $unwind: '$doctorInfo' },
      {
        $project: {
          doctorName: '$doctorInfo.name',
          department: '$doctorInfo.department',
          isAvailable: '$doctorInfo.isAvailable',
          total: 1,
          done: 1,
          waiting: 1,
          inConsultation: 1,
          noShow: 1,
          emergencies: 1,
          // Compute avg consultation minutes: totalMs / done / 60000
          avgConsultationMinutes: {
            $cond: [
              { $gt: ['$done', 0] },
              { $round: [{ $divide: [{ $divide: ['$totalConsultMs', '$done'] }, 60000] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.status(200).json({ success: true, data: { doctorLoad: result } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/analytics/department-summary
// @access Private (admin)
//
// Today's live summary per department with priority breakdown
// ─────────────────────────────────────────────────────────────────────────────
const getDepartmentSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await Appointment.aggregate([
      { $match: { appointmentDate: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: '$department',
          totalPatients: { $sum: 1 },
          currentlyWaiting: { $sum: { $cond: [{ $eq: ['$status', 'WAITING'] }, 1, 0] } },
          inConsultation: { $sum: { $cond: [{ $eq: ['$status', 'IN_CONSULTATION'] }, 1, 0] } },
          done: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
          p1Count: { $sum: { $cond: [{ $eq: ['$priority', 1] }, 1, 0] } },
          p2Count: { $sum: { $cond: [{ $eq: ['$priority', 2] }, 1, 0] } },
          p3Count: { $sum: { $cond: [{ $eq: ['$priority', 3] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, data: { departments: result } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/analytics/queue-snapshot/:department
// @access Private (admin, doctor)
//
// Returns P1/P2/P3 bucket breakdown for a department
// Shows clearly how many patients are in each priority tier
// ─────────────────────────────────────────────────────────────────────────────
const getQueueSnapshotAPI = async (req, res) => {
  try {
    const { department } = req.params;
    const snapshot = await getQueueSnapshot(department);

    res.status(200).json({
      success: true,
      data: {
        department,
        summary: {
          total: snapshot.total,
          waiting: snapshot.waitingCount,
          avgEstimatedWaitMinutes: snapshot.avgWait,
          byPriority: {
            P1_Emergency: snapshot.p1.length,
            P2_Priority: snapshot.p2.length,
            P3_Normal: snapshot.p3.length,
          },
        },
        buckets: {
          P1_Emergency: snapshot.p1,
          P2_Priority: snapshot.p2,
          P3_Normal: snapshot.p3,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @route GET /api/analytics/doctor-ratings
// Feature 8 — Average doctor ratings
const getDoctorRatings = async (req, res) => {
  try {
    const result = await require('../models/Appointment').aggregate([
      { $match: { patientRating: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$doctor',
          avgRating: { $avg: '$patientRating' },
          totalRatings: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ['$patientRating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$patientRating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$patientRating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$patientRating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$patientRating', 1] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctorInfo' } },
      { $unwind: '$doctorInfo' },
      {
        $project: {
          doctorName: '$doctorInfo.name',
          department: '$doctorInfo.department',
          avgRating: { $round: ['$avgRating', 1] },
          totalRatings: 1,
          distribution: { 5: '$rating5', 4: '$rating4', 3: '$rating3', 2: '$rating2', 1: '$rating1' },
        },
      },
      { $sort: { avgRating: -1 } },
    ]);
    res.status(200).json({ success: true, data: { ratings: result } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route GET /api/analytics/noshowrate
// Attack 12 — Detect doctor collusion via high NO_SHOW rate
const getNoShowRate = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await require('../models/Appointment').aggregate([
      { $match: { appointmentDate: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: '$doctor',
          total:   { $sum: 1 },
          noShows: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
        },
      },
      {
        $project: {
          total: 1, noShows: 1,
          noShowRate: { $cond: [{ $gt: ['$total', 0] }, { $divide: ['$noShows', '$total'] }, 0] },
          flagged: { $gte: [{ $divide: ['$noShows', { $max: ['$total', 1] }] }, 0.3] },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctorInfo' } },
      { $unwind: '$doctorInfo' },
      {
        $project: {
          doctorName: '$doctorInfo.name',
          department: '$doctorInfo.department',
          total: 1, noShows: 1,
          noShowRate: { $round: [{ $multiply: ['$noShowRate', 100] }, 1] },
          flagged: 1,
        },
      },
      { $sort: { noShowRate: -1 } },
    ]);

    res.status(200).json({ success: true, data: { noShowRates: result } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
  getAverageWaitTime,
  getPeakHours,
  getDoctorLoad,
  getDepartmentSummary,
  getQueueSnapshotAPI,
  getDoctorRatings,
  getNoShowRate,
};
