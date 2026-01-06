const nodemailer = require("nodemailer");

/**
 * Nodemailer configuration
 * Uses Gmail SMTP with App Password
 */
const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD
  }
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
