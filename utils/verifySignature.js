// utils/verifySignature.js
const crypto = require('crypto');

function verifyRazorpaySignature(orderId, paymentId, signature) {
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
    .update(body.toString())
    .digest("hex");
  return expectedSignature === signature;
}

module.exports = verifyRazorpaySignature;
