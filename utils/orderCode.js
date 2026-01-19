/**
 * Generate a unique 4-digit order code (string with leading zeros).
 *
 * Note: 4 digits means only 10,000 possible values; collisions are inevitable at scale.
 * This helper checks BOTH active orders and order history to avoid reusing a code.
 */
async function generateUniqueOrderCode({ Order, OrderHistory, session, maxAttempts = 30 } = {}) {
  if (!Order) throw new Error("Order model is required");
  if (!OrderHistory) throw new Error("OrderHistory model is required");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");

    const [existsInOrders, existsInHistory] = await Promise.all([
      session ? Order.findOne({ orderCode: code }).session(session) : Order.findOne({ orderCode: code }),
      session
        ? OrderHistory.findOne({ orderCode: code }).session(session)
        : OrderHistory.findOne({ orderCode: code }),
    ]);

    if (!existsInOrders && !existsInHistory) return code;
  }

  throw new Error("Unable to generate unique 4-digit order code. Please retry.");
}

module.exports = { generateUniqueOrderCode };

