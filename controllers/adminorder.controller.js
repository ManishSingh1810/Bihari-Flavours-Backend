const mongoose = require("mongoose");
const Order = require("../models/order.model");
const OrderHistory = require("../models/orderhistory.model");
const Coupon = require("../models/coupon.model");

// ----------------------------
// Helper: Clean order object
// ----------------------------
const cleanOrder = async (order) => {
  const obj = order.toObject();

  delete obj.transactionId;

  if (obj.couponId) {
    const coupon = await Coupon.findById(obj.couponId).lean();
    if (coupon) {
      obj.coupon = {
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
      };
    }
  }

  delete obj.couponId;

  // ✅ NO CHANGE: shipping data (delivery info)
  obj.customerName = obj.shippingAddress?.name || "";
  obj.customerPhone = obj.shippingAddress?.phone || "";

  return obj;
};

// ----------------------------
// Get active (pending/processing/shipped) orders
// ----------------------------
exports.getPendingOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $nin: ["Delivered", "Cancelled"] },
    })
      // 🔁 CHANGE HERE: phone → email (User model)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const cleanedOrders = await Promise.all(orders.map(cleanOrder));

    // Enrich with user data
    const enrichedOrders = cleanedOrders.map((order, idx) => ({
      ...order,
      user: orders[idx].userId, // now contains name + email
    }));

    res.status(200).json({ success: true, orders: enrichedOrders });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending orders",
    });
  }
};

// ----------------------------
// Update order status (SAFE)
// ----------------------------
exports.updateOrderStatus = async (req, res) => {
  console.log("🔄 updateOrderStatus:", req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    if (!orderStatus) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "orderStatus is required",
      });
    }

    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    /* =====================
       PREPARE UPDATE
    ===================== */
    const update = { orderStatus };

    // COD auto-paid when delivered
    if (order.paymentMethod === "COD" && orderStatus === "Delivered") {
      update.paymentStatus = "Paid";
    }

    /* =====================
       MOVE TO HISTORY
    ===================== */
    if (orderStatus === "Delivered" || orderStatus === "Cancelled") {
      const exists = await OrderHistory.findOne({
        originalOrderId: order._id,
      }).session(session);

      if (!exists) {
        await OrderHistory.create(
          [
            {
              originalOrderId: order._id,
              userId: order.userId,
              items: order.items,
              totalAmount: order.totalAmount,
              shippingAddress: order.shippingAddress,
              orderStatus,
              paymentStatus:
                order.paymentMethod === "COD" && orderStatus === "Delivered"
                  ? "Paid"
                  : order.paymentStatus,
              paymentMethod: order.paymentMethod,
              transactionId: order.transactionId || null,
              completedAt: new Date(),
            },
          ],
          { session }
        );
      }

      // 🔔 STATUS UPDATE (HOOK WILL FIRE)
      await Order.findByIdAndUpdate(order._id, { $set: update }, { session });

      // Remove active order
      await Order.deleteOne({ _id: order._id }, { session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Order ${orderStatus.toLowerCase()} and moved to history`,
      });
    }

    /* =====================
       NORMAL STATUS UPDATE
    ===================== */

    // 🔔 STATUS UPDATE (HOOK WILL FIRE)
    await Order.findByIdAndUpdate(
      order._id,
      { $set: update },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ updateOrderStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order",
    });
  }
};

// ----------------------------
// Get all order history
// ----------------------------
exports.getOrderHistory = async (req, res) => {
  try {
    const history = await OrderHistory.find()
      // 🔁 CHANGE HERE: phone → email
      .populate("userId", "name email")
      .sort({ completedAt: -1 });

    const enrichedHistory = history.map((h) => {
      const obj = h.toObject ? h.toObject() : h;

      obj.customerName =
        obj.userId?.name || obj.shippingAddress?.name || "";

      // 🔁 CHANGE HERE: user.phone → user.email
      obj.customerEmail = obj.userId?.email || "";

      // ✅ NO CHANGE: delivery phone
      obj.customerPhone = obj.shippingAddress?.phone || "";

      obj.user = obj.userId;
      return obj;
    });

    res.status(200).json({ success: true, orders: enrichedHistory });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
};

// ----------------------------
// Get order by ID (admin)
// ----------------------------
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      // 🔁 CHANGE HERE: phone → email
      .populate("userId", "name email");

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const cleanedOrder = await cleanOrder(order);

    res.status(200).json({
      success: true,
      order: cleanedOrder,
      user: order.userId, // contains name + email
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
};

// ----------------------------
// Get order history by ID (admin)
// ----------------------------
exports.getOrderHistoryById = async (req, res) => {
  try {
    const history = await OrderHistory.findById(req.params.id)
      // 🔁 CHANGE HERE: phone → email
      .populate("userId", "name email");

    if (!history)
      return res.status(404).json({
        success: false,
        message: "Order history not found",
      });

    const obj = history.toObject ? history.toObject() : history;

    obj.customerName =
      obj.userId?.name || obj.shippingAddress?.name || "";

    // 🔁 CHANGE HERE
    obj.customerEmail = obj.userId?.email || "";

    // ✅ NO CHANGE
    obj.customerPhone = obj.shippingAddress?.phone || "";

    res.status(200).json({
      success: true,
      history: obj,
      user: obj.userId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
};
