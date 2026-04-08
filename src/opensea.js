import { ethers } from "ethers";
import { config } from "./config.js";
import { getWallet, getProvider, getGasPrice } from "./wallet.js";
import { log } from "./logger.js";

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const SEAPORT_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";
const OPENSEA_FEE_RECIPIENT = "0x0000a26b00c1f0df003000390027140000faa719";
const CONDUIT_KEY = "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const CONDUIT_PROXY = "0x1e0049783f008a0085193e00003d00cd54003c71";
const SEAPORT_VERSION = "1.6";

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

// ✅ EIP712 Types Seaport 1.6 — salt = uint256 (BUKAN bytes32)
// Ref: https://github.com/ProjectOpenSea/seaport/blob/main/contracts/lib/ConsiderationBase.sol
const EIP712_TYPES = {
  OrderComponents: [
    { name: "offerer",    type: "address"   },
    { name: "zone",       type: "address"   },
    { name: "offer",      type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType",  type: "uint8"     },
    { name: "startTime",  type: "uint256"   },
    { name: "endTime",    type: "uint256"   },
    { name: "zoneHash",   type: "bytes32"   },
    { name: "salt",       type: "uint256"   }, // ← uint256, BUKAN bytes32
    { name: "conduitKey", type: "bytes32"   },
    { name: "counter",    type: "uint256"   },
  ],
  OfferItem: [
    { name: "itemType",              type: "uint8"   },
    { name: "token",                 type: "address" },
    { name: "identifierOrCriteria",  type: "uint256" },
    { name: "startAmount",           type: "uint256" },
    { name: "endAmount",             type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType",              type: "uint8"   },
    { name: "token",                 type: "address" },
    { name: "identifierOrCriteria",  type: "uint256" },
    { name: "startAmount",           type: "uint256" },
    { name: "endAmount",             type: "uint256" },
    { name: "recipient",             type: "address" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
//  FETCH WITH RETRY — selalu return atau throw, tidak pernah undefined
// ═══════════════════════════════════════════════════════════════════
async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError = null;

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
        log.warn(`Rate limited. Tunggu ${wait / 1000}s... (${attempt}/${retries})`);
        await sleep(wait);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const wait = attempt * (config.retryDelayMs || 3000);
        log.warn(`Fetch gagal (${attempt}/${retries}): ${err.message}. Retry ${wait / 1000}s...`);
        await sleep(wait);
      }
    }
  }

  throw new Error(`Fetch gagal setelah ${retries} percobaan: ${lastError?.message || "unknown"}`);
}

// ═══════════════════════════════════════════════════════════════════
//  FLOOR PRICE + STICKY MINIMUM
// ═══════════════════════════════════════════════════════════════════
const stickyFloor = new Map(); // slug → floor tertinggi yang pernah dilihat

export async function getFloorPrice(collectionSlug) {
  try {
    const res = await fetchWithRetry(
      `https://api.opensea.io/api/v2/collections/${collectionSlug}/stats`
    );

    if (!res.ok) {
      log.warn(`Gagal ambil floor ${collectionSlug}: ${res.status}`);
      return stickyFloor.get(collectionSlug) || null;
    }

    const data = await res.json();
    const floorRaw = data.total?.floor_price ?? data.stats?.floor_price ?? null;
    if (floorRaw == null) return stickyFloor.get(collectionSlug) || null;

    const floor = parseFloat(floorRaw);
    if (!floor || floor <= 0) return stickyFloor.get(collectionSlug) || null;

    // Sticky: catat jika floor sekarang lebih tinggi dari sebelumnya
    const prev = stickyFloor.get(collectionSlug);
    if (!prev || floor > prev) {
      if (prev) log.info(`📈 Floor naik: ${collectionSlug} ${prev.toFixed(6)} → ${floor.toFixed(6)}`);
      stickyFloor.set(collectionSlug, floor);
    }

    return floor;
  } catch (err) {
    log.warn(`Error ambil floor: ${err.message}`);
    return stickyFloor.get(collectionSlug) || null;
  }
}

// Harga listing = floor sekarang, min price = sticky floor (tidak pernah turun)
export async function calculatePrice(collection) {
  const { slug } = collection;
  const currentFloor = await getFloorPrice(slug);
  const minPrice = stickyFloor.get(slug) || config.minPriceFallback;

  if (!currentFloor || currentFloor <= 0) {
    log.warn(`Floor tidak tersedia untuk ${slug}, pakai sticky min: ${minPrice}`);
    return { price: minPrice, source: "sticky_min_fallback", basePrice: minPrice };
  }

  const offset = (config.priceOffsetPercent || 0) / 100;
  let price = currentFloor * (1 + offset);

  if (price < minPrice) {
    log.info(`Floor ${price.toFixed(6)} < sticky min ${minPrice.toFixed(6)}, pakai sticky min`);
    price = minPrice;
  }

  return { price, source: "floor", basePrice: currentFloor };
}

// ═══════════════════════════════════════════════════════════════════
//  NFT DISCOVERY — Realtime ownership check
// ═══════════════════════════════════════════════════════════════════
const OS_CHAIN_MAP = {
  ethereum: "ethereum", polygon: "matic", base: "base",
  arbitrum: "arbitrum", optimism: "optimism", avalanche: "avalanche",
  blast: "blast", zora: "zora", klaytn: "klaytn", animechain: "animechain",
};

async function verifyOwnershipOnChain(provider, contractAddress, tokenId, walletAddress) {
  try {
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const owner = await contract.ownerOf(tokenId);
    return owner.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

async function getNFTsFromOpenSeaAPI(chain, collectionSlug, walletAddress) {
  const osChain = OS_CHAIN_MAP[chain.toLowerCase()] || chain;
  const url = `https://api.opensea.io/api/v2/accounts/${walletAddress}/nfts?chain=${osChain}&collection=${collectionSlug}&limit=200`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) { log.warn(`OpenSea NFT API ${res.status}`); return null; }
    const data = await res.json();
    return data.nfts || [];
  } catch (err) {
    log.warn(`OpenSea NFT API gagal: ${err.message}`);
    return null;
  }
}

export async function getNFTsInWallet(privateKey, collection) {
  const { chain, contract, slug } = collection;
  const wallet = getWallet(privateKey, chain);
  const provider = getProvider(chain);
  const label = `${slug}@${chain}`;

  // Manual TOKEN_IDS override
  if (config.tokenIds && config.tokenIds.length > 0) {
    log.chain(chain, `${label}: Verifikasi ${config.tokenIds.length} TOKEN_IDS...`);
    const verified = [];
    for (const tokenId of config.tokenIds) {
      const owned = await verifyOwnershipOnChain(provider, contract, tokenId, wallet.address);
      if (owned) {
        verified.push(buildNFT(tokenId, collection, wallet.address));
      } else {
        log.warn(`⚠️  Token #${tokenId} tidak dimiliki (terjual?), dilewati`);
      }
    }
    return verified;
  }

  // OpenSea API (realtime)
  log.chain(chain, `${label}: Cek NFT via OpenSea API...`);
  const osNFTs = await getNFTsFromOpenSeaAPI(chain, slug, wallet.address);

  if (osNFTs && osNFTs.length > 0) {
    const verified = [];
    for (const nft of osNFTs) {
      const tokenId = nft.identifier || nft.token_id;
      if (!tokenId) continue;
      const owned = await verifyOwnershipOnChain(provider, contract, tokenId, wallet.address);
      if (owned) {
        verified.push(buildNFT(tokenId, collection, wallet.address));
      } else {
        log.warn(`⚠️  Token #${tokenId} tidak lagi dimiliki, dilewati`);
      }
    }
    log.chain(chain, `${label}: ${verified.length}/${osNFTs.length} NFT verified`);
    const limit = config.maxListingsPerWallet;
    return limit > 0 ? verified.slice(0, limit) : verified;
  }

  // Fallback: public RPC scan
  log.chain(chain, `${label}: Fallback blockchain scan...`);
  try {
    const nftContract = new ethers.Contract(contract, ERC721_ABI, provider);
    const balance = await nftContract.balanceOf(wallet.address);
    const total = Number(balance);
    log.chain(chain, `${label}: Balance = ${total}`);
    if (total === 0) return [];

    const nfts = [];
    try {
      for (let i = 0; i < total; i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(wallet.address, i);
        nfts.push(buildNFT(tokenId.toString(), collection, wallet.address));
      }
    } catch {
      const eventNFTs = await getNFTsViaEvents(nftContract, wallet.address, collection, provider);
      nfts.push(...eventNFTs);
    }

    const limit = config.maxListingsPerWallet;
    return limit > 0 ? nfts.slice(0, limit) : nfts;
  } catch (err) {
    log.error(`Scan gagal ${label}: ${err.message}`);
    return [];
  }
}

function buildNFT(tokenId, collection, walletAddress) {
  return {
    identifier: String(tokenId),
    contract: collection.contract,
    collection: collection.slug,
    chain: collection.chain,
    chainInfo: collection.chainInfo,
    walletAddress,
  };
}

async function getNFTsViaEvents(nftContract, walletAddress, collection, provider) {
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 50_000);

  const [eventsIn, eventsOut] = await Promise.all([
    nftContract.queryFilter(nftContract.filters.Transfer(null, walletAddress), fromBlock, currentBlock),
    nftContract.queryFilter(nftContract.filters.Transfer(walletAddress, null), fromBlock, currentBlock),
  ]);

  const owned = new Set();
  for (const e of eventsIn) owned.add(e.args.tokenId.toString());
  for (const e of eventsOut) owned.delete(e.args.tokenId.toString());

  const nfts = [];
  for (const tokenId of owned) {
    const ok = await verifyOwnershipOnChain(provider, collection.contract, tokenId, walletAddress);
    if (ok) nfts.push(buildNFT(tokenId, collection, walletAddress));
  }
  return nfts;
}

