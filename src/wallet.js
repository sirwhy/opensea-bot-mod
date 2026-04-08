import { ethers } from "ethers";
import { config, getRpcUrl } from "./config.js";
import { log } from "./logger.js";

// Provider pool — satu provider per chain
const providerPool = new Map();

export function getProvider(chain) {
  if (!providerPool.has(chain)) {
    const rpc = getRpcUrl(chain);
    providerPool.set(chain, new ethers.JsonRpcProvider(rpc));
  }
  return providerPool.get(chain);
}

// Wallet pool — kombinasi (privateKey + chain)
const walletPool = new Map();

export function getWallet(privateKey, chain) {
  const key = `${privateKey.slice(0, 10)}:${chain}`;
  if (!walletPool.has(key)) {
    const provider = getProvider(chain);
    walletPool.set(key, new ethers.Wallet(privateKey, provider));
  }
  return walletPool.get(key);
}

export function initWallets() {
  if (config.wallets.length === 0) {
    throw new Error("Tidak ada wallet yang dikonfigurasi.");
  }

  log.info(`Inisialisasi ${config.wallets.length} wallet...`);

  const walletInfos = [];
  for (const pk of config.wallets) {
    try {
      // Cukup buat di chain pertama untuk validasi
      const firstChain = config.collections[0]?.chain || "ethereum";
      const wallet = getWallet(pk, firstChain);
      walletInfos.push({ address: wallet.address, pk });
      log.success(`Wallet: ${wallet.address}`);
    } catch (err) {
      log.error(`Private key tidak valid: ${err.message}`);
      throw err;
    }
  }
  return walletInfos;
}

export async function getWalletBalance(privateKey, chain) {
  const wallet = getWallet(privateKey, chain);
  const balance = await wallet.provider.getBalance(wallet.address);
  return ethers.formatEther(balance);
}

export async function getGasPrice(chain) {
  const provider = getProvider(chain);
  const fee = await provider.getFeeData();
  const gweiPrice = parseFloat(ethers.formatUnits(fee.gasPrice || 0n, "gwei"));
  return gweiPrice;
}
