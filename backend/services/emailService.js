const nodemailer = require('nodemailer');

// Gmail SMTP, authenticated with an "App Password" (not the account's real
// password) generated from the sender Google account's security settings.
// Only created when both env vars are present — callers must check
// isEmailConfigured() before calling sendOtpEmail so a missing setup fails with a
// clear message instead of nodemailer throwing deep inside a request handler.
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
}

const isEmailConfigured = () => transporter !== null;

const sendOtpEmail = async (toEmail, otp) => {
  if (!transporter) {
    throw new Error('Email sending is not configured on the server (EMAIL_USER / EMAIL_APP_PASSWORD missing)');
  }

  await transporter.sendMail({
    from: `"Bright Star Coaching Manager" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Bright Star Coaching Manager</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5;">${otp}</p>
        <p style="color: #64748b; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { isEmailConfigured, sendOtpEmail };