// ═══════════════════════════════════════════════════════════════════
//  APPROVAL
// ═══════════════════════════════════════════════════════════════════
export async function ensureApproval(privateKey, nft) {
  const wallet = getWallet(privateKey, nft.chain);
  const nftContract = new ethers.Contract(nft.contract, ERC721_ABI, wallet);

  try {
    const isApproved = await nftContract.isApprovedForAll(wallet.address, CONDUIT_PROXY);
    if (isApproved) return true;
  } catch (err) {
    log.warn(`Cek approval gagal: ${err.message}`);
  }

  if (config.dryRun) { log.dryRun(`Perlu approve conduit untuk ${nft.contract}`); return true; }

  log.info(`Approve conduit untuk ${nft.contract}...`);
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
  if (!config.maxGasPriceGwei || config.maxGasPriceGwei <= 0) return true;
  try {
    const gwei = await getGasPrice(chain);
    if (gwei > config.maxGasPriceGwei) {
      log.warn(`Gas terlalu mahal: ${gwei.toFixed(2)} Gwei. Skip.`);
      return false;
    }
  } catch {}
  return true;
}

// ═══════════════════════════════════════════════════════════════════
//  CREATE LISTING
// ═══════════════════════════════════════════════════════════════════
export async function createListing(privateKey, nft, overridePrice = null) {
  const wallet = getWallet(privateKey, nft.chain);
  const provider = getProvider(nft.chain);

  let price, source;
  if (overridePrice !== null) {
    price = overridePrice; source = "override";
  } else {
    const r = await calculatePrice({ slug: nft.collection, chainInfo: nft.chainInfo });
    price = r.price; source = r.source;
  }

  if (config.dryRun) {
    log.dryRun(`${nft.collection}#${nft.identifier} @ ${price.toFixed(6)} ${nft.chainInfo.symbol}`);
    return { price, source, dryRun: true };
  }

  const durationSeconds = (config.listingDurationMinutes || 10) * 60;
  const nowSec = Math.round(Date.now() / 1000);
  const expirationTime = nowSec + durationSeconds;

  const priceWei = ethers.parseEther(price.toFixed(8));
  const openseaFee = (priceWei * 250n) / 10000n; // 2.5%
  const sellerAmount = priceWei - openseaFee;

  const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, provider);
  const counter = await seaport.getCounter(wallet.address);

  // ✅ Salt = uint256 decimal string (BUKAN bytes32 hex)
  // EIP712 type "salt" = uint256, jadi value harus decimal, bukan 0x hex
  const saltBigInt = BigInt(ethers.hexlify(ethers.randomBytes(32)));
  const salt = saltBigInt.toString(); // decimal string

  const parameters = {
    offerer: wallet.address,
    offer: [{
      itemType: 2,
      token: nft.contract,
      identifierOrCriteria: String(nft.identifier),
      startAmount: "1",
      endAmount: "1",
    }],
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
    startTime: String(nowSec),
    endTime: String(expirationTime),
    orderType: 0,                   // number
    zone: ethers.ZeroAddress,
    zoneHash: ethers.ZeroHash,
    salt,                           // ✅ uint256 decimal string
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: 2,  // number
    counter: String(counter),
  };

  const domain = {
    name: "Seaport",
    version: SEAPORT_VERSION,
    chainId: nft.chainInfo.chainId,
    verifyingContract: SEAPORT_ADDRESS,
  };

  log.info(`Signing: ${nft.collection}#${nft.identifier} @ ${price.toFixed(6)} ${nft.chainInfo.symbol} (${config.listingDurationMinutes}min)`);

  // signTypedData dengan EIP712_TYPES (salt = uint256)
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
    throw new Error(`OpenSea API ${res.status}: ${errText}`);
  }

  return { listing: await res.json(), price, source };
}

