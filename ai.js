// backend/routes/ai.js
// =====================================================
// STEP 3: AI RECOMMENDATION ENGINE (Claude API)
// =====================================================
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Anthropic Claude API call helper
async function callClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'AI API error');
  return data.content[0].text;
}

// GET AI recommendation berdasarkan konteks
// Query params: time, weather, mood, phone (untuk history)
router.get('/recommend', async (req, res) => {
  try {
    const { time, weather, mood, phone } = req.query;
    const hour = parseInt(time || new Date().getHours());

    // Tentukan konteks waktu
    let timeCtx = 'pagi';
    if (hour >= 10 && hour < 14) timeCtx = 'siang';
    else if (hour >= 14 && hour < 18) timeCtx = 'sore';
    else if (hour >= 18) timeCtx = 'malam';

    // Ambil menu yang tersedia
    const [menus] = await db.execute(
      'SELECT name, description, price, category_id, order_count, tags FROM menus WHERE is_available = TRUE ORDER BY order_count DESC'
    );

    // Ambil riwayat pesanan jika ada phone
    let orderHistory = [];
    if (phone) {
      const [history] = await db.execute(
        `SELECT oi.menu_name, COUNT(*) as cnt FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.customer_phone = ?
         GROUP BY oi.menu_name ORDER BY cnt DESC LIMIT 5`,
        [phone]
      );
      orderHistory = history.map(h => h.menu_name);
    }

    // Ambil trending hari ini
    const [trending] = await db.execute(
      `SELECT oi.menu_name, COUNT(*) as cnt FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE DATE(o.created_at) = CURDATE()
       GROUP BY oi.menu_name ORDER BY cnt DESC LIMIT 5`
    );

    const menuList = menus.map(m => `- ${m.name} (Rp ${Number(m.price).toLocaleString('id-ID')}): ${m.description}`).join('\n');
    const trendingList = trending.length > 0 ? trending.map(t => t.menu_name).join(', ') : 'belum ada data';
    const historyText = orderHistory.length > 0 ? `Pesanan sebelumnya: ${orderHistory.join(', ')}` : 'Pelanggan baru';

    const systemPrompt = `Kamu adalah AI barista Kopi Nusantara yang ramah dan berpengetahuan luas tentang kopi.
Tugasmu adalah merekomendasikan 2-3 menu yang paling cocok berdasarkan konteks pelanggan.
Berikan respons dalam format JSON yang valid:
{
  "recommendations": [
    { "name": "Nama Menu", "reason": "Alasan singkat kenapa cocok (maks 15 kata)", "mood_match": "cocok untuk [mood/situasi]" }
  ],
  "greeting": "Satu kalimat sapaan hangat dan personal (maks 20 kata)",
  "weather_note": "Komentar singkat tentang cuaca/waktu yang relevan dengan kopi (maks 15 kata)"
}
Hanya rekomendasikan menu yang ada dalam daftar. Jawab dalam bahasa Indonesia yang natural dan hangat.`;

    const userMsg = `Konteks pelanggan:
- Waktu: ${timeCtx} (jam ${hour}.00)
- Cuaca: ${weather || 'tidak diketahui'}
- Mood/keinginan: ${mood || 'tidak disebutkan'}
- ${historyText}
- Trending hari ini: ${trendingList}

Daftar menu tersedia:
${menuList}

Rekomendasikan 2-3 menu yang paling cocok.`;

    let aiResponse;
    try {
      const raw = await callClaude(systemPrompt, userMsg);
      // Parse JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      aiResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (aiErr) {
      console.warn('Claude API error, using fallback:', aiErr.message);
      aiResponse = null;
    }

    // Fallback jika AI tidak tersedia
    if (!aiResponse) {
      const fallbackMenus = menus.slice(0, 3);
      aiResponse = {
        recommendations: fallbackMenus.map(m => ({
          name: m.name,
          reason: timeCtx === 'pagi' ? 'Cocok untuk awali harimu' :
                   timeCtx === 'siang' ? 'Segar untuk tengah hari' :
                   timeCtx === 'sore' ? 'Teman sore yang sempurna' : 'Hangat untuk malam hari',
          mood_match: `cocok untuk ${timeCtx}`
        })),
        greeting: `Halo! Selamat ${timeCtx} di Kopi Nusantara ☕`,
        weather_note: weather === 'hujan' ? 'Hari hujan cocok banget buat ngopi yang hangat!' :
                       weather === 'panas' ? 'Cuaca panas? Coba menu dingin kami!' :
                       'Kopi selalu cocok di cuaca apapun!'
      };
    }

    // Enrich dengan data harga dari database
    const enriched = aiResponse.recommendations.map(rec => {
      const menuData = menus.find(m => m.name === rec.name);
      return { ...rec, price: menuData?.price || 0 };
    }).filter(r => r.price > 0);

    res.json({
      success: true,
      data: {
        ...aiResponse,
        recommendations: enriched,
        context: { time: timeCtx, hour, weather, mood },
        trending: trending.slice(0, 3).map(t => t.menu_name),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST AI barista chat
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Pesan kosong' });

    const [menus] = await db.execute('SELECT name, description, price FROM menus WHERE is_available=TRUE');
    const menuCtx = menus.map(m => `${m.name}: ${m.description} — Rp ${Number(m.price).toLocaleString('id-ID')}`).join('\n');

    const systemPrompt = `Kamu adalah "Barista AI" dari Kopi Nusantara, asisten barista virtual yang ramah, berpengetahuan, dan suka ngobrol santai tentang kopi.
Menu yang tersedia:\n${menuCtx}
Jawab dalam bahasa Indonesia, singkat (maks 3 kalimat), hangat, dan selalu akhiri dengan menawarkan bantuan lebih lanjut atau merekomendasikan menu.
Jangan menjawab hal di luar topik kopi, makanan, atau layanan Kopi Nusantara.`;

    const messages = [
      ...history.slice(-6), // Last 3 turns
      { role: 'user', content: message }
    ];

    let reply;
    try {
      reply = await callClaude(systemPrompt, messages.map(m => `${m.role}: ${m.content}`).join('\n'));
    } catch {
      reply = 'Maaf, AI barista sedang istirahat sebentar ☕ Tapi kamu bisa langsung tanya ke barista kami ya!';
    }

    res.json({ success: true, data: { reply, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET smart weather-based recommendation (no AI needed)
router.get('/weather-tip', async (req, res) => {
  try {
    const hour = new Date().getHours();
    const tips = {
      pagi:  { icon:'🌅', msg:'Pagi yang segar! Waktunya espresso atau pour over untuk semangat hari ini.', menus:['Espresso','V60 Pour Over','Cappuccino'] },
      siang: { icon:'☀️', msg:'Siang terik? Cold brew atau es kopi susu bisa jadi penyelamat!',           menus:['Cold Brew','Es Kopi Susu','Iced Matcha Latte'] },
      sore:  { icon:'🌤️', msg:'Sore asyik buat ngobrol sambil latte atau cappuccino.',                    menus:['Latte','Cappuccino','Avocado Toast'] },
      malam: { icon:'🌙', msg:'Malam tenang? Coklat panas atau teh tarik buat menutup hari.',             menus:['Coklat Panas','Teh Tarik','Banana Cake'] },
    };
    const period = hour < 10 ? 'pagi' : hour < 14 ? 'siang' : hour < 18 ? 'sore' : 'malam';
    const tip = tips[period];

    const [menuData] = await db.execute(
      'SELECT id, name, price FROM menus WHERE name IN (?,?,?) AND is_available=TRUE',
      tip.menus
    );

    res.json({ success: true, data: { ...tip, period, hour, menu_data: menuData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
