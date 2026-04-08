import "dotenv/config";
import { ethers } from "ethers";

// ═══════════════════════════════════════════════════════════════════
//  CHAIN REGISTRY — Semua chain yang didukung OpenSea Seaport
// ═══════════════════════════════════════════════════════════════════
export const CHAIN_REGISTRY = {
  ethereum: {
    name: "ethereum",
    chainId: 1,
    symbol: "ETH",
    rpcEnv: "RPC_URL_ETHEREUM",
    defaultRpc: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
  },
  polygon: {
    name: "matic",
    chainId: 137,
    symbol: "POL",
    rpcEnv: "RPC_URL_POLYGON",
    defaultRpc: "https://polygon.llamarpc.com",
    blockExplorer: "https://polygonscan.com",
  },
  base: {
    name: "base",
    chainId: 8453,
    symbol: "ETH",
    rpcEnv: "RPC_URL_BASE",
    defaultRpc: "https://base.llamarpc.com",
    blockExplorer: "https://basescan.org",
  },
  arbitrum: {
    name: "arbitrum",
    chainId: 42161,
    symbol: "ETH",
    rpcEnv: "RPC_URL_ARBITRUM",
    defaultRpc: "https://arbitrum.llamarpc.com",
    blockExplorer: "https://arbiscan.io",
  },
  optimism: {
    name: "optimism",
    chainId: 10,
    symbol: "ETH",
    rpcEnv: "RPC_URL_OPTIMISM",
    defaultRpc: "https://optimism.llamarpc.com",
    blockExplorer: "https://optimistic.etherscan.io",
  },
  avalanche: {
    name: "avalanche",
    chainId: 43114,
    symbol: "AVAX",
    rpcEnv: "RPC_URL_AVALANCHE",
    defaultRpc: "https://api.avax.network/ext/bc/C/rpc",
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
    defaultRpc: null,
    blockExplorer: "https://explorer.animechain.ai",
  },
  blast: {
    name: "blast",
    chainId: 81457,
    symbol: "ETH",
    rpcEnv: "RPC_URL_BLAST",
    defaultRpc: "https://rpc.blast.io",
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
//  PARSE MULTI-VALUE env helper
// ═══════════════════════════════════════════════════════════════════
function parseList(envKey, separator = ",") {
  const val = process.env[envKey] || "";
  return val
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCollections() {
  // Format: "ethereum:collection-slug:0xContract,base:another-slug:0xContract2"
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
      throw new Error(`Chain tidak dikenal: "${chain}". Pilihan: ${Object.keys(CHAIN_REGISTRY).join(", ")}`);
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
  // PRIVATE_KEYS=0xkey1,0xkey2,0xkey3
  const keys = parseList("PRIVATE_KEYS");
  if (keys.length > 0) return keys;

  // Fallback ke PRIVATE_KEY tunggal
  const single = process.env.PRIVATE_KEY;
  if (single) return [single];

  // Support MNEMONIC - derive wallet from 12/24 word phrase
  const mnemonic = process.env.MNEMONIC?.trim();
  if (mnemonic) {
    try {
      // ethers v6
      const wallet = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(mnemonic),
        "m/44'/60'/0'/0/0"
      );
      return [wallet.privateKey];
    } catch (err) {
      console.error(`Mnemonic tidak valid: ${err.message}`);
    }
  }

  return [];
}

// ═══════════════════════════════════════════════════════════════════
//  PRICE STRATEGY
// ═══════════════════════════════════════════════════════════════════
//  PRICE_STRATEGY:
//    "floor"     → ikuti floor price collection
//    "last_sale" → ikuti harga last sale tertinggi
//    "fixed"     → pakai DEFAULT_PRICE saja
//    "floor_or_last" → ambil mana yang lebih tinggi antara floor dan last sale

const PRICE_STRATEGIES = ["floor", "last_sale", "fixed", "floor_or_last"];

export const config = {
  // --- Wallet ---
  wallets: parseWallets(),

  // --- OpenSea ---
  openseaApiKey: process.env.OPENSEA_API_KEY,

  // --- Collections (multi-chain, multi-collection) ---
  collections: parseCollections(),

  // --- Harga ---
  defaultPrice: parseFloat(process.env.DEFAULT_PRICE || "0.05"),
  minPrice: parseFloat(process.env.MIN_PRICE || "0.001"),
  maxPrice: parseFloat(process.env.MAX_PRICE || "0"),         // 0 = tidak ada batas atas
  priceStrategy: (process.env.PRICE_STRATEGY || "floor").toLowerCase(),
  priceOffsetPercent: parseFloat(process.env.PRICE_OFFSET_PERCENT || "0"),

  // --- Listing ---
  listingDurationDays: parseFloat(process.env.LISTING_DURATION_DAYS || "7"),
  maxListingsPerWallet: parseInt(process.env.MAX_LISTINGS || "0"),  // 0 = semua

  // --- Jadwal ---
  cronSchedule: process.env.CRON_SCHEDULE || "0 * * * *",

  // --- Retry ---
  maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "5000"),

  // --- Gas limit ---
  maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || "0"),  // 0 = tidak ada batas

  // --- Mode ---
  dryRun: process.env.DRY_RUN === "true",
  verbose: process.env.VERBOSE === "true",

  // --- Delay antar operasi (ms) ---
  delayBetweenNFTs: parseInt(process.env.DELAY_BETWEEN_NFTS || "1500"),
  delayAfterCancel: parseInt(process.env.DELAY_AFTER_CANCEL || "3000"),

  // Manual token IDs to bypass blockchain scan
  tokenIds: process.env.TOKEN_IDS 
    ? process.env.TOKEN_IDS.split(",").map(t => t.trim()).filter(t => t)
    : [],
};

