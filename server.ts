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

// Database Setup (Render Postgres)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// State Management for multi-step bot flows (Applications & Gallery Posts)
const userStates = new Map<string, { 
  mode: 'APPLY' | 'POST'; 
  step: number; 
  data: any 
}>();

// --- 2. THE ULTIMATE DATABASE INITIALIZATION ---
async function initDatabase() {
  const query = `
    -- Create Users Table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'BUYER',
      trust_score INTEGER DEFAULT 0,
      craft_type TEXT,
      location TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Posts Table
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      caption TEXT,
      image_url TEXT,
      price TEXT,
      category TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Security Logs Table
    CREATE TABLE IF NOT EXISTS security_logs (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT,
      action TEXT,
      details JSONB,
      severity TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- CRITICAL REPAIR: Upgrade columns to BIGINT to handle your Telegram ID
    -- This fixes the "Out of Range" error specifically.
    ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
    ALTER TABLE posts ALTER COLUMN user_id TYPE BIGINT;

    -- Maintenance: Ensure all columns are present for the gallery
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'BUYER';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS price TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
  `;
  try {
    await pool.query(query);
    console.log("🛡️ WING Vault: Database structure upgraded and verified.");
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
  } catch (e) { console.error("📡 TG Transmission Error"); }
}

// --- 4. THE MASTER TELEGRAM ENGINE ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  
  // Clear Webhooks to enable Polling mode on Render
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  // AI Mentor Standby (Gemini Foundation)
  let aiModel: any = null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (e) { console.log("⚠️ AI Mentor awaiting key activation."); }

  console.log(`🤖 WING Master Engine Active. Polling for Artisans...`);
  
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

        // --- COMMAND: /start ---
        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) {
            await pool.query('INSERT INTO users (telegram_id, username, role) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING', 
            [userId, msg.from.username || 'Artisan', role]);
          }
          await sendTG(chatId, `🦅 *Welcome to WING Artisan Alliance*\n\nYour Role: \`${user?.role || role}\` \nStatus: Verified ✅\n\n/apply - Become a Seller\n/post - Upload Craft\n/reset - Reset if stuck`);
          continue;
        }

        // --- COMMAND: /reset (EMERGENCY FIX) ---
        if (text === "/reset" || text === "/cancel") {
          userStates.delete(userId);
          await sendTG(chatId, "🔄 *Session Reset.* You can now start a clean /post or /apply.");
          continue;
        }

        // --- COMMAND: /post (The Masterpiece Gallery) ---
        if (text === "/post") {
          if (user?.role !== 'SELLER' && user?.role !== 'ADMIN') {
             return sendTG(chatId, "⚠️ Only Verified Artisans can post. Please use /apply first.");
          }
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "📸 *Gallery Post: Step 1*\n\nPlease send a clear photo of your finished craft.");
          continue;
        }

        // --- COMMAND: /apply ---
        if (text === "/apply") {
          userStates.set(userId, { mode: 'APPLY', step: 1, data: {} });
          await sendTG(chatId, "🎨 *Artisan Application*\nStep 1: What type of craft do you make?");
          continue;
        }

        // --- CONVERSATION HANDLER ---
        const state = userStates.get(userId);
        if (state) {
          // A. POSTING FLOW
          if (state.mode === 'POST') {
            if (state.step === 1 && msg.photo) {
              state.data.image = msg.photo[msg.photo.length - 1].file_id;
              state.step = 2;
              await sendTG(chatId, "💰 *Step 2:* What is the price in ETB?");
            } else if (state.step === 2) {
              state.data.price = text; state.step = 3;
              await sendTG(chatId, "📝 *Step 3:* Write a short description.");
            } else if (state.step === 3 && text) {
              try {
                // SAVING TO DATABASE (Using explicit BIGINT conversion)
                await pool.query(
                  'INSERT INTO posts (user_id, caption, image_url, price) VALUES ($1, $2, $3, $4)', 
                  [BigInt(userId), text, state.data.image, state.data.price]
                );
                await sendTG(chatId, "✅ *Masterpiece Published!*\n\nYour work is officially live in the WING digital vault.");
                userStates.delete(userId);
              } catch (dbErr: any) {
                console.error("DB INSERT FAIL:", dbErr.message);
                await sendTG(chatId, `❌ *Database Error:* ${dbErr.message}`);
              }
            }
          }
          // B. APPLICATION FLOW
          else if (state.mode === 'APPLY') {
            if (state.step === 1) {
              state.data.craft = text; state.step = 2;
              await sendTG(chatId, "📍 Step 2: Workshop location?");
            } else if (state.step === 2) {
              state.data.loc = text; state.step = 3;
              await sendTG(chatId, "📸 Step 3: Photo of your work?");
            } else if (state.step === 3 && msg.photo) {
              await sendTG(chatId, "⏳ *Application Submitted!* Admin will review soon.");
              await sendTG(ADMIN_ID, `🔔 *NEW APP*\nUser: @${msg.from.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
              userStates.delete(userId);
            }
          }
          continue;
        }

        // --- ADMIN: VERIFY USER ---
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTG(targetId, "🎉 *Verified!* You are now a Verified WING Seller.");
          await sendTG(ADMIN_ID, `✅ User ${targetId} promoted.`);
          continue;
        }

        // --- COMMAND: /ask (Gemini AI) ---
        if (text?.startsWith("/ask ")) {
          const prompt = text.replace("/ask ", "");
          await sendTG(chatId, "💡 *Wing Guide is analyzing...*");
          try {
            const result = await aiModel.generateContent(prompt);
            await sendTG(chatId, `📖 *Artisan Advice:*\n\n${result.response.text()}`);
          } catch (e) { await sendTG(chatId, "⚠️ AI Mentor is currently resting."); }
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 5. WEBSITE API ENDPOINTS ---
app.get("/api/gallery", async (req, res) => {
  try {
    const gallery = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json(gallery.rows);
  } catch (err) { res.status(500).json([]); }
});

// --- 6. SERVER STARTUP ---
async function startServer() {
  console.log("🚀 WING Engine activating...");
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
    console.log(`⭐ WING MASTER ENGINE ONLINE ON PORT ${PORT}`);
  });
}

startServer();