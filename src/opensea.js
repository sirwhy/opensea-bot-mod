import { ethers } from "ethers";
import { config } from "./config.js";
import { getWallet, getProvider, getGasPrice } from "./wallet.js";
import { log } from "./logger.js";

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const SEAPORT_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";
const OPENSEA_FEE_RECIPIENT = "0x0000a26b00c1f0df003000390027140000faa719";
const CONDUIT_KEY = "0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e";

const SEAPORT_ABI = [
  "function getCounter(address offerer) view returns (uint256)",
  "function cancel(tuple(address offerer, address zone, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter)[] orders) returns (bool)",
];

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
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
    { name: "salt", type: "bytes32" },
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

// ═══════════════════════════════════════════════════════════════════
//  PRICE CACHE — per collection
// ═══════════════════════════════════════════════════════════════════
const priceCache = new Map(); // slug → { floor, lastSale, fetchedAt }
const CACHE_TTL_MS = 60_000; // 60 detik

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "X-API-KEY": config.openseaApiKey,
          accept: "application/json",
          ...options.headers,
        },
      });

      if (res.status === 429) {
        const wait = attempt * 5000;
        log.warn(`Rate limited. Tunggu ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = attempt * config.retryDelayMs;
      log.warn(`Fetch gagal (percobaan ${attempt}/${retries}): ${err.message}. Coba lagi dalam ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
}

// ─── Floor Price ──────────────────────────────────────────────────
export async function getFloorPrice(collectionSlug, chainName) {
  try {
    const res = await fetchWithRetry(
      `https://api.opensea.io/api/v2/collections/${collectionSlug}/stats`
    );

    if (!res.ok) {
      log.warn(`Gagal ambil floor price untuk ${collectionSlug}: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const floor = data.total?.floor_price || data.stats?.floor_price || null;
    return floor ? parseFloat(floor) : null;
  } catch (err) {
    log.warn(`Error ambil floor price: ${err.message}`);
    return null;
  }
}

// ─── Last Sale Price ──────────────────────────────────────────────
export async function getLastSalePrice(collectionSlug) {
  try {
    const res = await fetchWithRetry(
      `https://api.opensea.io/api/v2/events/collection/${collectionSlug}?event_type=sale&limit=10`
    );

    if (!res.ok) return null;

    const data = await res.json();
    const sales = data.asset_events || [];
    if (sales.length === 0) return null;

    const prices = sales
      .map((s) => parseFloat(s.payment?.quantity || "0") / 1e18)
      .filter((p) => p > 0);

    return prices.length > 0 ? Math.max(...prices) : null;
  } catch (err) {
    log.warn(`Error ambil last sale: ${err.message}`);
    return null;
  }
}

// ─── Combined price fetch dengan cache ───────────────────────────
export async function getPriceData(collectionSlug, chainName) {
  const now = Date.now();
  const cached = priceCache.get(collectionSlug);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const [floor, lastSale] = await Promise.all([
    getFloorPrice(collectionSlug, chainName),
    getLastSalePrice(collectionSlug),
  ]);

  const data = { floor, lastSale, fetchedAt: now };
  priceCache.set(collectionSlug, data);

  log.info(
    `📊 ${collectionSlug} — Floor: ${floor?.toFixed(4) ?? "N/A"} | Last Sale: ${lastSale?.toFixed(4) ?? "N/A"}`
  );

  return data;
}

// ─── Hitung harga akhir ───────────────────────────────────────────
export async function calculatePrice(collection) {
  const { slug, chainInfo } = collection;
  const priceData = await getPriceData(slug, chainInfo.name);
  const strategy = config.priceStrategy;
  const offset = config.priceOffsetPercent / 100;
  let basePrice = null;
  let source = "";

  if (strategy === "fixed") {
    return { price: config.defaultPrice, source: "fixed" };
  }

  if (strategy === "floor") {
    basePrice = priceData.floor;
    source = "floor";
  } else if (strategy === "last_sale") {
    basePrice = priceData.lastSale;
    source = "last_sale";
  } else if (strategy === "floor_or_last") {
    const candidates = [priceData.floor, priceData.lastSale].filter((v) => v != null);
    basePrice = candidates.length > 0 ? Math.max(...candidates) : null;
    source = "floor_or_last";
  }

  if (!basePrice || basePrice <= 0) {
    log.warn(`Tidak bisa ambil harga untuk strategi "${strategy}", pakai DEFAULT_PRICE`);
    return { price: config.defaultPrice, source: "default_fallback" };
  }

  let price = basePrice * (1 + offset);

  if (price < config.minPrice) {
    log.info(`Harga ${price.toFixed(4)} di bawah MIN_PRICE, naik ke ${config.minPrice}`);
    price = config.minPrice;
  }

  if (config.maxPrice > 0 && price > config.maxPrice) {
    log.info(`Harga ${price.toFixed(4)} melebihi MAX_PRICE, turun ke ${config.maxPrice}`);
    price = config.maxPrice;
  }

  return { price, source, basePrice };
}

// ═══════════════════════════════════════════════════════════════════
//  NFT DISCOVERY
// ═══════════════════════════════════════════════════════════════════
// Fetch NFTs from OpenSea API (auto-detect owned NFTs)
async function getNFTsFromOpenSea(chain, contract, walletAddress) {
  const chainMap = {
    ethereum: 'eth',
    arbitrum: 'arbitrum',
    polygon: 'polygon',
    base: 'base',
    optimism: 'optimism',
    avalanche: 'avax',
    blast: 'blast',
    zora: 'zora',
  };
  
  const osChain = chainMap[chain.toLowerCase()] || chain;
  const url = `https://api.opensea.io/api/v2/accounts/${walletAddress}/nfts?chain=${osChain}&collection=${contract}&limit=50`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'X-API-KEY': config.openseaApiKey,
        'accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      throw new Error(`OpenSea API: ${res.status}`);
    }
    
    const data = await res.json();
    const nfts = data.nfts || [];
    
    return nfts.map(nft => ({
      identifier: nft.identifier,
      contract: contract,
      name: nft.name || `#${nft.identifier}`,
    }));
  } catch (err) {
    log.warn(`OpenSea API fetch gagal: ${err.message}`);
    return null;
  }
}

