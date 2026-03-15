// backend/routes/loyalty.js
// =====================================================
// FITUR UNIK: Loyalty Points System
// =====================================================
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Tier thresholds
const TIERS = {
  bronze:   { min: 0,    max: 499,  multiplier: 1,   label: '🥉 Bronze',   discount: 0   },
  silver:   { min: 500,  max: 1499, multiplier: 1.5, label: '🥈 Silver',   discount: 5   },
  gold:     { min: 1500, max: 3999, multiplier: 2,   label: '🥇 Gold',     discount: 10  },
  platinum: { min: 4000, max: 9999, multiplier: 3,   label: '💎 Platinum', discount: 15  },
};

function getTier(points) {
  if (points >= 4000) return 'platinum';
  if (points >= 1500) return 'gold';
  if (points >= 500)  return 'silver';
  return 'bronze';
}

function calcPoints(totalAmount, tier) {
  const base = Math.floor(totalAmount / 1000); // 1 poin per Rp 1.000
  return Math.floor(base * TIERS[tier].multiplier);
}

// GET cek poin by phone
router.get('/check/:phone', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM loyalty_points WHERE customer_phone = ?',
      [req.params.phone]
    );
    if (rows.length === 0) {
      return res.json({ success: true, exists: false, points: 0, tier: 'bronze', tier_label: TIERS.bronze.label });
    }
    const lp = rows[0];
    const tierInfo = TIERS[lp.tier];
    const nextTier = Object.entries(TIERS).find(([, v]) => v.min > lp.points);
    res.json({
      success: true,
      exists: true,
      data: {
        ...lp,
        tier_label: tierInfo.label,
        next_tier: nextTier ? nextTier[0] : null,
        points_to_next: nextTier ? nextTier[1].min - lp.points : 0,
        discount_pct: tierInfo.discount,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST tambah / update poin setelah order
router.post('/earn', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_name, customer_phone, order_id, total_amount } = req.body;
    if (!customer_phone || !total_amount) throw new Error('phone dan total_amount wajib');

    // Cari atau buat loyalty record
    let [rows] = await conn.execute('SELECT * FROM loyalty_points WHERE customer_phone = ?', [customer_phone]);
    let lp;

    if (rows.length === 0) {
      await conn.execute(
        'INSERT INTO loyalty_points (customer_name, customer_phone, points, total_earned, tier) VALUES (?,?,0,0,"bronze")',
        [customer_name, customer_phone]
      );
      [rows] = await conn.execute('SELECT * FROM loyalty_points WHERE customer_phone = ?', [customer_phone]);
    }
    lp = rows[0];

    const earned = calcPoints(total_amount, lp.tier);
    const newPoints = lp.points + earned;
    const newTier = getTier(newPoints);

    await conn.execute(
      'UPDATE loyalty_points SET points=?, total_earned=total_earned+?, tier=?, customer_name=?, updated_at=NOW() WHERE customer_phone=?',
      [newPoints, earned, newTier, customer_name, customer_phone]
    );

    await conn.execute(
      'INSERT INTO loyalty_history (customer_phone, order_id, points_earned, description) VALUES (?,?,?,?)',
      [customer_phone, order_id || null, earned, `Order #${order_id} — Rp ${Number(total_amount).toLocaleString('id-ID')}`]
    );

    await conn.commit();
    const tierUpgrade = newTier !== lp.tier;
    res.json({
      success: true,
      data: {
        points_earned: earned,
        total_points: newPoints,
        tier: newTier,
        tier_label: TIERS[newTier].label,
        tier_upgraded: tierUpgrade,
        message: tierUpgrade
          ? `🎉 Selamat! Kamu naik ke tier ${TIERS[newTier].label}!`
          : `+${earned} poin ditambahkan! Total: ${newPoints} poin`
      }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST redeem poin untuk diskon
router.post('/redeem', async (req, res) => {
  try {
    const { customer_phone, points_to_redeem, order_total } = req.body;
    if (!customer_phone || !points_to_redeem) throw new Error('phone dan points wajib');

    const [rows] = await db.execute('SELECT * FROM loyalty_points WHERE customer_phone = ?', [customer_phone]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });

    const lp = rows[0];
    if (lp.points < points_to_redeem) return res.status(400).json({ success: false, message: 'Poin tidak cukup' });

    // 100 poin = Rp 1.000 diskon
    const discount = Math.floor(points_to_redeem / 100) * 1000;
    const finalTotal = Math.max(0, order_total - discount);

    res.json({
      success: true,
      data: {
        points_redeemed: points_to_redeem,
        discount_amount: discount,
        final_total: finalTotal,
        remaining_points: lp.points - points_to_redeem,
        message: `Diskon Rp ${discount.toLocaleString('id-ID')} berhasil diterapkan!`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET riwayat poin
router.get('/history/:phone', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM loyalty_history WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 20',
      [req.params.phone]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;