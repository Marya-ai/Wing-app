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

// --- 1. CONFIGURATION & ROBUSTNESS ---
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "wing-secure-secret-2024";
const ADMIN_ID = process.env.ADMIN_ID; // Your TG ID from Render Env
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";

// Initialize Postgres with SSL for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. DATABASE INITIALIZATION ---
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
      telegram_chat_id TEXT,
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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
    console.log("🛡️ Guardian System: PostgreSQL Tables Verified.");
  } catch (err) {
    console.error("❌ DB Init Error:", err);
  }
}

// --- 3. GUARDIAN LOGGING ---
async function logGuardianEvent(type: string, details: any, severity: string = "INFO") {
  try {
    await pool.query(
      'INSERT INTO security_logs (telegram_id, action, details, severity) VALUES ($1, $2, $3, $4)',
      [details.userId || "SYSTEM", type, JSON.stringify(details), severity]
    );
  } catch (err) {
    console.error("Logging Failed:", err);
  }
}

// --- 4. AUTHENTICATION MIDDLEWARE ---
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logGuardianEvent("UNAUTHORIZED_ROLE_ACCESS", { userId: req.user?.id, path: req.path }, "WARN");
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
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
  } catch (err) {
    console.error("Telegram Send Error:", err);
  }
}

// --- 6. TELEGRAM BOT POLLING (Hardened) ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) {
    console.error("❌ Telegram Token missing! Bot will not start.");
    return;
  }

  // FORCE RESET: Deletes any old Webhooks that make the bot silent
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`);
    console.log("🧹 Guardian: Webhook cleared. Polling mode activated.");
  } catch (e) {
    console.warn("⚠️ Failed to clear webhook, but continuing...");
  }

  console.log(`🤖 WING Guardian active. Token: ${TELEGRAM_TOKEN.substring(0, 5)}...`);
  
  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
      const data: any = await response.json();
      
      if (!data.ok) {
        console.error("❌ Telegram API Error:", data.description);
        await new Promise(r => setTimeout(r, 10000)); // Cool down
        continue;
      }

      if (data.result.length > 0) {
        console.log(`📥 RECEIVED ${data.result.length} NEW MESSAGES`);
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const chatId = msg.chat.id;
          const text = msg.text.trim();
          const userId = msg.from.id.toString();

          console.log(`💬 Message from ${userId}: ${text}`);

          if (text === "/start") {
            let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
            let user = res.rows[0];

            if (!user) {
                // If the user's ID matches your ADMIN_ID env var, make them ADMIN
                const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
                await pool.query('INSERT INTO users (telegram_id, username, role, telegram_chat_id) VALUES ($1, $2, $3, $4)', 
                [userId, msg.from.username || 'Artisan', role, chatId.toString()]);
                await sendTelegramMessage(chatId, `👋 *Welcome to WING!* \n\nYour account is now registered as: \`${role}\` \nStatus: Verified ✅`);
            } else {
                await sendTelegramMessage(chatId, `🦅 *Welcome back, Artisan.* \nRole: \`${user.role}\` \nStatus: Secure 🛡️`);
            }
          }
          
          if (text === "/status") {
              const res = await pool.query('SELECT role, trust_score FROM users WHERE telegram_id = $1', [userId]);
              if (res.rows[0]) {
                  const u = res.rows[0];
                  await sendTelegramMessage(chatId, `📊 *WING Profile Status*\n\nRole: \`${u.role}\`\nTrust Score: \`${u.trust_score}\``);
              }
          }
        }
      }
    } catch (err) {
      console.error("📡 Polling Loop Error:", err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// --- 7. API ENDPOINTS ---

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (user && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
      res.json({ accessToken: token, user });
    } else {
      logGuardianEvent("FAILED_LOGIN", { email, ip: req.ip }, "WARN");
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) { res.status(500).send("Server Error"); }
});

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");
app.post("/api/mentor", authenticateToken, async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const { prompt } = req.body;
    const result = await model.generateContent(`You are Wing Guide, a mentor for Ethiopian Artisans. Assist with: ${prompt}`);
    res.json({ text: result.response.text() });
  } catch (err) { res.status(500).json({ error: "AI Mentor offline" }); }
});

app.post("/api/posts", authenticateToken, requireRole("SELLER", "ADMIN"), async (req: any, res) => {
  const { caption, image_url, category, price } = req.body;
  try {
    const newPost = await pool.query(
      'INSERT INTO posts (user_id, caption, image_url, category, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, caption, image_url, category, price]
    );
    res.status(201).json(newPost.rows[0]);
  } catch (err) { res.status(500).json({ error: "Post creation failed" }); }
});

// --- 8. SERVER STARTUP ---
async function startServer() {
  console.log("🚀 Starting WING Backend...");
  await initDatabase();
  
  // Start bot polling
  startTelegramBotPolling();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⭐ WING ENGINE ONLINE ON PORT ${PORT}`);
  });
}

startServer();