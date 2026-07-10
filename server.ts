import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(express.json());

// --- 1. CONFIGURATION & SECURITY ---
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "wing-secure-secret-2024";
const ADMIN_ID = process.env.ADMIN_ID; // Your TG ID: 8360912681
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";

// Initialize Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. STATE MANAGEMENT (For Multi-step Application) ---
const userStates = new Map<string, { step: number; craft?: string; location?: string }>();

// --- 3. DATABASE INITIALIZATION & PATCHES ---
async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'BUYER', -- ADMIN, SELLER, BUYER
      trust_score INTEGER DEFAULT 0,
      telegram_chat_id TEXT,
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Schema Patches (Ensuring all columns exist)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS craft_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      caption TEXT,
      image_url TEXT,
      category TEXT,
      price TEXT,
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
  `;
  try {
    await pool.query(query);
    console.log("🛡️ Guardian System: PostgreSQL Tables Verified & Patched.");
  } catch (err) {
    console.error("❌ DB Init Error:", err);
  }
}

// --- 4. GUARDIAN LOGGING ---
async function logGuardianEvent(type: string, details: any, severity: string = "INFO") {
  try {
    await pool.query(
      'INSERT INTO security_logs (telegram_id, action, details, severity) VALUES ($1, $2, $3, $4)',
      [details.userId || "SYSTEM", type, JSON.stringify(details), severity]
    );
  } catch (err) { console.error("Logging Failed"); }
}

// --- 5. TELEGRAM UTILITIES ---
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

// --- 6. TELEGRAM BOT ENGINE (GATEKEEPER + AI MENTOR) ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;

  // Clear webhooks to wake up the bot
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  console.log(`🤖 WING Gatekeeper active. Monitoring Trust Layer...`);
  
  let offset = 0;
  const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");
  const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        // Check user in DB
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // --- COMMAND: /start ---
        if (text === "/start") {
          const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
          if (!user) {
            await pool.query('INSERT INTO users (telegram_id, username, role, telegram_chat_id) VALUES ($1, $2, $3, $4)', 
            [userId, msg.from.username || 'Artisan', role, chatId.toString()]);
          }
          await sendTelegramMessage(chatId, `👋 *Welcome to WING!*\n\nRole: \`${user?.role || role}\`\nStatus: Verified ✅\n\n*Commands:*\n/apply - Join as a Seller\n/ask [question] - AI Mentor\n/status - Profile info`);
          continue;
        }

        // --- COMMAND: /ask (Gemini AI Mentor) ---
        if (text?.startsWith("/ask ")) {
          const prompt = text.replace("/ask ", "");
          await sendTelegramMessage(chatId, "💡 *Wing Guide is analyzing...*");
          try {
            const result = await aiModel.generateContent(`You are Wing Guide, a business mentor for Ethiopian artisans. Answer this: ${prompt}`);
            await sendTelegramMessage(chatId, `📖 *Artisan Advice:*\n\n${result.response.text()}`);
          } catch (e) { await sendTelegramMessage(chatId, "⚠️ AI Mentor is resting. Try again later."); }
          continue;
        }

        // --- COMMAND: /apply (Gatekeeper Start) ---
        if (text === "/apply") {
          if (user?.role === 'SELLER') return sendTelegramMessage(chatId, "✅ You are already a verified Seller.");
          userStates.set(userId, { step: 1 });
          await sendTelegramMessage(chatId, "🎨 *Artisan Application: Step 1*\n\nWhat kind of traditional craft do you specialize in? (e.g. Weaving, Pottery, Leatherwork)");
          continue;
        }

        // --- HANDLE APPLICATION STEPS ---
        const state = userStates.get(userId);
        if (state) {
          if (state.step === 1 && text) {
            state.craft = text;
            state.step = 2;
            await sendTelegramMessage(chatId, "📍 *Step 2*\n\nWhere is your workshop located? (City/Region)");
          } 
          else if (state.step === 2 && text) {
            state.location = text;
            state.step = 3;
            await sendTelegramMessage(chatId, "📸 *Step 3*\n\nPlease send a photo of your work or your workshop for verification.");
          } 
          else if (state.step === 3 && msg.photo) {
            await sendTelegramMessage(chatId, "⏳ *Application Submitted!*\n\nThe Guardian Admin will review your craft. You will be notified of the result.");
            
            // Notify you (The ADMIN)
            await sendTelegramMessage(ADMIN_ID, `🔔 *NEW ARTISAN APPLICATION*\n\n👤 User: @${msg.from.username}\n🎨 Craft: ${state.craft}\n📍 Location: ${state.location}\n\nTo verify this user, type:\n/verify_${userId}`);
            
            // Save draft info to DB
            await pool.query('UPDATE users SET craft_type = $1, location = $2 WHERE telegram_id = $3', [state.craft, state.location, userId]);
            userStates.delete(userId);
          }
          continue;
        }

        // --- COMMAND: /verify_ID (Admin Approval) ---
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const targetId = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [targetId]);
          await sendTelegramMessage(targetId, "🎉 *CONGRATULATIONS!*\n\nYour artisan application has been approved. You are now a *Verified WING Seller*.");
          await sendTelegramMessage(ADMIN_ID, `✅ User ${targetId} successfully promoted to SELLER.`);
          continue;
        }

        // --- COMMAND: /status ---
        if (text === "/status") {
          await sendTelegramMessage(chatId, `📊 *WING Status*\n\nUser ID: \`${userId}\`\nRole: \`${user?.role || 'BUYER'}\`\nTrust Score: \`${user?.trust_score || 0}\``);
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 7. API ENDPOINTS ---
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (user && user.password_hash && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
      res.json({ accessToken: token, user });
    } else { res.status(401).json({ error: "Invalid credentials" }); }
  } catch (err) { res.status(500).send("Server Error"); }
});

// --- 8. STARTUP ---
async function startServer() {
  await initDatabase();
  startTelegramBotPolling();
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => { console.log(`⭐ WING ENGINE LIVE ON PORT ${PORT}`); });
}

startServer();