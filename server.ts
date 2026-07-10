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

// Database Setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. STATE MANAGEMENT (For Bot Conversations) ---
const userStates = new Map<string, { 
  mode: 'APPLY' | 'POST'; 
  step: number; 
  data: any 
}>();

// --- 3. DATABASE INITIALIZATION (Future-Proof Schema) ---
async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'BUYER', -- ADMIN, SELLER, BUYER
      trust_score INTEGER DEFAULT 0,
      craft_type TEXT,
      location TEXT,
      telegram_chat_id TEXT,
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure columns exist for older DB versions
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS craft_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(telegram_id),
      caption TEXT,
      image_url TEXT, -- This stores the Telegram file_id
      price TEXT,
      category TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS security_logs (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT,
      action TEXT,
      details JSONB,
      severity TEXT, -- INFO, WARN, CRITICAL
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log("🛡️ Guardian System: PostgreSQL Trust Layer Fully Operational.");
  } catch (err) {
    console.error("❌ DB Init Error:", err);
  }
}

// --- 4. TELEGRAM UTILITIES ---
async function sendTG(chatId: string | number, text: string) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (e) { console.error("TG Send Error"); }
}

// --- 5. THE MASTER TELEGRAM ENGINE ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  
  // Clear any existing webhooks
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  // AI Mentor Init
  let aiModel: any = null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (e) { console.error("⚠️ AI Mentor failed to initialize."); }

  console.log(`🤖 WING Master Engine Active. Polling for Artisan interactions...`);
  
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

        // Check/Register User in DB
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // --- COMMAND: /start ---
        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) {
            await pool.query('INSERT INTO users (telegram_id, username, role, telegram_chat_id) VALUES ($1, $2, $3, $4)', 
            [userId, msg.from.username || 'Artisan', role, chatId.toString()]);
          }
          await sendTG(chatId, `🦅 *Welcome to WING Artisan Alliance*\n\nYour Role: \`${user?.role || role}\` \nStatus: Verified ✅\n\n*Commands:*\n/apply - Become a Seller\n/post - Upload Craft\n/ask [question] - AI Mentor\n/status - My Profile`);
          continue;
        }

        // --- COMMAND: /ask (AI Mentor) ---
        if (text?.startsWith("/ask ")) {
          if (!aiModel) { await sendTG(chatId, "⚠️ AI Mentor is offline."); continue; }
          const prompt = text.replace("/ask ", "");
          await sendTG(chatId, "💡 *Wing Guide is analyzing...*");
          try {
            const result = await aiModel.generateContent(`You are Wing Guide, a mentor for Ethiopian artisans. Help with: ${prompt}`);
            await sendTG(chatId, `📖 *Artisan Advice:*\n\n${result.response.text()}`);
          } catch (e) { await sendTG(chatId, "⚠️ AI limit reached. Try later."); }
          continue;
        }

        // --- COMMAND: /apply (Gatekeeper) ---
        if (text === "/apply") {
          if (user?.role === 'SELLER') return sendTG(chatId, "✅ You are already a verified Seller.");
          userStates.set(userId, { mode: 'APPLY', step: 1, data: {} });
          await sendTG(chatId, "🎨 *Artisan Application*\n\nStep 1: What type of craft do you specialize in?");
          continue;
        }

        // --- COMMAND: /post (Gallery Upload) ---
        if (text === "/post") {
          if (user?.role !== 'SELLER' && user?.role !== 'ADMIN') return sendTG(chatId, "⚠️ Only Verified Sellers can post. Use /apply.");
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "📸 *Gallery Post*\n\nStep 1: Send a photo of your masterpiece.");
          continue;
        }

        // --- HANDLE MULTI-STEP FLOWS ---
        const state = userStates.get(userId);
        if (state) {
          // A. APPLY FLOW
          if (state.mode === 'APPLY') {
            if (state.step === 1 && text) {
              state.data.craft = text; state.step = 2;
              await sendTG(chatId, "📍 Step 2: Workshop location? (City/Region)");
            } else if (state.step === 2 && text) {
              state.data.loc = text; state.step = 3;
              await sendTG(chatId, "📸 Step 3: Send a photo of your work for verification.");
            } else if (state.step === 3 && msg.photo) {
              await sendTG(chatId, "⏳ *Application Submitted!* Admin will review soon.");
              await sendTG(ADMIN_ID, `🔔 *NEW APP*\nUser: @${msg.from.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
              userStates.delete(userId);
            }
          }
          // B. POST FLOW
          else if (state.mode === 'POST') {
            if (state.step === 1 && msg.photo) {
              state.data.image = msg.photo[msg.photo.length - 1].file_id;
              state.step = 2;
              await sendTG(chatId, "💰 Step 2: Price in ETB?");
            } else if (state.step === 2 && text) {
              state.data.price = text; state.step = 3;
              await sendTG(chatId, "📝 Step 3: Short description?");
            } else if (state.step === 3 && text) {
              await pool.query('INSERT INTO posts (user_id, caption, image_url, price) VALUES ($1, $2, $3, $4)', 
                [userId, text, state.data.image, state.data.price]);
              await sendTG(chatId, "✅ *Masterpiece Published!*");
              userStates.delete(userId);
            }
          }
          continue;
        }

        // --- COMMAND: /verify_ID (Admin Only) ---
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTG(targetId, "🎉 Approved! You are now a *Verified Seller*.");
          await sendTG(ADMIN_ID, `✅ User ${targetId} is now a SELLER.`);
          continue;
        }

        // --- COMMAND: /status ---
        if (text === "/status") {
          await sendTG(chatId, `📊 *Profile Status*\nRole: \`${user?.role || 'BUYER'}\`\nTrust: \`${user?.trust_score || 0}\``);
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 6. WEBSITE API ENDPOINTS (MIRROR SYSTEM) ---

// Public Search & Gallery
app.get("/api/gallery", async (req, res) => {
  try {
    const posts = await pool.query('SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.telegram_id ORDER BY created_at DESC');
    res.json(posts.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch gallery" }); }
});

// Login for future dashboard
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (user && user.password_hash && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { username: user.username, role: user.role } });
    } else { res.status(401).json({ error: "Invalid credentials" }); }
  } catch (err) { res.status(500).send("Error"); }
});

// --- 7. SERVER STARTUP ---
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
    console.log(`⭐ WING MASTER ENGINE ONLINE ON PORT ${PORT}`);
  });
}

startServer();