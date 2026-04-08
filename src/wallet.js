import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./logger.js";

let provider, wallet;

export function initWallet() {
  const rpcUrl = config.rpcUrl;
  
  console.log("=== Wallet Init Debug ===");
  console.log("RPC URL:", rpcUrl);
  console.log("Chain:", config.chainName);
  console.log("============================");
  
  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(config.privateKey, provider);
    log.success(`Wallet terhubung: ${wallet.address}`);
    return { provider, wallet };
  } catch (err) {
    console.error("Wallet init error:", err.message);
    throw err;
  }
}

export function getWallet() {
  if (!wallet) throw new Error("Wallet belum diinisialisasi. Panggil initWallet() dulu.");
  return wallet;
}

export async function getWalletBalance() {
  const balance = await provider.getBalance(wallet.address);
  return ethers.formatEther(balance);
}

export function getWalletAddress() {
  return wallet.address;
}
