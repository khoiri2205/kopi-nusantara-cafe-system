// backend/routes/tracking.js
// =====================================================
// FITUR UNIK: Live Order Tracking
// =====================================================
const express = require('express');
const router = express.Router();
const db = require('../config/database');

const STATUS_MESSAGES = {
  pending:    { icon: '📋', msg: 'Pesanan diterima, menunggu konfirmasi kasir',  eta: '1-2 menit'  },
  preparing:  { icon: '☕', msg: 'Barista sedang menyeduh pesananmu',            eta: '5-8 menit'  },
  ready:      { icon: '🔔', msg: 'Pesananmu SIAP! Silakan ambil di kasir',       eta: 'Sekarang!'  },
  done:       { icon: '✅', msg: 'Pesanan selesai. Selamat menikmati!',          eta: 'Selesai'    },
  cancelled:  { icon: '❌', msg: 'Pesanan dibatalkan',                           eta: '-'          },
};

// GET tracking status pesanan
router.get('/:orderId', async (req, res) => {
  try {
    const [[order]] = await db.execute(
      'SELECT o.*, GROUP_CONCAT(oi.menu_name ORDER BY oi.id SEPARATOR ", ") as items_summary FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id WHERE o.id = ? GROUP BY o.id',
      [req.params.orderId]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    const [events] = await db.execute(
      'SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC',
      [req.params.orderId]
    );

    const statusInfo = STATUS_MESSAGES[order.status] || STATUS_MESSAGES.pending;

    // Build timeline
    const allStatuses = ['pending', 'preparing', 'ready', 'done'];
    const currentIdx = allStatuses.indexOf(order.status);

    const timeline = allStatuses.map((s, idx) => ({
      status: s,
      label: STATUS_MESSAGES[s].icon + ' ' + s.charAt(0).toUpperCase() + s.slice(1),
      message: STATUS_MESSAGES[s].msg,
      completed: idx <= currentIdx && order.status !== 'cancelled',
      active: s === order.status,
      timestamp: events.find(e => e.status === s)?.created_at || null,
    }));

    res.json({
      success: true,
      data: {
        order_id: order.id,
        customer_name: order.customer_name,
        table_number: order.table_number,
        items_summary: order.items_summary,
        total_amount: order.total_amount,
        status: order.status,
        payment_status: order.payment_status,
        current_message: statusInfo.msg,
        current_icon: statusInfo.icon,
        eta: statusInfo.eta,
        timeline,
        last_updated: order.updated_at,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST insert tracking event (dipanggil saat status order berubah)
router.post('/', async (req, res) => {
  try {
    const { order_id, status, message } = req.body;
    const defaultMsg = STATUS_MESSAGES[status]?.msg || message;
    await db.execute(
      'INSERT INTO order_tracking (order_id, status, message) VALUES (?,?,?)',
      [order_id, status, defaultMsg]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
