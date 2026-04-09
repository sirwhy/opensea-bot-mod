# 🚀 Railway COLLECTIONS Setup Guide

## ❌ SALAH (Error yang Anda alami):

```bash
# ❌ JANGAN gunakan quotes di dalam value!
COLLECTIONS="arbitrum:arbitrumdao-celebrating-the-third-anniversary:0xContract"
# ^^^ This causes "Format COLLECTIONS salah"

# ❌ JANGAN gunakan escape!
COLLECTIONS=\"arbitrum:arbitrumdao-celebrating-the-third-anniversary:0xContract\"
# ^^^ Also wrong!
```

## ✅ BENAR (Cara yang Tepat):

### **Option 1: Tanpa Quotes** (RECOMMENDED)
```bash
# Railway Dashboard → Settings → Variables
COLLECTIONS=arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x0000419b4b6132e05dfbd89f65b165dfd6fa126f
#                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                                           Paste contract address here
```

### **Option 2: Dengan Quotes di Railway UI**
```bash
# Railway UI allows quotes, bot will handle them automatically
COLLECTIONS="arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x0000419b4b6132e05dfbd89f65b165dfd6fa126f"
```

**Bot sekarang sudah support BOTH format!** ✅

---

## 📝 Step-by-Step Railway Setup:

### **Step 1: Get Contract Address**

1. Go to OpenSea: https://arbitrum.opensea.io/collection/arbitrumdao-celebrating-the-third-anniversary
2. Click "Settings" or "Contract"
3. Copy contract address: `0x0000419b4b6132e05dfbd89f65b165dfd6fa126f`

### **Step 2: Set Collection in Railway**

1. Go to Railway Dashboard
2. Click **Settings** → **Variables**
3. Click **New Variable**
4. **Name:** `COLLECTIONS`
5. **Value:** 
   ```
   arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x0000419b4b6132e05dfbd89f65b165dfd6fa126f
   ```
   (paste contract address at the end)
6. Click **Add Variable**

### **Step 3: Add Required Variables**

```bash
MNEMONIC="your_12_or_24_word_mnemonic_here"
OPENSEA_API_KEY="your_opensea_api_key_here"
ETHERSCAN_API_KEY="X9PH5MYKVIQ2RSI6XFYAF8BHZ4TD3IE5E7"
USE_ETHERSCAN_API="true"
USE_MIN_PRICE="true"
MIN_PRICE_USD="0.02"
TELEGRAM_ENABLED="true"
TELEGRAM_BOT_TOKEN="7888221452:AAGRUXznbxxz2m1nVmGXK5UWlNjtieirml4"
TELEGRAM_CHAT_ID="899391125"
LISTING_DURATION_MINUTES="10"
CRON_SCHEDULE="*/10 * * * *"
DRY_RUN="false"
```

**Railway will auto-deploy!** ✅

---

## 🔍 Verify COLLECTIONS Format:

### **Format:**
```
chain:collection-slug:contract-address
```

### **Components:**
1. **chain:** `arbitrum` (lowercase)
2. **collection-slug:** `arbitrumdao-celebrating-the-third-anniversary` (copy dari OpenSea URL)
3. **contract-address:** `0x...` (pastikan lengkap dan benar)

### **Example:**
```
arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x0000419b4b6132e05dfbd89f65b165dfd6fa126f
      ↑                          ↑                                        ↑
   chain name              collection slug                        contract address
```

---

## 🧪 Test Mode (Recommended First):

Set `DRY_RUN="true"` first:

```bash
DRY_RUN="true"
COLLECTIONS="arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x0000419b4b6132e05dfbd89f65b165dfd6fa126f"
```

**Expected Output:**
```
🔧 Config debug:
   • Collections: 1 collection(s)
   • Collection: arbitrumdao-celebrating-the-third-anniversary@arbitrum
   • Contract: 0x0000419b4b6132e05dfbd89f65b165dfd6fa126f
```

---

## ✅ Expected Logs (After Fix):

```
🤖 OPENSEA MULTI-CHAIN BOT — MULAI SIKLUS
🔧 Config debug:
   • Collections: 1 collection(s)
   • Collection #1: arbitrumdao-celebrating-the-third-anniversary@arbitrum
   • Min Price USD: $0.02
   • Etherscan Enabled: true
   • Etherscan API Key: ✅ Set
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Wallet: 0xFD6b9Aa56... (1 wallet)
📦 Collection: arbitrumdao-celebrating-the-third-anniversary@arbitrum (1 collection)

Etherscan API: tokenlist for 0xFD6b9A... (Explorer: api.arbiscan.io)
Etherscan success: 50 tokens found
✅ Auto-mint: 0 NFTs minted (balance sufficient)
📋 Listing new: arbitrumdao-celebrating-the-third-anniversary#123 @ $0.02
```

---

## 🐛 Troubleshooting:

### **Error: "Format COLLECTIONS salah"**

**Cause:** Contract address missing or invalid

**Fix:**
1. Check Railway Variable:
   - Should be: `arbitrum:slug:0x...`
   - NOT: `arbitrum:slug` (missing contract)
   - NOT: `arbitrum slug 0x...` (using spaces)

2. Verify contract address:
   - Should start with `0x`
   - Should be 42 characters long
   - Example: `0x0000419b4b6132e05dfbd89f65b165dfd6fa126f`

### **Error: "Chain tidak dikenal: arbitrumdao..."**

**Cause:** Colon split wrong, slug contains colon

**Fix:**
- Collection slug should NOT contain colons
- `arbitrumdao-celebrating-the-third-anniversary` ✅
- `arbitrum:dao:collection` ❌ (wrong - has colon in slug)

### **Error: "COLLECTIONS tidak diatur"**

**Cause:** Variable not set or empty

**Fix:**
- Railway Settings → Variables
- Add `COLLECTIONS` variable
- Value: `arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x...`
- Deploy again

---

## 📋 Quick Checklist:

Before deploying:

- [ ] `COLLECTIONS` variable set
- [ ] Format: `chain:slug:contract`
- [ ] Chain = `arbitrum` (lowercase)
- [ ] Slug = `arbitrumdao-celebrating-the-third-anniversary` (exact)
- [ ] Contract = `0x0000419b4b6132e05dfbd89f65b165dfd6fa126f` (verified)
- [ ] `MNEMONIC` variable set
- [ ] `OPENSEA_API_KEY` variable set
- [ ] `ETHERSCAN_API_KEY` = `X9PH5MYKVIQ2RSI6XFYAF8BHZ4TD3IE5E7`
- [ ] `USE_ETHERSCAN_API` = `true`
- [ ] `USE_MIN_PRICE` = `true`
- [ ] `MIN_PRICE_USD` = `0.02`

---

## 🎯 Summary:

**Railway Variable Format:**
```
COLLECTIONS=arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x0000419b4b6132e05dfbd89f65b165dfd6fa126f
```

**Bot supports both:**
- ✅ Without quotes: `COLLECTIONS=arbitrum:slug:0x...`
- ✅ With quotes: `COLLECTIONS="arbitrum:slug:0x..."`

**Bot will now handle quotes automatically!** ✅

---

## 🚀 Ready to Deploy:

1. Update Railway `COLLECTIONS` variable
2. Ensure all other variables set
3. Railway auto-deploys
4. Check logs in 1-2 minutes
5. Should see success messages!

---

**Good luck! 🦕**
