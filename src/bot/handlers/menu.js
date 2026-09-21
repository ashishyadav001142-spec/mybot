import { Keyboard, InlineKeyboard } from 'grammy';
import { dbService as firestoreService } from '../../services/db.js';
import { isOwner } from '../middlewares/auth.js';
import { openAdminPanel } from './admin.js';
import { formatMessage, safeReply } from '../../utils/format.js';

/**
 * Builds the stylish bottom ReplyKeyboard (Chat ke bahar, screen ke bottom me)
 * - Row 1 (Center / Big): 🚀 𝗦𝗧𝗔𝗥𝗧 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀
 * - Row 2+: Top-level main buttons from Supabase (Sub-buttons are filtered out)
 * - Last Row: Refresh & Admin panel
 */
export async function getDoraemonBottomKeyboard(userId) {
  const kb = new Keyboard();

  // 1. Big Center Start Button (Full Row)
  kb.text('🚀 𝗦𝗧𝗔𝗥𝗧 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀').row();

  // 2. Fetch enabled TOP-LEVEL buttons (ignore sub-buttons)
  const buttons = firestoreService.getMainButtons 
    ? await firestoreService.getMainButtons()
    : (await firestoreService.getButtons()).filter(b => b.enabled !== false && (!b.url || !b.url.startsWith('parent:')));

  let count = 0;
  for (const btn of buttons) {
    kb.text(btn.name);
    count++;
    if (count % 2 === 0) {
      kb.row();
    }
  }

  if (count % 2 !== 0) {
    kb.row();
  }

  // 3. Bottom Control Row
  kb.text('🔄 𝗥𝗘𝗙𝗥𝗘𝗦𝗛 𝗠𝗘𝗡𝗨');
  if (isOwner(userId)) {
    kb.text('🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟');
  }

  return kb.resized().persistent();
}

/**
 * Displays the dynamic main menu with the bottom keyboard
 */
export async function showMainMenu(ctx) {
  const userId = ctx.from?.id;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  await ctx.replyWithChatAction('typing').catch(() => {});

  const [bottomKb, settings] = await Promise.all([
    getDoraemonBottomKeyboard(userId),
    firestoreService.getBotSettings()
  ]);

  const menuText = formatMessage(settings.welcomeMessage || '👋 *Welcome, {name}!*', ctx.from);

  await safeReply(ctx, menuText, {
    reply_markup: bottomKb
  });
}

/**
 * Executes a dynamic button action (APK file, VIP Key, Link, or Sub-menu)
 */
