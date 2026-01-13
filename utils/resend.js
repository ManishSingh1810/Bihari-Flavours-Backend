
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  const from = process.env.MAIL_FROM || "onboarding@resend.dev";

//   const response = await resend.emails.send({
//     from,
//     to,
//     subject,
//     html,
//   });

//   return response;
// };

// module.exports = { sendEmail };

try {
  const resp = await resend.emails.send({ from, to, subject, html });
  console.log("✅ Resend sent:", resp);
  return resp;
} catch (err) {
  console.error("❌ Resend failed:", err);
  throw err;
}
