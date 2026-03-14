const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * RETRY UTILITY
 * Retries an async function up to maxRetries times
 * with exponential backoff: 1s → 2s → 4s
 *
 * Interview talking point:
 * "Notifications use exponential backoff retry — if Twilio or NodeMailer
 *  fails transiently, it retries 3 times before giving up.
 *  This prevents notification loss due to temporary service outages."
 */
const withRetry = async (fn, maxRetries = 3, label = 'operation') => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      if (attempt > 1) {
        console.log(`✅ ${label} succeeded on attempt ${attempt}`);
      }
      return; // success
    } catch (err) {
      lastError = err;
      console.warn(`⚠️  ${label} failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  // All retries exhausted — log but don't throw
  console.error(`❌ ${label} failed after ${maxRetries} attempts: ${lastError.message}`);
};

// Send email with retry
const sendEmail = async ({ to, subject, html }) => {
  await withRetry(async () => {
    await transporter.sendMail({
      from: `"MediQueue" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}`);
  }, 3, `Email to ${to}`);
};

// Send SMS with retry
const sendSMS = async ({ to, message }) => {
  await withRetry(async () => {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`📱 SMS sent to ${to}`);
  }, 3, `SMS to ${to}`);
};

// Notify patient when 3 positions away
const notifyTurnApproaching = async (appointment) => {
  const { patient, tokenNumber, department, queuePosition } = appointment;

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #1d4ed8; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">🏥 MediQueue</h1>
      </div>
      <div style="background: #fff; padding: 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0f172a; margin: 0 0 12px;">Your turn is approaching!</h2>
        <p style="color: #475569;">Dear <strong>${patient.name}</strong>,</p>
        <p style="color: #475569;">You are currently <strong>#${queuePosition}</strong> in the <strong>${department}</strong> queue.</p>
        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <div style="font-size: 28px; font-weight: 800; color: #0f172a;">${tokenNumber}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Your Token</div>
        </div>
        <p style="color: #475569;">Please make your way to the <strong>${department}</strong> waiting area now.</p>
      </div>
    </div>
  `;

  const smsMessage = `MediQueue: You are #${queuePosition} in ${department}. Token: ${tokenNumber}. Please proceed to the waiting area now.`;

  await Promise.allSettled([
    sendEmail({ to: patient.email, subject: `Your turn is approaching — ${department}`, html: emailHtml }),
    patient.phone ? sendSMS({ to: patient.phone, message: smsMessage }) : Promise.resolve(),
  ]);
};

// Notify patient when they are NEXT
const notifyNextInLine = async (appointment) => {
  const { patient, tokenNumber, department } = appointment;

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #16a34a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">🏥 MediQueue</h1>
      </div>
      <div style="background: #fff; padding: 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0f172a; margin: 0 0 12px;">You are NEXT! 🎉</h2>
        <p style="color: #475569;">Dear <strong>${patient.name}</strong>,</p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <div style="font-size: 28px; font-weight: 800; color: #0f172a;">${tokenNumber}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${department} Department</div>
        </div>
        <p style="color: #dc2626; font-weight: 600;">Please go to the doctor's room immediately.</p>
      </div>
    </div>
  `;

  const smsMessage = `MediQueue URGENT: Token ${tokenNumber} — You are NEXT in ${department}. Please go to the doctor's room now.`;

  await Promise.allSettled([
    sendEmail({ to: patient.email, subject: `YOU ARE NEXT — ${department}`, html: emailHtml }),
    patient.phone ? sendSMS({ to: patient.phone, message: smsMessage }) : Promise.resolve(),
  ]);
};

module.exports = { sendEmail, sendSMS, notifyTurnApproaching, notifyNextInLine };