export async function getNFTsInWallet(privateKey, collection) {
  const { chain, contract, slug, chainInfo } = collection;
  const wallet = getWallet(privateKey, chain);
  const provider = getProvider(chain);
  const nftContract = new ethers.Contract(contract, ERC721_ABI, provider);

  const label = `${slug}@${chain}`;

  // Use manual TOKEN_IDS if provided (bypass blockchain scan)
  if (config.tokenIds && config.tokenIds.length > 0) {
    log.chain(chain, `${label}: Using manual TOKEN_IDS: ${config.tokenIds.join(", ")}`);
    const nfts = config.tokenIds.map(tokenId => 
      buildNFT(tokenId, collection, wallet.address)
    );
    const limit = config.maxListingsPerWallet;
    return limit > 0 ? nfts.slice(0, limit) : nfts;
  }

  // Try OpenSea API first (auto-detect NFTs)
  log.chain(chain, `${label}: Mencoba ambil NFT dari OpenSea API...`);
  const osNFTs = await getNFTsFromOpenSea(chain, contract, wallet.address);
  if (osNFTs && osNFTs.length > 0) {
    log.chain(chain, `${label}: Ditemukan ${osNFTs.length} NFT via OpenSea API`);
    const limit = config.maxListingsPerWallet;
    const nfts = osNFTs.map(n => buildNFT(n.identifier, collection, wallet.address));
    return limit > 0 ? nfts.slice(0, limit) : nfts;
  }

  // Fallback to blockchain
  try {
    const balance = await nftContract.balanceOf(wallet.address);
    const total = Number(balance);
    log.chain(chain, `${label}: ${total} NFT di wallet ${wallet.address.slice(0, 8)}...`);

    if (total === 0) return [];

    const nfts = [];

    // Coba Enumerable dulu
    try {
      for (let i = 0; i < total; i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(wallet.address, i);
        nfts.push(buildNFT(tokenId.toString(), collection, wallet.address));
      }
    } catch {
      log.info(`${label}: Tidak support Enumerable, scan via Transfer events...`);
      const eventNFTs = await getNFTsViaEvents(nftContract, wallet.address, collection);
      nfts.push(...eventNFTs);
    }

    const limit = config.maxListingsPerWallet;
    return limit > 0 ? nfts.slice(0, limit) : nfts;
  } catch (err) {
    log.error(`Gagal baca NFT dari ${label}: ${err.message}`);
    return [];
  }
}