export async function handleButtonExecution(ctx, button) {
  const userId = ctx.from?.id;
  const bottomKb = await getDoraemonBottomKeyboard(userId);

  // 1. Check if this button has sub-buttons (Categories / Sub-menus)
  const subButtons = firestoreService.getSubButtons 
    ? await firestoreService.getSubButtons(button.id)
    : (await firestoreService.getButtons()).filter(b => b.enabled !== false && b.url === `parent:${button.id}`);

  if (subButtons.length > 0) {
    // Render interactive Sub-menu with inline buttons
    const keyboard = new InlineKeyboard();
    subButtons.forEach(sub => {
      keyboard.text(sub.name, `subbtn:${sub.id}`).row();
    });
    keyboard.text('🔙 𝗕𝗮𝗰𝗸 𝘁𝗼 𝗠𝗮𝗶𝗻 𝗠𝗲𝗻𝘂', 'flow:menu');

    const promptText = formatMessage(
      button.message || `📂 *${button.name}*\n\n_Please select an option below:_`,
      ctx.from
    );

    return safeReply(ctx, promptText, {
      reply_markup: keyboard
    });
  }

  // 2. No sub-buttons: Execute regular button action
  if (button.type === 'FILE') {
    await ctx.replyWithChatAction('upload_document').catch(() => {});

    const caption = formatMessage(
      button.message || `📦 *${button.name}*\n\n🎒 *Doraemon 4D Pocket Gadget Ready!*`,
      ctx.from
    );

    // Check if telegramFileId is missing, empty, or placeholder
    const isPlaceholder = !button.telegramFileId || 
      button.telegramFileId === 'SAMPLE_FILE_ID' || 
      button.telegramFileId.includes('SAMPLE');

    if (isPlaceholder) {
      const files = await firestoreService.getFiles();
      const realFile = files.find(f => f.telegramFileId && !f.telegramFileId.includes('SAMPLE'));
      
      if (realFile) {
        button.telegramFileId = realFile.telegramFileId;
        firestoreService.updateButton(button.id, { telegramFileId: realFile.telegramFileId }).catch(() => {});
      } else {
        let msg = `${caption}\n\n`;
        if (isOwner(userId)) {
          msg += `⚠️ *Abhi tak koi File ya Video upload nahi ki gayi hai!*\n\n💡 *Owner Tip:* Apne phone ya PC se koi bhi APK, Video ya Document is bot chat me direct send/forward karein — bot use automatically save karke attach kar dega!`;
        } else {
          msg += `⏳ *File is currently being updated by admin.*\nPlease check back soon!`;
        }
        return safeReply(ctx, msg, { reply_markup: bottomKb });
      }
    }

    try {
      await ctx.replyWithDocument(button.telegramFileId, {
        caption,
        reply_markup: bottomKb,
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error(`Error sending file (${button.telegramFileId}):`, err.message);
      
      // Automatic Cloud Fallback: Try sending directly from Supabase Storage
      try {
        const files = await firestoreService.getFiles();
        const matchedFile = files.find(f => f.telegramFileId === button.telegramFileId);
        if (matchedFile && (matchedFile.storageUrl || matchedFile.storage_url)) {
          const directUrl = matchedFile.storageUrl || matchedFile.storage_url;
          await ctx.replyWithDocument(directUrl, {
            caption,
            reply_markup: bottomKb,
            parse_mode: 'Markdown'
          });
          return;
        }
      } catch (fallbackErr) {
        console.error('Fallback cloud download failed:', fallbackErr.message);
      }

      let errorText = `⚠️ *File temporarily unavailable.*`;
      if (isOwner(userId)) {
        errorText = `📦 *${button.name}*\n\n⚠️ *Invalid Telegram File ID:* \`${button.telegramFileId}\`\n\n💡 *Owner Tip:* Is bot chat me direct APK/Video file send/forward karein to update!`;
      }
      await safeReply(ctx, errorText, { reply_markup: bottomKb });
    }
  } else if (button.type === 'TEXT') {
    await ctx.replyWithChatAction('typing').catch(() => {});
    const msg = formatMessage(button.message || 'ℹ️ *No gadget info configured for this button.*', ctx.from);
    await safeReply(ctx, msg, {
      reply_markup: bottomKb
    });
  } else if (button.type === 'LINK' || button.type === 'CHANNEL') {
    const url = button.url || 'https://t.me';
    const text = button.message 
      ? formatMessage(button.message, ctx.from) 
      : `🚪 *𝗔𝗡𝗬𝗪𝗛𝗘𝗥𝗘 𝗗𝗢𝗢𝗥 𝗚𝗔𝗗𝗚𝗘𝗧*\n\n🔗 *Official Link:* ${url}`;
    await safeReply(ctx, text, {
      reply_markup: bottomKb
    });
  }
}

/**
 * Handles clicks on interactive sub-buttons (nested keys, files, videos)
 */
export async function handleSubButtonClick(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  await ctx.answerCallbackQuery().catch(() => {});

  const subBtnId = data.replace('subbtn:', '');
  const buttons = await firestoreService.getButtons();
  const subBtn = buttons.find(b => b.id === subBtnId);

  if (!subBtn) {
    return safeReply(ctx, '⚠️ *Option not found or removed.*');
  }

  // Find parent button to offer back navigation
  const parentId = subBtn.url?.replace('parent:', '');
  const parentBtn = buttons.find(b => b.id === parentId);

  const backKeyboard = new InlineKeyboard();
  if (parentBtn) {
    backKeyboard.text(`🔙 𝗕𝗮𝗰𝗸 𝘁𝗼 ${parentBtn.name}`, `parent_view:${parentId}`).row();
  }
  backKeyboard.text('🏠 𝗠𝗮𝗶𝗻 𝗠𝗲𝗻𝘂', 'flow:menu');

  if (subBtn.type === 'FILE') {
    if (!subBtn.telegramFileId || subBtn.telegramFileId.includes('SAMPLE')) {
      const msg = `📦 *${subBtn.name}*\n\n${formatMessage(subBtn.message, ctx.from) || ''}\n\n⚠️ *File/Video abhi upload nahi hui hai.*`;
      return safeReply(ctx, msg, { reply_markup: backKeyboard });
    }

    try {
      await ctx.replyWithChatAction('upload_document').catch(() => {});
      await ctx.replyWithDocument(subBtn.telegramFileId, {
        caption: formatMessage(subBtn.message || `📦 *${subBtn.name}*`, ctx.from),
        reply_markup: backKeyboard,
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.warn('Could not send sub-file as document, trying video:', err.message);
      try {
        await ctx.replyWithVideo(subBtn.telegramFileId, {
          caption: formatMessage(subBtn.message || `🎥 *${subBtn.name}*`, ctx.from),
          reply_markup: backKeyboard,
          parse_mode: 'Markdown'
        });
      } catch (videoErr) {
        await safeReply(ctx, `❌ *Failed to deliver file:* \`${err.message}\``, {
          reply_markup: backKeyboard
        });
      }
    }
  } else if (subBtn.type === 'TEXT') {
    const text = 
      `╭──────────────────────────────╮\n` +
      `│  🔑 ${subBtn.name}  \n` +
      `╰──────────────────────────────╯\n\n` +
      formatMessage(subBtn.message || 'ℹ️ *Key Activated!*', ctx.from);

    await safeReply(ctx, text, {
      reply_markup: backKeyboard
    });
  } else if (subBtn.type === 'LINK' || subBtn.type === 'CHANNEL') {
    const url = subBtn.telegramFileId || 'https://t.me';
    await safeReply(ctx, `🔗 *${subBtn.name}*\n\n👉 [Click Here to Access](${url})`, {
      reply_markup: backKeyboard,
      disable_web_page_preview: true
    });
  }
}

/**
 * Handles navigating back to a parent sub-menu
 */
export async function handleParentView(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  await ctx.answerCallbackQuery().catch(() => {});

  const parentId = data.replace('parent_view:', '');
  const buttons = await firestoreService.getButtons();
  const parentBtn = buttons.find(b => b.id === parentId);

  if (!parentBtn) {
    return showMainMenu(ctx);
  }

  return handleButtonExecution(ctx, parentBtn);
}

/**
 * Handles clicks on dynamic inline action buttons (fallback)
 */
export async function handleDynamicButtonClick(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  await ctx.answerCallbackQuery().catch(() => {});

  const [prefix, type, buttonId] = data.split(':');
  if (prefix !== 'btn') return;

  const buttons = await firestoreService.getButtons();
  const button = buttons.find(b => b.id === buttonId);

  if (!button) {
    return safeReply(ctx, '⚠️ *Gadget not found or removed.*');
  }

  return handleButtonExecution(ctx, button);
}
