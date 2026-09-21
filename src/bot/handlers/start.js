import { InlineKeyboard } from 'grammy';
import { dbService as firestoreService } from '../../services/db.js';
import { getDoraemonBottomKeyboard, getMainInlineKeyboard } from './menu.js';
import { getUnjoinedChannels } from './verification.js';
import { formatMessage, safeReply, toSmallCaps } from '../../utils/format.js';

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
  // Toh sidha Welcome name aur INLINE BUTTONS chat ke andar bahar dikhein!
  if (unjoinedChannels.length === 0) {
    firestoreService.setUserVerified(user.id, true).catch(() => {});
    const inlineKb = await getMainInlineKeyboard(user.id);
    const welcomeText = formatMessage(settings.welcomeMessage || '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*', user);
    return safeReply(ctx, welcomeText, {
      reply_markup: inlineKb
    });
  }

  // Sirf wahi channel show hoga jo abhi tak user ne join NAHI kiya hai
  const keyboard = new InlineKeyboard();
  unjoinedChannels.forEach((chan, idx) => {
    const link = chan.inviteUrl || (chan.username ? `https://t.me/${chan.username.replace('@', '')}` : '#');
    keyboard.url(`📢 ᴊᴏɪɴ ${toSmallCaps(chan.title || `ᴄʜᴀɴɴᴇʟ ${idx + 1}`)}`, link).row();
  });
  keyboard.text('🔄 ᴄʜᴇᴄᴋ ᴊᴏɪɴ', 'flow:check_join');

  const joinText = formatMessage(settings.joinRequiredMessage || '🔔 *ᴊᴏɪɴ ᴏᴜʀ ᴏғғɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟs ᴛᴏ ᴜɴʟᴏᴄᴋ:*', user);

  return safeReply(ctx, joinText, {
    reply_markup: keyboard
  });
}
