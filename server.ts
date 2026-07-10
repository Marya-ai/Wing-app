import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Standard Library
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const ADMIN_ID = process.env.ADMIN_ID; 
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const userStates = new Map<string, { step: number; craft?: string; location?: string }>();

async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT,
      role TEXT DEFAULT 'BUYER',
      trust_score INTEGER DEFAULT 0,
      telegram_chat_id TEXT,
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS craft_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
  `;
  try {
    await pool.query(query);
    console.log("🛡️ Guardian System: PostgreSQL Tables Verified.");
  } catch (err) { console.error("❌ DB Init Error:", err); }
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (err) { console.error("Telegram Send Error"); }
}

// --- TELEGRAM BOT ENGINE ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  // SAFE AI INITIALIZATION
  let aiModel: any = null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("💡 Wing Guide (AI Mentor) Initialized.");
  } catch (e) {
    console.error("⚠️ AI Initialization failed. /ask will not work, but bot is staying online.");
  }

  console.log(`🤖 WING Gatekeeper active. Monitoring Trust Layer...`);
  
  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
      const data: any = await response.json();
      if (!data.ok) { await new Promise(r => setTimeout(r, 10000)); continue; }

      for (const update of data.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg) continue;

        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const text = msg.text?.trim();

        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) await pool.query('INSERT INTO users (telegram_id, username, role, telegram_chat_id) VALUES ($1, $2, $3, $4)', [userId, msg.from.username || 'Artisan', role, chatId.toString()]);
          await sendTelegramMessage(chatId, `👋 *Welcome to WING!*\n\nRole: \`${user?.role || role}\`\n\n*Commands:*\n/apply - Join as a Seller\n/ask [question] - AI Mentor\n/status - Profile info`);
          continue;
        }

        if (text?.startsWith("/ask ")) {
          if (!aiModel) {
            await sendTelegramMessage(chatId, "⚠️ AI Mentor is currently offline.");
            continue;
          }
          const prompt = text.replace("/ask ", "");
          await sendTelegramMessage(chatId, "💡 *Wing Guide is analyzing...*");
          try {
            const result = await aiModel.generateContent(`You are Wing Guide, a business mentor for Ethiopian artisans. Answer this: ${prompt}`);
            await sendTelegramMessage(chatId, `📖 *Artisan Advice:*\n\n${result.response.text()}`);
          } catch (e) { await sendTelegramMessage(chatId, "⚠️ AI Error. Please try again."); }
          continue;
        }

        if (text === "/apply") {
          userStates.set(userId, { step: 1 });
          await sendTelegramMessage(chatId, "🎨 *Artisan Application: Step 1*\n\nWhat kind of traditional craft do you specialize in?");
          continue;
        }

        const state = userStates.get(userId);
        if (state) {
          if (state.step === 1 && text) {
            state.craft = text; state.step = 2;
            await sendTelegramMessage(chatId, "📍 *Step 2*\n\nWhere is your workshop located?");
          } 
          else if (state.step === 2 && text) {
            state.location = text; state.step = 3;
            await sendTelegramMessage(chatId, "📸 *Step 3*\n\nPlease send a photo of your work.");
          } 
          else if (state.step === 3 && msg.photo) {
            await sendTelegramMessage(chatId, "⏳ *Application Submitted!*");
            await sendTelegramMessage(ADMIN_ID, `🔔 *NEW APP*\nUser: @${msg.from.username}\nCraft: ${state.craft}\n/verify_${userId}`);
            userStates.delete(userId);
          }
          continue;
        }

        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTelegramMessage(targetId, "🎉 Approved! You are now a Seller.");
          await sendTelegramMessage(ADMIN_ID, `✅ User ${targetId} promoted.`);
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

async function startServer() {
  await initDatabase();
  startTelegramBotPolling();
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => { console.log(`⭐ WING ENGINE ONLINE`); });
}

startServer();