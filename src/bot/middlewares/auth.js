import { OWNER_TELEGRAM_ID } from '../../config/env.js';

/**
 * Checks if a given Telegram User ID is the verified Owner/Admin
 * @param {string|number} telegramId 
 * @returns {boolean}
 */
export function isOwner(telegramId) {
  if (!telegramId) return false;
  return String(telegramId).trim() === String(OWNER_TELEGRAM_ID).trim();
}

/**
 * Strict Grammy middleware for Admin command and callback protection
 */
export async function requireOwner(ctx, next) {
  const userId = ctx.from?.id;

  if (!isOwner(userId)) {
    console.warn(`🚨 [SECURITY ALERT] Unauthorized admin access attempt by User ID: ${userId} (@${ctx.from?.username || 'unknown'})`);
    
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '⛔ Access Denied! Only Owner (8833095685) can access Admin functions.',
        show_alert: true
      });
    } else {
      await ctx.reply(
        `⛔ *Access Denied*\n\nYou are not authorized to perform admin actions.\nOnly Owner (*ID: \`${OWNER_TELEGRAM_ID}\`*) has permission.`,
        { parse_mode: 'Markdown' }
      );
    }
    return; // Stop middleware pipeline immediately!
  }

  return next();
}
