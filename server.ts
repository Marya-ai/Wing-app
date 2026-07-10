import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(express.json());

// --- 1. CONFIGURATION ---
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "wing-secure-secret-2024";
const ADMIN_ID = process.env.ADMIN_ID || "8360912681";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// State Management
const userStates = new Map<string, { mode: 'APPLY' | 'POST'; step: number; data: any }>();

// --- 2. DATABASE: THE CLEAN START ---
async function initDatabase() {
  try {
    console.log("🧹 Initializing Fresh WING Vault...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE, 
        username TEXT,
        role TEXT DEFAULT 'BUYER',
        trust_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- We use a NEW table name to bypass the old corrupted 'posts' table
      CREATE TABLE IF NOT EXISTS wing_masterpieces (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        caption TEXT,
        image_url TEXT,
        price TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure users table is BIGINT
      ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
    `);
    console.log("✅ WING Vault Ready: Fresh table 'wing_masterpieces' created.");
  } catch (err: any) {
    console.error("❌ DB Initialization Error:", err.message);
  }
}

async function sendTG(chatId: string | number, text: string) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (e) { console.error("📡 TG Send Error"); }
}

// --- 3. THE MASTER TELEGRAM ENGINE ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  // AI Mentor (Safe-Start)
  let aiModel: any = null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (e) { console.log("⚠️ AI Mentor Standby."); }

  console.log(`🤖 WING Master Engine Active. Listening for Masterpieces...`);
  
  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
      const data: any = await response.json();
      if (!data.ok) { await new Promise(r => setTimeout(r, 10000)); continue; }

      for (const update of data.result) {
        offset = update.update_id + 1;
        if (!update.message) continue;

        const chatId = update.message.chat.id;
        const userId = update.message.from.id.toString();
        const text = update.message.text?.trim();

        // Check user
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // COMMAND: /start
        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) {
            await pool.query('INSERT INTO users (telegram_id, username, role) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING', [userId, update.message.from.username, role]);
          }
          await sendTG(chatId, `🦅 *Welcome to WING Artisan Alliance*\n\nRole: \`${user?.role || role}\` \nStatus: Verified ✅\n\n/post - Upload Craft\n/apply - Become Seller\n/reset - Start over`);
          continue;
        }

        // COMMAND: /reset (Emergency Reset)
        if (text === "/reset" || text === "/cancel") {
          userStates.delete(userId);
          await sendTG(chatId, "🔄 *Session Reset.* You can now start a new /post.");
          continue;
        }

        // COMMAND: /post
        if (text === "/post") {
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "📸 *Gallery Post: Step 1*\n\nPlease send a clear photo of your craft.");
          continue;
        }

        // --- CONVERSATION HANDLER ---
        const state = userStates.get(userId);
        if (state) {
          // --- POSTING FLOW ---
          if (state.mode === 'POST') {
            if (state.step === 1 && update.message.photo) {
              state.data.image = update.message.photo[update.message.photo.length - 1].file_id;
              state.step = 2;
              await sendTG(chatId, "💰 *Step 2:* What is the price in ETB?");
            } else if (state.step === 2) {
              state.data.price = text; state.step = 3;
              await sendTG(chatId, "📝 *Step 3:* Write a short description.");
            } else if (state.step === 3 && text) {
              try {
                // SAVING TO THE NEW TABLE
                await pool.query(
                  'INSERT INTO wing_masterpieces (user_id, caption, image_url, price) VALUES ($1, $2, $3, $4)', 
                  [BigInt(userId), text, state.data.image, state.data.price]
                );
                await sendTG(chatId, "✅ *Masterpiece Published!*\n\nYour work is officially live in the digital gallery.");
                userStates.delete(userId);
              } catch (dbErr: any) {
                await sendTG(chatId, `❌ *Database Error:* ${dbErr.message}`);
              }
            }
          }
          // --- APPLICATION FLOW ---
          else if (state.mode === 'APPLY') {
            if (state.step === 1) {
              state.data.craft = text; state.step = 2;
              await sendTG(chatId, "📍 Step 2: Workshop location?");
            } else if (state.step === 2) {
              state.data.loc = text; state.step = 3;
              await sendTG(chatId, "📸 Step 3: Photo of your work?");
            } else if (state.step === 3 && update.message.photo) {
              await sendTG(chatId, "⏳ *Submitted!* Admin will review soon.");
              await sendTG(ADMIN_ID, `🔔 *NEW APP*\nUser: @${update.message.from.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
              userStates.delete(userId);
            }
          }
          continue;
        }

        // ADMIN: VERIFY
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTG(targetId, "🎉 *Verified!* You are now a Seller.");
          await sendTG(ADMIN_ID, `✅ User ${targetId} promoted.`);
          continue;
        }

        // AI MENTOR
        if (text?.startsWith("/ask ")) {
          const prompt = text.replace("/ask ", "");
          await sendTG(chatId, "💡 *Wing Guide is analyzing...*");
          try {
            const result = await aiModel.generateContent(prompt);
            await sendTG(chatId, `📖 *Advice:*\n\n${result.response.text()}`);
          } catch (e) { await sendTG(chatId, "⚠️ AI Mentor offline."); }
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 4. WEBSITE API ---
app.get("/api/gallery", async (req, res) => {
  try {
    // Note: Fetching from the NEW table
    const gallery = await pool.query('SELECT * FROM wing_masterpieces ORDER BY created_at DESC');
    res.json(gallery.rows);
  } catch (err) { res.status(500).json([]); }
});

// --- 5. SERVER STARTUP ---
async function startServer() {
  await initDatabase();
  startTelegramBotPolling();
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⭐ WING ENGINE LIVE ON PORT ${PORT}`);
  });
}

startServer();