function buildNFT(tokenId, collection, walletAddress) {
  return {
    identifier: tokenId,
    contract: collection.contract,
    collection: collection.slug,
    chain: collection.chain,
    chainInfo: collection.chainInfo,
    walletAddress,
  };
}

async function getNFTsViaEvents(nftContract, walletAddress, collection) {
  const provider = nftContract.runner.provider;
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 200_000);

  const filterIn = nftContract.filters.Transfer(null, walletAddress);
  const filterOut = nftContract.filters.Transfer(walletAddress, null);

  const [eventsIn, eventsOut] = await Promise.all([
    nftContract.queryFilter(filterIn, fromBlock, currentBlock),
    nftContract.queryFilter(filterOut, fromBlock, currentBlock),
  ]);

  const owned = new Set();
  for (const e of eventsIn) owned.add(e.args.tokenId.toString());
  for (const e of eventsOut) owned.delete(e.args.tokenId.toString());

  const nfts = [];
  for (const tokenId of owned) {
    try {
      const owner = await nftContract.ownerOf(tokenId);
      if (owner.toLowerCase() === walletAddress.toLowerCase()) {
        nfts.push(buildNFT(tokenId, collection, walletAddress));
      }
    } catch {}
  }

  return nfts;
}

// ═══════════════════════════════════════════════════════════════════
//  APPROVAL CHECK
// ═══════════════════════════════════════════════════════════════════
// Conduit proxy yang harus di-approve agar Seaport bisa transfer NFT
const CONDUIT_PROXY = "0x1e0049783f008a0085193e00003d00cd54003c71";

