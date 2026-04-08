import "dotenv/config";
import { ethers } from "ethers";

// ═══════════════════════════════════════════════════════════════════
//  CHAIN REGISTRY — public RPC defaults untuk semua chain
// ═══════════════════════════════════════════════════════════════════
export const CHAIN_REGISTRY = {
  ethereum: {
    name: "ethereum",
    chainId: 1,
    symbol: "ETH",
    rpcEnv: "RPC_URL_ETHEREUM",
    // Multiple public RPCs sebagai fallback
    defaultRpc: "https://ethereum.publicnode.com",
    blockExplorer: "https://etherscan.io",
  },
  polygon: {
    name: "matic",
    chainId: 137,
    symbol: "POL",
    rpcEnv: "RPC_URL_POLYGON",
    defaultRpc: "https://polygon.publicnode.com",
    blockExplorer: "https://polygonscan.com",
  },
  base: {
    name: "base",
    chainId: 8453,
    symbol: "ETH",
    rpcEnv: "RPC_URL_BASE",
    defaultRpc: "https://base.publicnode.com",
    blockExplorer: "https://basescan.org",
  },
  arbitrum: {
    name: "arbitrum",
    chainId: 42161,
    symbol: "ETH",
    rpcEnv: "RPC_URL_ARBITRUM",
    // ✅ Public RPC Arbitrum yang reliable
    defaultRpc: "https://arbitrum-one.publicnode.com",
    blockExplorer: "https://arbiscan.io",
  },
  optimism: {
    name: "optimism",
    chainId: 10,
    symbol: "ETH",
    rpcEnv: "RPC_URL_OPTIMISM",
    defaultRpc: "https://optimism.publicnode.com",
    blockExplorer: "https://optimistic.etherscan.io",
  },
  avalanche: {
    name: "avalanche",
    chainId: 43114,
    symbol: "AVAX",
    rpcEnv: "RPC_URL_AVALANCHE",
    defaultRpc: "https://avalanche-c-chain.publicnode.com",
    blockExplorer: "https://snowtrace.io",
  },
  klaytn: {
    name: "klaytn",
    chainId: 8217,
    symbol: "KLAY",
    rpcEnv: "RPC_URL_KLAYTN",
    defaultRpc: "https://public-en-cypress.klaytn.net",
    blockExplorer: "https://scope.klaytn.com",
  },
  animechain: {
    name: "animechain",
    chainId: 69000,
    symbol: "ANIME",
    rpcEnv: "RPC_URL_ANIMECHAIN",
    defaultRpc: "https://rpc.animechain.ai",
    blockExplorer: "https://explorer.animechain.ai",
  },
  blast: {
    name: "blast",
    chainId: 81457,
    symbol: "ETH",
    rpcEnv: "RPC_URL_BLAST",
    defaultRpc: "https://blast.publicnode.com",
    blockExplorer: "https://blastscan.io",
  },
  zora: {
    name: "zora",
    chainId: 7777777,
    symbol: "ETH",
    rpcEnv: "RPC_URL_ZORA",
    defaultRpc: "https://rpc.zora.energy",
    blockExplorer: "https://explorer.zora.energy",
  },
};

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
function parseList(envKey, separator = ",") {
  const val = process.env[envKey] || "";
  return val.split(separator).map((s) => s.trim()).filter(Boolean);
}

function parseCollections() {
  const raw = parseList("COLLECTIONS");
  if (raw.length === 0) return [];

  return raw.map((entry) => {
    const [chain, slug, contract] = entry.split(":");
    if (!chain || !slug || !contract) {
      throw new Error(
        `Format COLLECTIONS salah: "${entry}"\n   Gunakan format: chain:collection-slug:0xContractAddress`
      );
    }
    const chainInfo = CHAIN_REGISTRY[chain.toLowerCase()];
    if (!chainInfo) {
      throw new Error(
        `Chain tidak dikenal: "${chain}". Pilihan: ${Object.keys(CHAIN_REGISTRY).join(", ")}`
      );
    }
    return {
      chain: chain.toLowerCase(),
      chainInfo,
      slug,
      contract: contract.toLowerCase(),
    };
  });
}

