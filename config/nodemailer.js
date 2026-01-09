const nodemailer = require("nodemailer");

/**
 * Nodemailer configuration
 * Uses Gmail SMTP with App Password
 */
const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,                 // smtp.titan.email
  port: Number(process.env.MAIL_PORT || 587),  // 587 recommended
  secure: String(process.env.MAIL_SECURE) === "true", // false for 587, true for 465
  
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD
  },
    
  tls: { rejectUnauthorized: false } // helps avoid TLS issues on some hosts
});

// Verify connection once on server start
mailTransporter.verify((err, success) => {
  if (err) {
    console.error("❌ Nodemailer config failed:", err);
  } else {
    console.log("✅ Nodemailer configured successfully");
  }
});

module.exports = mailTransporter;


