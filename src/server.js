import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, validateEnv } from './config/env.js';
import { initBot } from './bot/bot.js';
import { dbService as firestoreService } from './services/db.js';
import { auth, isInitialized } from './config/firebase.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Verify Firebase Auth Token middleware for secure Android App REST calls
async function verifyAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!isInitialized || !auth) {
    // If running in development without Firebase keys
    return next();
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.adminUser = decodedToken;
    next();
  } catch (err) {
    console.error('Failed to verify Firebase ID token:', err.message);
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    firebaseConnected: isInitialized,
    ownerTelegramId: config.ownerTelegramId
  });
});

// Bot & System Statistics
app.get('/api/stats', verifyAdminAuth, async (req, res) => {
  try {
    const stats = await firestoreService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test Channel Permissions using Telegram Bot API
app.post('/api/channels/test', verifyAdminAuth, async (req, res) => {
  const { channelUsername } = req.body;
  if (!channelUsername) {
    return res.status(400).json({ error: 'channelUsername is required' });
  }

  const botInstance = (await import('./bot/bot.js')).bot;
  if (!botInstance) {
    return res.status(503).json({ error: 'Telegram Bot is not initialized on this server' });
  }

  try {
    const chat = await botInstance.api.getChat(channelUsername);
    const botMember = await botInstance.api.getChatMember(chat.id, (await botInstance.api.getMe()).id);

    const isAdmin = ['creator', 'administrator'].includes(botMember.status);
    res.json({
      success: true,
      data: {
        chatId: chat.id,
        title: chat.title,
        username: chat.username,
        botStatus: botMember.status,
        canVerifyMembers: isAdmin
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Failed to inspect channel: ${err.message}`
    });
  }
});

// Start Express Server and Telegram Bot
async function startServer() {
  validateEnv();

  const bot = initBot();

  if (bot) {
    if (config.webhookUrl) {
      // Production Webhook Mode
      console.log(`🌐 [Bot] Setting up webhook on ${config.webhookUrl}...`);
      await bot.api.setWebhook(`${config.webhookUrl}/telegram-webhook`);
      app.use('/telegram-webhook', (await import('grammy')).webhookCallback(bot, 'express'));
    } else {
      // Development Long Polling Mode
      console.log('🔄 [Bot] Starting long-polling mode...');
      bot.start({
        onStart: (botInfo) => {
          console.log(`🚀 [Bot] @${botInfo.username} is running and listening for messages!`);
        }
      });
    }
  }

  const server = app.listen(config.port, () => {
    console.log(`⚡ [Backend] Server listening on http://localhost:${config.port}`);
    console.log(`🔒 [Security] Owner Telegram ID set to: ${config.ownerTelegramId}`);
  });

  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down server...');
    if (bot) await bot.stop();
    server.close(() => {
      console.log('Server terminated successfully.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(err => {
  console.error('Fatal startup error:', err);
});
