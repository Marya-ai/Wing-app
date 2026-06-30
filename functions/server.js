const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

app.post('/webhook', async (req, res) => {
  const update = req.body;
  if (update.message?.text?.startsWith('/start')) {
    const chatId = update.message.chat.id;
    const param = update.message.text.split(' ')[1];
    let text = 'Hello! I am @WingArtisanBot.';
    
    if (param === 'web_redirect') {
      text = '🦅 Welcome from WING website!\n\nUse:\n/critique - Get feedback\n/swap - Material barter\n/pricecheck - Valuation';
    } else if (param === 'buy_premium_50etb') {
      text = '👑 Premium Access\n\nSend 50 ETB to Telebirr: 09XX-XXX-XXX\nReply PAID after transfer.';
    } else if (param === 'need_help_web') {
      text = '🆘 Support\n\nDescribe your issue and our team will respond shortly.';
    }

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    });
  }
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));