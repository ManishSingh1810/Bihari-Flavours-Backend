config/nodemailer file

const nodemailer = require("nodemailer");

/**
 * Brevo SMTP using SMTP KEY (recommended)
 */
const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false, // TLS
  auth: {
   user: process.env.MAIL_USER,                    
      pass: process.env.MAIL_PASS    
  }
});

// Verify on server start
mailTransporter.verify((err) => {
  if (err) {
    console.error("❌ Brevo SMTP config failed:", err);
  } else {
    console.log("✅ Brevo SMTP configured successfully");
  }
});

module.exports = mailTransporter;

module.exports = mailTransporter;



