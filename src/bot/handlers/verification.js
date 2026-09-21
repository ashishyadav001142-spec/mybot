import { InlineKeyboard } from 'grammy';
import { dbService as firestoreService } from '../../services/db.js';
import { getDoraemonBottomKeyboard, getMainInlineKeyboard } from './menu.js';
import { formatMessage, safeReply, safeEditMessageText, toSmallCaps } from '../../utils/format.js';

/**
 * Checks which enabled channels the user has NOT yet joined.
 * Channels already joined will NOT be returned.
 */
export async function getUnjoinedChannels(ctx, userId) {
  const channels = await firestoreService.getEnabledChannels();
  if (!channels || channels.length === 0) {
    return [];
  }

  const unjoined = [];

  await Promise.all(
    channels.map(async (channel) => {
      const targetChat = channel.username || channel.id;
      if (!targetChat) return;

      try {
        const member = await ctx.api.getChatMember(targetChat, userId);
        const validStatuses = ['creator', 'administrator', 'member'];
        let hasJoined = validStatuses.includes(member.status);
        if (member.status === 'restricted') {
          hasJoined = member.is_member === true;
        }
        if (!hasJoined) {
          unjoined.push(channel);
        }
      } catch (err) {
        // If user not found in channel, they have definitely not joined
        if (err.description && err.description.includes('user not found')) {
          unjoined.push(channel);
        } else if (err.description && err.description.includes('bot is not a member')) {
          // If bot is not admin in channel, don't crash or block
          console.warn(`🚨 Bot is not admin in ${targetChat}, skipping strict check.`);
        } else {
          console.warn(`Could not verify channel ${targetChat}:`, err.message);
        }
      }
    })
  );

  return unjoined;
}

/**
 * Handles Telegram channel join verification:
 * Only displays channels that the user has NOT joined yet.
 * Once all are joined, automatically deletes the old join prompt message and displays bottom keyboard.
 */
export async function verifyUserChannels(ctx, isCheckJoin = true) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: '⚡ Checking channels...' }).catch(() => {});
  }

  await ctx.replyWithChatAction('typing').catch(() => {});

  const unjoinedChannels = await getUnjoinedChannels(ctx, userId);
  const settings = await firestoreService.getBotSettings();

  // If all channels are joined:
  if (unjoinedChannels.length === 0) {
    await firestoreService.setUserVerified(userId, true);
    const inlineKb = await getMainInlineKeyboard(userId);

    // Clean up: Delete the old join prompt message completely from chat
    try {
      if (ctx.callbackQuery?.message) {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
      }
    } catch {}

    try {
      if (ctx.callbackQuery?.message?.reply_to_message?.message_id) {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.reply_to_message.message_id);
      }
    } catch {}

    const verifiedText = formatMessage(settings.verifiedMessage || settings.welcomeMessage || '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*', ctx.from);

    return safeReply(ctx, verifiedText, {
      reply_markup: inlineKb
    });
  }

  // User has not joined all channels: only show the remaining unjoined ones!
  const keyboard = new InlineKeyboard();
  unjoinedChannels.forEach((chan, idx) => {
    const link = chan.inviteUrl || (chan.username ? `https://t.me/${chan.username.replace('@', '')}` : '#');
    keyboard.url(`📢 ᴊᴏɪɴ ${toSmallCaps(chan.title || `ᴄʜᴀɴɴᴇʟ ${idx + 1}`)}`, link).row();
  });
  keyboard.text('🔄 ᴄʜᴇᴄᴋ ᴊᴏɪɴ', 'flow:check_join');

  const joinText = formatMessage(settings.joinRequiredMessage || '🔔 *ᴊᴏɪɴ ᴏᴜʀ ᴏғғɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟs ᴛᴏ ᴜɴʟᴏᴄᴋ:*', ctx.from);

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `⚠️ Please join remaining ${unjoinedChannels.length} channel(s)!`,
      show_alert: true
    }).catch(() => {});

    try {
      await safeEditMessageText(ctx, joinText, {
        reply_markup: keyboard
      });
    } catch {}
  } else {
    await safeReply(ctx, joinText, {
      reply_markup: keyboard
    });
  }
}
