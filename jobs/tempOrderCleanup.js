const cron = require('node-cron');
const TempOrder = require('../models/temporder.model');
const Coupon = require('../models/coupon.model');

/* ----------------------------
   RUN EVERY HOUR
---------------------------- */
cron.schedule('0 * * * *', async () => {
  console.log('🧹 Running TempOrder cleanup job');

  try {
    const expiredOrders = await TempOrder.find({
      expiresAt: { $lte: new Date() }
    });

    for (const order of expiredOrders) {

      /* 🔁 RESTORE COUPON */
      if (order.couponId) {
        await Coupon.findByIdAndUpdate(
          order.couponId,
          { $inc: { usageLimit: 1 } }
        );
      }

      /* ❌ DELETE TEMP ORDER */
      await TempOrder.deleteOne({ _id: order._id });
    }

    console.log(`✅ Cleaned ${expiredOrders.length} expired temp orders`);
  } catch (err) {
    console.error('❌ TempOrder cleanup failed', err);
  }
});
