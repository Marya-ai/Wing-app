// render-server.js - Standalone server for Render.com
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Get bot token from environment variable (set in Render dashboard)
const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Webhook endpoint - this is where Telegram sends messages
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    // Only process /start commands for now
    if (update.message?.text?.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const param = update.message.text.split(' ')[1];
      let text = 'Hello! I am @WingArtisanBot.';
      
      if (param === 'web_redirect') {
        text = '🦅 Welcome from WING website!\n\nUse:\n/critique - Get feedback\n/swap - Material barter\n/pricecheck - Valuation';
      } else if (param === 'buy_premium_50etb') {
        text = '👑 Premium Access\n\nSend 50 ETB to Telebirr: 09XX-XXX-XXX\nReply PAID after transfer.';
      } else if (param === 'need_help_web') {
        text = ' Support\n\nDescribe your issue and our team will respond shortly.';
      }

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      });
      
      console.log(`Sent message to ${chatId}`);
    }
    
    // Always respond OK to Telegram within 10 seconds
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Health check endpoint (required by Render)
app.get('/', (req, res) => {
  res.send('WingArtisanBot is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Automatically set webhook when server starts
  if (BOT_TOKEN && process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
    axios.post(`${TELEGRAM_API}/setWebhook`, { url: webhookUrl })
      .then(() => console.log(`Webhook set to: ${webhookUrl}`))
      .catch(err => console.error('Failed to set webhook:', err));
  }
});