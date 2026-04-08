import "dotenv/config";

// Public RPC nodes (no API key needed)
const PUBLIC_RPCS = {
  ethereum: [
    "https://eth.llamarpc.com",
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.ankr.com/eth",
  ],
  polygon: [
    "https://polygon-rpc.com",
    "https://polygon.llamarpc.com",
    "https://rpc.ankr.com/polygon",
  ],
  base: [
    "https://base.llamarpc.com",
    "https://base-rpc.publicnode.com",
    "https://rpc.ankr.com/base",
  ],
  arbitrum: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.llamarpc.com",
    "https://rpc.ankr.com/arbitrum",
  ],
  optimism: [
    "https://optimism.llamarpc.com",
    "https://optimism-rpc.publicnode.com",
    "https://rpc.ankr.com/optimism",
  ],
  avalanche: [
    "https://api.avax.network/ext/bc/C/rpc",
    "https://avalanche.llamarpc.com",
    "https://rpc.ankr.com/avalanche",
  ],
  klaytn: [
    "https://kaia.llamarpc.com",
    "https://rpc.ankr.com/klaytn",
  ],
  animechain: [
    "https://rpc.animechain.io",
  ],
  bsc: [
    "https://binance.llamarpc.com",
    "https://bsc.llamarpc.com",
    "https://rpc.ankr.com/bsc",
  ],
  celo: [
    "https://rpc.ankr.com/celo",
    "https://celo.llamarpc.com",
  ],
  fantom: [
    "https://rpc.ankr.com/fantom",
    "https://fantom.llamarpc.com",
  ],
};

const CHAIN_MAP = {
  ethereum: { name: "mainnet", chainId: 1, symbol: "ETH" },
  polygon: { name: "matic", chainId: 137, symbol: "MATIC" },
  base: { name: "base", chainId: 8453, symbol: "ETH" },
  arbitrum: { name: "arbitrum", chainId: 42161, symbol: "ETH" },
  optimism: { name: "optimism", chainId: 10, symbol: "ETH" },
  avalanche: { name: "avalanche", chainId: 43114, symbol: "AVAX" },
  klaytn: { name: "klaytn", chainId: 8217, symbol: "KLAY" },
  bsc: { name: "bsc", chainId: 56, symbol: "BNB" },
  celo: { name: "celo", chainId: 42220, symbol: "CELO" },
  fantom: { name: "fantom", chainId: 250, symbol: "FTM" },
  animechain: { name: "animechain", chainId: 69000, symbol: "ANIME" },
};

const chainKey = process.env.CHAIN?.toLowerCase() || "ethereum";
const chainInfo = CHAIN_MAP[chainKey] || CHAIN_MAP["ethereum"];

// Get RPC - use user provided or pick random public RPC
function getRpcUrl() {
  // If user provided RPC_URL, use it
  if (process.env.RPC_URL && process.env.RPC_URL.trim() !== "") {
    return process.env.RPC_URL;
  }
  
  // Get RPC list for current chain
  const rpcs = PUBLIC_RPCS[chainKey] || PUBLIC_RPCS["ethereum"];
  if (!rpcs || rpcs.length === 0) {
    throw new Error(`No public RPCs available for chain: ${chainKey}`);
  }
  
  // Use random public RPC from the list
  const randomRpc = rpcs[Math.floor(Math.random() * rpcs.length)];
  console.log(`🔗 Using public RPC: ${randomRpc}`);
  return randomRpc;
}

export const config = {
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: getRpcUrl(),
  openseaApiKey: process.env.OPENSEA_API_KEY,
  chain: chainInfo.name,
  chainName: chainKey,
  chainId: chainInfo.chainId,
  chainSymbol: chainInfo.symbol,
  // Price mode: "eth" atau "usd"
  priceMode: (process.env.PRICE_MODE || "eth").toLowerCase(),
  // Default price dalam ETH atau USD
  defaultPrice: parseFloat(process.env.DEFAULT_PRICE || "0.01"),
  minPrice: parseFloat(process.env.MIN_PRICE || "0.001"),
  // Auto-detect floor price - default TRUE
  followFloorPrice: process.env.FOLLOW_FLOOR_PRICE !== "false",
  // Floor price dalam USD atau ETH (sesuai priceMode)
  floorPriceUsd: parseFloat(process.env.FLOOR_PRICE_USD || "0"),
  // Offset harga dari floor price (dalam %)
  priceOffsetPercent: parseFloat(process.env.PRICE_OFFSET_PERCENT || "-10"),
  // Listing 10 menit = 600 detik (OpenSea pakai detik)
  listingDurationSeconds: parseInt(process.env.LISTING_DURATION_SECONDS || "600"),
  maxListings: parseInt(process.env.MAX_LISTINGS || "0"),
  cronSchedule: process.env.CRON_SCHEDULE || "*/10 * * * *", // Default 10 menit
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || null,
};

export function validateConfig() {
  const required = ["PRIVATE_KEY", "OPENSEA_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `❌ Config berikut belum diisi di file .env:\n   ${missing.join(", ")}\n\n   Salin .env.example ke .env lalu isi nilainya.\n\n   RPC_URL bersifat opsional - bot akan menggunakan public RPC jika tidak diisi.`
    );
  }
}

export function getSupportedChains() {
  return Object.keys(CHAIN_MAP).map((chain) => ({
    name: chain,
    symbol: CHAIN_MAP[chain].symbol,
    chainId: CHAIN_MAP[chain].chainId,
  }));
}

// Telegram notifications
export const telegram = {
  enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
};