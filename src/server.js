import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { webhookCallback } from 'grammy';
import { config, validateEnv } from './config/env.js';
import { initBot } from './bot/bot.js';
import { dbService as firestoreService } from './services/db.js';
import { auth, isInitialized } from './config/firebase.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize Bot instance
const bot = initBot();

// Mount Telegram Webhook for Vercel Serverless & Production Webhook mode
if (bot) {
  app.use('/api/webhook', webhookCallback(bot, 'express', {
    timeoutMilliseconds: 30000,
    onTimeout: 'return'
  }));
  app.use('/telegram-webhook', webhookCallback(bot, 'express', {
    timeoutMilliseconds: 30000,
    onTimeout: 'return'
  }));
}

// 1-Click Webhook Registration for Vercel
app.get('/api/set-webhook', async (req, res) => {
  if (!bot) {
    return res.status(500).json({
      success: false,
      error: 'Bot is not initialized. Please ensure TELEGRAM_BOT_TOKEN is set in Vercel Environment Variables!'
    });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const webhookUrl = `${protocol}://${host}/api/webhook`;

  try {
    await bot.api.setWebhook(webhookUrl, { drop_pending_updates: true });
    const info = await bot.api.getWebhookInfo();
    res.json({
      success: true,
      message: '🎉 Webhook successfully registered with Telegram on Vercel!',
      webhookUrl,
      webhookInfo: info
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check Webhook Status
app.get('/api/webhook-info', async (req, res) => {
  if (!bot) return res.status(500).json({ error: 'Bot not initialized' });
  try {
    const info = await bot.api.getWebhookInfo();
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Firebase Auth Token middleware for secure Android App REST calls
async function verifyAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!isInitialized || !auth) {
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
    environment: process.env.VERCEL ? 'vercel-serverless' : 'continuous',
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

// Start Express Server (for Local PC and continuous hosts like Railway/VPS)
async function startServer() {
  // If running in Vercel Serverless environment, skip port listening and polling
  if (process.env.VERCEL) {
    console.log('⚡ [Backend] Running in Vercel Serverless environment.');
    return;
  }

  validateEnv();

  if (bot) {
    if (config.webhookUrl) {
      console.log(`🌐 [Bot] Setting up webhook on ${config.webhookUrl}...`);
      await bot.api.setWebhook(`${config.webhookUrl}/api/webhook`);
    } else {
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

export { app, bot };
export default app;
