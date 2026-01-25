const mongoose = require('mongoose');
const crypto = require('crypto');

const Order = require('../models/order.model');
const TempOrder = require('../models/temporder.model'); // 🟢 NEW
const TransactionModel = require('../models/transaction.model');
const OrderHistory = require('../models/orderhistory.model');
const Coupon = require('../models/coupon.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const razorpay = require('../config/razorpay');
const { generateUniqueOrderCode } = require('../utils/orderCode');

const presentOrder = (orderDoc) => {
  if (!orderDoc) return orderDoc;
  const obj = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  return {
    ...obj,
    // ✅ 4-digit id for UI (same for user + admin)
    orderId: obj.orderCode || obj.orderId || obj._id,
  };
};

const getOrderSortDate = (obj) => {
  // Active orders have createdAt, history orders have completedAt (plus timestamps too)
  const d = obj.completedAt || obj.createdAt;
  const ms = d ? new Date(d).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
};

const getDefaultVariant = (product) => {
  const vs = product?.variants;
  if (!Array.isArray(vs) || vs.length === 0) return null;
  return vs.find((v) => v.isDefault) || vs[0];
};

const getProductEffectiveUnitPrice = (product, variantLabel) => {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  if (!hasVariants) return Number(product.price) || 0;
  const def = getDefaultVariant(product);
  const v = product.variants.find((x) => x.label === variantLabel) || (variantLabel ? null : def);
  if (!v) throw new Error("Invalid variantLabel");
  return Number(v.price) || 0;
};

const computeComboPriceAndCollectAdjustments = async ({ comboProduct, cartQty, session, adjustments }) => {
  const comboItems = Array.isArray(comboProduct.comboItems) ? comboProduct.comboItems : [];
  if (comboItems.length === 0) throw new Error("Combo has no items");

  let sum = 0;

  for (const ci of comboItems) {
    const child = await Product.findById(ci.product).session(session);
    if (!child) throw new Error("Combo item product not found");
    if (String(child._id) === String(comboProduct._id)) throw new Error("Combo cannot include itself");

    const needed = (Number(ci.quantity) || 0) * cartQty;
    if (needed < 1) throw new Error("Invalid combo item quantity");

    const childHasVariants = Array.isArray(child.variants) && child.variants.length > 0;
    const label = typeof ci.variantLabel === "string" ? ci.variantLabel.trim() : "";

    if (childHasVariants) {
      const def = getDefaultVariant(child);
      const v = child.variants.find((x) => x.label === label) || (label ? null : def);
      if (!v) throw new Error("Invalid combo item variantLabel");
      sum += (Number(v.price) || 0) * needed;

      // record stock decrement for successful checkout
      const key = `${child._id}:${String(v.label)}`;
      adjustments.set(key, (adjustments.get(key) || 0) + needed);
    } else {
      if (child.quantity !== "instock") throw new Error("Combo item is out of stock");
      sum += (Number(child.price) || 0) * needed;
      // no numeric stock tracking for legacy items
    }
  }

  if (comboProduct.comboPriceMode === "sumMinusDiscount") {
    return Math.max(sum - (Number(comboProduct.comboDiscount) || 0), 0);
  }

  // fixed price combo: take combo product's effective price (variant-aware if it has variants)
  return getProductEffectiveUnitPrice(comboProduct, "");
};

const buildValidatedItemsAndAdjustStock = async ({ items, session, decrementStock }) => {
  const productCache = new Map(); // productId -> productDoc
  const adjustments = new Map(); // `${productId}:${variantLabel}` -> qty to decrement
  const normalized = [];

  const getProduct = async (id) => {
    const key = String(id);
    if (productCache.has(key)) return productCache.get(key);
    const p = await Product.findById(key).session(session);
    if (!p) throw new Error("Product not found");
    productCache.set(key, p);
    return p;
  };

  for (const item of items) {
    const productId = String(item?.productId || item?._id || "").trim();
    const qty = Number(item?.quantity);
    const variantLabel = typeof item?.variantLabel === "string" ? item.variantLabel.trim() : "";

    if (!productId) throw new Error("productId is required");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Invalid quantity");

    const product = await getProduct(productId);

    if (product.productType === "combo") {
      // Validate combo availability and compute price
      const computedComboUnitPrice = await computeComboPriceAndCollectAdjustments({
        comboProduct: product,
        cartQty: qty,
        session,
        adjustments,
      });

      normalized.push({
        productId: product._id,
        name: product.name,
        variantLabel: "",
        priceAtAdd: computedComboUnitPrice,
        price: computedComboUnitPrice,
        quantity: qty,
      });
      continue;
    }

    // Single product logic (variant-aware)
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    let selectedVariantLabel = "";
    let unitPrice = Number(product.price);

    if (hasVariants) {
      const def = getDefaultVariant(product);
      const v = product.variants.find((x) => x.label === variantLabel) || (variantLabel ? null : def);
      if (!v) throw new Error("Invalid variantLabel");
      if (!Number.isFinite(Number(v.stock))) throw new Error("Invalid variant stock");
      if (Number(v.stock) < qty) throw new Error("Not enough stock for selected variant");

      selectedVariantLabel = String(v.label);
      unitPrice = Number(v.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Invalid variant price");

      const key = `${product._id}:${selectedVariantLabel}`;
      adjustments.set(key, (adjustments.get(key) || 0) + qty);
    } else {
      if (product.quantity !== "instock") throw new Error("Product is out of stock");
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Invalid product price");
    }

    normalized.push({
      productId: product._id,
      name: product.name,
      variantLabel: selectedVariantLabel,
      priceAtAdd: unitPrice,
      price: unitPrice,
      quantity: qty,
    });
  }

  // Apply stock adjustments only when requested (COD creation / ONLINE payment success)
  if (decrementStock) {
    for (const [key, decQty] of adjustments.entries()) {
      const [productId, variantLabel] = key.split(":");
      const product = await getProduct(productId);
      const v = (product.variants || []).find((x) => x.label === variantLabel);
      if (!v) throw new Error("Variant not found for stock decrement");
      if (Number(v.stock) < decQty) throw new Error("Not enough stock");
      v.stock = Number(v.stock) - decQty;
      product.quantity = product.variants.some((x) => Number(x.stock) > 0) ? "instock" : "outofstock";
      const def = getDefaultVariant(product);
      if (def) product.price = Number(def.price);
      await product.save({ session });
    }
  }

  return normalized;
};

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

    // Validate items, compute pricing, and (for COD) decrement variant stock now
    const validatedItems = await buildValidatedItemsAndAdjustStock({
      items,
      session,
      decrementStock: paymentMethod === "COD",
    });

    /* ----------------------------
       CALCULATE TOTAL
    ---------------------------- */
    let totalAmount = validatedItems.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0);

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
      const orderCode = await generateUniqueOrderCode({ Order, OrderHistory, session });

      const [order] = await Order.create([{
        userId,
        items: validatedItems,
        shippingAddress,
        paymentMethod: 'COD',
        totalAmount,
        couponId: coupon?._id,
        paymentStatus: 'Pending',
        orderCode
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
        order: presentOrder(order),
        orderId: order.orderCode,
        message: 'COD order placed successfully'
      });
    }

    /* ======================================================
       ONLINE PAYMENT (FIXED)
    ====================================================== */

    // 1️⃣ Create TempOrder INSIDE transaction
    const [tempOrder] = await TempOrder.create([{
      userId,
      items: validatedItems,
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

      // Validate items again (source of truth) and decrement variant stock on successful payment
      const validatedItems = await buildValidatedItemsAndAdjustStock({
        items: tempOrder.items,
        session,
        decrementStock: true,
      });

      const orderCode = await generateUniqueOrderCode({ Order, OrderHistory, session });
      const [order] = await Order.create([{
        userId: tempOrder.userId,
        items: validatedItems,
        shippingAddress: tempOrder.shippingAddress,
        paymentMethod: 'ONLINE',
        totalAmount: tempOrder.totalAmount,
        couponId: tempOrder.couponId,
        paymentStatus: 'Paid',
        razorpayOrderId: tempOrder.razorpayOrderId,
        orderCode
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

    // Optional query flags (defaults are "true" for best UX)
    const includeAll = String(req.query.includeAll ?? "true").toLowerCase() !== "false";
    const includeOnline = String(req.query.includeOnline ?? "true").toLowerCase() !== "false";
    const includeCOD = String(req.query.includeCOD ?? "true").toLowerCase() !== "false";

    const methods = [];
    if (includeCOD) methods.push("COD");
    if (includeOnline) methods.push("ONLINE");

    const methodFilter = methods.length ? { paymentMethod: { $in: methods } } : {};

    const [activeOrders, historyOrders] = await Promise.all([
      Order.find({ userId, ...methodFilter }).sort({ createdAt: -1 }),
      includeAll
        ? OrderHistory.find({ userId, ...methodFilter }).sort({ completedAt: -1, createdAt: -1 })
        : Promise.resolve([]),
    ]);

    const merged = [
      ...activeOrders.map((o) => ({ ...presentOrder(o), isHistory: false })),
      ...historyOrders.map((h) => ({ ...presentOrder(h), isHistory: true })),
    ].sort((a, b) => getOrderSortDate(b) - getOrderSortDate(a));

    res.status(200).json({
      success: true,
      orders: merged
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
    const idParam = String(req.params.id || "").trim();
    const isOrderCode = /^\d{4}$/.test(idParam);

    let order = await Order.findOne({
      userId: req.user._id,
      ...(isOrderCode ? { orderCode: idParam } : { _id: idParam }),
    });

    // If not found in active orders, try order history so details work for Delivered/Cancelled.
    if (!order) {
      order = await OrderHistory.findOne({
        userId: req.user._id,
        ...(isOrderCode ? { orderCode: idParam } : { _id: idParam }),
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order: presentOrder(order)
    });

  } catch {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
};

/* ======================================================
   GET USER ORDER HISTORY (DELIVERED / CANCELLED)
====================================================== */
exports.getUserOrderHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const history = await OrderHistory.find({ userId }).sort({ completedAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      orders: history.map(presentOrder),
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
};

/* ======================================================
   GET USER ORDER HISTORY DETAILS
====================================================== */
exports.getUserOrderHistoryDetails = async (req, res) => {
  try {
    const idParam = String(req.params.id || "").trim();
    const isOrderCode = /^\d{4}$/.test(idParam);

    const history = await OrderHistory.findOne({
      userId: req.user._id,
      ...(isOrderCode ? { orderCode: idParam } : { _id: idParam }),
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Order history not found",
      });
    }

    return res.status(200).json({
      success: true,
      order: presentOrder(history),
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order history details",
    });
  }
};
