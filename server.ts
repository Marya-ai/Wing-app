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
const COMMISSION_RATE = 0.05; // 5%
const NODE_ENV = process.env.NODE_ENV || 'development';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Memory State for Bot Flows
const userStates = new Map<string, { mode: 'APPLY' | 'POST'; step: number; data: any }>();

// --- 2. DATABASE INITIALIZATION (The Marketplace Vault) ---
async function initDatabase() {
  const query = `
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
      qr_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id SERIAL PRIMARY KEY,
      seller_id BIGINT,
      buyer_id BIGINT,
      post_id INTEGER,
      amount NUMERIC,
      status TEXT DEFAULT 'UNPAID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure BIGINT for large Telegram IDs
    ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
    ALTER TABLE wing_masterpieces ALTER COLUMN user_id TYPE BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_limited BOOLEAN DEFAULT FALSE;
  `;
  try {
    await pool.query(query);
    console.log("🛡️ Database Patched: BIGINT and Commission tables ready.");
  } catch (err: any) { console.error("❌ DB Init Error:", err.message); }
}

// --- 3. TELEGRAM UTILITIES ---
async function sendTG(chatId: string | number, text: string, keyboard?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: "Markdown" };
  if (keyboard) body.reply_markup = keyboard;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error(" TG Send Error"); }
}

// --- 4. THE MASTER TELEGRAM ENGINE (Marketplace Logic) ---
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
        const userObj = update.message?.from || update.callback_query?.from;
        if (!userObj) continue;

        const userId = userObj.id.toString();
        const chatId = msg.chat.id;
        const text = update.message?.text?.trim();

        // 🛡️ AUTHENTICATION
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // START & QR DEEP LINKS
        if (text?.startsWith("/start")) {
            const role = (userId === ADMIN_ID) ? 'ADMIN' : (user?.role || 'BUYER');
            if (!user) await pool.query('INSERT INTO users (telegram_id, username, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, userObj.username, role]);
            
            const payload = text.split(" ")[1];
            if (payload?.startsWith("qr_")) {
                const postId = payload.replace("qr_", "");
                await sendTG(chatId, `🛍️ *Confirm Purchase*\nDid you just buy Item #${postId}?`, {
                    inline_keyboard: [[{ text: "✅ Yes, I Confirm", callback_data: `confirm_buy_${postId}` }]]
                });
                continue;
            }

            await sendTG(chatId, `🦅 *WING Marketplace*\nRole: \`${role}\` \n/post - Upload\n/apply - Join\n/reset - Fix session`);
            continue;
        }

        // BUYER CONFIRMATION (COMMISSION CREATION)
        if (update.callback_query) {
            const cbData = update.callback_query.data;
            if (cbData.startsWith("confirm_buy_")) {
                const postId = cbData.replace("confirm_buy_", "");
                const postRes = await pool.query('SELECT * FROM wing_masterpieces WHERE id = $1', [postId]);
                const post = postRes.rows[0];
                if (post) {
                    const commission = parseFloat(post.price) * COMMISSION_RATE;
                    await pool.query('INSERT INTO commissions (seller_id, buyer_id, post_id, amount) VALUES ($1, $2, $3, $4)', [post.user_id, userId, postId, commission]);
                    await sendTG(chatId, `✨ *Sale Verified!* Thank you.`);
                    await sendTG(post.user_id, `💰 *New Sale!* Commission of ${commission} ETB recorded.`);
                }
            }
            continue;
        }

        if (text === "/reset") { userStates.delete(userId); await sendTG(chatId, " Session reset."); continue; }

        // POSTING FLOW
        if (text === "/post") {
          if (user?.role !== 'SELLER' && user?.role !== 'ADMIN') return sendTG(chatId, "⚠️ Apply via /apply first.");
          if (user?.is_limited) return sendTG(chatId, "🚫 Account limited due to unpaid commission.");
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, " *Gallery Post*\nStep 1: Send a clear photo.");
          continue;
        }

        const state = userStates.get(userId);
        if (state && state.mode === 'POST') {
            if (state.step === 1 && update.message.photo) {
                state.data.image = update.message.photo[update.message.photo.length - 1].file_id;
                state.step = 2; await sendTG(chatId, "💰 *Step 2:* Price in ETB?");
            } else if (state.step === 2) {
                state.data.price = text; state.step = 3;
                await sendTG(chatId, "📝 *Step 3:* Short description.");
            } else if (state.step === 3 && text) {
                try {
                    const postRes = await pool.query('INSERT INTO wing_masterpieces (user_id, caption, image_url, price) VALUES ($1, $2, $3, $4) RETURNING id', [BigInt(userId), text, state.data.image, state.data.price]);
                    const link = `https://t.me/WingArtisanBot?start=qr_${postRes.rows[0].id}`;
                    await sendTG(chatId, `✅ *Published!*\nReceipt Link: \`${link}\``);
                    userStates.delete(userId);
                } catch (e: any) { await sendTG(chatId, `❌ DB Error: ${e.message}`); }
            }
            continue;
        }

        // ARTISAN APPLY
        if (text === "/apply") {
          userStates.set(userId, { mode: 'APPLY', step: 1, data: {} });
          await sendTG(chatId, "🎨 *Application*\nWhat craft do you make?");
          continue;
        }
        if (state && state.mode === 'APPLY') {
            if (state.step === 1) { state.data.craft = text; state.step = 2; await sendTG(chatId, "📍 Workshop location?"); }
            else if (state.step === 2) { state.data.loc = text; state.step = 3; await sendTG(chatId, "📸 Send a photo of your work."); }
            else if (state.step === 3 && update.message.photo) {
              await sendTG(chatId, "⏳ Application submitted!");
              await sendTG(ADMIN_ID, ` *NEW APP* from @${userObj.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
              userStates.delete(userId);
            }
            continue;
        }

        // ADMIN VERIFY
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const target = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'SELLER' WHERE telegram_id = $1", [target]);
          await sendTG(target, "🎉 Verified! You can now use /post.");
          await sendTG(ADMIN_ID, `✅ User ${target} promoted.`);
        }
      }
    } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

// --- 5. SERVER STARTUP & STATIC FILE SERVING (FIXES BLACK SCREEN) ---
async function startServer() {
  await initDatabase();
  startTelegramBotPolling();

  const distPath = path.join(process.cwd(), 'dist');
  
  // Serve static files FIRST (before catch-all route)
  app.use(express.static(distPath, {
    index: 'index.html',
    extensions: ['html', 'htm']
  }));

  // API routes for the dashboard (add these if needed)
  app.get('/api/user/:telegramId', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [req.params.telegramId]);
      res.json(result.rows[0] || null);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Catch-all route MUST come after static files
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⭐ WING HYBRID ENGINE LIVE ON PORT ${PORT}`);
    console.log(`📁 Serving static files from: ${distPath}`);
  });
}

startServer();