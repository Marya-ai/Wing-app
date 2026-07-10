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

// --- 2. STATE MANAGEMENT (Memory for Bot Flows) ---
const userStates = new Map<string, { 
  mode: 'APPLY' | 'POST'; 
  step: number; 
  data: any 
}>();

// --- 3. DATABASE INITIALIZATION (With Auto-Patches) ---
async function initDatabase() {
  const query = `
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
      telegram_chat_id TEXT,
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      caption TEXT,
      image_url TEXT,
      price TEXT,
      category TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS security_logs (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT,
      action TEXT,
      details JSONB,
      severity TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure all columns exist for existing databases
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'BUYER';
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS price TEXT;
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
  
  // Reset Webhook to enable Polling
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  // AI Mentor Initialization (Safe-Start)
  let aiModel: any = null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (e) { console.error("⚠️ AI Mentor foundation ready (Key pending)."); }

  console.log(`🤖 WING Master Engine Active. Token: ${TELEGRAM_TOKEN.substring(0, 7)}...`);
  
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

        // 🛡️ AUTHENTICATION / REGISTRATION
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) {
            await pool.query('INSERT INTO users (telegram_id, username, role, telegram_chat_id) VALUES ($1, $2, $3, $4)', 
            [userId, msg.from.username || 'Artisan', role, chatId.toString()]);
          }
          await sendTG(chatId, `🦅 *Welcome to WING Artisan Alliance*\n\nYour Role: \`${user?.role || role}\` \nStatus: Verified ✅\n\n/apply - Become a Seller\n/post - Upload Craft\n/status - My Profile\n/ask - AI Mentor`);
          continue;
        }

        // 🎨 ARTISAN ONBOARDING (/apply)
        if (text === "/apply") {
          if (user?.role === 'SELLER') return sendTG(chatId, "✅ You are already a verified Seller.");
          userStates.set(userId, { mode: 'APPLY', step: 1, data: {} });
          await sendTG(chatId, "🎨 *Artisan Application*\nStep 1: What do you make? (e.g., Crochet, Jewelry)");
          continue;
        }

        // 📸 PRODUCT POSTING (/post)
        if (text === "/post") {
          if (user?.role !== 'SELLER' && user?.role !== 'ADMIN') return sendTG(chatId, "⚠️ Only Verified Sellers can post. Use /apply.");
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "📸 *Gallery Post*\nStep 1: Send a clear photo of your masterpiece.");
          continue;
        }

        // 💡 AI MENTOR (/ask)
        if (text?.startsWith("/ask ")) {
          const prompt = text.replace("/ask ", "");
          await sendTG(chatId, "💡 *Wing Guide is thinking...*");
          try {
            const result = await aiModel.generateContent(prompt);
            await sendTG(chatId, `📖 *Artisan Advice:*\n\n${result.response.text()}`);
          } catch (e) { await sendTG(chatId, "⚠️ AI is currently busy. Please try again later."); }
          continue;
        }

        // ⚙️ HANDLE MULTI-STEP CONVERSATIONS
        const state = userStates.get(userId);
        if (state) {
          // POST FLOW
          if (state.mode === 'POST') {
            if (state.step === 1 && msg.photo) {
              state.data.image = msg.photo[msg.photo.length - 1].file_id;
              state.step = 2;
              await sendTG(chatId, "💰 Step 2: Price in ETB?");
            } else if (state.step === 2) {
              state.data.price = text;
              state.step = 3;
              await sendTG(chatId, "📝 Step 3: Short description?");
            } else if (state.step === 3) {
              try {
                await pool.query('INSERT INTO posts (user_id, caption, image_url, price) VALUES ($1, $2, $3, $4)', 
                [userId, text, state.data.image, state.data.price]);
                await sendTG(chatId, "✅ *Masterpiece Published!*\nView it here: https://wing-artisan-bot.onrender.com/api/gallery");
                userStates.delete(userId);
              } catch (err) { console.error("Post Insert Failed", err); }
            }
          }
          // APPLY FLOW
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

        // 🛡️ ADMIN COMMANDS
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTG(targetId, "🎉 Approved! You are now a *Verified WING Seller*.");
          await sendTG(ADMIN_ID, `✅ User ${targetId} promoted.`);
        }

        if (text === "/status") {
          await sendTG(chatId, `📊 *Profile Status*\nRole: \`${user?.role || 'BUYER'}\`\nTrust: \`${user?.trust_score || 0}\``);
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 6. WEBSITE API ENDPOINTS ---

// The Pinterest-style Gallery Data
app.get("/api/gallery", async (req, res) => {
  try {
    const posts = await pool.query(`
      SELECT posts.*, users.username 
      FROM posts 
      LEFT JOIN users ON posts.user_id = users.telegram_id 
      ORDER BY created_at DESC
    `);
    res.json(posts.rows);
  } catch (err) { res.status(500).json([]); }
});

// Admin Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (user && user.password_hash && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { username: user.username, role: user.role } });
    } else { res.status(401).json({ error: "Invalid" }); }
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