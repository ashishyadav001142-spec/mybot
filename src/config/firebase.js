import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
let auth = null;
let isInitialized = false;

try {
  let credential = null;

  // 1. Check if serviceAccountKey.json exists at provided path or default location
  const serviceAccountPath = config.firebase.serviceAccountPath 
    ? path.resolve(config.firebase.serviceAccountPath)
    : path.resolve(__dirname, '../../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    console.log(`🔥 [Firebase] Initialized with service account file: ${serviceAccountPath}`);
  } else if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    // 2. Use environment variables
    credential = admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    });
    console.log(`🔥 [Firebase] Initialized with environment credentials for project: ${config.firebase.projectId}`);
  } else {
    // 3. Fallback for Google Application Default Credentials
    try {
      credential = admin.credential.applicationDefault();
      console.log(`🔥 [Firebase] Initialized with Application Default Credentials`);
    } catch {
      console.warn(`⚠️ [Firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_PATH or project credentials in .env.`);
    }
  }

  if (credential) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }
    db = admin.firestore();
    auth = admin.auth();
    isInitialized = true;
  }
} catch (error) {
  console.error(`❌ [Firebase] Failed to initialize Firebase Admin SDK:`, error.message);
}

export { admin, db, auth, isInitialized };
