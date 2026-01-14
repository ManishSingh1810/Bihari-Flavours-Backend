const { sendEmail } = require("./resend");

/* -------------------- Brand Helpers -------------------- */
const BRAND = {
  name: "Bihari Flavours",
  supportEmail: "support@bihariflavours.in",
  phone: "+91 85211 754329",
  hours: "Mon–Fri, 9:00 AM – 6:00 PM (IST)",
  accent: "#8E1B1B",
  bg: "#FAF7F2",
  text: "#1F1B16",
  muted: "#6F675E",
  border: "rgba(142, 27, 27, 0.22)",
};

const escapeHtml = (str = "") =>
  String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const emailShell = ({ title, preheader, contentHtml }) => {
  // Preheader helps Gmail preview text
  const safePreheader = escapeHtml(preheader || "");

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <title>${escapeHtml(title || BRAND.name)}</title>
    </head>
    <body style="margin:0;padding:0;background:${BRAND.bg};">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${safePreheader}
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="max-width:640px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
              
              <!-- Header -->
              <tr>
                <td style="padding:20px 22px;background:linear-gradient(180deg, rgba(142,27,27,0.08), rgba(142,27,27,0));">
                  <div style="font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:14px;letter-spacing:0.6px;text-transform:uppercase;color:${BRAND.muted};">
                      ${BRAND.name}
                    </div>
                    <div style="margin-top:6px;font-size:22px;font-weight:700;color:${BRAND.text};">
                      ${escapeHtml(title || BRAND.name)}
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding:22px;">
                  <div style="font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};line-height:1.6;">
                    ${contentHtml}
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:18px 22px;border-top:1px solid ${BRAND.border};background:${BRAND.bg};">
                  <div style="font-family:Arial,Helvetica,sans-serif;color:${BRAND.muted};font-size:12px;line-height:1.6;">
                    <div style="font-weight:700;color:${BRAND.text};margin-bottom:6px;">
                      Need help?
                    </div>
                    <div>
                      Email: <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.supportEmail}</a>
                      &nbsp;•&nbsp;
                      Phone: <a href="tel:${BRAND.phone.replace(/\s/g, "")}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.phone}</a>
                    </div>
                    <div>Hours: ${BRAND.hours}</div>

                    <div style="margin-top:12px;color:${BRAND.muted};">
                      © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                    </div>
                  </div>
                </td>
              </tr>

            </table>

            <div style="max-width:640px;margin:14px auto 0 auto;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${BRAND.muted};text-align:center;padding:0 16px;">
              Please do not reply to this email. For support, contact
              <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.supportEmail}</a>.
            </div>

          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

const infoRow = (label, value) => `
  <div style="display:flex;justify-content:space-between;gap:16px;padding:10px 12px;border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.bg};margin-top:10px;">
    <div style="font-size:13px;color:${BRAND.muted};">${escapeHtml(label)}</div>
    <div style="font-size:13px;font-weight:700;color:${BRAND.text};text-align:right;">${escapeHtml(value)}</div>
  </div>
`;

const statusBadge = (statusRaw) => {
  const status = String(statusRaw || "").toLowerCase();
  let bg = "rgba(142,27,27,0.10)";
  let fg = BRAND.accent;

  if (status.includes("placed") || status.includes("confirmed")) {
    bg = "rgba(16, 185, 129, 0.12)"; // green tint
    fg = "#065F46";
  } else if (status.includes("shipped") || status.includes("out for delivery")) {
    bg = "rgba(59, 130, 246, 0.12)"; // blue tint
    fg = "#1D4ED8";
  } else if (status.includes("cancel") || status.includes("failed")) {
    bg = "rgba(239, 68, 68, 0.12)"; // red tint
    fg = "#B91C1C";
  }

  return `
    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:700;">
      ${escapeHtml(statusRaw)}
    </span>
  `;
};

/* ---------------- SEND OTP EMAIL ---------------- */
const sendOtpEmail = async (email, otp) => {
  if (!email) throw new Error("Email is required");

  const title = "Your verification code";
  const preheader = "Use this code to securely verify your email.";

  const contentHtml = `
    <p style="margin:0 0 10px 0;font-size:14px;color:${BRAND.muted};">
      Use the verification code below to continue. This code is valid for <strong>5 minutes</strong>.
    </p>

    <div style="margin-top:14px;padding:16px;border:1px dashed ${BRAND.border};border-radius:14px;background:${BRAND.bg};text-align:center;">
      <div style="font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:6px;">
        Verification Code
      </div>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:${BRAND.text};">
        ${escapeHtml(otp)}
      </div>
    </div>

    <p style="margin:14px 0 0 0;font-size:12px;color:${BRAND.muted};">
      If you didn’t request this code, you can safely ignore this email.
    </p>

    <div style="margin-top:18px;font-size:13px;color:${BRAND.text};">
      Warm regards,<br/>
      <strong>Team ${BRAND.name}</strong>
    </div>
  `;

  const html = emailShell({ title, preheader, contentHtml });

  const resp = await sendEmail({
    to: email,
    subject: `${BRAND.name} | Verification Code`,
    html,
  });

  console.log("✅ RESEND RESPONSE:", resp);

  return {
    success: true,
    message: "OTP sent to email",
    email,
  };
};

/* ----------- SEND ORDER STATUS EMAIL ----------- */
const sendOrderStatusEmail = async ({ email, orderId, amount, status }) => {
  if (!email) throw new Error("Email is required");

  const safeOrderId = escapeHtml(orderId);
  const safeAmount = `₹${Number(amount || 0).toFixed(0)}`;

  const title = "Order update";
  const preheader = `Your order status is ${status}. Order ID: ${orderId}`;

  const contentHtml = `
    <p style="margin:0 0 10px 0;font-size:14px;color:${BRAND.muted};">
      Thank you for shopping with <strong>${BRAND.name}</strong>. Here are your order details:
    </p>

    ${infoRow("Order ID", safeOrderId)}
    ${infoRow("Amount", safeAmount)}

    <div style="margin-top:10px;">
      <div style="font-size:13px;color:${BRAND.muted};margin-bottom:6px;">Status</div>
      ${statusBadge(status)}
    </div>

    <div style="margin-top:18px;padding:14px;border:1px solid ${BRAND.border};border-radius:14px;background:#ffffff;">
      <div style="font-size:13px;color:${BRAND.text};font-weight:700;margin-bottom:6px;">
        What happens next?
      </div>
      <div style="font-size:13px;color:${BRAND.muted};">
        We’ll keep you updated as your order progresses. If you have any questions, our support team is available during working hours.
      </div>
    </div>

    <div style="margin-top:18px;font-size:13px;color:${BRAND.text};">
      Warm regards,<br/>
      <strong>Team ${BRAND.name}</strong>
    </div>
  `;

  const html = emailShell({ title, preheader, contentHtml });

  await sendEmail({
    to: email,
    subject: `${BRAND.name} | Order ${escapeHtml(status)} • ${orderId}`,
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
