import "dotenv/config";

// Public RPC nodes - using reliable DNS-resolvable endpoints
const PUBLIC_RPCS = {
  ethereum: [
    "https://rpc.ankr.com/eth",
    "https://1rpc.io/eth",
    "https://eth.llamarpc.com",
  ],
  polygon: [
    "https://rpc.ankr.com/polygon",
    "https://1rpc.io/matic",
    "https://polygon.llamarpc.com",
  ],
  base: [
    "https://rpc.ankr.com/base",
    "https://1rpc.io/base",
    "https://base.llamarpc.com",
  ],
  arbitrum: [
    "https://rpc.ankr.com/arbitrum",
    "https://1rpc.io/arb",
    "https://arb1.arbitrum.io/rpc",
  ],
  optimism: [
    "https://rpc.ankr.com/optimism",
    "https://1rpc.io/op",
    "https://optimism.llamarpc.com",
  ],
  avalanche: [
    "https://rpc.ankr.com/avalanche",
    "https://1rpc.io/avax",
    "https://api.avax.network/ext/bc/C/rpc",
  ],
  klaytn: [
    "https://rpc.ankr.com/klaytn",
    "https://1rpc.io/klay",
  ],
  bsc: [
    "https://rpc.ankr.com/bsc",
    "https://1rpc.io/bsc",
  ],
  celo: [
    "https://rpc.ankr.com/celo",
    "https://1rpc.io/celo",
  ],
  fantom: [
    "https://rpc.ankr.com/fantom",
    "https://1rpc.io/ftm",
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

// Get RPC - use user provided or fallback to Ankr (most reliable)
function getRpcUrl() {
  if (process.env.RPC_URL && process.env.RPC_URL.trim() !== "") {
    return process.env.RPC_URL;
  }
  
  // Use Ankr as primary (most reliable for Railway)
  const ankrRpc = `https://rpc.ankr.com/${chainKey === 'ethereum' ? 'eth' : chainKey}`;
  console.log(`🔗 Using Ankr RPC: ${ankrRpc}`);
  return ankrRpc;
}

export const config = {
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: getRpcUrl(),
  openseaApiKey: process.env.OPENSEA_API_KEY,
  chain: chainInfo.name,
  chainName: chainKey,
  chainId: chainInfo.chainId,
  chainSymbol: chainInfo.symbol,
  priceMode: (process.env.PRICE_MODE || "eth").toLowerCase(),
  defaultPrice: parseFloat(process.env.DEFAULT_PRICE || "0.01"),
  minPrice: parseFloat(process.env.MIN_PRICE || "0.001"),
  followFloorPrice: process.env.FOLLOW_FLOOR_PRICE !== "false",
  floorPriceUsd: parseFloat(process.env.FLOOR_PRICE_USD || "0"),
  priceOffsetPercent: parseFloat(process.env.PRICE_OFFSET_PERCENT || "-10"),
  listingDurationSeconds: parseInt(process.env.LISTING_DURATION_SECONDS || "600"),
  maxListings: parseInt(process.env.MAX_LISTINGS || "0"),
  cronSchedule: process.env.CRON_SCHEDULE || "*/10 * * * *",
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

export const telegram = {
  enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
};
