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

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "wing-secure-secret-2024";
const ADMIN_ID = process.env.ADMIN_ID; // From Render Env
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";

// --- POSTGRESQL CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- DATABASE INITIALIZATION (Auto-Migrate) ---
async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'BUYER', -- ADMIN, SELLER, BUYER
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

// --- GUARDIAN LOGGING ---
async function logGuardianEvent(type: string, details: any, severity: string = "INFO") {
  try {
    await pool.query(
      'INSERT INTO security_logs (telegram_id, action, details, severity) VALUES ($1, $2, $3, $4)',
      [details.userId || details.ip, type, JSON.stringify(details), severity]
    );
  } catch (err) {
    console.error("Logging Failed:", err);
  }
}

// --- AUTHENTICATION MIDDLEWARE ---
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

// --- TELEGRAM UTILITIES ---
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

// --- TELEGRAM BOT POLLING (Optimized for PostgreSQL) ---
async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) return;
  console.log("🤖 WING Telegram Guardian active. Polling updates...");
  
  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=15`);
      const data: any = await response.json();
      
      if (data?.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const chatId = msg.chat.id;
          const text = msg.text.trim();
          const userId = msg.from.id.toString();

          if (text === "/start") {
            // Register or Identify user
            let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
            let user = res.rows[0];

            if (!user) {
                const role = (userId === ADMIN_ID) ? 'ADMIN' : 'BUYER';
                await pool.query('INSERT INTO users (telegram_id, username, role, telegram_chat_id) VALUES ($1, $2, $3, $4)', 
                [userId, msg.from.username, role, chatId.toString()]);
                await sendTelegramMessage(chatId, `👋 *Welcome to WING!* \nYour account is registered as: \`${role}\``);
            } else {
                await sendTelegramMessage(chatId, `🦅 *Welcome back, Artisan.* \nStatus: Verified ✅`);
            }
          }
          
          if (text === "/status") {
              const res = await pool.query('SELECT role, trust_score FROM users WHERE telegram_id = $1', [userId]);
              if (res.rows[0]) {
                  const u = res.rows[0];
                  await sendTelegramMessage(chatId, `📊 *WING Profile*\nRole: ${u.role}\nTrust Score: ${u.trust_score}`);
              }
          }
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// --- API ENDPOINTS ---

// 1. Auth: Login
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
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 2. AI Mentor (Gemini)
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");
app.post("/api/mentor", authenticateToken, async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const { prompt } = req.body;
    
    const result = await model.generateContent(`Context: You are Wing Guide, a mentor for Ethiopian Artisans. User asks: ${prompt}`);
    res.json({ text: result.response.text() });
  } catch (err) {
    res.status(500).json({ error: "AI Mentor offline" });
  }
});

// 3. Posts: Create (Artisan Only)
app.post("/api/posts", authenticateToken, requireRole("SELLER", "ADMIN"), async (req: any, res) => {
  const { caption, image_url, category, price } = req.body;
  try {
    const newPost = await pool.query(
      'INSERT INTO posts (user_id, caption, image_url, category, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, caption, image_url, category, price]
    );
    res.status(201).json(newPost.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Post creation failed" });
  }
});

// 4. Admin: Get Security Logs
app.get("/api/admin/fraud-logs", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const logs = await pool.query('SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT 50');
    res.json(logs.rows);
  } catch (err) {
    res.status(500).send("Error fetching logs");
  }
});

// --- SERVER STARTUP ---
async function startServer() {
  await initDatabase();
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