import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();
const app = express();
app.use(express.json());

// --- 1. CONFIGURATION ---
const PORT = process.env.PORT || 10000;
const ADMIN_ID = process.env.ADMIN_ID || "8360912681";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";
const COMMISSION_RATE = 0.05; // 5% Commission

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const userStates = new Map<string, { mode: 'APPLY' | 'POST'; step: number; data: any }>();

// --- 2. DATABASE: THE MARKETPLACE VAULT ---
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username TEXT,
        role TEXT DEFAULT 'BUYER',
        trust_score INTEGER DEFAULT 10,
        is_limited BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wing_masterpieces (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        caption TEXT,
        image_url TEXT,
        price NUMERIC,
        qr_token TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        seller_id BIGINT,
        buyer_id BIGINT,
        post_id INTEGER,
        amount NUMERIC,
        status TEXT DEFAULT 'UNPAID', -- UNPAID, PAID
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS security_logs (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT,
        action TEXT,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Maintenance Patches
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_limited BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
    `);
    console.log("🛡️ WING System: Commission & QR Tables Verified.");
  } catch (err: any) { console.error("❌ DB Init Error:", err.message); }
}

// --- 3. GUARDIAN BOT UTILITIES ---
async function sendTG(chatId: string | number, text: string, keyboard?: any) {
  try {
    const body: any = { chat_id: chatId, text, parse_mode: "Markdown" };
    if (keyboard) body.reply_markup = keyboard;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error("📡 TG Outbound Error"); }
}

async function logFraud(userId: any, action: string, details: string) {
  await pool.query('INSERT INTO security_logs (telegram_id, action, details) VALUES ($1, $2, $3)', [userId, action, details]);
  await sendTG(ADMIN_ID, `🚨 *GUARDIAN ALERT*\nUser: ${userId}\nAction: ${action}\nDetails: ${details}`);
}

// --- 4. THE MASTER ENGINE LOGIC ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`); } catch (e) {}

  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
      const data: any = await response.json();
      if (!data.ok) { await new Promise(r => setTimeout(r, 10000)); continue; }

      for (const update of data.result) {
        offset = update.update_id + 1;
        const msg = update.message || update.callback_query?.message;
        if (!update.message && !update.callback_query) continue;

        const userId = (update.message?.from.id || update.callback_query?.from.id).toString();
        const chatId = (update.message?.chat.id || update.callback_query?.message.chat.id);
        const text = update.message?.text?.trim();

        // 🛡️ USER AUTH & LIMITATION CHECK
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // START COMMAND & DEEP LINKS
        if (text?.startsWith("/start")) {
            const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
            if (!user) await pool.query('INSERT INTO users (telegram_id, username, role) VALUES ($1, $2, $3)', [userId, update.message.from.username, role]);
            
            const payload = text.split(" ")[1];
            // Handle QR Scan Receipt
            if (payload?.startsWith("qr_")) {
                const postId = payload.replace("qr_", "");
                await sendTG(chatId, `🛍️ *Confirm Purchase*\nYou are scanning the QR for Item #${postId}. Did you just buy this item?`, {
                    inline_keyboard: [[{ text: "✅ Yes, I bought it", callback_data: `confirm_buy_${postId}` }]]
                });
                continue;
            }

            await sendTG(chatId, `🦅 *WING Marketplace*\nRole: \`${user?.role || role}\`\n\n/post - Upload Craft\n/apply - Join Alliance\n/status - My Office`);
            continue;
        }

        // HANDLE BUYER CONFIRMATION (Callback)
        if (update.callback_query) {
            const cbData = update.callback_query.data;
            if (cbData.startsWith("confirm_buy_")) {
                const postId = cbData.replace("confirm_buy_", "");
                const postRes = await pool.query('SELECT * FROM wing_masterpieces WHERE id = $1', [postId]);
                const post = postRes.rows[0];

                if (post) {
                    const commission = post.price * COMMISSION_RATE;
                    await pool.query('INSERT INTO commissions (seller_id, buyer_id, post_id, amount) VALUES ($1, $2, $3, $4)', 
                        [post.user_id, userId, postId, commission]);
                    
                    await sendTG(chatId, `✨ *Sale Double-Verified!*\nCommission of ${commission} ETB has been recorded for this craft.`);
                    await sendTG(post.user_id, `💰 *New Sale Confirmed!*\nBuyer @${update.callback_query.from.username} confirmed the purchase of your craft.\nCommission Due: *${commission} ETB*.\n\n⚠️ Pay via /pay to keep your account active.`);
                }
            }
            continue;
        }

        // SELLER LIMITATION ENFORCEMENT
        if (user?.is_limited && (text === "/post" || userStates.has(userId))) {
            return sendTG(chatId, "🚫 *Account Limited*\nYou have unpaid commissions. Access to the Seller Office is restricted until payment is verified.");
        }

        // POSTING FLOW
        if (text === "/post") {
          if (user?.role !== 'SELLER' && user?.role !== 'ADMIN') return sendTG(chatId, "⚠️ Apply via /apply first.");
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "📸 *Gallery Post*\nStep 1: Send a clear photo.");
          continue;
        }

        // MULTI-STEP LOGIC
        const state = userStates.get(userId);
        if (state && state.mode === 'POST') {
            if (state.step === 1 && update.message.photo) {
                state.data.image = update.message.photo[update.message.photo.length - 1].file_id;
                state.step = 2;
                await sendTG(chatId, "💰 *Step 2:* Price in ETB?");
            } else if (state.step === 2) {
                state.data.price = text; state.step = 3;
                await sendTG(chatId, "📝 *Step 3:* One-sentence description.");
            } else if (state.step === 3) {
                const qrToken = `qr_${Date.now()}`;
                const newPost = await pool.query(
                    'INSERT INTO wing_masterpieces (user_id, caption, image_url, price, qr_token) VALUES ($1, $2, $3, $4, $5) RETURNING id', 
                    [userId, text, state.data.image, state.data.price, qrToken]
                );
                const postUrl = `https://t.me/WingArtisanBot?start=qr_${newPost.rows[0].id}`;
                await sendTG(chatId, `✅ *Masterpiece Published!*\n\n🤝 *Real-World Tracking:*\nAsk your buyer to scan this digital receipt at the moment of sale:\n\n\`${postUrl}\``);
                userStates.delete(userId);
            }
            continue;
        }

        // ADMIN COMMANDS
        if (text?.startsWith("/limit_") && userId === ADMIN_ID) {
            const target = text.split("_")[1];
            await pool.query('UPDATE users SET is_limited = TRUE WHERE telegram_id = $1', [target]);
            await sendTG(ADMIN_ID, `🔴 User ${target} is now LIMITED.`);
            await sendTG(target, "⚠️ *Account Restricted:* The Guardian has limited your account due to commission policy.");
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 5. WEBSITE API ---
app.get("/api/gallery", async (req, res) => {
  const gallery = await pool.query('SELECT * FROM wing_masterpieces ORDER BY created_at DESC');
  res.json(gallery.rows);
});

async function startServer() {
  await initDatabase();
  startTelegramBotPolling();
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => { console.log(`⭐ WING HYBRID ENGINE LIVE`); });
}
startServer();