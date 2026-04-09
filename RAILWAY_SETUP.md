# 🚀 Railway Deployment - Full Configuration

## 📋 Copy-Paste Railway Variables:

### 🔐 WALLET
```env
MNEMONIC="your_12_or_24_word_mnemonic_here"
```

### 🌐 OPENSEA API
```env
OPENSEA_API_KEY="your_opensea_api_key_here"
```

### 🎯 COLLECTIONS (IMPORTANT!)
```env
COLLECTIONS="arbitrum:arbitrumdao-celebrating-the-third-anniversary:0x41fdE438b6B757bc13f956464fD64b3a540692F0"
```

**⚠️ PENTING:**
- Chain: `arbitrum`
- Slug: `arbitrumdao-celebrating-the-third-anniversary`
- Contract: `0x0000419b4b6132e05dfbd89f65b165dfd6fa126f` (ganti dengan contract address yang benar)

### 🔍 ETHERSCAN API
```env
ETHERSCAN_API_KEY="X9PH5MYKVIQ2RSI6XFYAF8BHZ4TD3IE5E7"
USE_ETHERSCAN_API="true"
ETHERSCAN_SCAN_BATCH="100"
ETHERSCAN_RATE_LIMIT_MS="1000"
```

### 💰 PRICE PROTECTION (USD-based)
```env
USE_MIN_PRICE="true"
MIN_PRICE_USD="0.02"
```

### ⚡ AUTO-MINT (Optional)
```env
MINT_CONFIG="{\"default\": {\"enabled\": false, \"minBalance\": 50, \"maxMintAmount\": 50}}"
```

### 📊 LISTING & SCHEDULE
```env
PRICE_OFFSET_PERCENT="0"
MIN_PRICE_FALLBACK="0.000001"
MAX_PRICE="0"
LISTING_DURATION_MINUTES="10"
MAX_LISTINGS="0"
CRON_SCHEDULE="*/10 * * * *"
```

### ⏱️ DELAY
```env
DELAY_BETWEEN_NFTS="2000"
DELAY_AFTER_CANCEL="3000"
```

### ⛽ GAS PROTECTION
```env
MAX_GAS_PRICE_GWEI="0"
```

### 🔧 DEBUG
```env
DRY_RUN="false"
VERBOSE="false"
```

### 💬 TELEGRAM
```env
TELEGRAM_ENABLED="true"
TELEGRAM_BOT_TOKEN="7888221452:AAGRUXznbxxz2m1nVmGXK5UWlNjtieirml4"
TELEGRAM_CHAT_ID="899391125"
```

---

## 🎯 Collection Details:

**Name:** Arbitrum DAO - Celebrating the Third Anniversary  
**Chain:** Arbitrum One  
**Slug:** `arbitrumdao-celebrating-the-third-anniversary`  
**URL:** https://opensea.io/collection/arbitrumdao-celebrating-the-third-anniversary

---

## 📝 Railway Setup Steps:

1. **Go to Railway Dashboard**
   - Project: `opensea-bot-mod`
   - Settings → Variables

2. **Delete Old Variables:**
   ```
   ❌ DEFAULT_PRICE
   ❌ RPC_URL_*(all RPC variables)
   ❌ MIN_PRICE_FALLBACK (optional)
   ```

3. **Add New Variables:**
   - Copy all variables from list above
   - Add one by one
   - Railway will auto-deploy

4. **Test:**
   - Check logs after deploy
   - Should see: "Etherscan success: X tokens found"

---

## 🧪 Test Mode (Dry Run):

Before going live, test with:
```env
DRY_RUN="true"
```

**Dry run output:**
```
🤖 OPENSEA MULTI-CHAIN BOT — MULAI SIKLUS
✅ No real transactions (DRY_RUN)
🔧 Config debug:
   • Min Price USD: $0.02
   • Etherscan Enabled: true
   • Etherscan API Key: ✅ Set
```

---

## ✅ Expected Logs:

```
🤖 OPENSEA MULTI-CHAIN BOT — MULAI SIKLUS
🔧 Config debug:
   • Min Price USD: $0.02
   • Use Min Price: true
   • Etherscan Enabled: true
   • Etherscan API Key: ✅ Set
   • Auto-Mint Enabled: false
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Wallet: 0xFD6b9Aa56... (1 wallet)
📦 Collection: arbitrumdao-celebrating-the-third-anniversary@arbitrum

Etherscan API: tokenlist for 0xFD6b9A... (Explorer: api.arbiscan.io)
Etherscan success: 50 tokens found
✅ Auto-mint: 0 NFTs minted (sufficient balance)
📋 Listing new: arbitrumdao-celebrating-the-third-anniversary#123 @ $0.02
```

---

## ⚠️ Important Notes:

1. **Replace placeholder values:**
   - `MNEMONIC`: Your wallet recovery phrase
   - `OPENSEA_API_KEY`: Your OpenSea API key
   - `COLLECTIONS`: Update with correct contract address

2. **No RPC variables needed:**
   - Bot uses public RPC defaults
   - FREE and sufficient for NFT listing

3. **Etherscan API key works for ALL EVM chains:**
   - Arbitrum, Ethereum, Polygon, Base, etc.
   - One key works everywhere

4. **Collection slug must be EXACT:**
   - `arbitrumdao-celebrating-the-third-anniversary`
   - No typos!

---

## 🆘 Troubleshooting:

### "Min Price USD: undefined"
**Fix:** Add `MIN_PRICE_USD="0.02"` variable

### "Etherscan API Key: ❌ Not set"
**Fix:** Add `ETHERSCAN_API_KEY="X9PH5MYKVIQ2RSI6XFYAF8BHZ4TD3IE5E7"`

### "OpenSea API 404"
**Fix:** Verify:
- OPENSEA_API_KEY is valid
- COLLECTIONS slug is correct (copy paste from OpenSea)

### "AutoScan running instead of Etherscan"
**Fix:** Verify:
- ETHERSCAN_API_KEY is set
- USE_ETHERSCAN_API="true"
- Railway deployed latest commit

---

## 📞 Support:

If issues persist, check:
1. Railway logs: `railway logs`
2. Railway variables: Settings → Variables
3. GitHub commit: https://github.com/sirwhy/opensea-bot-mod
