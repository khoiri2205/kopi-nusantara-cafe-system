// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET stats utama dashboard
router.get('/stats', async (req, res) => {
  try {
    const [[todayOrders]]  = await db.execute("SELECT COUNT(*) as total FROM orders WHERE DATE(created_at)=CURDATE()");
    const [[todayRevenue]] = await db.execute("SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE status='done' AND DATE(created_at)=CURDATE()");
    const [[pendingOrders]]= await db.execute("SELECT COUNT(*) as total FROM orders WHERE status IN ('pending','preparing')");
    const [[menuCount]]    = await db.execute("SELECT COUNT(*) as total FROM menus WHERE is_available=TRUE");
    const [[memberCount]]  = await db.execute("SELECT COUNT(*) as total FROM loyalty_points");
    const [[avgRating]]    = await db.execute("SELECT ROUND(AVG(rating),1) as avg FROM testimonials WHERE is_approved=TRUE");
    const [[weekRevenue]]  = await db.execute("SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE status='done' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
    const [[monthRevenue]] = await db.execute("SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE status='done' AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");

    res.json({
      success: true,
      data: {
        today_orders: todayOrders.total,
        today_revenue: todayRevenue.total,
        pending_orders: pendingOrders.total,
        menu_count: menuCount.total,
        member_count: memberCount.total,
        avg_rating: avgRating.avg || 0,
        week_revenue: weekRevenue.total,
        month_revenue: monthRevenue.total,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET revenue chart (7 hari terakhir)
router.get('/revenue', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount),0) as revenue
      FROM orders
      WHERE status='done' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC`
    );

    // Fill missing days
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = rows.find(r => r.date?.toISOString?.().split('T')[0] === dateStr || String(r.date).split('T')[0] === dateStr);
      result.push({
        date: dateStr,
        label: d.toLocaleDateString('id-ID', { weekday:'short', day:'numeric' }),
        revenue: found ? Number(found.revenue) : 0,
        orders: found ? found.order_count : 0,
      });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET trending menu
router.get('/trending', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT m.name, m.price, c.icon, c.name as category,
        COUNT(oi.id) as total_sold,
        COALESCE(SUM(oi.subtotal),0) as total_revenue
      FROM menus m
      LEFT JOIN order_items oi ON m.id = oi.menu_id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'done'
      WHERE m.is_available = TRUE
      GROUP BY m.id
      ORDER BY total_sold DESC
      LIMIT 8`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET live orders untuk kasir (pending + preparing)
router.get('/live-orders', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT o.*,
        GROUP_CONCAT(CONCAT(oi.quantity,'x ',oi.menu_name) ORDER BY oi.id SEPARATOR ' · ') as items_text
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('pending','preparing','ready')
      GROUP BY o.id
      ORDER BY o.created_at ASC
      LIMIT 20`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET payment breakdown
router.get('/payments', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT payment_method,
        COUNT(*) as count,
        COALESCE(SUM(total_amount),0) as total
      FROM orders
      WHERE DATE(created_at) = CURDATE()
      GROUP BY payment_method`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
