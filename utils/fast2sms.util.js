const axios = require("axios"); // kept for future PROD use
const fast2smsConfig = require("../config/fast2sms");

/* ---------------- FORMAT INDIAN PHONE (10 DIGITS) ---------------- */
const formatIndianPhone = (phone) => {
  if (!phone) throw new Error("Phone number is required");

  phone = phone.replace(/\D/g, "");

  if (phone.startsWith("91") && phone.length === 12) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("0") && phone.length === 11) {
    phone = phone.slice(1);
  }

  if (phone.length !== 10) {
    throw new Error("Invalid Indian phone number");
  }

  return phone;
};

/* ---------------- PHONE VARIANTS ---------------- */
const getPhoneVariants = (phone) => {
  const local = formatIndianPhone(phone);
  const e164 = `+91${local}`;
  return { local, e164 };
};
/* ---------------- SEND OTP SMS (DEV MODE) ---------------- */

const sendOtpSMS = async (phone, otp) => {
  const localPhone = formatIndianPhone(phone);

  console.log(
    `🔐 DEV OTP (SMS BYPASSED) → Phone: +91${localPhone}, OTP: ${otp}`
  );

  return {
    success: true,
    message: "OTP generated in DEV mode",
    phone: localPhone,
  };
};

/* ----------- SEND ORDER AMOUNT + STATUS (DEV MODE) ----------- */

const sendOrderStatusSMS = async ({
  phone,
  orderId,
  amount,
  status,
}) => {
  const localPhone = formatIndianPhone(phone);

  const message =
    `Dear Customer, your order ${orderId} ` +
    `of amount Rs.${amount} is ${status}. Thank you.`;

  console.log(
    `📦 DEV ORDER SMS (SMS BYPASSED)
     → Phone: +91${localPhone}
     → Message: ${message}`
  );

  return {
    success: true,
    message: "Order status SMS bypassed in DEV mode",
    phone: localPhone,
    orderId,
    status,
  };
};


module.exports = {
  sendOtpSMS,            
  sendOrderStatusSMS,    
  formatIndianPhone,
  getPhoneVariants,
};