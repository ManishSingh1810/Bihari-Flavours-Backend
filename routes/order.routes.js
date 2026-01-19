// routes/order.routes.js
const router = require('express').Router();
const express = require('express');

const {
  createOrder,
  razorpayWebhook,
  getUserOrders,
  getOrderDetails,
  verifyCoupon,
  getUserOrderHistory,
  getUserOrderHistoryDetails,
} = require('../controllers/order.controller');

const {
  getPendingOrders,
  updateOrderStatus,
  getOrderHistory,
  getOrderById,
  getOrderHistoryById,
} = require('../controllers/adminorder.controller');

const { protect } = require('../middleware/auth.middleware');
const { adminProtect } = require('../middleware/admin.middleware');

// --------------------
// USER ROUTES
// --------------------

// Verify coupon before creating order
router.post('/verify-coupon', protect, verifyCoupon);

// Create a new order
router.post('/create', protect, createOrder);


// Get all orders of logged-in user
router.get('/my-orders', protect, getUserOrders);

// Get single order details (user)
router.get('/my-orders/:id', protect, getOrderDetails);

// Order history (delivered/cancelled)
router.get('/my-history', protect, getUserOrderHistory);
router.get('/my-history/:id', protect, getUserOrderHistoryDetails);


// --------------------
// ADMIN ROUTES
// --------------------

// Get all pending / paid orders
router.get('/admin/orders', protect, adminProtect, getPendingOrders);

// Update order status
router.patch('/admin/orders/:id', protect, adminProtect, updateOrderStatus);

// Get order details (admin)
router.get('/admin/orders/details/:id', protect, adminProtect, getOrderById);

// Order history
router.get('/admin/history', protect, adminProtect, getOrderHistory);

// Get order history by ID (admin)
router.get('/admin/history/:id', protect, adminProtect, getOrderHistoryById);

module.exports = router;
