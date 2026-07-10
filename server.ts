import express from "express";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';

const { Pool } = pkg;
dotenv.config();

const app = express();
app.use(express.json());

// --- 1. CONFIGURATION ---
const PORT = process.env.PORT || 10000;
const ADMIN_ID = process.env.ADMIN_ID || "8360912681";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";
const JWT_SECRET = process.env.JWT_SECRET || "wing-secret-key-change-in-production";
const NODE_ENV = process.env.NODE_ENV || 'development';

// Email Transporter Setup
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Rate Limiter for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: "Too many authentication attempts. Please try again later." }
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
      email TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'BUYER',
      business_scale TEXT DEFAULT 'small',
      trust_score INTEGER DEFAULT 10,
      is_limited BOOLEAN DEFAULT FALSE,
      is_verified BOOLEAN DEFAULT FALSE,
      reset_token TEXT,
      reset_token_expiry TIMESTAMP,
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
    ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT USING telegram_id::BIGINT;
    ALTER TABLE wing_masterpieces ALTER COLUMN user_id TYPE BIGINT USING user_id::BIGINT;
    
    -- Add missing columns if they don't exist
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_scale TEXT DEFAULT 'small';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
  `;
  try {
    await pool.query(query);
    console.log("🛡️ Database Patched: Auth & Commission tables ready.");
  } catch (err: any) { console.error("❌ DB Init Error:", err.message); }
}

// --- 3. AUTHENTICATION API ENDPOINTS ---

// REGISTER
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, full_name, telegram_id, role, business_scale, tg_wallet, tiktok } = req.body;
    
    // Validate required fields
    if (!email || !password || !telegram_id) {
      return res.status(400).json({ error: "Email, password, and Telegram ID are required" });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1 OR telegram_id = $2', [email, telegram_id]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "User with this email or Telegram ID already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Generate verification token
    const verifyToken = jwt.sign({ email, type: 'verify' }, JWT_SECRET, { expiresIn: '24h' });
    const verifyLink = `${process.env.FRONTEND_URL || 'https://wing-artisan-bot.onrender.com'}/verify?token=${verifyToken}`;

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, telegram_id, role, business_scale, trust_score) 
       VALUES ($1, $2, $3, $4, $5, $6, 10) RETURNING id, email, telegram_id, role, business_scale, trust_score`,
      [email, password_hash, full_name, telegram_id, role || 'buyer', business_scale || 'small']
    );

    // Send verification email
    await transporter.sendMail({
      from: `"Wing Artisan Alliance" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Wing Account",
      html: `<p>Welcome to Wing! Click below to verify your email:</p>
             <a href="${verifyLink}" style="background:#E07A5F;color:white;padding:12px 24px;border-radius:24px;text-decoration:none;display:inline-block;margin-top:10px;">Verify Email</a>
             <p>This link expires in 24 hours.</p>`
    });

    res.status(201).json({ 
      message: "Registration successful. Please verify your email.",
      user: result.rows[0]
    });

  } catch (err: any) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// LOGIN
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: "Please verify your email first" });
    }

    const token = jwt.sign(
      { id: user.id, telegram_id: user.telegram_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        telegram_id: user.telegram_id,
        role: user.role,
        business_scale: user.business_scale,
        trust_score: user.trust_score,
        is_limited: user.is_limited
      }
    });

  } catch (err: any) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: "If an account exists, a reset link has been sent." });

    const resetToken = jwt.sign({ id: user.id, type: 'reset' }, JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${process.env.FRONTEND_URL || 'https://wing-artisan-bot.onrender.com'}/reset-password?token=${resetToken}`;

    await pool.query('UPDATE users SET reset_token = $1, reset_token_expiry = NOW() + INTERVAL \'1 hour\' WHERE id = $2', [resetToken, user.id]);

    await transporter.sendMail({
      from: `"Wing Artisan Alliance" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Wing Password",
      html: `<p>Click below to reset your password:</p>
             <a href="${resetLink}" style="background:#E07A5F;color:white;padding:12px 24px;border-radius:24px;text-decoration:none;display:inline-block;margin-top:10px;">Reset Password</a>
             <p>This link expires in 1 hour.</p>`
    });

    res.json({ message: "If an account exists, a reset link has been sent." });

  } catch (err: any) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as { id: number; type: string };
    } catch {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (payload.type !== 'reset') return res.status(400).json({ error: "Invalid token type" });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2', [password_hash, payload.id]);

    res.json({ message: "Password reset successful" });

  } catch (err: any) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: "Password reset failed" });
  }
});

// EMAIL VERIFICATION
app.get('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Token required" });

    let payload;
    try {
      payload = jwt.verify(token as string, JWT_SECRET) as { email: string; type: string };
    } catch {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (payload.type !== 'verify') return res.status(400).json({ error: "Invalid token type" });

    await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [payload.email]);

    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL || 'https://wing-artisan-bot.onrender.com'}/verified`);

  } catch (err: any) {
    console.error("Verification Error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// --- 4. TELEGRAM UTILITIES ---
async function sendTG(chatId: string | number, text: string, keyboard?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: "Markdown" };
  if (keyboard) body.reply_markup = keyboard;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error("📡 TG Send Error"); }
}

// --- 5. THE MASTER TELEGRAM ENGINE (Marketplace Logic) ---
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
            if (!user) {
              await pool.query(
                'INSERT INTO users (telegram_id, username, role, trust_score) VALUES ($1, $2, $3, 10) ON CONFLICT DO NOTHING', 
                [userId, userObj.username, role]
              );
            }
            
            const payload = text.split(" ")[1];
            if (payload?.startsWith("qr_")) {
                const postId = payload.replace("qr_", "");
                await sendTG(chatId, `🛍️ *Confirm Purchase*\nDid you just buy Item #${postId}?`, {
                    inline_keyboard: [[{ text: "✅ Yes, I Confirm", callback_data: `confirm_buy_${postId}` }]]
                });
                continue;
            }

            // Generate web app link with TG ID for auth binding
            const webAppUrl = `https://wing-artisan-bot.onrender.com/?tg_id=${userId}`;
            await sendTG(chatId, `🦅 *WING Marketplace*\nRole: \`${role}\` \n/post - Upload\n/apply - Join\n/reset - Fix session\n\n🌐 Open Dashboard: ${webAppUrl}`);
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
                    // Get seller's commission rate based on business scale
                    const sellerRes = await pool.query('SELECT business_scale FROM users WHERE telegram_id = $1', [post.user_id]);
                    const sellerScale = sellerRes.rows[0]?.business_scale || 'small';
                    const rate = sellerScale === 'small' ? 0.10 : sellerScale === 'medium' ? 0.15 : 0.25;
                    
                    const commission = parseFloat(post.price) * rate;
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
              await sendTG(ADMIN_ID, `🔔 *NEW APP* from @${userObj.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
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

// --- 6. SERVER STARTUP & STATIC FILE SERVING ---
async function startServer() {
  await initDatabase();
  startTelegramBotPolling();

  const distPath = path.join(process.cwd(), 'dist');
  
  // Serve static files FIRST (before catch-all route)
  app.use(express.static(distPath, {
    index: 'index.html',
    extensions: ['html', 'htm']
  }));

  // API routes for the dashboard
  app.get('/api/user/:telegramId', async (req, res) => {
    try {
      const result = await pool.query('SELECT id, telegram_id, username, role, trust_score, is_limited, business_scale FROM users WHERE telegram_id = $1', [req.params.telegramId]);
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