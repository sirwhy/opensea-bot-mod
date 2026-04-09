import { ethers } from "ethers";
import { config } from "./config.js";
import { getWallet, getProvider } from "./wallet.js";
import { log } from "./logger.js";

// ═══════════════════════════════════════════════════════════════
//  AUTO MINT FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Auto-mint NFTs when wallet balance is low
 * 
 * Usage:
 * - Check wallet NFT balance
 * - If balance < MIN_MINT_BALANCE, mint up to MAX_MINT_AMOUNT
 * - Prevents running out of NFTs to list
 */

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function safeMint(address to) returns (uint256)",
  "function mint(uint256 quantity) returns (uint256)",
  "function mint(address to, uint256 quantity) returns (uint256)",
  "function mint() returns (uint256)",
];

export async function checkAndMintNFTs(collection) {
  const { chain, contract } = collection;
  
  // Check if auto-mint is enabled for this collection
  const mintConfig = config.mintConfig?.[contract.toLowerCase()] || config.mintConfig?.default;
  
  if (!mintConfig?.enabled) {
    log.chain(chain, "Auto-mint disabled for this collection");
    return { minted: 0, reason: "disabled" };
  }

  // Get wallet and provider
  const wallets = config.wallets;
  if (wallets.length === 0) {
    log.warn("No wallets configured for auto-mint");
    return { minted: 0, reason: "no_wallets" };
  }

  const wallet = getWallet(wallets[0].privateKey, chain);
  const provider = getProvider(chain);
  
  log.chain(chain, `Checking NFT balance for ${wallet.address.slice(0, 6)}...`);

  // Check current balance
  const nftContract = new ethers.Contract(contract, ERC721_ABI, provider);
  
  try {
    const balance = await nftContract.balanceOf(wallet.address);
    const currentBalance = Number(balance);
    
    log.chain(chain, `Current balance: ${currentBalance} NFTs`);

    // Check if minting is needed
    const threshold = mintConfig.minBalance || 50;
    const maxMint = mintConfig.maxMintAmount || 50;
    const targetBalance = threshold + maxMint;

    if (currentBalance >= targetBalance) {
      log.chain(chain, `Balance sufficient (${currentBalance} >= ${targetBalance}), no mint needed`);
      return { minted: 0, balance: currentBalance, reason: "sufficient" };
    }

    const needed = targetBalance - currentBalance;
    const toMint = Math.min(needed, maxMint);

    if (toMint <= 0) {
      return { minted: 0, balance: currentBalance, reason: "none_needed" };
    }

    log.info(`⚡ Auto-mint needed: minting ${toMint} NFTs (current: ${currentBalance}, target: ${targetBalance})`);

    // Check if dry-run mode
    if (config.dryRun) {
      log.dryRun(`Would mint ${toMint} NFTs from ${contract}`);
      return { minted: 0, balance: currentBalance, reason: "dry_run" };
    }

    // Execute mint
    const tx = await nftContract.mint(wallet.address, toMint);
    log.chain(chain, `Minting ${toMint} NFTs... tx: ${tx.hash}`);
    
    await tx.wait();
    
    // Verify new balance
    const newBalance = Number(await nftContract.balanceOf(wallet.address));
    
    log.success(`✅ Auto-mint complete: ${toMint} NFTs (new balance: ${newBalance})`);
    
    return { minted: toMint, balance: newBalance, txHash: tx.hash };
    
  } catch (err) {
    log.error(`Auto-mint failed: ${err.message}`);
    if (err.code === 'CALL_EXCEPTION') {
      log.warn("Contract may not support safeMint. Trying alternative method...");
      // Try alternative mint methods
      return await tryAlternativeMint(contract, wallet, toMint, provider);
    }
    return { minted: 0, balance: currentBalance, error: err.message };
  }
}

async function tryAlternativeMint(contract, wallet, amount, provider) {
  const nftContract = new ethers.Contract(contract, ERC721_ABI, wallet);
  
  // Try different mint signatures
  const mintMethods = [
    { name: "mint", params: [wallet.address, amount] },
    { name: "mint", params: [amount] },
    { name: "safeMint", params: [wallet.address] },
  ];

  for (const method of mintMethods) {
    try {
      log.info(`Trying mint method: ${method.name}(${method.params})`);
      const tx = await nftContract[method.name](...method.params);
      await tx.wait();
      
      const newBalance = Number(await nftContract.balanceOf(wallet.address));
      const minted = newBalance - amount;
      
      log.success(`✅ Mint successful via ${method.name}: ${amount} NFTs (tx: ${tx.hash})`);
      return { minted: amount, balance: newBalance, txHash: tx.hash };
    } catch (err) {
      log.warn(`${method.name} failed: ${err.message}`);
    }
  }

  throw new Error("All mint methods failed");
}

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION HELPER
// ═══════════════════════════════════════════════════════════════
export function parseMintConfig() {
  const mintConfigRaw = process.env.MINT_CONFIG;
  
  if (!mintConfigRaw) {
    log.info("MINT_CONFIG not set, using defaults");
    return {
      default: {
        enabled: false,
        minBalance: 50,
        maxMintAmount: 50,
      },
    };
  }

  // Parse JSON config
  try {
    const config = JSON.parse(mintConfigRaw);
    log.info("MINT_CONFIG loaded successfully");
    return config;
  } catch (err) {
    log.warn(`Failed to parse MINT_CONFIG: ${err.message}`);
    return {
      default: {
        enabled: false,
        minBalance: 50,
        maxMintAmount: 50,
      },
    };
  }
}
