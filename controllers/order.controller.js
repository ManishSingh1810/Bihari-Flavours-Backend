const mongoose = require('mongoose');
const crypto = require('crypto');

const Order = require('../models/order.model');
const TempOrder = require('../models/temporder.model'); // 🟢 NEW
const TransactionModel = require('../models/transaction.model');
const OrderHistory = require('../models/orderhistory.model');
const Coupon = require('../models/coupon.model');
const Cart = require('../models/cart.model');
const razorpay = require('../config/razorpay');

/* ======================================================
   VERIFY COUPON
====================================================== */
exports.verifyCoupon = async (req, res) => {
  try {
    const { couponCode, totalAmount } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const coupon = await Coupon.findOne({
      code: couponCode,
      status: 'active',
      usageLimit: { $gt: 0 },
      minPurchase: { $lte: totalAmount },
      maxPurchase: { $gte: totalAmount }
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon not applicable'
      });
    }

    res.status(200).json({
      success: true,
      coupon: {
        code: coupon.code,
        discountPercentage: coupon.discountPercentage
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Coupon verification failed'
    });
  }
};

/* ======================================================
   CREATE ORDER
====================================================== */
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingAddress, paymentMethod, couponCode } = req.body;
    const userId = req.user._id;

    if (!items || items.length === 0) {
      throw new Error('Cart is empty');
    }

    /* ----------------------------
       CALCULATE TOTAL
    ---------------------------- */
    let totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    let coupon = null;

    /* ----------------------------
       APPLY COUPON
    ---------------------------- */
    if (couponCode) {
      coupon = await Coupon.findOneAndUpdate(
        {
          code: couponCode,
          status: 'active',
          usageLimit: { $gt: 0 },
          minPurchase: { $lte: totalAmount },
          maxPurchase: { $gte: totalAmount }
        },
        { $inc: { usageLimit: -1 } },
        { new: true, session }
      );

      if (!coupon) throw new Error('Coupon not applicable');

      totalAmount -= (totalAmount * coupon.discountPercentage) / 100;
    }

    /* ======================================================
       COD FLOW (WORKING ALREADY)
    ====================================================== */
    if (paymentMethod === 'COD') {
      totalAmount += 30;

      const [order] = await Order.create([{
        userId,
        items,
        shippingAddress,
        paymentMethod: 'COD',
        totalAmount,
        couponId: coupon?._id,
        paymentStatus: 'Pending'
      }], { session });

      await Cart.findOneAndUpdate(
        { userId },
        { $set: { cartItems: [], totalAmount: 0 } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        order,
        message: 'COD order placed successfully'
      });
    }

    /* ======================================================
       ONLINE PAYMENT (FIXED)
    ====================================================== */

    // 1️⃣ Create TempOrder INSIDE transaction
    const [tempOrder] = await TempOrder.create([{
      userId,
      items,
      shippingAddress,
      paymentMethod: 'ONLINE',
      totalAmount,
      couponId: coupon?._id,
      paymentStatus: 'Pending'
    }], { session });

    // 2️⃣ Commit DB transaction FIRST
    await session.commitTransaction();
    session.endSession();

    // 3️⃣ Razorpay API call OUTSIDE transaction
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: tempOrder._id.toString()
    });

    // 4️⃣ Save Razorpay orderId
    tempOrder.razorpayOrderId = razorpayOrder.id;
    await tempOrder.save();

    return res.status(200).json({
      success: true,
      tempOrderId: tempOrder._id,
      razorpayOrder
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('CREATE ORDER ERROR:', error);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/* ======================================================
   RAZORPAY WEBHOOK
====================================================== */
exports.razorpayWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false });
    }

    const event = JSON.parse(req.body.toString());
    const payment = event.payload?.payment?.entity;

    /* ----------------------------
       PAYMENT SUCCESS
    ---------------------------- */
    if (event.event === 'payment.captured') {
      const tempOrder = await TempOrder.findOne({
        razorpayOrderId: payment.order_id
      }).session(session);

      if (!tempOrder) throw new Error('Temp order not found');

      const [order] = await Order.create([{
        userId: tempOrder.userId,
        items: tempOrder.items,
        shippingAddress: tempOrder.shippingAddress,
        paymentMethod: 'ONLINE',
        totalAmount: tempOrder.totalAmount,
        couponId: tempOrder.couponId,
        paymentStatus: 'Paid',
        razorpayOrderId: tempOrder.razorpayOrderId
      }], { session });

      await TransactionModel.create([{
        orderId: order._id,
        userId: order.userId,
        items: order.items,
        amount: order.totalAmount,
        paymentMethod: 'ONLINE',
        paymentStatus: 'Success',
        transactionId: payment.id
      }], { session });

      await Cart.findOneAndUpdate(
        { userId: order.userId },
        { $set: { cartItems: [], totalAmount: 0 } },
        { session }
      );

      await TempOrder.deleteOne({ _id: tempOrder._id }).session(session);

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ success: true });
    }

    /* ----------------------------
       PAYMENT FAILED
    ---------------------------- */
    if (event.event === 'payment.failed') {
      const tempOrder = await TempOrder.findOne({
        razorpayOrderId: payment.order_id
      }).session(session);

      if (tempOrder?.couponId) {
        await Coupon.findByIdAndUpdate(
          tempOrder.couponId,
          { $inc: { usageLimit: 1 } },
          { session }
        );
      }

      await TempOrder.deleteOne({ _id: tempOrder?._id }).session(session);

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ success: true });
    }

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ success: true });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('WEBHOOK ERROR:', error);
    res.status(500).json({ success: false });
  }
};


/* ======================================================
   GET USER ORDERS
====================================================== */
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders
    });

  } catch {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

/* ======================================================
   GET ORDER DETAILS
====================================================== */
exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order
    });

  } catch {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
};
