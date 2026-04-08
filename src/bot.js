import { log } from "./logger.js";
import {
  getNFTsInWallet,
  getListingForNFT,
  createListing,
  cancelListing,
  calculatePrice,
} from "./opensea.js";
import { config } from "./config.js";

export async function runBotCycle() {
  log.title("🤖 OPENSEA AUTO BOT — MULAI SIKLUS");
  log.divider();

  try {
    log.info("Mengambil NFT dari wallet...");
    const nfts = await getNFTsInWallet();
    log.success(`Ditemukan ${nfts.length} NFT di wallet`);

    if (nfts.length === 0) {
      log.warn("Tidak ada NFT di wallet.");
      return;
    }

    let listed = 0, relisted = 0, skipped = 0, errors = 0;
    const now = Math.round(Date.now() / 1000);

    for (const nft of nfts) {
      const label = `${nft.name || nft.identifier} (#${nft.identifier})`;
      try {
        const targetPrice = await calculatePrice(nft);
        const existing = await getListingForNFT(nft.contract, nft.identifier);

        if (existing) {
          const currentPrice = parseFloat(existing.current_price) / 1e18;
          const expiresAt = parseInt(existing.expiration_time);
          const isExpired = expiresAt > 0 && expiresAt <= now;
          const priceDiff = Math.abs(currentPrice - targetPrice) / targetPrice;

          if (priceDiff < 0.001 && !isExpired) {
            const minsLeft = Math.round((expiresAt - now) / 60);
            log.info(`⏭️  Skip: ${label} | ${currentPrice.toFixed(4)} ANIME | ${minsLeft} mnt lagi`);
            skipped++;
            await sleep(500);
            continue;
          }

          if (isExpired) {
            log.warn(`⏰ Expired, relist: ${label}`);
          } else {
            log.warn(`📉 Floor berubah: ${label} | ${currentPrice.toFixed(4)} → ${targetPrice.toFixed(4)} ANIME`);
          }

          // Cancel dengan kirim orderParameters dari existing listing
          const orderParams = existing.protocol_data?.parameters;
          await cancelListing(existing.order_hash, orderParams);
          await sleep(3000);
          relisted++;
        } else {
          log.info(`📋 Listing baru: ${label} @ ${targetPrice.toFixed(4)} ANIME`);
          listed++;
        }

        const { price } = await createListing(nft);
        log.success(`✅ Listed: ${label} @ ${price.toFixed(4)} ANIME`);

      } catch (err) {
        log.error(`Gagal: ${label} — ${err.message}`);
        errors++;
      }

      await sleep(1500);
    }

    log.divider();
    log.title("📊 RINGKASAN");
    console.log(`  ✅ Baru dilist : ${listed}`);
    console.log(`  🔄 Re-listed  : ${relisted}`);
    console.log(`  ⏭️  Skip       : ${skipped}`);
    console.log(`  ❌ Error      : ${errors}`);
    log.divider();

  } catch (err) {
    log.error(`Error fatal: ${err.message}`);
    console.error(err);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
