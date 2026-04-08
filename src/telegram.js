import https from "https";
import { telegram } from "./config.js";

/**
 * Send message to Telegram
 */
export function sendTelegramMessage(message, parseMode = "HTML") {
  if (!telegram.enabled) return;

  const data = JSON.stringify({
    chat_id: telegram.chatId,
    text: message,
    parse_mode: parseMode,
  });

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${telegram.botToken}/sendMessage`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (err) => {
      console.error("❌ Telegram error:", err.message);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Format ETH price
 */
function fmtPrice(wei) {
  if (!wei) return "0";
  return (wei / 1e18).toFixed(4);
}

/**
 * Notification: NFT Listed
 */
export async function notifyListed(tokenId, collection, price, chain) {
  if (!telegram.enabled) return;
  
  const msg = `🆕 <b>NFT Listed!</b>

📦 <b>Collection:</b> ${collection}
🔢 <b>Token ID:</b> #${tokenId}
💰 <b>Price:</b> ${price} ${chain.toUpperCase()}
⏰ <b>Duration:</b> 10 menit`;

  await sendTelegramMessage(msg);
}

/**
 * Notification: NFT Sold
 */
export async function notifySold(tokenId, collection, price, chain) {
  if (!telegram.enabled) return;
  
  const msg = `💰 <b>NFT SOLD!</b>

📦 <b>Collection:</b> ${collection}
🔢 <b>Token ID:</b> #${tokenId}
✅ <b>Price:</b> ${price} ${chain.toUpperCase()}

🎉 Selamat!`;
  
  await sendTelegramMessage(msg);
}

/**
 * Notification: NFT Relisted
 */
export async function notifyRelisted(tokenId, collection, oldPrice, newPrice, chain) {
  if (!telegram.enabled) return;
  
  const msg = `🔄 <b>NFT Relisted</b>

📦 <b>Collection:</b> ${collection}
🔢 <b>Token ID:</b> #${tokenId}
💰 <b>Old Price:</b> ${oldPrice} ${chain.toUpperCase()}
💰 <b>New Price:</b> ${newPrice} ${chain.toUpperCase()}`;

  await sendTelegramMessage(msg);
}

/**
 * Notification: Floor Price Updated
 */
export async function notifyFloorPrice(collection, oldFloor, newFloor, chain) {
  if (!telegram.enabled) return;
  
  const change = ((newFloor - oldFloor) / oldFloor * 100).toFixed(1);
  const emoji = change >= 0 ? "📈" : "📉";
  
  const msg = `📊 <b>Floor Price Update</b>

📦 <b>Collection:</b> ${collection}
${emoji} <b>Floor:</b> ${oldFloor} → ${newFloor} ${chain.toUpperCase()}
📊 <b>Change:</b> ${change > 0 ? "+" : ""}${change}%`;

  await sendTelegramMessage(msg);
}

/**
 * Notification: Bot Started
 */
export async function notifyBotStarted(walletAddress, chain, nftCount) {
  if (!telegram.enabled) return;
  
  const msg = `🤖 <b>OpenSea Bot Started</b>

👛 <b>Wallet:</b> <code>${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</code>
⛓️ <b>Chain:</b> ${chain}
📦 <b>NFTs:</b> ${nftCount}
⏰ <b>Interval:</b> 10 menit

✅ Bot berjalan!`;

  await sendTelegramMessage(msg);
}

/**
 * Notification: Error
 */
export async function notifyError(errorMsg) {
  if (!telegram.enabled) return;
  
  const msg = `⚠️ <b>Bot Error</b>

❌ <b>Error:</b> ${errorMsg}`;
  
  await sendTelegramMessage(msg);
}
/**
 * Send cycle summary with remaining NFTs
 */
export async function sendCycleSummary(stats, duration) {
  if (!telegram.enabled) return;

  const total = stats.totalNfts || 0;
  const processed = stats.listed + stats.relisted + stats.skipped + stats.errors;
  const remaining = Math.max(0, total - processed);

  const msg = `📊 <b>Cycle Summary</b>

📦 Total NFT: ${total}
✅ Listed: ${stats.listed}
🔄 Relisted: ${stats.relisted}
⏭️ Skipped: ${stats.skipped}
❌ Error: ${stats.errors}

📦 <b>NFT Tersisa: ${remaining}</b>
⏱️ Duration: ${duration}s`;

  await sendTelegramMessage(msg);
}
