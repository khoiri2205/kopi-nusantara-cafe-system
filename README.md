# ☕ Kopi Nusantara

> Sistem manajemen kafe modern yang aesthetic — dari meja pelanggan sampai dapur owner, semua dalam satu platform.

---

## 🌟 Tentang Project

**Kopi Nusantara** adalah web app manajemen kafe yang dibangun untuk menyederhanakan operasional kafe sehari-hari. Mulai dari pelanggan yang scan QR buat order, kasir yang proses transaksi, sampai owner yang pantau semua dari dashboard — semuanya terintegrasi rapi dalam satu sistem.

---

## ✨ Fitur Utama

### 🛒 Sistem Order Online
Pelanggan bisa langsung order dari meja lewat browser — nggak perlu antri, nggak perlu install app.

### 📊 Dashboard Owner & Kasir
Dua dashboard terpisah sesuai peran:
- **Owner** — pantau revenue, menu terlaris, dan performa keseluruhan
- **Kasir** — kelola order masuk, update status, dan proses transaksi

### 🎁 Loyalty Points
Sistem poin otomatis untuk pelanggan setia. Setiap transaksi = poin yang bisa ditukar reward.

### 📱 QR Code Menu
Scan QR di meja → langsung ke halaman order. Paperless, cepat, dan kekinian.

---

## 🗂️ Struktur File

```
kopi-nusantara/
├── home.html              # Halaman utama / landing
├── order.html             # Halaman order pelanggan
├── dashboard.html         # Dashboard utama
├── dashboard-kasir.html   # Dashboard untuk kasir
├── dashboard-owner.html   # Dashboard untuk owner
├── qr-generator.html      # Generator QR code meja
├── ai.js                  # Modul AI
├── app.js                 # Logic utama aplikasi
├── dashboard.js           # Logic dashboard
├── loyalty.js             # Sistem loyalty points
├── orders.js              # Manajemen order
├── tracking.js            # Tracking pesanan
└── style.css              # Stylesheet global
```

---

## 🚀 Cara Pakai

1. Clone repo ini:
   ```bash
   git clone https://github.com/username/kopi-nusantara.git
   ```

2. Buka `home.html` di browser — atau serve lewat local server:
   ```bash
   npx serve .
   ```

3. Untuk generate QR meja, buka `qr-generator.html`

---

## 🛠️ Tech Stack

- **HTML / CSS / JavaScript** — vanilla, no framework
- **CSS Custom** — styling aesthetic & responsive

---

## 👨‍💻 Author

Dibuat dengan ☕ dan banyak waktu gabut.

---

> *"Kopi terbaik adalah kopi yang dipesan dengan mudah."*