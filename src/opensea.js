import { ethers } from "ethers";
import { config } from "./config.js";
import { getWallet } from "./wallet.js";
import { log } from "./logger.js";

const SEAPORT_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";
const OPENSEA_FEE_RECIPIENT = "0x0000a26b00c1f0df003000390027140000faa719";
const CONDUIT_KEY = "0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e";
const COLLECTION_SLUG = process.env.COLLECTION_SLUG || "";

const SEAPORT_ABI = [
  "function getCounter(address offerer) view returns (uint256)",
  "function cancel(tuple(address offerer, address zone, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter)[] orders) returns (bool)"
];

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const EIP712_TYPES = {
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
};

// ─── Cache last sale price ───────────────────────────────────
let cachedLastSale = null;
let lastSaleFetchTime = 0;
const CACHE_MS = 30000;

export async function getLastSalePrice() {
  // If no collection slug, return default price
  if (!COLLECTION_SLUG) {
    return config.defaultPrice;
  }

  const now = Date.now();
  if (cachedLastSale && now - lastSaleFetchTime < CACHE_MS) {
    return cachedLastSale;
  }

  try {
    const res = await fetch(
      `https://api.opensea.io/api/v2/events/collection/${COLLECTION_SLUG}?event_type=sale&limit=5`,
      { headers: { "X-API-KEY": config.openseaApiKey, accept: "application/json" } }
    );

    if (!res.ok) {
      log.warn(`Gagal ambil last sale: ${res.statusText}`);
      return cachedLastSale || config.defaultPrice;
    }

    const data = await res.json();
    const sales = data.asset_events || [];

    if (sales.length === 0) {
      log.warn("Belum ada sale event, pakai harga default");
      cachedLastSale = config.defaultPrice;
      lastSaleFetchTime = now;
      return config.defaultPrice;
    }

    const prices = sales
      .map(s => parseFloat(s.payment?.quantity || "0") / 1e18)
      .filter(p => p > 0);

    const highestPrice = Math.max(...prices);

    if (highestPrice > 0) {
      const prev = cachedLastSale;
      cachedLastSale = highestPrice;
      lastSaleFetchTime = now;

      if (prev && Math.abs(prev - highestPrice) / prev > 0.005) {
        log.info(`💹 Last sale tertinggi berubah: ${prev.toFixed(4)} → ${highestPrice.toFixed(4)} ANIME`);
      }

      return highestPrice;
    }

    return cachedLastSale || config.minPrice;
  } catch (err) {
    log.warn(`Error ambil last sale: ${err.message}`);
    return cachedLastSale || config.minPrice;
  }
}

export function initOpenSea() {
  log.success(`OpenSea siap — Chain: ${config.chainName} (chainId: ${config.chainId}, symbol: ${config.chainSymbol})`);
}

export async function getNFTsInWallet() {
  const wallet = getWallet();
  const provider = wallet.provider;

  if (!config.nftContractAddress) {
    log.warn("NFT_CONTRACT_ADDRESS belum diset.");
    return [];
  }

  const nftContract = new ethers.Contract(config.nftContractAddress, ERC721_ABI, provider);

  try {
    const balance = await nftContract.balanceOf(wallet.address);
    const total = Number(balance);
    log.info(`Balance dari blockchain: ${total} NFT`);
    if (total === 0) return [];

    const nfts = [];
    for (let i = 0; i < total; i++) {
      const tokenId = await nftContract.tokenOfOwnerByIndex(wallet.address, i);
      nfts.push({
        identifier: tokenId.toString(),
        contract: config.nftContractAddress,
        collection: COLLECTION_SLUG,
        name: "Azuki Gate #0",
      });
    }
    if (config.maxListings > 0) return nfts.slice(0, config.maxListings);
    return nfts;
  } catch {
    log.info("Contract tidak support Enumerable, scan via Transfer events...");
    return await getNFTsViaEvents(nftContract, wallet.address);
  }
}

async function getNFTsViaEvents(nftContract, walletAddress) {
  // Skip event scanning - Alchemy free tier doesn't support it
  log.warn("⚠️ Event scan skipped - Alchemy free tier limit");
  log.warn("💡 Gunakan contract dengan tokenOfOwnerByIndex()");
  return [];
}

