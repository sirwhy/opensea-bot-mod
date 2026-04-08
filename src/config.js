import "dotenv/config";

const CHAIN_MAP = {
  ethereum: { name: "mainnet", chainId: 1, symbol: "ETH" },
  polygon: { name: "matic", chainId: 137, symbol: "MATIC" },
  base: { name: "base", chainId: 8453, symbol: "ETH" },
  arbitrum: { name: "arbitrum", chainId: 42161, symbol: "ETH" },
  optimism: { name: "optimism", chainId: 10, symbol: "ETH" },
  avalanche: { name: "avalanche", chainId: 43114, symbol: "AVAX" },
  klaytn: { name: "klaytn", chainId: 8217, symbol: "KLAY" },
  animechain: { name: "animechain", chainId: 69000, symbol: "ANIME" },
};

const chainKey = process.env.CHAIN?.toLowerCase() || "ethereum";
const chainInfo = CHAIN_MAP[chainKey] || CHAIN_MAP["ethereum"];

export const config = {
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.RPC_URL,
  openseaApiKey: process.env.OPENSEA_API_KEY,
  chain: chainInfo.name,
  chainName: chainKey,
  chainId: chainInfo.chainId,
  chainSymbol: chainInfo.symbol,
  defaultPrice: parseFloat(process.env.DEFAULT_PRICE || "0.2"),
  minPrice: parseFloat(process.env.MIN_PRICE || "0.2"),
  followFloorPrice: process.env.FOLLOW_FLOOR_PRICE === "true",
  priceOffsetPercent: parseFloat(process.env.PRICE_OFFSET_PERCENT || "0"),
  listingDurationMinutes: parseInt(process.env.LISTING_DURATION_MINUTES || "15"),
  maxListings: parseInt(process.env.MAX_LISTINGS || "0"),
  cronSchedule: process.env.CRON_SCHEDULE || "* * * * *",
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || null,
};

export function validateConfig() {
  const required = ["PRIVATE_KEY", "RPC_URL", "OPENSEA_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `❌ Config berikut belum diisi di file .env:\n   ${missing.join(", ")}\n\n   Salin .env.example ke .env lalu isi nilainya.`
    );
  }
}
