import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID || '8833095685';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  ownerTelegramId: OWNER_TELEGRAM_ID,
  webhookUrl: process.env.WEBHOOK_URL || '',
  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  }
};

export function validateEnv() {
  const missing = [];
  if (!config.botToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (missing.length > 0) {
    console.warn(`⚠️ [CONFIG WARNING] Missing required environment variables: ${missing.join(', ')}`);
    console.warn(`Please configure them in your .env file.`);
  }
  return missing.length === 0;
}
