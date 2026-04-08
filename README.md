# 🤖 OpenSea Auto Listing Bot — Multi-Chain & Multi-Wallet

Bot otomatis untuk listing NFT di OpenSea, mendukung banyak chain dan banyak wallet sekaligus.

## ✨ Fitur Baru (v2.0)

| Fitur | Keterangan |
|---|---|
| **Multi-Chain** | Ethereum, Polygon, Base, Arbitrum, Optimism, Avalanche, Klaytn, AnimeChain, Blast, Zora |
| **Multi-Wallet** | Jalankan banyak wallet sekaligus |
| **Multi-Collection** | Kelola beberapa collection di chain berbeda |
| **Strategi Harga** | `floor`, `last_sale`, `fixed`, `floor_or_last` |
| **Gas Protection** | Skip otomatis jika gas terlalu mahal |
| **Auto Approval** | Cek & approve Seaport conduit otomatis |
| **Retry Logic** | Retry otomatis dengan delay jika gagal |
| **Dry-Run Mode** | Simulasi tanpa transaksi nyata |
| **Price Cache** | Cache harga 60 detik agar hemat API call |
| **Statistik Detail** | Ringkasan per siklus dan per chain |

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Buat file .env
```bash
cp .env.example .env
```

Edit `.env` dan isi konfigurasi:

```env
# Wallet (pilih salah satu)
PRIVATE_KEY=0xprivate_key_kamu
# atau banyak wallet:
# PRIVATE_KEYS=0xkey1,0xkey2,0xkey3

OPENSEA_API_KEY=opensea_api_key_kamu

# Format: chain:collection-slug:0xContractAddress
# Pisahkan dengan koma untuk multi-collection
COLLECTIONS=animechain:gate-0:0xContractKamu

# RPC untuk setiap chain yang dipakai
RPC_URL_ANIMECHAIN=https://rpc.anime.xyz
```

### 3. Jalankan bot
```bash
# Mode normal
npm start

# Mode dry-run (simulasi, tidak ada transaksi)
npm run dry

# Mode dev (auto-restart saat file berubah)
npm run dev
```

## ⚙️ Konfigurasi Lengkap

### COLLECTIONS (format)
```
COLLECTIONS=chain:slug:0xContract
```

Contoh multi-chain:
```
COLLECTIONS=ethereum:boredapeyachtclub:0xBC4CA0Ed...,base:my-base-nft:0xABC123...,animechain:gate-0:0xDEF456...
```

### Chain yang didukung
| Key | Chain | Symbol |
|---|---|---|
| `ethereum` | Ethereum Mainnet | ETH |
| `polygon` | Polygon | POL |
| `base` | Base | ETH |
| `arbitrum` | Arbitrum One | ETH |
| `optimism` | Optimism | ETH |
| `avalanche` | Avalanche C-Chain | AVAX |
| `klaytn` | Klaytn | KLAY |
| `animechain` | AnimeChain | ANIME |
| `blast` | Blast | ETH |
| `zora` | Zora Network | ETH |

### Strategi Harga
| Strategy | Keterangan |
|---|---|
| `floor` | Ikuti floor price collection |
| `last_sale` | Ikuti harga last sale tertinggi |
| `fixed` | Gunakan `DEFAULT_PRICE` saja |
| `floor_or_last` | Ambil mana yang lebih tinggi |

```env
PRICE_STRATEGY=floor
PRICE_OFFSET_PERCENT=-2   # 2% di bawah floor
MIN_PRICE=0.001            # tidak boleh kurang dari ini
MAX_PRICE=10               # tidak boleh lebih dari ini (0 = bebas)
```

### Gas Protection
```env
MAX_GAS_PRICE_GWEI=50  # skip jika gas > 50 Gwei (0 = tidak dibatasi)
```

## 📁 Struktur Project

```
src/
├── index.js    — Entry point & scheduler
├── bot.js      — Logika utama siklus bot
├── config.js   — Konfigurasi & parsing env
├── opensea.js  — API OpenSea & Seaport integration
├── wallet.js   — Multi-wallet & provider pool
└── logger.js   — Colored logging
```

## ⚠️ Disclaimer

Bot ini untuk keperluan edukasi. Pastikan Anda memahami risiko listing NFT secara otomatis. Selalu test dengan `DRY_RUN=true` terlebih dahulu.
