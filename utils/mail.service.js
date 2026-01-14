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

  const html = `
  <div style="background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1F1B16;max-width:600px;margin:0 auto;padding:32px;">
    
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#8E1B1B;">
      Verify Your Email
    </h1>

    <p style="margin:0 0 20px 0;font-size:14px;color:#6F675E;">
      Use the verification code below to continue. This code is valid for 5 minutes.
    </p>

    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;padding:14px 24px;border:1px solid #eee;border-radius:8px;
                  font-size:28px;letter-spacing:6px;font-weight:600;color:#1F1B16;">
        ${otp}
      </div>
    </div>

    <p style="font-size:14px;color:#6F675E;">
      If you did not request this code, you can safely ignore this email.
    </p>

    <p style="margin-top:24px;font-size:14px;">
      Warm regards,<br/>
      <strong>Team Bihari Flavours</strong>
    </p>
  </div>
  `;

  await sendEmail({
    to: email,
    subject: "Bihari Flavours | Verification Code",
    html,
  });

  return {
    success: true,
    message: "OTP sent to email",
    email,
  };
};


/* ----------- SEND ORDER STATUS EMAIL ----------- */
const sendOrderStatusEmail = async ({ email, orderId, amount, status }) => {
  if (!email) throw new Error("Email is required");

  const s = String(status || "").toLowerCase();

  // ---------- Dynamic content based on status ----------
  let heading = "Order Update";
  let intro = `Thank you for shopping with <strong>Bihari Flavours</strong>.`;
  let statusLine = `${status}`;
  let nextText =
    "We’ll keep you updated as your order progresses.";

  if (s.includes("placed") || s.includes("confirmed")) {
    heading = "Order Confirmed";
    intro =
      `Thank you for shopping with <strong>Bihari Flavours</strong>. Your order has been successfully placed.`;
    nextText =
      "We’ll notify you when your order is shipped.";
  } else if (s.includes("packed") || s.includes("processing")) {
    heading = "Order Processing";
    intro =
      `Your order is being prepared with care.`;
    nextText =
      "We’ll notify you as soon as it’s shipped.";
  } else if (s.includes("shipped") || s.includes("dispatched")) {
    heading = "Order Shipped";
    intro =
      `Good news — your order has been shipped.`;
    nextText =
      "It’s on the way. We’ll notify you once it’s delivered.";
  } else if (s.includes("out for delivery")) {
    heading = "Out for Delivery";
    intro =
      `Your order is out for delivery and will reach you soon.`;
    nextText =
      "If you need help, contact our support team.";
  } else if (s.includes("delivered")) {
    heading = "Order Delivered";
    intro =
      `Your order has been delivered. We hope you enjoy it!`;
    nextText =
      "If anything is not right, please contact support within 24 hours.";
  } else if (s.includes("cancel") || s.includes("cancelled")) {
    heading = "Order Cancelled";
    intro =
      `Your order has been cancelled.`;
    nextText =
      "If you have questions about this cancellation, please contact support.";
  } else if (s.includes("failed")) {
    heading = "Order Update";
    intro =
      `We couldn’t process your order successfully.`;
    nextText =
      "Please contact support and we’ll help you right away.";
  }

  const html = `
  <div style="background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1F1B16;max-width:600px;margin:0 auto;padding:32px;">
    
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#8E1B1B;">
      ${heading}
    </h1>

    <p style="margin:0 0 20px 0;font-size:14px;color:#6F675E;">
      ${intro}
    </p>

    <div style="border-top:1px solid #eee;margin:24px 0;"></div>

    <table width="100%" style="font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;color:#6F675E;">Order ID</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;">${orderId}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6F675E;">Total Amount</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;">₹${amount}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6F675E;">Status</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#8E1B1B;">
          ${statusLine}
        </td>
      </tr>
    </table>

    <div style="border-top:1px solid #eee;margin:24px 0;"></div>

    <p style="font-size:14px;color:#1F1B16;margin:0 0 8px 0;">
      ${nextText}
    </p>

    <p style="font-size:14px;color:#6F675E;margin:0;">
      For any assistance, feel free to contact our support team.
    </p>

    <p style="margin-top:24px;font-size:14px;">
      Warm regards,<br/>
      <strong>Team Bihari Flavours</strong><br/>
      <span style="color:#6F675E;">support@bihariflavours.in | +91 85211 754329</span>
    </p>

    <p style="margin-top:16px;font-size:12px;color:#999;">
      Monday – Friday, 9:00 AM to 6:00 PM (IST)
    </p>
  </div>
  `;

  await sendEmail({
    to: email,
    subject: `Bihari Flavours | ${heading} (${orderId})`,
    html,
  });

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


