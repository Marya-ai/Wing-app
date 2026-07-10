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

const userStates = new Map<string, { mode: 'APPLY' | 'POST'; step: number; data: any }>();

// --- 2. DATABASE INITIALIZATION & EMERGENCY TYPE FIX ---
async function initDatabase() {
  try {
    // A. Create Tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username TEXT,
        role TEXT DEFAULT 'BUYER',
        trust_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        caption TEXT,
        image_url TEXT,
        price TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // B. THE CRITICAL FIX: Convert columns to BIGINT to handle large Telegram IDs
    // This fixes the "out of range" error you just saw
    await pool.query(`
      ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
      ALTER TABLE posts ALTER COLUMN user_id TYPE BIGINT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS craft_type TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
    `);

    console.log("🛡️ Guardian System: Database upgraded to BIGINT. Ready for high-volume IDs.");
  } catch (err: any) {
    console.error("❌ DB Maintenance Error:", err.message);
  }
}

// --- 3. TELEGRAM UTILITIES ---
async function sendTG(chatId: string | number, text: string) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (e) { console.error("📡 TG Outbound Error"); }
}

// --- 4. THE MASTER TELEGRAM ENGINE ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  // AI Mentor (Safe-Start)
  let aiModel: any = null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (e) { console.log("⚠️ AI Mentor Standby."); }

  console.log(`🤖 WING Master Engine Active. Polling for Artisan data...`);
  
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

        // 🛡️ USER AUTH/REGISTRATION
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // COMMAND: /start
        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) {
            await pool.query('INSERT INTO users (telegram_id, username, role) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING', 
            [userId, msg.from.username || 'Artisan', role]);
          }
          await sendTG(chatId, `🦅 *Welcome to WING Artisan Alliance*\n\nYour Role: \`${user?.role || role}\` \nStatus: Verified ✅\n\n/apply - Become a Seller\n/post - Upload Craft\n/status - My Profile\n/ask - AI Mentor`);
          continue;
        }

        // COMMAND: /post
        if (text === "/post") {
          if (user?.role !== 'SELLER' && user?.role !== 'ADMIN') return sendTG(chatId, "⚠️ Only Verified Artisans can post. Use /apply.");
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "📸 *Gallery Post: Step 1*\nPlease send a clear photo of your craft.");
          continue;
        }

        // COMMAND: /apply
        if (text === "/apply") {
          userStates.set(userId, { mode: 'APPLY', step: 1, data: {} });
          await sendTG(chatId, "🎨 *Artisan Application*\nStep 1: What type of craft do you make?");
          continue;
        }

        // CONVERSATION HANDLER
        const state = userStates.get(userId);
        if (state) {
          if (state.mode === 'POST') {
            if (state.step === 1 && msg.photo) {
              state.data.image = msg.photo[msg.photo.length - 1].file_id;
              state.step = 2;
              await sendTG(chatId, "💰 Step 2: Price in ETB?");
            } else if (state.step === 2) {
              state.data.price = text; state.step = 3;
              await sendTG(chatId, "📝 Step 3: Write a short description.");
            } else if (state.step === 3 && text) {
              try {
                // FIXED INSERT WITH BIGINT CONVERSION
                await pool.query(
                  'INSERT INTO posts (user_id, caption, image_url, price) VALUES ($1, $2, $3, $4)', 
                  [BigInt(userId), text, state.data.image, state.data.price]
                );
                await sendTG(chatId, "✅ *Masterpiece Published!*\n\nRefresh your gallery link to see it.");
                userStates.delete(userId);
              } catch (err: any) {
                await sendTG(chatId, `❌ Database Error: ${err.message}`);
              }
            }
          }
          else if (state.mode === 'APPLY') {
            if (state.step === 1) {
              state.data.craft = text; state.step = 2;
              await sendTG(chatId, "📍 Step 2: Workshop location?");
            } else if (state.step === 2) {
              state.data.loc = text; state.step = 3;
              await sendTG(chatId, "📸 Step 3: Photo of your work?");
            } else if (state.step === 3 && msg.photo) {
              await sendTG(chatId, "⏳ *Application Submitted!*");
              await sendTG(ADMIN_ID, `🔔 *NEW APP*\nUser: @${msg.from.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
              userStates.delete(userId);
            }
          }
          continue;
        }

        // ADMIN: VERIFY
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTG(targetId, "🎉 Approved! You are now a Verified Seller.");
          await sendTG(ADMIN_ID, `✅ User ${targetId} promoted.`);
          continue;
        }

        if (text === "/status") {
          await sendTG(chatId, `📊 *WING Profile*\nRole: \`${user?.role || 'BUYER'}\``);
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 5. WEBSITE API ---
app.get("/api/gallery", async (req, res) => {
  try {
    const gallery = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json(gallery.rows);
  } catch (err) { res.status(500).json([]); }
});

// --- 6. SERVER STARTUP ---
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