// ═══════════════════════════════════════════════════════════════════
//  CANCEL LISTING
// ═══════════════════════════════════════════════════════════════════
export async function cancelListing(privateKey, nft, orderHash, orderParameters) {
  if (config.dryRun) { log.dryRun(`Cancel ${orderHash?.slice(0, 10)}...`); return; }

  const wallet = getWallet(privateKey, nft.chain);

  if (orderParameters) {
    try {
      const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, wallet);
      const tx = await seaport.cancel([orderParameters]);
      log.chain(nft.chain, `Cancel tx: ${tx.hash}`);
      await tx.wait();
      log.success("Cancel onchain berhasil!");
      return;
    } catch (err) {
      log.warn(`Cancel onchain gagal: ${err.message}, fallback API...`);
    }
  }

  try {
    const res = await fetchWithRetry(
      `https://api.opensea.io/api/v2/orders/${nft.chainInfo.name}/seaport/listings/${orderHash}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerer: wallet.address }),
      }
    );
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    log.success("Cancel via API berhasil.");
  } catch (err) {
    // Listing 10 menit — expire sendiri jika cancel gagal
    log.warn(`Cancel gagal (akan expire ${config.listingDurationMinutes}min): ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GET EXISTING LISTING
// ═══════════════════════════════════════════════════════════════════
export async function getListingForNFT(nft) {
  try {
    const res = await fetchWithRetry(
      `https://api.opensea.io/api/v2/orders/${nft.chainInfo.name}/seaport/listings?asset_contract_address=${nft.contract}&token_ids=${nft.identifier}&order_by=created_date&order_direction=desc`
    );
    if (!res || !res.ok) return null;
    const data = await res.json();
    return data.orders?.[0] || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
