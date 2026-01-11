const { sendEmail } = require("./resend");


/* ---------------- SEND OTP EMAIL ---------------- */
const sendOtpEmail = async (email, otp) => {
  if (!email) throw new Error("Email is required");

  const html = `
    <div style="font-family: Arial">
      <h2>🔐 Your OTP Code</h2>
      <p>Your OTP is:</p>
      <h1 style="letter-spacing: 4px;">${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
      <br />
      <p>– Team Bihar</p>
    </div>
  `;
await sendEmail({
  to: email,
  subject: "Your OTP Code",
  html,
});

  console.log(`📧 OTP EMAIL SENT → ${email}, OTP: ${otp}`);

  return {
    success: true,
    message: "OTP sent to email",
    email,
  };
};

/* ----------- SEND ORDER STATUS EMAIL ----------- */
const sendOrderStatusEmail = async ({
  email,
  orderId,
  amount,
  status,
}) => {
  if (!email) throw new Error("Email is required");

  const html = `
    <div style="font-family: Arial">
      <h2>📦 Order Update</h2>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Amount:</strong> ₹${amount}</p>
      <p><strong>Status:</strong> ${status}</p>
      <br />
      <p>Thank you for ordering with us 🙏</p>
      <p>– Team Bihar</p>
    </div>
  `;

await sendEmail({
  to: email,
  subject: `Order ${status} | ${orderId}`,
  html,
});

  console.log(
    `📧 ORDER EMAIL SENT
     → Email: ${email}
     → Order: ${orderId}
     → Status: ${status}`
  );

  return {
    success: true,
    message: "Order status email sent",
    email,
    orderId,
    status,
  };
};

module.exports = {
  sendOtpEmail,
  sendOrderStatusEmail,
};

