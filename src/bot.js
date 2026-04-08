import { log } from "./logger.js";
import { config } from "./config.js";
import {
  getNFTsInWallet,
  getListingForNFT,
  createListing,
  cancelListing,
  calculatePrice,
  ensureApproval,
  checkGasPrice,
  sleep,
} from "./opensea.js";

// ═══════════════════════════════════════════════════════════════════
//  STATISTIK SESSION
// ═══════════════════════════════════════════════════════════════════
function createStats() {
  return {
    listed: 0,
    relisted: 0,
    skipped: 0,
    errors: 0,
    cancelled: 0,
    gasBlocked: 0,
    byChain: {},
  };
}

function addChainStat(stats, chain, key) {
  if (!stats.byChain[chain]) {
    stats.byChain[chain] = { listed: 0, relisted: 0, skipped: 0, errors: 0 };
  }
  stats.byChain[chain][key] = (stats.byChain[chain][key] || 0) + 1;
}

// ═══════════════════════════════════════════════════════════════════
//  PROSES SATU NFT
// ═══════════════════════════════════════════════════════════════════
async function processNFT(privateKey, nft, stats) {
  const label = `${nft.collection}#${nft.identifier} [${nft.chain}]`;
  const now = Math.round(Date.now() / 1000);

  try {
    // Cek gas price
    const gasOk = await checkGasPrice(nft.chain);
    if (!gasOk) {
      stats.gasBlocked++;
      return;
    }

    // Hitung target harga
    const { price: targetPrice, source } = await calculatePrice({
      slug: nft.collection,
      chainInfo: nft.chainInfo,
    });

    // Cek listing yang sudah ada
    const existing = await getListingForNFT(nft);

    if (existing) {
      const currentPrice = parseFloat(existing.current_price) / 1e18;
      const expiresAt = parseInt(existing.expiration_time);
      const isExpired = expiresAt > 0 && expiresAt <= now;
      const priceDiff = Math.abs(currentPrice - targetPrice) / targetPrice;
      const PRICE_THRESHOLD = 0.005; // 0.5% toleransi

      // Skip jika harga sama dan belum expired
      if (priceDiff < PRICE_THRESHOLD && !isExpired) {
        const minsLeft = Math.round((expiresAt - now) / 60);
        const daysLeft = (minsLeft / 60 / 24).toFixed(1);
        log.info(
          `⏭️  Skip: ${label} | ${currentPrice.toFixed(4)} ${nft.chainInfo.symbol} | ${daysLeft}d tersisa`
        );
        stats.skipped++;
        addChainStat(stats, nft.chain, "skipped");
        return;
      }

      // Perlu re-list
      if (isExpired) {
        log.warn(`⏰ Expired, relist: ${label}`);
      } else {
        log.warn(
          `📉 Harga berubah: ${label} | ${currentPrice.toFixed(4)} → ${targetPrice.toFixed(4)} ${nft.chainInfo.symbol} (${source})`
        );
      }

      const orderParams = existing.protocol_data?.parameters;
      await cancelListing(privateKey, nft, existing.order_hash, orderParams);
      stats.cancelled++;
      await sleep(config.delayAfterCancel);
      stats.relisted++;
      addChainStat(stats, nft.chain, "relisted");
    } else {
      log.info(
        `📋 Listing baru: ${label} @ ${targetPrice.toFixed(4)} ${nft.chainInfo.symbol} (${source})`
      );
      stats.listed++;
      addChainStat(stats, nft.chain, "listed");
    }

    // Pastikan conduit sudah di-approve
    await ensureApproval(privateKey, nft);

    // Buat listing
    const result = await createListing(privateKey, nft);

    if (!result.dryRun) {
      log.success(
        `✅ Listed: ${label} @ ${result.price.toFixed(4)} ${nft.chainInfo.symbol}`
      );
    }
  } catch (err) {
    log.error(`Gagal proses ${label}: ${err.message}`);
    if (config.verbose) console.error(err);
    stats.errors++;
    addChainStat(stats, nft.chain, "errors");
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PROSES SATU WALLET × SATU COLLECTION
// ═══════════════════════════════════════════════════════════════════
async function processWalletCollection(privateKey, collection, stats) {
  const nfts = await getNFTsInWallet(privateKey, collection);

  if (nfts.length === 0) {
    log.chain(collection.chain, `Tidak ada NFT di ${collection.slug}`);
    return;
  }

  log.chain(collection.chain, `Proses ${nfts.length} NFT dari ${collection.slug}...`);

  for (const nft of nfts) {
    await processNFT(privateKey, nft, stats);
    await sleep(config.delayBetweenNFTs);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN BOT CYCLE
// ═══════════════════════════════════════════════════════════════════
export async function runBotCycle() {
  log.title("🤖 OPENSEA MULTI-CHAIN BOT — MULAI SIKLUS");
  if (config.dryRun) log.dryRun("MODE DRY-RUN AKTIF — Tidak ada transaksi nyata");
  log.divider();

  const startTime = Date.now();
  const stats = createStats();

  try {
    const { wallets, collections } = config;

    log.info(
      `Konfigurasi: ${wallets.length} wallet × ${collections.length} collection = ${wallets.length * collections.length} kombinasi`
    );

    for (const privateKey of wallets) {
      // Ambil address untuk display
      const { ethers } = await import("ethers");
      const tempWallet = new ethers.Wallet(privateKey);
      const addr = tempWallet.address;

      log.wallet(addr, `Memproses wallet...`);

      for (const collection of collections) {
        await processWalletCollection(privateKey, collection, stats);
      }
    }
  } catch (err) {
    log.error(`Error fatal: ${err.message}`);
    if (config.verbose) console.error(err);
  }

  // ─── Ringkasan ────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.divider();
  log.title("📊 RINGKASAN SIKLUS");
  console.log(`   ✅ Baru dilist   : ${stats.listed}`);
  console.log(`   🔄 Re-listed    : ${stats.relisted}`);
  console.log(`   ⏭️  Skip         : ${stats.skipped}`);
  console.log(`   🚫 Cancel       : ${stats.cancelled}`);
  console.log(`   ⛽ Gas blocked  : ${stats.gasBlocked}`);
  console.log(`   ❌ Error        : ${stats.errors}`);
  console.log(`   ⏱  Durasi       : ${elapsed}s`);

  if (Object.keys(stats.byChain).length > 1) {
    console.log("\n   Per Chain:");
    for (const [chain, cs] of Object.entries(stats.byChain)) {
      console.log(
        `     ${chain.padEnd(12)}: listed=${cs.listed || 0} relisted=${cs.relisted || 0} skip=${cs.skipped || 0} err=${cs.errors || 0}`
      );
    }
  }

  log.divider();
  return stats;
}
