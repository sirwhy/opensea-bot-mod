# 🤖 OpenSea Auto Listing Bot

Bot otomatis untuk listing NFT di OpenSea dengan fitur:
- ✅ Auto list semua NFT di wallet
- 🔄 Auto relist jika expired
- 💰 Auto update harga mengikuti floor price
- 🗑️ Auto cancel & relist jika harga berubah

---

## 📋 Prasyarat

- Node.js versi 18 atau lebih baru
- Akun OpenSea + API Key
- Akun Alchemy / Infura (gratis)
- Wallet Ethereum dengan NFT

---

## 🚀 Cara Install

### 1. Clone / download project ini

```bash
git clone https://github.com/kamu/opensea-bot.git
cd opensea-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Buat file `.env`

```bash
cp .env.example .env
```

Buka file `.env` lalu isi:
- `PRIVATE_KEY` → private key wallet kamu
- `RPC_URL` → dari Alchemy atau Infura
- `OPENSEA_API_KEY` → dari opensea.io/developers

### 4. Jalankan bot

```bash
npm start
```

---

## ⚙️ Konfigurasi

Semua pengaturan ada di file `.env`:

| Variable | Fungsi | Contoh |
|---|---|---|
| `CHAIN` | Blockchain target | `ethereum`, `polygon`, `base` |
| `DEFAULT_PRICE` | Harga listing (ETH) | `0.05` |
| `FOLLOW_FLOOR_PRICE` | Ikut floor price | `true` |
| `PRICE_OFFSET_PERCENT` | Offset dari floor | `-5` (5% dibawah floor) |
| `LISTING_DURATION_DAYS` | Masa berlaku listing | `7` |
| `CRON_SCHEDULE` | Jadwal pengecekan | `0 * * * *` (tiap jam) |
| `NFT_CONTRACT_ADDRESS` | Filter 1 collection | kosongkan = semua NFT |
| `MAX_LISTINGS` | Batas jumlah listing | `0` = tidak terbatas |

---

## 🔗 Ganti Chain

Cukup ubah di `.env`:

```env
# Ethereum mainnet
CHAIN=ethereum
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY

# Polygon
CHAIN=polygon
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/KEY

# Base
CHAIN=base
RPC_URL=https://base-mainnet.g.alchemy.com/v2/KEY
```

---

## 🖥️ Deploy ke VPS (agar bot jalan 24/7)

```bash
# Install PM2
npm install -g pm2

# Jalankan bot dengan PM2
pm2 start src/index.js --name opensea-bot

# Bot otomatis restart saat server reboot
pm2 startup
pm2 save

# Lihat log
pm2 logs opensea-bot
```

---

## ⚠️ Peringatan

- **JANGAN share private key kamu ke siapapun**
- **JANGAN commit file `.env` ke GitHub**
- Pastikan wallet punya cukup ETH untuk gas fee
- Baca Terms of Service OpenSea sebelum menggunakan bot

---

## 📞 Butuh Bantuan?

Cek bagian Issues di repository ini atau hubungi developer.
