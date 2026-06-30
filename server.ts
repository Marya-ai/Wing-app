import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where } from "firebase/firestore";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// CORRECTED: Firebase configuration matching your new project: wing-app-55bc8
const firebaseConfig = {
  apiKey: "AIzaSyCdeRDZtCiQCSelwaP-y9xDycqAN5lRZio",
  authDomain: "wing-app-55bc8.firebaseapp.com",
  projectId: "wing-app-55bc8",
  storageBucket: "wing-app-55bc8.firebasestorage.app",
  messagingSenderId: "718269448738",
  appId: "1:718269448738:web:d0edf63c9102360a85c07b",
  measurementId: "G-ECH94GSHDS"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const TELEGRAM_TOKEN = "8858899653:AAE4mHAIjKnhwgzuW4XRmMTC8kVJlKMcPOo";

async function sendTelegramMessage(chatId: string | number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown"
      })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("Telegram API error response:", err);
    }
  } catch (err) {
    console.error("Error sending Telegram message:", err);
  }
}

async function startTelegramBotPolling() {
  if (!TELEGRAM_TOKEN) {
    console.log("No TELEGRAM_TOKEN configured. Skipping Telegram Bot.");
    return;
  }
  console.log("Telegram Bot service started. Polling for updates...");
  
  let offset = 0;
  
  (async () => {
    while (true) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=15`
        );
        if (!response.ok) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        const data = await response.json() as any;
        if (data && data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = Math.max(offset, update.update_id + 1);
            
            if (update.message) {
              const message = update.message;
              const chatId = message.chat.id;
              const text = (message.text || "").trim();
              const username = message.chat.username || message.from?.username || "";
              
              if (text.startsWith("/start")) {
                const parts = text.split(" ");
                const param = parts[1] || "";
                
                if (param.startsWith("bind_")) {
                  const userId = param.replace("bind_", "");
                  try {
                    const profileRef = doc(db, "profiles", userId);
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                      await updateDoc(profileRef, {
                        telegram_chat_id: String(chatId),
                        telegram_username: username
                      });
                      
                      const welcomeText = `🎉 *Account Successfully Linked!*\n\nHello *${profileSnap.data().full_name || "Artisan"}*, your WING profile has been securely linked to this Telegram Bot.\n\nNow, whenever a buyer sends you a direct message (DM) on WING or contacts you about one of your crafts, you will receive real-time notifications directly here!\n\nHappy crafting! 🪔🪵🧵`;
                      await sendTelegramMessage(chatId, welcomeText);
                    } else {
                      await sendTelegramMessage(chatId, "⚠️ *Error:* We could not find an artisan profile matching that ID. Please go back to WING Settings and try again!");
                    }
                  } catch (err: any) {
                    console.error("Error in Telegram bind:", err);
                    await sendTelegramMessage(chatId, `⚠️ *Error:* Failed to link account: ${err.message}`);
                  }
                } else if (param.startsWith("buy_")) {
                  const postId = param.replace("buy_", "");
                  try {
                    const postRef = doc(db, "posts", postId);
                    const postSnap = await getDoc(postRef);
                    if (postSnap.exists()) {
                      const postData = postSnap.data();
                      const makerId = postData.user_id;
                      const makerRef = doc(db, "profiles", makerId);
                      const makerSnap = await getDoc(makerRef);
                      const makerData = makerSnap.exists() ? makerSnap.data() : null;
                      
                      if (makerData && makerData.telegram_chat_id) {
                        const makerMsg = `🔔 *New Inquiry on WING!*\n\nHi *${makerData.full_name}*, a potential buyer is interested in purchasing your craft *"${postData.caption || "Craft Pin"}"*!\n\n👤 *Buyer:* @${username || "Anonymous"}\n📍 *Action:* Connect with them at @${username} or reply in the WING direct messages!`;
                        await sendTelegramMessage(makerData.telegram_chat_id, makerMsg);
                        
                        await sendTelegramMessage(chatId, `📲 *Inquiry Sent!*\n\nI have notified the master artisan *${makerData.full_name || "Maker"}* that you are interested in *"${postData.caption}"*! They will contact you @${username} shortly. Thank you for supporting authentic traditional crafts! ✨`);
                      } else {
                        await addDoc(collection(db, "notifications"), {
                          user_id: makerId,
                          sender_name: "Telegram Bot Coordinator 🤖",
                          sender_avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=tele-coord",
                          type: "telegram",
                          post_id: postId,
                          post_image: postData.image_url,
                          content: `A buyer (@${username || "Anonymous"}) is interested in buying your craft "${postData.caption?.slice(0, 30)}..." on Telegram!`,
                          read: false,
                          created_at: new Date().toISOString()
                        });
                        
                        await sendTelegramMessage(chatId, `📲 *Inquiry Recorded!*\n\nThis artisan hasn't linked their Telegram chat yet, but I have created a priority alert inside the WING app! You can also chat with them directly in WING.`);
                      }
                    } else {
                      await sendTelegramMessage(chatId, "⚠️ *Error:* This craft pin could not be found or has been deleted.");
                    }
                  } catch (err: any) {
                    console.error("Error in Telegram buy param:", err);
                    await sendTelegramMessage(chatId, `⚠️ *Error:* Could not fetch craft details: ${err.message}`);
                  }
                } else {
                  const greeting = `👋 *Welcome to WING Artisan Bot!* 🤖🇪🇹\n\nI am the real-time notification assistant for the *WING Traditional Crafts Platform*.\n\n*My features:*\n• Receive buyer inquiries immediately on Telegram.\n• Get instant notifications when people DM you in private chats.\n\n👉 *To Link Your WING Account:* Go to WING, open Settings, and click "Contact Support Bot" to link automatically!`;
                  await sendTelegramMessage(chatId, greeting);
                }
              } else if (text === "/status") {
                try {
                  const qProfile = query(collection(db, "profiles"), where("telegram_chat_id", "==", String(chatId)));
                  const snap = await getDocs(qProfile);
                  if (!snap.empty) {
                    const profileData = snap.docs[0].data();
                    await sendTelegramMessage(chatId, `🟢 *Status:* Linked to *${profileData.full_name}* (@${profileData.telegram_username || "no_username"}). You are ready to receive real-time notifications!`);
                  } else {
                    await sendTelegramMessage(chatId, "🔴 *Status:* Unlinked. Please click the Telegram link in WING Settings to link your account.");
                  }
                } catch (e: any) {
                  await sendTelegramMessage(chatId, `⚠️ Error: ${e.message}`);
                }
              } else if (text === "/unlink") {
                try {
                  const qProfile = query(collection(db, "profiles"), where("telegram_chat_id", "==", String(chatId)));
                  const snap = await getDocs(qProfile);
                  if (!snap.empty) {
                    for (const docSnap of snap.docs) {
                      await updateDoc(doc(db, "profiles", docSnap.id), {
                        telegram_chat_id: "",
                        telegram_username: ""
                      });
                    }
                    await sendTelegramMessage(chatId, "🙋‍♂️ *Account Unlinked successfully.* You will no longer receive alerts here.");
                  } else {
                    await sendTelegramMessage(chatId, "No linked account found.");
                  }
                } catch (e: any) {
                  await sendTelegramMessage(chatId, `⚠️ Error: ${e.message}`);
                }
              } else {
                await sendTelegramMessage(chatId, "🤖 WING Bot: Use /status to check link, /unlink to remove link, or visit the WING website to explore beautiful traditional Ethiopian crafts.");
              }
            }
          }
        }
      } catch (err) {
        console.error("Error in Telegram polling loop:", err);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  })();
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required to use AI features.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