export async function calculatePrice(nft) {
  try {
    let priceInEth;
    const offset = config.priceOffsetPercent / 100;

    // Get floor/sale price
    const highestSale = await getLastSalePrice();

    // Apply offset
    let price = highestSale * (1 + offset);

    // Handle USD mode
    if (config.priceMode === "usd") {
      // Convert USD price to ETH
      const { usdToEth } = await import("./price.js");
      priceInEth = await usdToEth(price);
      log.info(`💵 USD ${price.toFixed(2)} → ETH ${priceInEth.toFixed(6)} (offset ${config.priceOffsetPercent}%)`);
    } else {
      priceInEth = price;
      log.info(`💰 ETH ${priceInEth.toFixed(6)} (offset ${config.priceOffsetPercent}%)`);
    }

    // Don't list below minimum
    if (priceInEth < config.minPrice) {
      log.info(`💰 Price ${priceInEth.toFixed(6)} below minimum, using MIN_PRICE: ${config.minPrice} ${config.chainSymbol}`);
      priceInEth = config.minPrice;
    }

    return priceInEth;
  } catch (err) {
    log.error(`Price calc error: ${err.message}`);
    return config.minPrice;
  }
}

export async function createListing(nft) {
  const wallet = getWallet();
  const provider = wallet.provider;
  const price = await calculatePrice(nft);
  const priceWei = ethers.parseEther(price.toFixed(8));
  const openseaFee = priceWei * 100n / 10000n;
  const sellerAmount = priceWei - openseaFee;
  const expirationTime = Math.round(Date.now() / 1000) + config.listingDurationSeconds;

  const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, provider);
  const counter = await seaport.getCounter(wallet.address);

  const parameters = {
    offerer: wallet.address,
    offer: [
      { itemType: 2, token: nft.contract, identifierOrCriteria: nft.identifier, startAmount: "1", endAmount: "1" },
    ],
    consideration: [
      { itemType: 0, token: "0x0000000000000000000000000000000000000000", identifierOrCriteria: "0", startAmount: sellerAmount.toString(), endAmount: sellerAmount.toString(), recipient: wallet.address },
      { itemType: 0, token: "0x0000000000000000000000000000000000000000", identifierOrCriteria: "0", startAmount: openseaFee.toString(), endAmount: openseaFee.toString(), recipient: OPENSEA_FEE_RECIPIENT },
    ],
    startTime: Math.round(Date.now() / 1000).toString(),
    endTime: expirationTime.toString(),
    orderType: 0,
    zone: "0x0000000000000000000000000000000000000000",
    zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    salt: Math.floor(Math.random() * 1e15).toString(),
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: 2,
    counter: counter.toString(),
  };

  const domain = { name: "Seaport", version: "1.6", chainId: config.chainId, verifyingContract: SEAPORT_ADDRESS };
  const signature = await wallet.signTypedData(domain, EIP712_TYPES, parameters);

  const res = await fetch(
    `https://api.opensea.io/api/v2/orders/${config.chainName}/seaport/listings`,
    {
      method: "POST",
      headers: { "X-API-KEY": config.openseaApiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ parameters, protocol_address: SEAPORT_ADDRESS, signature }),
    }
  );

  if (!res.ok) throw new Error(`Gagal listing: ${await res.text()}`);
  const listing = await res.json();
  return { listing, price };
}

export async function cancelListing(orderHash, orderParameters) {
  const wallet = getWallet();

  if (orderParameters) {
    try {
      const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, wallet);
      log.info(`Cancel onchain: ${orderHash.slice(0, 10)}...`);
      const tx = await seaport.cancel([orderParameters]);
      log.info(`Tx: ${tx.hash}`);
      await tx.wait();
      log.success("Cancel onchain berhasil!");
      return;
    } catch (err) {
      log.warn(`Cancel onchain gagal: ${err.message}`);
    }
  }

  const res = await fetch(
    `https://api.opensea.io/api/v2/orders/${config.chainName}/seaport/listings/${orderHash}/cancel`,
    {
      method: "POST",
      headers: { "X-API-KEY": config.openseaApiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ offerer: wallet.address }),
    }
  );
  if (!res.ok) throw new Error(`Gagal cancel: ${await res.text()}`);
}

export async function getListingForNFT(contractAddress, tokenId) {
  const response = await fetch(
    `https://api.opensea.io/api/v2/orders/${config.chainName}/seaport/listings?asset_contract_address=${contractAddress}&token_ids=${tokenId}&order_by=created_date&order_direction=desc`,
    { headers: { "X-API-KEY": config.openseaApiKey, accept: "application/json" } }
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.orders?.[0] || null;
}
