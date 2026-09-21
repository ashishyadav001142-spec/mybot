import { InlineKeyboard } from 'grammy';
import { dbService as firestoreService } from '../../services/db.js';
import { getDoraemonBottomKeyboard } from './menu.js';
import { getUnjoinedChannels } from './verification.js';
import { formatMessage, safeReply } from '../../utils/format.js';

export async function handleStart(ctx) {
  const user = ctx.from;
  if (!user) return;

  await ctx.replyWithChatAction('typing').catch(() => {});

  // Asynchronously record user in background
  firestoreService.upsertUser({
    telegramId: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name
  }).catch(() => {});

  // Fetch customizable messages from database (settings table)
  const settings = await firestoreService.getBotSettings();

  // Real-time check on start: Jo channel user ne join kiya hai wo wapas na aaye
  const unjoinedChannels = await getUnjoinedChannels(ctx, user.id);

  // Agar sabhi channels joined hain (ya koi mandatory channel nahi hai):
  // Toh sidha Welcome name aur bottom buttons bahar aayein!
  if (unjoinedChannels.length === 0) {
    firestoreService.setUserVerified(user.id, true).catch(() => {});
    const bottomKb = await getDoraemonBottomKeyboard(user.id);
    const welcomeText = formatMessage(settings.welcomeMessage || '👋 *Welcome, {name}!*', user);
    return safeReply(ctx, welcomeText, {
      reply_markup: bottomKb
    });
  }

  // Sirf wahi channel show hoga jo abhi tak user ne join NAHI kiya hai
  const keyboard = new InlineKeyboard();
  unjoinedChannels.forEach((chan, idx) => {
    const link = chan.inviteUrl || (chan.username ? `https://t.me/${chan.username.replace('@', '')}` : '#');
    keyboard.url(`📢 𝗝𝗢𝗜𝗡 ${chan.title || `Channel ${idx + 1}`}`, link).row();
  });
  keyboard.text('🔄 𝗖𝗛𝗘𝗖𝗞 𝗝𝗢𝗜𝗡', 'flow:check_join');

  const joinText = formatMessage(settings.joinRequiredMessage || '🔔 *𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹 𝗖𝗵𝗮𝗻𝗻𝗲𝗹 𝗧𝗼 𝗨𝗻𝗹𝗼𝗰𝗸:*', user);

  return safeReply(ctx, joinText, {
    reply_markup: keyboard
  });
}
