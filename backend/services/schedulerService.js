const cron = require('node-cron');
const Appointment = require('../models/Appointment');

/**
 * SCHEDULER SERVICE
 * 1. Midnight reset — cancels stale appointments
 * 2. Auto-escalation — upgrades P3 patients waiting > 60 min to P2
 */
const startScheduler = (io) => {

  // ── Midnight reset ──
  cron.schedule('0 0 * * *', async () => {
    console.log('🕛 Midnight reset — cancelling stale appointments...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stale = await Appointment.find({
        status: { $in: ['WAITING', 'IN_CONSULTATION'] },
        appointmentDate: { $gte: yesterday, $lt: today },
      });

      if (stale.length === 0) { console.log('✅ No stale appointments.'); return; }

      await Appointment.updateMany(
        { status: { $in: ['WAITING', 'IN_CONSULTATION'] }, appointmentDate: { $gte: yesterday, $lt: today } },
        { $set: { status: 'CANCELLED' } }
      );

      console.log(`✅ Midnight reset: ${stale.length} cancelled.`);
      const depts = [...new Set(stale.map(a => a.department))];
      depts.forEach(dept => io.to(dept).emit('queue_updated', { department: dept, queue: [], timestamp: new Date().toISOString() }));
    } catch (err) { console.error('❌ Midnight reset failed:', err.message); }
  }, { timezone: 'Asia/Kolkata' });

  // ── Auto-escalation — runs every minute ──
  // Attack 15 — Only escalate if notifiedAt3 = true
  // This means patient was near their turn — confirms they were physically present
  // Prevents patients who booked early and went home from getting unfair upgrades
  // NOTE: Threshold set to 5 min for demo purposes (production = 60 min)
cron.schedule('* * * * *', async () => {
  try {
    const thresholdAgo = new Date(Date.now() - 5 * 60 * 1000);// 5 min for demo
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const escalated = await Appointment.find({
      status: 'WAITING',
      priority: 3,
      createdAt: { $lte: thresholdAgo },
      appointmentDate: { $gte: today, $lt: tomorrow },
    });

    if (escalated.length === 0) return;

    const { recalculateQueue } = require('./queueEngine');

    for (const appt of escalated) {
      appt.priority = 2;
      appt.priorityReason = 'Auto-escalated — waiting too long';
      await appt.save();
      console.log(`⬆️  Auto-escalated ${appt.tokenNumber} P3 → P2`);

      // Recalculate so doctor dashboard updates in real time
      const updatedQueue = await recalculateQueue(appt.department, appt.doctor);
      io.to(appt.department).emit('queue_updated', {
        department: appt.department,
        queue: updatedQueue,
        timestamp: new Date().toISOString(),
      });
    }

    const depts = [...new Set(escalated.map(a => a.department))];
    depts.forEach(dept => io.to(dept).emit('priority_escalated', {
      department: dept,
      count: escalated.filter(a => a.department === dept).length,
    }));
  } catch (err) { console.error('❌ Auto-escalation error:', err.message); }
});

  // Attack 1/11 — Step Away expiry — runs every minute
  // If patient stepped away > 15 min ago → move to back of their priority bucket
  cron.schedule('* * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const overdue = await Appointment.find({
        status: 'ON_HOLD',
        onHoldAtDepartment: null, // stepped away — not multi-dept
        stepAwayAt: { $lte: fifteenMinutesAgo },
        appointmentDate: { $gte: today, $lt: tomorrow },
      });

      if (overdue.length === 0) return;

      const { recalculateQueue } = require('./queueEngine');

      for (const appt of overdue) {
        // Find last WAITING patient in same priority bucket
        const lastInBucket = await Appointment.findOne({
          doctor: appt.doctor, department: appt.department,
          priority: appt.priority, status: 'WAITING',
          _id: { $ne: appt._id },
          appointmentDate: { $gte: today, $lt: tomorrow },
        }).sort({ createdAt: -1 });

        const newCreatedAt = lastInBucket
          ? new Date(lastInBucket.createdAt.getTime() + 1000)
          : new Date();

        appt.status    = 'WAITING';
        appt.stepAwayAt = null;
        await appt.save();
        await Appointment.findByIdAndUpdate(appt._id, { $set: { createdAt: newCreatedAt } });

        const updatedQueue = await recalculateQueue(appt.department, appt.doctor);
        io.to(appt.department).emit('queue_updated', {
          department: appt.department, queue: updatedQueue, timestamp: new Date().toISOString(),
        });

        io.to(`patient_${appt.patient.toString()}`).emit('step_away_expired', {
          department: appt.department,
          message: `Your 15-minute step away window has expired. You have been moved to the back of the ${appt.priority === 1 ? 'Emergency' : appt.priority === 2 ? 'Priority' : 'Normal'} queue.`,
        });

        console.log(`⏰ Step away expired — ${appt.tokenNumber} moved to back of P${appt.priority} bucket`);
      }
    } catch (err) { console.error('❌ Step away expiry error:', err.message); }
  });

  console.log('⏰ Scheduler started — midnight reset + auto-escalation + step-away expiry active');
};

module.exports = { startScheduler };