function parseWallets() {
  const keys = parseList("PRIVATE_KEYS");
  if (keys.length > 0) return keys;

  const single = process.env.PRIVATE_KEY;
  if (single) return [single.trim()];

  const mnemonic = process.env.MNEMONIC?.trim();
  if (mnemonic) {
    const path = process.env.MNEMONIC_PATH || "m/44'/60'/0'/0/0";
    try {
      const hdNode = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(mnemonic),
        path
      );
      console.log(`[MNEMONIC] Derived: ${hdNode.address} (${path})`);
      return [hdNode.privateKey];
    } catch (err) {
      console.error(`Mnemonic tidak valid: ${err.message}`);
    }
  }

  return [];
}

// ═══════════════════════════════════════════════════════════════════
//  TELEGRAM
// ═══════════════════════════════════════════════════════════════════
export const telegram = {
  enabled: process.env.TELEGRAM_ENABLED === "true",
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  chatId: process.env.TELEGRAM_CHAT_ID || "",
};

// ═══════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════
export const config = {
  // Wallet
  wallets: parseWallets(),

  // OpenSea
  openseaApiKey: process.env.OPENSEA_API_KEY,

  // Collections
  collections: parseCollections(),

  // Harga — floor only, tidak ada DEFAULT_PRICE
  // minPriceFallback dipakai HANYA jika floor price tidak bisa diambil sama sekali
  minPriceFallback: parseFloat(process.env.MIN_PRICE_FALLBACK || "0.000001"),
  priceOffsetPercent: parseFloat(process.env.PRICE_OFFSET_PERCENT || "0"),
  maxPrice: parseFloat(process.env.MAX_PRICE || "0"), // 0 = tidak ada batas

  // Strategi harga — selalu "floor"
  priceStrategy: "floor",

  // ✅ Durasi listing: 10 menit (bukan hari)
  listingDurationMinutes: parseInt(process.env.LISTING_DURATION_MINUTES || "10"),

  // Max listing per wallet
  maxListingsPerWallet: parseInt(process.env.MAX_LISTINGS || "0"),

  // Jadwal
  cronSchedule: process.env.CRON_SCHEDULE || "*/10 * * * *", // default setiap 10 menit

  // Retry
  maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "3000"),

  // Gas limit (0 = tidak ada batas)
  maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || "0"),

  // Mode
  dryRun: process.env.DRY_RUN === "true",
  verbose: process.env.VERBOSE === "true",

  // Delay antar operasi (ms)
  delayBetweenNFTs: parseInt(process.env.DELAY_BETWEEN_NFTS || "2000"),
  delayAfterCancel: parseInt(process.env.DELAY_AFTER_CANCEL || "3000"),

  // Manual token IDs (bypass scan)
  tokenIds: process.env.TOKEN_IDS
    ? process.env.TOKEN_IDS.split(",").map((t) => t.trim()).filter(Boolean)
    : [],
};

// ═══════════════════════════════════════════════════════════════════
//  VALIDATE
// ═══════════════════════════════════════════════════════════════════
export function validateConfig() {
  const errors = [];

  if (config.wallets.length === 0)
    errors.push("PRIVATE_KEY / PRIVATE_KEYS / MNEMONIC harus diisi");

  if (!config.openseaApiKey)
    errors.push("OPENSEA_API_KEY harus diisi");

  if (config.collections.length === 0)
    errors.push("COLLECTIONS harus diisi.\n   Format: chain:collection-slug:0xContractAddress");

  if (errors.length > 0) {
    throw new Error(
      `❌ Konfigurasi tidak lengkap:\n\n${errors.map((e) => `   • ${e}`).join("\n")}\n\n   Salin .env.example ke .env dan isi nilainya.`
    );
  }
}

export function getRpcUrl(chain) {
  const info = CHAIN_REGISTRY[chain];
  if (!info) throw new Error(`Chain tidak dikenal: ${chain}`);
  // Prioritas: env var → default public RPC
  return process.env[info.rpcEnv] || info.defaultRpc;
}