export function validateConfig() {
  const errors = [];

  // Check for any wallet source: PRIVATE_KEY, PRIVATE_KEYS, or MNEMONIC
  const hasPrivateKey = process.env.PRIVATE_KEY;
  const hasPrivateKeys = process.env.PRIVATE_KEYS;
  const hasMnemonic = process.env.MNEMONIC?.trim();
  
  if (!hasPrivateKey && !hasPrivateKeys && !hasMnemonic)
    errors.push("PRIVATE_KEY atau PRIVATE_KEYS atau MNEMONIC harus diisi");

  if (!config.openseaApiKey)
    errors.push("OPENSEA_API_KEY harus diisi");

  if (config.collections.length === 0)
    errors.push(
      "COLLECTIONS harus diisi.\n   Format: ethereum:collection-slug:0xContractAddress,base:slug:0xContract"
    );

  if (!PRICE_STRATEGIES.includes(config.priceStrategy))
    errors.push(
      `PRICE_STRATEGY tidak valid: "${config.priceStrategy}". Pilihan: ${PRICE_STRATEGIES.join(", ")}`
    );

  if (errors.length > 0) {
    throw new Error(
      `❌ Konfigurasi tidak lengkap:\n\n${errors.map((e) => `   • ${e}`).join("\n")}\n\n   Salin .env.example ke .env dan isi nilainya.`
    );
  }

  // Validasi RPC untuk setiap chain yang dipakai
  const chainsNeeded = [...new Set(config.collections.map((c) => c.chain))];
  for (const chain of chainsNeeded) {
    const info = CHAIN_REGISTRY[chain];
    const rpc = process.env[info.rpcEnv] || info.defaultRpc;
    if (!rpc) {
      errors.push(`RPC_URL untuk chain ${chain} (env: ${info.rpcEnv}) belum diset dan tidak ada default.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`❌ RPC tidak lengkap:\n\n${errors.map((e) => `   • ${e}`).join("\n")}`);
  }
}

export function getRpcUrl(chain) {
  const info = CHAIN_REGISTRY[chain];
  if (!info) throw new Error(`Chain tidak dikenal: ${chain}`);
  return process.env[info.rpcEnv] || info.defaultRpc;
}
