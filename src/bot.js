import { log } from "./logger.js";
import { config } from "./config.js";
import { sendCycleSummary, notifyBotStarted } from "./telegram.js";
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
import { checkAndMintNFTs } from "./mint.js";

function createStats() {
  return { listed: 0, relisted: 0, skipped: 0, errors: 0, cancelled: 0, gasBlocked: 0, soldSkipped: 0, totalNfts: 0, byChain: {} };
}

function addChainStat(stats, chain, key) {
  if (!stats.byChain[chain]) stats.byChain[chain] = {};
  stats.byChain[chain][key] = (stats.byChain[chain][key] || 0) + 1;
}

async function processNFT(privateKey, nft, stats) {
  const label = `${nft.collection}#${nft.identifier} [${nft.chain}]`;
  const now = Math.round(Date.now() / 1000);

  try {
    // Gas check
    const gasOk = await checkGasPrice(nft.chain);
    if (!gasOk) { stats.gasBlocked++; return; }

    // Hitung harga target
    const { price: targetPrice, source, basePrice } = await calculatePrice({
      slug: nft.collection,
      chainInfo: nft.chainInfo,
    });

    // Cek listing existing
    const existing = await getListingForNFT(nft);

    if (existing) {
      const currentPrice = parseFloat(existing.current_price) / 1e18;
      const expiresAt = parseInt(existing.expiration_time);
      const isExpired = expiresAt > 0 && expiresAt <= now;
      const priceDiff = Math.abs(currentPrice - targetPrice) / (targetPrice || 1);
      const PRICE_THRESHOLD = 0.005; // 0.5% toleransi

      // Skip jika harga sama dan belum expired
      if (priceDiff < PRICE_THRESHOLD && !isExpired) {
        const secsLeft = expiresAt - now;
        const minsLeft = Math.max(0, Math.round(secsLeft / 60));
        log.info(`⏭️  Skip: ${label} | ${currentPrice.toFixed(6)} ${nft.chainInfo.symbol} | ${minsLeft}min tersisa`);
        stats.skipped++;
        addChainStat(stats, nft.chain, "skipped");
        return;
      }

      if (isExpired) {
        log.warn(`⏰ Expired, relist: ${label}`);
      } else {
        log.warn(`📉 Floor berubah: ${label} | ${currentPrice.toFixed(6)} → ${targetPrice.toFixed(6)} ${nft.chainInfo.symbol}`);
      }

      // Cancel listing lama
      const orderParams = existing.protocol_data?.parameters;
      await cancelListing(privateKey, nft, existing.order_hash, orderParams);
      stats.cancelled++;
      await sleep(config.delayAfterCancel);
      stats.relisted++;
      addChainStat(stats, nft.chain, "relisted");
    } else {
      log.info(`📋 Listing baru: ${label} @ ${targetPrice.toFixed(6)} ${nft.chainInfo.symbol} (${source})`);
      stats.listed++;
      addChainStat(stats, nft.chain, "listed");
    }

    // Approval
    const approved = await ensureApproval(privateKey, nft);
    if (!approved) {
      log.error(`Approval gagal untuk ${label}, skip listing`);
      stats.errors++;
      return;
    }

    // Buat listing
    const result = await createListing(privateKey, nft);

    if (!result.dryRun) {
      log.success(`✅ Listed: ${label} @ ${result.price.toFixed(6)} ${nft.chainInfo.symbol} (${config.listingDurationMinutes}min)`);
    }
  } catch (err) {
    log.error(`Gagal proses ${label}: ${err.message}`);
    if (config.verbose) console.error(err);
    stats.errors++;
    addChainStat(stats, nft.chain, "errors");
  }
}

async function processWalletCollection(privateKey, collection, stats) {
  const label = `${collection.slug}@${collection.chain}`;
  
  // ✅ Auto-mint check BEFORE listing
  const mintResult = await checkAndMintNFTs(collection);
  if (mintResult.minted > 0) {
    log.success(`✅ Auto-mint: ${mintResult.minted} NFTs minted (tx: ${mintResult.txHash?.slice(0, 10)}...)`);
    // Re-fetch NFTs after minting
    await sleep(5000); // Wait for blockchain to sync
  }

  // getNFTsInWallet sudah verifikasi ownership realtime — NFT yang terjual tidak akan masuk
  const nfts = await getNFTsInWallet(privateKey, collection);
  
  // Track total NFTs
  stats.totalNfts = (stats.totalNfts || 0) + nfts.length;

  if (nfts.length === 0) {
    log.chain(collection.chain, `Tidak ada NFT yang dimiliki di ${collection.slug}`);
    return;
  }

  log.chain(collection.chain, `Proses ${nfts.length} NFT dari ${collection.slug}...`);

  for (const nft of nfts) {
    await processNFT(privateKey, nft, stats);
    await sleep(config.delayBetweenNFTs);
  }
}

export async function runBotCycle() {
  log.title("🤖 OPENSEA MULTI-CHAIN BOT — MULAI SIKLUS");
  if (config.dryRun) log.dryRun("MODE DRY-RUN AKTIF — Tidak ada transaksi nyata");
  log.divider();

  // Debug: Log config values
  log.info(`🔧 Config debug:`);
  log.info(`   • Min Price USD: $${config.minPriceUsd}`);
  log.info(`   • Use Min Price: ${config.useMinPrice}`);
  log.info(`   • Etherscan Enabled: ${config.etherscan.enabled}`);
  log.info(`   • Etherscan API Key: ${config.etherscan.apiKey ? '✅ Set' : '❌ Not set'}`);
  log.info(`   • Auto-Mint Enabled: ${config.mintConfig?.default?.enabled || '❌ Not set'}`);
  log.divider();

  const startTime = Date.now();
  const stats = createStats();

  try {
    const { wallets, collections } = config;
    log.info(`${wallets.length} wallet × ${collections.length} collection`);

    for (const privateKey of wallets) {
      const { ethers } = await import("ethers");
      const addr = new ethers.Wallet(privateKey).address;
      log.wallet(addr, `Memproses...`);

      for (const collection of collections) {
        await processWalletCollection(privateKey, collection, stats);
      }
    }
  } catch (err) {
    log.error(`Error fatal: ${err.message}`);
    if (config.verbose) console.error(err);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.divider();
  log.title("📊 RINGKASAN");
  console.log(`   ✅ Baru listed  : ${stats.listed}`);
  console.log(`   🔄 Re-listed   : ${stats.relisted}`);
  console.log(`   ⏭️  Skip        : ${stats.skipped}`);
  console.log(`   🚫 Cancelled   : ${stats.cancelled}`);
  console.log(`   ⛽ Gas blocked : ${stats.gasBlocked}`);
  console.log(`   ❌ Error       : ${stats.errors}`);
  console.log(`   ⏱  Durasi      : ${elapsed}s`);
  log.divider();

  // Send Telegram summary with stats
  await sendCycleSummary(stats, elapsed);
  
  return stats;
}
