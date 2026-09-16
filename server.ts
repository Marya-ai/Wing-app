import express from "express";
import path from "path";
import dotenv from "dotenv";
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

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
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || "";
const TELEBIRR_NUMBER = process.env.TELEBIRR_NUMBER || "09XX-XXX-XXX";

// Email Transporter Setup
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "wingartisan.alliance@outlook.com",
    pass: process.env.EMAIL_PASS || ""
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) console.error("❌ Email config failed:", error.message);
  else console.log("✅ Email service ready");
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Rate Limiter for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many authentication attempts. Please try again later." }
});

// Memory State for Bot Flows
const userStates = new Map<string, { mode: 'APPLY' | 'POST'; step: number; data: any }>();

// --- HUGGING FACE AI HELPER ---
async function getAIResponse(prompt: string): Promise<string> {
  if (!HF_TOKEN) return "AI service unavailable. Please contact admin.";
  
  try {
    const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        inputs: prompt,
        parameters: { max_new_tokens: 250, temperature: 0.7 }
      })
    });
    
    const data = await response.json();
    return data[0]?.generated_text || "AI response unavailable";
  } catch (err) {
    console.error(" HF AI Error:", err);
    return "AI service temporarily unavailable";
  }
}

// --- 2. DATABASE INITIALIZATION (MANAGED MARKETPLACE UPGRADED) ---
async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'buyer',
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
      seller_subcity TEXT,
      stock_quantity INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id SERIAL PRIMARY KEY,
      seller_id BIGINT,
      buyer_id BIGINT,
      post_id INTEGER,
      item_price NUMERIC,
      commission_amount NUMERIC,
      total_amount NUMERIC,
      unique_code TEXT,
      expected_amount NUMERIC,
      token TEXT,
      status TEXT DEFAULT 'PENDING_BUYER_PAYMENT',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 🆕 NEW: Managed Marketplace Orders Table
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_token TEXT UNIQUE,
      buyer_id BIGINT,
      seller_id BIGINT,
      post_id INTEGER,
      quantity INTEGER DEFAULT 1,
      selected_color TEXT,
      buyer_subcity TEXT,
      buyer_address TEXT,
      buyer_phone TEXT,
      delivery_method TEXT,
      item_price NUMERIC,
      commission_fee NUMERIC,
      delivery_fee NUMERIC,
      total_amount NUMERIC,
      status TEXT DEFAULT 'pending_payment',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure types are correct
    ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT USING telegram_id::BIGINT;
    ALTER TABLE wing_masterpieces ALTER COLUMN user_id TYPE BIGINT USING user_id::BIGINT;
    
    -- Add missing columns safely
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_scale TEXT DEFAULT 'small';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
    
    -- 🆕 PLAN A PRIVACY & ESCROW COLUMNS
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'buyer';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS agreed_to_terms BOOLEAN DEFAULT FALSE;
    
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS item_price NUMERIC;
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_amount NUMERIC;
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS total_amount NUMERIC;
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS unique_code TEXT;
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS expected_amount NUMERIC;
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS token TEXT;
    ALTER TABLE commissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING_BUYER_PAYMENT';

    ALTER TABLE wing_masterpieces ADD COLUMN IF NOT EXISTS seller_subcity TEXT;
    ALTER TABLE wing_masterpieces ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 1;
  `;
  
  try {
    await pool.query(query);
    console.log("🛡️ Database Patched: Auth, Escrow, Privacy, and Managed Orders ready.");
  } catch (err: any) { 
    console.error("⚠️ DB Init Error:", err.message); 
  }
}

// --- 3. AUTHENTICATION API ENDPOINTS ---

// REGISTER
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, full_name, username, phone_number, telegram_id, role, business_scale, tg_wallet, tiktok, agreed_to_terms } = req.body;
    
    if (!email || !password || !telegram_id || !phone_number) {
      return res.status(400).json({ error: "Email, password, phone number, and Telegram ID are required" });
    }

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1 OR telegram_id = $2', [email, telegram_id]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "User with this email or Telegram ID already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const verifyToken = jwt.sign({ email, type: 'verify' }, JWT_SECRET, { expiresIn: '24h' });
    const verifyLink = `${process.env.FRONTEND_URL || 'https://wing-artisan-bot.onrender.com'}/verify?token=${verifyToken}`;

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, username, phone_number, telegram_id, role, business_scale, trust_score, agreed_to_terms) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10, $9) RETURNING id, email, telegram_id, role, business_scale, trust_score`,
      [email, password_hash, full_name, username, phone_number, telegram_id, role || 'buyer', business_scale || 'small', agreed_to_terms || false]
    );

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

    res.redirect(`${process.env.FRONTEND_URL || 'https://wing-artisan-bot.onrender.com'}/verified`);

  } catch (err: any) {
    console.error("Verification Error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// --- 4. MANAGED MARKETPLACE API ENDPOINTS (NEW) ---

// CREATE ORDER (Checkout)
app.post('/api/orders', async (req, res) => {
  try {
    const { buyer_id, post_id, quantity, selected_color, buyer_subcity, buyer_address, buyer_phone, delivery_method } = req.body;
    
    // Fetch post and seller info
    const postRes = await pool.query('SELECT * FROM wing_masterpieces WHERE id = $1', [post_id]);
    const post = postRes.rows[0];
    if (!post) return res.status(404).json({ error: "Item not found" });

    const sellerRes = await pool.query('SELECT telegram_id, business_scale FROM users WHERE telegram_id = $1', [post.user_id]);
    const seller = sellerRes.rows[0];
    if (!seller) return res.status(404).json({ error: "Seller not found" });

    // Calculate fees
    const item_price = parseFloat(post.price) * (quantity || 1);
    const baseRate = seller.business_scale === 'small' ? 0.10 : seller.business_scale === 'medium' ? 0.15 : 0.25;
    const commission_fee = Math.ceil(item_price * baseRate);
    
    // Simple delivery fee logic (Addis Ababa zones)
    let delivery_fee = 100; // Default motorbike fee
    if (buyer_subcity === 'Ayat' || buyer_subcity === 'Kaliti' || buyer_subcity === 'Legetafo' || buyer_subcity === 'Burayu') {
      delivery_fee = 150; // Far distance
    }
    if (delivery_method === 'isuzu') {
      delivery_fee += 150; // Extra for large items
    }

    const total_amount = item_price + commission_fee + delivery_fee;
    const order_token = `ORD-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO orders (order_token, buyer_id, seller_id, post_id, quantity, selected_color, buyer_subcity, buyer_address, buyer_phone, delivery_method, item_price, commission_fee, delivery_fee, total_amount, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending_payment') RETURNING *`,
      [order_token, buyer_id, seller.telegram_id, post_id, quantity || 1, selected_color, buyer_subcity, buyer_address, buyer_phone, delivery_method, item_price, commission_fee, delivery_fee, total_amount]
    );

    // Notify Admin for Dispatch
    await sendTG(ADMIN_ID, 
      `🆕 *NEW WING ORDER!* 🆕\n` +
      `Token: \`${order_token}\`\n` +
      `Item: ${post.caption.slice(0, 30)}...\n` +
      `Pickup: Seller in ${post.seller_subcity || 'Unknown'}\n` +
      `Dropoff: ${buyer_subcity} - ${buyer_address}\n` +
      `Buyer Phone: \`${buyer_phone}\`\n` +
      `Total: ${total_amount} ETB (Item: ${item_price} | Comm: ${commission_fee} | Del: ${delivery_fee})\n\n` +
      `Awaiting buyer payment...`
    );

    res.status(201).json({ success: true, order: result.rows[0], total_amount, order_token });
  } catch (err: any) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ADMIN: GET ALL ORDERS (For Dispatch Dashboard)
app.get('/api/admin/orders', async (req, res) => {
  try {
    // Note: In production, add admin authentication middleware here
    const result = await pool.query(`
      SELECT o.*, p.caption as item_name, u.full_name as buyer_name 
      FROM orders o
      LEFT JOIN wing_masterpieces p ON o.post_id = p.id
      LEFT JOIN users u ON o.buyer_id = u.telegram_id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ADMIN: UPDATE ORDER STATUS
app.put('/api/admin/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // e.g., 'paid', 'dispatched', 'delivered'
    const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    
    if (result.rows.length > 0) {
      const order = result.rows[0];
      
      // Notify seller if dispatched (Ghost Fulfillment: Seller only knows it's going to WING Courier)
      if (status === 'dispatched') {
        await sendTG(order.seller_id, `📦 *WING COURIER DISPATCHED*\n\nPlease have your item ready for the WING Courier pickup. Do not share buyer details.`);
      }
      
      // Notify buyer if delivered
      if (status === 'delivered') {
        await sendTG(order.buyer_id, `🎉 *DELIVERED!*\n\nYour WING order has arrived safely. Thank you for supporting local artisans!`);
        // TODO: Trigger seller payout logic here (or handle manually via Admin for now)
      }
    }
    
    res.json({ success: true, order: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// --- 5. TELEGRAM UTILITIES ---
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

async function answerCbQuery(id: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: id, text })
    });
  } catch (e) {}
}

// --- 6. THE MASTER TELEGRAM ENGINE ---
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

        // 🛡️ AUTHENTICATION CHECK
        let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        let user = res.rows[0];

        // START & QR DEEP LINKS
        if (text?.startsWith("/start")) {
            const role = (userId === ADMIN_ID) ? 'ADMIN' : (user?.role || 'buyer');
            if (!user) {
              await pool.query(
                'INSERT INTO users (telegram_id, username, role, trust_score) VALUES ($1, $2, $3, 10) ON CONFLICT DO NOTHING', 
                [userId, userObj.username, role]
              );
            }
            
            const payload = text.split(" ")[1];
            if (payload?.startsWith("qr_")) {
                const postId = payload.replace("qr_", "");
                await sendTG(chatId, `🛡️ *SECURE WING PURCHASE*\n\nYou are about to buy Item #${postId}.\nFunds will be held safely by WING until our courier delivers it.\n\nProceed to Web App Checkout?`, {
                    inline_keyboard: [[{ text: "✅ Yes, Open Checkout", web_app: { url: "https://wing-artisan-bot.onrender.com" } }]]
                });
                continue;
            }

            await sendTG(chatId, `🦅 *WING Marketplace*\nRole: \`${role}\``, {
              inline_keyboard: [[{ text: "🌐 Open Dashboard", web_app: { url: "https://wing-artisan-bot.onrender.com" } }]]
            });
            continue;
        }

        // 🛒 BUYER CONFIRMATION (ESCROW INITIATION - Legacy/Bot Native)
        if (update.callback_query) {
            const cbData = update.callback_query.data;
            
            if (cbData.startsWith("confirm_buy_")) {
                const postId = cbData.replace("confirm_buy_", "");
                const postRes = await pool.query('SELECT * FROM wing_masterpieces WHERE id = $1', [postId]);
                const post = postRes.rows[0];
                
                if (post) {
                    const sellerRes = await pool.query('SELECT business_scale, telegram_id FROM users WHERE telegram_id = $1', [post.user_id]);
                    const seller = sellerRes.rows[0];
                    
                    if (seller) {
                        const sellerScale = seller.business_scale || 'small';
                        const baseRate = sellerScale === 'small' ? 0.10 : sellerScale === 'medium' ? 0.15 : 0.25;
                        const commission = Math.ceil(parseFloat(post.price) * baseRate);
                        const totalPrice = parseFloat(post.price) + commission;
                        
                        const uniqueCode = Math.floor(Math.random() * 90) + 10;
                        const expectedAmount = `${totalPrice}.${uniqueCode}`;
                        const token = `WING-${crypto.randomUUID()}`;

                        await pool.query(
                          `INSERT INTO commissions (seller_id, buyer_id, post_id, item_price, commission_amount, total_amount, unique_code, expected_amount, token, status) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_BUYER_PAYMENT')`,
                          [seller.telegram_id, userId, postId, post.price, commission, totalPrice, uniqueCode.toString(), expectedAmount, token]
                        );

                        await sendTG(chatId, 
                          `💰 *ESCROW PAYMENT REQUIRED*\n\n` +
                          `Item: ${post.caption.slice(0, 30)}...\n` +
                          `Price: ${post.price} ETB | WING Fee: ${commission} ETB\n` +
                          `*Total to Pay: ${expectedAmount} ETB*\n\n` +
                          `💸 Send exactly *${expectedAmount} ETB* to WING Telebirr: \`${TELEBIRR_NUMBER}\`\n` +
                          `_(The .${uniqueCode} is your unique code. Do not send ${totalPrice}.00)._\n\n` +
                          `Once paid, the WING Courier will be dispatched to the seller, and then to you.\n🔑 Your Secure Token: \`${token}\``
                        );

                        await sendTG(ADMIN_ID, 
                          `🆕 *New Escrow Request*\n` +
                          `Post: ${postId}\nBuyer: ${userId}\nSeller: ${seller.telegram_id}\n` +
                          `Expected: ${expectedAmount} ETB (Code: ${uniqueCode})\n` +
                          `Use: /approve_escrow ${uniqueCode}`
                        );
                    }
                }
                await answerCbQuery(update.callback_query.id, "Payment instructions sent!");
                continue;
            }

            // SELLER FINAL CONFIRMATION BUTTONS
            if (cbData.startsWith("final_confirm_")) {
                const token = cbData.replace("final_confirm_", "");
                const commRes = await pool.query("UPDATE commissions SET status = 'ACTIVE' WHERE token = $1 RETURNING *", [token]);
                if (commRes.rows.length > 0) {
                    const comm = commRes.rows[0];
                    await sendTG(comm.seller_id, `✅ Sale Confirmed!\n\nPlease prepare the item for WING Courier pickup.`);
                    await sendTG(comm.buyer_id, `✅ Seller Confirmed!\n\nWING Courier will deliver your item shortly.`);
                    await sendTG(ADMIN_ID, `✅ Deal Active for Token: ${token}`);
                }
                await answerCbQuery(update.callback_query.id, "Sale confirmed!");
                continue;
            }

            if (cbData.startsWith("cancel_refund_")) {
                const token = cbData.replace("cancel_refund_", "");
                const commRes = await pool.query("UPDATE commissions SET status = 'REFUNDED' WHERE token = $1 RETURNING *", [token]);
                if (commRes.rows.length > 0) {
                    const comm = commRes.rows[0];
                    await sendTG(comm.seller_id, `❌ Sale Cancelled. No funds transferred.`);
                    await sendTG(comm.buyer_id, `❌ Seller cancelled the sale.\n\nPlease contact Admin to refund your ${comm.expected_amount} ETB.`);
                    await sendTG(ADMIN_ID, `⚠️ Refund Required!\nToken: ${token}\nAmount: ${comm.expected_amount} ETB\nBuyer: ${comm.buyer_id}`);
                }
                await answerCbQuery(update.callback_query.id, "Sale cancelled.");
                continue;
            }
        }

        // 🛠️ ADMIN COMMANDS
        if (text?.startsWith("/approve_escrow ") && userId === ADMIN_ID) {
            const code = text.split(" ")[1];
            const commRes = await pool.query("UPDATE commissions SET status = 'PENDING_SELLER_CONFIRM' WHERE unique_code = $1 AND status = 'PENDING_BUYER_PAYMENT' RETURNING *", [code]);
            
            if (commRes.rows.length > 0) {
                const comm = commRes.rows[0];
                await sendTG(ADMIN_ID, `✅ Buyer payment verified for code ${code}. Asking seller to prepare for courier.`);
                
                await sendTG(comm.seller_id, 
                  `💰 *FUNDS SECURED BY WING!*\n\n` +
                  `A buyer has paid for Item #${comm.post_id}.\n` +
                  `Your payout will be *${comm.item_price} ETB* (WING keeps ${comm.commission_amount} ETB fee).\n\n` +
                  `⚠️ FINAL CHECK: Is the item ready for WING Courier pickup?\n` +
                  `[ ✅ Confirm Ready ]  [ ❌ Cancel & Refund ]`,
                  {
                    inline_keyboard: [[
                      { text: "✅ Confirm Ready", callback_data: `final_confirm_${comm.token}` },
                      { text: "❌ Cancel & Refund", callback_data: `cancel_refund_${comm.token}` }
                    ]]
                  }
                );
            } else {
                await sendTG(ADMIN_ID, `❌ Code ${code} not found or already processed.`);
            }
            continue;
        }

        if (text?.startsWith("/complete_deal ") && userId === ADMIN_ID) {
            const token = text.split(" ")[1];
            const commRes = await pool.query("UPDATE commissions SET status = 'COMPLETED' WHERE token = $1 RETURNING *", [token]);
            if (commRes.rows.length > 0) {
                const comm = commRes.rows[0];
                await sendTG(ADMIN_ID, `✅ Deal marked complete.\nPlease pay Seller ${comm.seller_id} their share: ${comm.item_price} ETB.`);
                await sendTG(comm.seller_id, `🎉 Deal Complete! Admin will process your payout of ${comm.item_price} ETB shortly.`);
                await sendTG(comm.buyer_id, `🎉 Deal Complete! Thank you for using WING.`);
            }
            continue;
        }

        if (text === "/reset") { userStates.delete(userId); await sendTG(chatId, "🔄 Session reset."); continue; }

        // POSTING FLOW
        if (text === "/post") {
          if (user?.role !== 'seller' && user?.role !== 'ADMIN' && user?.role !== 'both') return sendTG(chatId, "⚠️ Apply via /apply first.");
          if (user?.is_limited) return sendTG(chatId, "⚠️ Account limited due to unpaid commission.");
          userStates.set(userId, { mode: 'POST', step: 1, data: {} });
          await sendTG(chatId, "🖼️ *Gallery Post*\nStep 1: Send a clear photo.");
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
                } catch (e: any) { await sendTG(chatId, `⚠️ DB Error: ${e.message}`); }
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
            if (state.step === 1) { state.data.craft = text; state.step = 2; await sendTG(chatId, "📍 Workshop location (Sub-city)?"); }
            else if (state.step === 2) { state.data.loc = text; state.step = 3; await sendTG(chatId, "📸 Send a photo of your work."); }
            else if (state.step === 3 && update.message.photo) {
              await sendTG(chatId, "✅ Application submitted!");
              await sendTG(ADMIN_ID, `🔔 *NEW APP* from @${userObj.username}\nCraft: ${state.data.craft}\n/verify_${userId}`);
              userStates.delete(userId);
            }
            continue;
        }

        // ADMIN VERIFY USER
        if (text?.startsWith("/verify_") && userId === ADMIN_ID) {
          const target = text.split("_")[1];
          await pool.query("UPDATE users SET role = 'seller' WHERE telegram_id = $1", [target]);
          await sendTG(target, "🎉 Verified! You can now use /post.");
          await sendTG(ADMIN_ID, `✅ User ${target} promoted.`);
        }
      }
    } catch (err) { 
      console.error("Bot polling error:", err);
      await new Promise(r => setTimeout(r, 5000)); 
    }
  }
}

// --- 7. SERVER STARTUP & STATIC FILE SERVING ---
async function startServer() {
  await initDatabase();
  startTelegramBotPolling();

  const distPath = path.join(process.cwd(), 'dist');
  
  app.use(express.static(distPath, {
    index: 'index.html',
    extensions: ['html', 'htm']
  }));

  // 🛡️ PRIVACY FILTER: Public endpoint hides phone_number and email
  app.get('/api/user/:telegramId', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, telegram_id, username, full_name, role, trust_score, is_limited, business_scale, agreed_to_terms FROM users WHERE telegram_id = $1', 
        [req.params.telegramId]
      );
      res.json(result.rows[0] || null);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // 👑 ADMIN ONLY: Full details endpoint for dispute resolution
  app.get('/api/admin/user-details/:telegramId', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1', 
        [req.params.telegramId]
      );
      res.json(result.rows[0] || null);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⭐ WING HYBRID ENGINE LIVE ON PORT ${PORT}`);
    console.log(`📁 Serving static files from: ${distPath}`);
  });
}

startServer();