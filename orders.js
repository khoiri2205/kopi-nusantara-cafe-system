// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// POST buat pesanan baru
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_name, table_number, note, items, payment_method } = req.body;

    if (!customer_name || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan dan item pesanan wajib diisi' });
    }
    const validPayments = ['cash','qris','card'];
    const pmethod = validPayments.includes(payment_method) ? payment_method : 'cash';

    // Hitung total
    let total = 0;
    const enrichedItems = [];
    for (const item of items) {
      const [menuRows] = await conn.execute('SELECT id, name, price FROM menus WHERE id = ? AND is_available = TRUE', [item.menu_id]);
      if (menuRows.length === 0) throw new Error(`Menu ID ${item.menu_id} tidak tersedia`);
      const menu = menuRows[0];
      const subtotal = menu.price * item.quantity;
      total += subtotal;
      enrichedItems.push({ ...item, menu_name: menu.name, unit_price: menu.price, subtotal });
    }

    // Insert order
    const [orderResult] = await conn.execute(
      'INSERT INTO orders (customer_name, table_number, total_amount, note, payment_method) VALUES (?,?,?,?,?)',
      [customer_name, table_number || null, total, note || null, pmethod]
    );
    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of enrichedItems) {
      await conn.execute(
        'INSERT INTO order_items (order_id, menu_id, menu_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)',
        [orderId, item.menu_id, item.menu_name, item.quantity, item.unit_price, item.subtotal]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat!',
      data: { order_id: orderId, total_amount: total, customer_name, status: 'pending', payment_method: pmethod, payment_status: 'unpaid' }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// GET semua pesanan (admin)
router.get('/', async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = `SELECT o.*, COUNT(oi.id) as item_count FROM orders o
                 LEFT JOIN order_items oi ON o.id = oi.order_id WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND o.status = ?'; params.push(status); }
    if (date) { query += ' AND DATE(o.created_at) = ?'; params.push(date); }
    query += ' GROUP BY o.id ORDER BY o.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET detail pesanan by ID
router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await db.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    const [items] = await db.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH update status pesanan (admin)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['pending', 'preparing', 'ready', 'done', 'cancelled'];
    if (!validStatus.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });

    await db.execute('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `Status pesanan diupdate ke "${status}"` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH konfirmasi pembayaran (kasir)
router.patch('/:id/payment', async (req, res) => {
  try {
    const { payment_status } = req.body;
    const validStatus = ['unpaid','paid','refunded'];
    if (!validStatus.includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid' });
    }
    await db.execute(
      'UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?',
      [payment_status, req.params.id]
    );
    // Auto update order status to preparing when paid
    if (payment_status === 'paid') {
      await db.execute(
        "UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [req.params.id]
      );
    }
    res.json({ success: true, message: `Status pembayaran diupdate ke "${payment_status}"` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;