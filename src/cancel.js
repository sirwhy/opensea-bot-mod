import { ethers } from "ethers";
import { config } from "./config.js";
import { getWallet } from "./wallet.js";
import { log } from "./logger.js";

const SEAPORT_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";

const SEAPORT_ABI = [
  "function cancel(tuple(address offerer, address zone, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter)[] orders) returns (bool cancelled)"
];

export async function cancelListingOnchain(orderParameters) {
  const wallet = getWallet();
  const seaport = new ethers.Contract(SEAPORT_ADDRESS, SEAPORT_ABI, wallet);

  log.info("Cancel listing via Seaport contract...");
  const tx = await seaport.cancel([orderParameters]);
  log.info(`Tx hash: ${tx.hash}`);
  await tx.wait();
  log.success("Cancel berhasil!");
}