app.post("/api/mentor", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const lastMessage = messages[messages.length - 1]?.content || "";
    const abusiveKeywords = ["hack", "bypass instructions", "system prompt", "ignore previous"];
    if (abusiveKeywords.some(keyword => lastMessage.toLowerCase().includes(keyword))) {
      return res.json({
        text: "As Wing Guide, I am here to help you build and grow your traditional artisan craft practice. Let's keep our conversation focused on techniques and business strategy!"
      });
    }

    const ai = getGeminiClient();
    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
      config: {
        systemInstruction: `You are Wing Guide, an expert artisan mentor. Help makers with techniques in Ceramics, Woodworking, Textiles, and Jewelry, and provide business advice for traditional crafts.`,
      },
    });

    res.json({ text: response.text || "I'm sorry, I couldn't process that request." });
  } catch (error: any) {
    console.error("AI Mentor error:", error);
    res.status(500).json({ error: error.message || "An error occurred with Wing Guide." });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const { query: searchQuery, posts } = req.body;
    if (!searchQuery || !posts) return res.json({ matchedIds: [] });

    const ai = getGeminiClient();
    const simplifiedPosts = posts.map((p:any)=> ({ id: p.id, caption: p.caption || "" }));

    const prompt = `Find matching post IDs for: "${searchQuery}". Posts: ${JSON.stringify(simplifiedPosts)}. Return ONLY a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const text = response.text?.trim() || "[]";
    const cleanJsonString = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const matchedIds = JSON.parse(cleanJsonString);
    res.json({ matchedIds });
  } catch (error: any) {
    res.json({ matchedIds: [] });
  }
});

app.post("/api/voice/generate", async (req, res) => {
  try {
    const { text, voiceName = "Zephyr" } = req.body;
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: text }] }],
    });
    // Placeholder for TTS logic as standard Gemini doesn't return base64 audio directly in some regions
    res.json({ audio: "" }); 
  } catch (error: any) {
    res.status(500).json({ error: "Voice Generation failed" });
  }
});

app.post("/api/telegram/send", async (req, res) => {
  try {
    const { chatId, text } = req.body;
    await sendTelegramMessage(chatId, text);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Telegram dispatch failed" });
  }
});

async function startServer() {
  startTelegramBotPolling().catch(err => console.error(err));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();