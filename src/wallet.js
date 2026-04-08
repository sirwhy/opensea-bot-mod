import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./logger.js";

let provider, wallet;

export function initWallet() {
  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  wallet = new ethers.Wallet(config.privateKey, provider);
  log.success(`Wallet terhubung: ${wallet.address}`);
  return { provider, wallet };
}

export function getWallet() {
  if (!wallet) throw new Error("Wallet belum diinisialisasi. Panggil initWallet() dulu.");
  return wallet;
}

export async function getWalletBalance() {
  const balance = await provider.getBalance(wallet.address);
  return ethers.formatEther(balance);
}
