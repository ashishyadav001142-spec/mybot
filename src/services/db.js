import { supabase } from '../config/supabase.js';
import { supabaseService } from './supabaseService.js';
import { firestoreService } from './firestoreService.js';

// Automatically choose Supabase if connected, otherwise fallback to Firestore
export const dbService = (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY))
  ? supabaseService
  : firestoreService;

console.log(`🔌 [Database] Active backend database engine: ${dbService === supabaseService ? '⚡ Supabase (PostgreSQL)' : '🔥 Firebase Firestore'}`);
