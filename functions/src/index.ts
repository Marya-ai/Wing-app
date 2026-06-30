/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onRequest, HttpsFunction } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import { Request, Response } from "express"; // Add this import for proper typing

// For cost control, limit concurrent containers to prevent unexpected bills
setGlobalOptions({ maxInstances: 10 });

// Securely get your bot token from .env file (Modern Method)
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// This function runs on Google's servers 24/7
export const telegramBot: HttpsFunction = onRequest(async (req: Request, res: Response): Promise<void> => {
  // Only accept POST requests from Telegram webhook
  if (req.method !== "POST") {
    res.status(405).send("OK");
    return; // Explicit return after sending response
  }

  const update = req.body;

  // Handle /start command with deep link parameters
  if (update.message?.text?.startsWith("/start")) {
    const chatId = update.message.chat.id;
    const param = update.message.text.split(" ")[1];

    let text = "";
    
    if (param === "web_redirect") {
      text = "🦅 Welcome from WING website!\n\nUse:\n/critique - Get feedback\n/swap - Material barter\n/pricecheck - Valuation";
    } else if (param === "buy_premium_50etb") {
      text = "👑 Premium Access\n\nSend 50 ETB to Telebirr: 09XX-XXX-XXX\nReply PAID after transfer.";
    } else if (param === "need_help_web") {
      text = "🆘 Support\n\nDescribe your issue and our team will respond shortly.";
    } else {
      text = "Hello! I am @WingArtisanBot.\n\nTap /menu to explore community features.";
    }

    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: "Markdown"
      });
      logger.info(`Sent welcome message to ${chatId}`);
    } catch (error) {
      logger.error("Failed to send Telegram message:", error);
    }
  }

  // Always respond OK to Telegram webhook within 10 seconds
  res.status(200).send("OK");
  return; // Explicit return at end of function
});