export async function ensureApproval(privateKey, nft) {
  const wallet = getWallet(privateKey, nft.chain);
  const nftContract = new ethers.Contract(nft.contract, ERC721_ABI, wallet);

  const isApproved = await nftContract.isApprovedForAll(wallet.address, CONDUIT_PROXY);
  if (isApproved) return true;

  if (config.dryRun) {
    log.dryRun(`[DRY-RUN] Perlu approve conduit untuk ${nft.contract}`);
    return true;
  }

  log.info(`Approve conduit untuk contract ${nft.contract}...`);
  try {
    const tx = await nftContract.setApprovalForAll(CONDUIT_PROXY, true);
    log.info(`Approval tx: ${tx.hash}`);
    await tx.wait();
    log.success("Approval berhasil!");
    return true;
  } catch (err) {
    log.error(`Approval gagal: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GAS GUARD
// ═══════════════════════════════════════════════════════════════════
export async function checkGasPrice(chain) {
  if (config.maxGasPriceGwei <= 0) return true; // tidak ada limit

  const gasPriceGwei = await getGasPrice(chain);
  if (gasPriceGwei > config.maxGasPriceGwei) {
    log.warn(
      `Gas terlalu mahal di ${chain}: ${gasPriceGwei.toFixed(2)} Gwei > max ${config.maxGasPriceGwei} Gwei. Skip.`
    );
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════
//  LISTING
// ═══════════════════════════════════════════════════════════════════
export async function createListing(privateKey, nft, overridePrice = null) {
  const wallet = getWallet(privateKey, nft.chain);
  const provider = getProvider(nft.chain);

  // Hitung harga
  let price, source;
  if (overridePrice !== null) {
    price = overridePrice;
    source = "override";
  } else {
    const priceResult = await calculatePrice({
      slug: nft.collection,
      chainInfo: nft.chainInfo,
    });
    price = priceResult.price;
    source = priceResult.source;
  }

  if (config.dryRun) {
    log.dryRun(`[DRY-RUN] Listing ${nft.collection}#${nft.identifier} @ ${price.toFixed(4)} ${nft.chainInfo.symbol} (${source})`);
    return { price, source, dryRun: true };
  }

  const priceWei = ethers.parseEther(price.toFixed(8));
  const openseaFee = (priceWei * 100n) / 10000n;   // 1% (OpenSea standard)
  const sellerAmount = priceWei - openseaFee;
  const durationSeconds = Math.round(config.listingDurationDays * 24 * 3600);
  const expirationTime = Math.round(Date.now() / 1000) + durationSeconds;

  const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, provider);
  const counter = await seaport.getCounter(wallet.address);

  const salt = ethers.hexlify(ethers.randomBytes(32));

  const parameters = {
    offerer: wallet.address,
    offer: [
      {
        itemType: 2,
        token: nft.contract,
        identifierOrCriteria: nft.identifier,
        startAmount: "1",
        endAmount: "1",
      },
    ],
    consideration: [
      {
        itemType: 0,
        token: ethers.ZeroAddress,
        identifierOrCriteria: "0",
        startAmount: sellerAmount.toString(),
        endAmount: sellerAmount.toString(),
        recipient: wallet.address,
      },
      {
        itemType: 0,
        token: ethers.ZeroAddress,
        identifierOrCriteria: "0",
        startAmount: openseaFee.toString(),
        endAmount: openseaFee.toString(),
        recipient: OPENSEA_FEE_RECIPIENT,
      },
    ],
    startTime: Math.round(Date.now() / 1000).toString(),
    endTime: expirationTime.toString(),
    orderType: 0,
    zone: ethers.ZeroAddress,
    zoneHash: ethers.ZeroHash,
    salt,
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: 2,
    counter: counter.toString(),
  };

  const domain = {
    name: "Seaport",
    version: "1.6",
    chainId: nft.chainInfo.chainId,
    verifyingContract: SEAPORT_ADDRESS,
  };

  const signature = await wallet.signTypedData(domain, EIP712_TYPES, parameters);

  const res = await fetchWithRetry(
    `https://api.opensea.io/api/v2/orders/${nft.chainInfo.name}/seaport/listings`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parameters, protocol_address: SEAPORT_ADDRESS, signature }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenSea listing API error: ${res.status} — ${errText}`);
  }

  const listing = await res.json();
  return { listing, price, source };
}

// ═══════════════════════════════════════════════════════════════════
//  CANCEL
// ═══════════════════════════════════════════════════════════════════
export async function cancelListing(privateKey, nft, orderHash, orderParameters) {
  if (config.dryRun) {
    log.dryRun(`[DRY-RUN] Cancel listing ${orderHash.slice(0, 10)}...`);
    return;
  }

  const wallet = getWallet(privateKey, nft.chain);

  // Coba cancel onchain dulu (lebih reliable)
  if (orderParameters) {
    try {
      const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, wallet);
      const tx = await seaport.cancel([orderParameters]);
      log.chain(nft.chain, `Cancel onchain tx: ${tx.hash}`);
      await tx.wait();
      log.success("Cancel onchain berhasil!");
      return;
    } catch (err) {
      log.warn(`Cancel onchain gagal: ${err.message}, coba via API...`);
    }
  }

  // Fallback ke API cancel
  const res = await fetchWithRetry(
    `https://api.opensea.io/api/v2/orders/${nft.chainInfo.name}/seaport/listings/${orderHash}/cancel`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offerer: wallet.address }),
    }
  );

  if (!res.ok) throw new Error(`Gagal cancel via API: ${await res.text()}`);
  log.success("Cancel via API berhasil.");
}

// ═══════════════════════════════════════════════════════════════════
//  GET EXISTING LISTING
// ═══════════════════════════════════════════════════════════════════
export async function getListingForNFT(nft) {
  const res = await fetchWithRetry(
    `https://api.opensea.io/api/v2/orders/${nft.chainInfo.name}/seaport/listings?asset_contract_address=${nft.contract}&token_ids=${nft.identifier}&order_by=created_date&order_direction=desc`
  );

  if (!res || !res.ok) return null;
  const data = await res.json();
  return data.orders?.[0] || null;
}

// ═══════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
