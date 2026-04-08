import cron from "node-cron";
import chalk from "chalk";
import { validateConfig, config } from "./config.js";
import { initWallets, getWalletBalance } from "./wallet.js";
import { runBotCycle } from "./bot.js";
import { log } from "./logger.js";

function printBanner() {
  console.log(
    chalk.bold.cyan(`
╔══════════════════════════════════════════════════╗
║       🤖  OPENSEA AUTO LISTING BOT               ║
║          Multi-Chain | Multi-Wallet              ║
╚══════════════════════════════════════════════════╝
`)
  );
}

function printConfig() {
  log.divider();
  log.info(`Wallets     : ${chalk.bold(config.wallets.length)}`);
  log.info(`Collections : ${chalk.bold(config.collections.length)}`);

  for (const col of config.collections) {
    log.info(
      `  • ${chalk.magenta(col.chain.padEnd(12))} ${chalk.bold(col.slug)} — ${col.contract.slice(0, 10)}...`
    );
  }

  log.divider();
  log.info(`Strategi harga : ${chalk.bold(config.priceStrategy)}`);
  log.info(`Offset harga   : ${chalk.bold(config.priceOffsetPercent + "%")}`);
  log.info(`Harga min      : ${chalk.bold(config.minPrice)}`);
  if (config.maxPrice > 0)
    log.info(`Harga max      : ${chalk.bold(config.maxPrice)}`);
  log.info(`Durasi listing : ${chalk.bold(config.listingDurationDays + " hari")}`);
  log.info(`Gas max        : ${config.maxGasPriceGwei > 0 ? chalk.bold(config.maxGasPriceGwei + " Gwei") : chalk.gray("tidak dibatasi")}`);
  log.info(`Jadwal cron    : ${chalk.bold(config.cronSchedule)}`);
  log.info(`Dry-run mode   : ${config.dryRun ? chalk.yellow("AKTIF") : chalk.gray("tidak aktif")}`);
  log.divider();
}

async function printWalletBalances() {
  log.info("Mengecek saldo wallet...");
  const chains = [...new Set(config.collections.map((c) => c.chain))];

  for (const pk of config.wallets) {
    for (const chain of chains) {
      try {
        const balance = await getWalletBalance(pk, chain);
        const { ethers } = await import("ethers");
        const addr = new ethers.Wallet(pk).address;
        log.wallet(
          addr,
          `${chalk.yellow(parseFloat(balance).toFixed(4))} ${chain.toUpperCase()}`
        );
      } catch (err) {
        log.warn(`Gagal cek saldo di ${chain}: ${err.message}`);
      }
    }
  }
}

async function main() {
  printBanner();

  // Validasi config
  try {
    validateConfig();
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }

  // Init wallets
  try {
    initWallets();
  } catch (err) {
    log.error(`Gagal inisialisasi wallet: ${err.message}`);
    process.exit(1);
  }

  // Tampilkan info
  printConfig();
  await printWalletBalances();

  // Jalankan siklus pertama
  log.info("Menjalankan siklus pertama...\n");
  await runBotCycle();

  // Jadwal cron
  log.info(`\n⏰ Bot dijadwalkan: ${chalk.bold(config.cronSchedule)}`);
  log.info("Bot berjalan di background. Tekan Ctrl+C untuk berhenti.\n");

  cron.schedule(config.cronSchedule, async () => {
    log.info("⏰ Jadwal terpicu, mulai siklus...");
    await runBotCycle();
  });
}

process.on("SIGINT", () => {
  log.warn("\n🛑 Bot dihentikan.");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log.error(`Uncaught error: ${err.message}`);
  if (config.verbose) console.error(err);
});

process.on("unhandledRejection", (reason) => {
  log.error(`Unhandled rejection: ${reason}`);
});

main();
