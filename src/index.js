import cron from "node-cron";
import chalk from "chalk";
import { validateConfig, config, telegram } from "./config.js";
import { initWallet, getWalletAddress, getWalletBalance } from "./wallet.js";
import { initOpenSea, getNFTsInWallet } from "./opensea.js";
import { runBotCycle } from "./bot.js";
import { log } from "./logger.js";
import { notifyBotStarted, notifyError } from "./telegram.js";

function printBanner() {
  console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════╗
║     🤖  OPENSEA AUTO LISTING BOT      ║
╚═══════════════════════════════════════╝
`));
}

async function main() {
  printBanner();

  try {
    validateConfig();
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }

  log.info("Menginisialisasi wallet...");
  initWallet();

  const balance = await getWalletBalance();
  log.info(`Saldo wallet: ${chalk.yellow(balance + " ETH")}`);

  log.info("Menghubungkan ke OpenSea...");
  initOpenSea();

  log.divider();
  log.info(`Chain       : ${chalk.bold(config.chainName)}`);
  log.info(`Jadwal      : ${chalk.bold(config.cronSchedule)}`);
  log.info(`Follow floor: ${chalk.bold(config.followFloorPrice ? "Ya" : "Tidak")}`);
  log.info(`Offset harga: ${chalk.bold(config.priceOffsetPercent + "%")}`);
  log.info(`Durasi list : ${chalk.bold(config.listingDurationSeconds + " detik")} (${config.listingDurationSeconds/60} menit)`);
  log.divider();

  log.info("Menjalankan siklus pertama...");
  await runBotCycle();

  // Send Telegram notification if enabled
  if (telegram.enabled) {
    const nfts = await getNFTsInWallet().catch(() => []);
    const walletAddr = getWalletAddress();
    await notifyBotStarted(walletAddr, config.chainName, nfts.length);
    log.success("📱 Notifikasi Telegram dikirim");
  }

  log.info(`\n⏰ Bot dijadwalkan: ${chalk.bold(config.cronSchedule)}`);
  log.info("Bot berjalan di background. Tekan Ctrl+C untuk berhenti.\n");

  cron.schedule(config.cronSchedule, async () => {
    log.info("⏰ Jadwal terpicu, mulai siklus...");
    await runBotCycle();
  });
}

process.on("SIGINT", () => {
  log.warn("\n🛑 Bot dihentikan oleh user.");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log.error(`Uncaught error: ${err.message}`);
  console.error(err);
  notifyError(err.message);
});

main();
