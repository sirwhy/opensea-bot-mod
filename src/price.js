import https from "https";
import { config } from "./config.js";

// CoinGecko API for price conversion (free, no API key needed)
const PRICE_CACHE_MS = 60000; // 1 minute cache
let cachedPrice = null;
let lastPriceFetch = 0;

// Map chain to CoinGecko coin ID
const CHAIN_TO_COINGECKO = {
  ethereum: "ethereum",
  polygon: "matic-network",
  base: "ethereum",  // Base uses ETH
  arbitrum: "ethereum",  // Arbitrum uses ETH
  optimism: "ethereum",  // Optimism uses ETH
  avalanche: "avalanche-2",
  bsc: "binancecoin",
  celo: "celo",
  fantom: "fantom",
  klaytn: "klaytn",
  animechain: "anime",
};

/**
 * Get current ETH price in USD
 */
export async function getEthPriceUsd() {
  const now = Date.now();
  
  // Return cached price if still valid
  if (cachedPrice && now - lastPriceFetch < PRICE_CACHE_MS) {
    return cachedPrice;
  }

  return new Promise((resolve) => {
    const coinId = CHAIN_TO_COINGECKO[process.env.CHAIN?.toLowerCase()] || "ethereum";
    
    const req = https.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      (res) => {
        let data = "";
        
        res.on("data", (chunk) => (data += chunk));
        
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const price = json[coinId]?.usd;
            
            if (price) {
              cachedPrice = price;
              lastPriceFetch = now;
              console.log(`💵 ETH price: $${price.toFixed(2)}`);
              resolve(price);
            } else {
              console.warn("⚠️ Gagal dapat harga dari CoinGecko, pakai cache");
              resolve(cachedPrice || 2000); // Fallback
            }
          } catch (e) {
            console.error("❌ CoinGecko parse error:", e.message);
            resolve(cachedPrice || 2000);
          }
        });
      }
    );

    req.on("error", (err) => {
      console.error("❌ CoinGecko request error:", err.message);
      resolve(cachedPrice || 2000); // Fallback to $2000
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(cachedPrice || 2000);
    });
  });
}

/**
 * Convert USD to ETH
 */
export async function usdToEth(usdAmount) {
  const ethPrice = await getEthPriceUsd();
  return usdAmount / ethPrice;
}

/**
 * Convert ETH to USD
 */
export async function ethToUsd(ethAmount) {
  const ethPrice = await getEthPriceUsd();
  return ethAmount * ethPrice;
}

/**
 * Calculate price with min floor protection (USD-based)
 * 
 * Strategy: 
 * - If floor < minPrice, use minPrice (in USD, converted to ETH)
 * - If floor >= minPrice, use floor (can go higher if floor rises)
 * 
 * Example:
 * - Floor $0.005 → Listing $0.02 (min protection)
 * - Floor $0.05 → Listing $0.05 (follow floor)
 * - Floor $0.10 → Listing $0.10 (follow floor, can go higher)
 */
export async function calculatePriceWithMinFloor(collection, currentFloor) {
  if (!config.useMinPrice) {
    // If min floor protection disabled, use regular logic
    const minPriceFallback = config.minPriceFallback;
    const offset = (config.priceOffsetPercent || 0) / 100;
    let price = currentFloor * (1 + offset);

    if (price < minPriceFallback) {
      return { price, source: "floor_fallback" };
    }

    return { price, source: "floor" };
  }

  // Convert min price from USD to ETH
  const minPriceEth = await usdToEth(config.minPriceUsd);
  
  // Use the higher of floor or min floor
  let price;
  let source;

  if (currentFloor < minPriceEth) {
    price = minPriceEth;
    source = "min_floor";
  } else {
    price = currentFloor;
    source = "floor";
  }

  return { price, source };
}