import { InlineKeyboard } from 'grammy';
import { dbService as firestoreService } from '../../services/db.js';
import { isOwner } from '../middlewares/auth.js';
import { OWNER_TELEGRAM_ID } from '../../config/env.js';
import { safeReply, safeEditMessageText, formatMessage } from '../../utils/format.js';

// In-memory session for admin pending state
export const adminSessionState = new Map();

/**
 * Renders the main Admin Panel interface
 */
export async function openAdminPanel(ctx) {
  const userId = ctx.from?.id;
  if (!isOwner(userId)) {
    return safeReply(ctx, `⛔ *Access Denied*: You must be Owner (\`${OWNER_TELEGRAM_ID}\`) to access this.`);
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  await ctx.replyWithChatAction('typing').catch(() => {});

  const stats = await firestoreService.getStats();

  const text = 
    `╭──────────────────────────────╮\n` +
    `│  🛡️ 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗔𝗗𝗠𝗜𝗡 💀 𝗣𝗔𝗡𝗘𝗟  │\n` +
    `╰──────────────────────────────╯\n\n` +
    `👑 *𝗢𝗪𝗡𝗘𝗥 𝗖𝗢𝗡𝗧𝗥𝗢𝗟 𝗖𝗘𝗡𝗧𝗘𝗥*\n` +
    `🆔 *Owner ID:* \`${OWNER_TELEGRAM_ID}\`\n\n` +
    `📊 *𝗟𝗜𝗩𝗘 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗖𝗦:*\n` +
    `• 👥 Total Users: *${stats.totalUsers}*\n` +
    `• ✅ Verified Users: *${stats.verifiedUsers}*\n` +
    `• 🔘 Active Buttons: *${stats.buttonsCount}*\n` +
    `• 📢 Required Channels: *${stats.channelsCount}*\n` +
    `• 📁 Gadget Files/Videos/APKs: *${stats.filesCount}*\n\n` +
    `_Select an administration module below:_`;

  const keyboard = new InlineKeyboard()
    .text('🔘 𝗗𝘆𝗻𝗮𝗺𝗶𝗰 𝗕𝘂𝘁𝘁𝗼𝗻𝘀', 'admin:buttons')
    .text('📢 𝗥𝗲𝗾𝘂𝗶𝗿𝗲𝗱 𝗖𝗵𝗮𝗻𝗻𝗲𝗹𝘀', 'admin:channels').row()
    .text('📝 𝗘𝗱𝗶𝘁 𝗔𝗹𝗹 𝗠𝗲𝘀𝘀𝗮𝗴𝗲𝘀', 'admin:messages')
    .text('📁 𝗙𝗶𝗹𝗲𝘀 & 𝗩𝗶𝗱𝗲𝗼𝘀', 'admin:files').row()
    .text('⚙️ 𝗕𝗼𝘁 𝗦𝗲𝘁𝘁𝗶𝗻𝗴𝘀', 'admin:settings')
    .text('📣 𝗕𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 𝗠𝘀𝗴', 'admin:broadcast').row()
    .text('🔄 𝗥𝗲𝗳𝗿𝗲𝘀𝗵 𝗦𝘁𝗮𝘁𝘀', 'admin:panel')
    .text('🔙 𝗠𝗮𝗶𝗻 𝗠𝗲𝗻𝘂', 'flow:menu');

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Messages Management Sub-panel: Allows editing Welcome, Join prompt, Verified messages
 */
export async function showMessagesManager(ctx) {
  if (!isOwner(ctx.from?.id)) return;

  const settings = await firestoreService.getBotSettings();

  const text = 
    `╭──────────────────────────────╮\n` +
    `│    📝 𝗠𝗘𝗦𝗦𝗔𝗚𝗘𝗦 𝗠𝗔𝗡𝗔𝗚𝗘𝗥       │\n` +
    `╰──────────────────────────────╯\n\n` +
    `👑 *𝗟𝗜𝗩𝗘 𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗖𝗨𝗦𝗧𝗢𝗠𝗜𝗭𝗔𝗧𝗜𝗢𝗡*\n` +
    `_You can write and edit every single message sent by this bot!_\n\n` +
    `1️⃣ *Welcome Message* (On /start & Menu):\n` +
    `\`\`\`\n${settings.welcomeMessage || '👋 *Welcome, {name}!*'}\n\`\`\`\n\n` +
    `2️⃣ *Join Required Prompt* (When channels pending):\n` +
    `\`\`\`\n${settings.joinRequiredMessage || '🔔 *𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹 𝗖𝗵𝗮𝗻𝗻𝗲𝗹 𝗧𝗼 𝗨𝗻𝗹𝗼𝗰𝗸:*'}\n\`\`\`\n\n` +
    `3️⃣ *Verification Success Message* (When all joined):\n` +
    `\`\`\`\n${settings.verifiedMessage || '👋 *Welcome, {name}!*'}\n\`\`\`\n\n` +
    `💡 *Dynamic Placeholders you can use:*\n` +
    `• \`{name}\` - User's name\n` +
    `• \`{username}\` - User's @username\n` +
    `• \`{id}\` - User's Telegram ID\n\n` +
    `_Tap a button below to edit any message live:_`;

  const keyboard = new InlineKeyboard()
    .text('✏️ Edit Welcome Message', 'admin:edit_msg:welcome').row()
    .text('✏️ Edit Join Prompt', 'admin:edit_msg:join').row()
    .text('✏️ Edit Verified Success', 'admin:edit_msg:verified').row()
    .text('🔘 Edit Button Messages / Captions', 'admin:buttons').row()
    .text('🔄 Reset Messages to Default', 'admin:msg_reset').row()
    .text('🔙 Back to Dashboard', 'admin:panel');

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Buttons Management Sub-panel
 */
export async function showButtonsManager(ctx) {
  if (!isOwner(ctx.from?.id)) return;

  const buttons = await firestoreService.getButtons();
  // Filter top-level main buttons
  const mainButtons = buttons.filter(b => !b.url || !b.url.startsWith('parent:'));

  let text = `🔘 *DYNAMIC BUTTONS & MENUS MANAGER*\n\n`;

  if (mainButtons.length === 0) {
    text += `_No buttons created yet._\n`;
  } else {
    text += `_Click any button to view & edit details, add nested sub-buttons/keys/files:_\n\n`;
    mainButtons.forEach((b, i) => {
      const statusIcon = b.enabled !== false ? '✅' : '⏸️';
      const subCount = buttons.filter(sub => sub.url === `parent:${b.id}`).length;
      const subTag = subCount > 0 ? ` 📂 [${subCount} Sub-options]` : '';
      text += `${i + 1}. ${statusIcon} *${b.name}* [${b.type}]${subTag}\n`;
    });
  }

  const keyboard = new InlineKeyboard();

  mainButtons.forEach(b => {
    const toggleText = b.enabled !== false ? '⏸️' : '▶️';
    keyboard
      .text(`⚙️ ${b.name}`, `admin:btn_view:${b.id}`)
      .text(toggleText, `admin:btn_toggle:${b.id}`)
      .text('🗑️', `admin:btn_del:${b.id}`)
      .row();
  });

  keyboard
    .text('➕ Add New Main Button', 'admin:btn_add').row()
    .text('🔙 Back to Dashboard', 'admin:panel');

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Single Button Detail View (Allows editing name, message, URL/file, and adding Sub-Buttons)
 */
export async function showButtonDetail(ctx, buttonId) {
  if (!isOwner(ctx.from?.id)) return;

  const buttons = await firestoreService.getButtons();
  const b = buttons.find(btn => btn.id === buttonId);
  if (!b) {
    return showButtonsManager(ctx);
  }

  const subButtons = buttons.filter(sub => sub.url === `parent:${buttonId}`);

  const status = b.enabled !== false ? '🟢 Active' : '🔴 Disabled';
  let text =
    `🔘 *BUTTON DETAIL & EDIT*\n\n` +
    `• *Name:* *${b.name}*\n` +
    `• *Type:* \`${b.type}\`\n` +
    `• *Status:* ${status}\n` +
    (b.url && !b.url.startsWith('parent:') ? `• *URL:* ${b.url}\n` : '') +
    (b.telegramFileId ? `• *File/Video ID:* \`${b.telegramFileId.substring(0, 20)}...\`\n` : '') +
    `\n💬 *Current Message / Caption:*\n\`\`\`\n${b.message || 'No custom message set'}\n\`\`\`\n\n`;

  if (subButtons.length > 0) {
    text += `📂 *Nested Sub-Buttons (${subButtons.length}):*\n`;
    subButtons.forEach((s, idx) => {
      text += `  ${idx + 1}. *${s.name}* [${s.type}]\n`;
    });
    text += `\n`;
  }

  text += `_Select an action below:_`;

  const keyboard = new InlineKeyboard()
    .text('➕ Add Sub-Button (Key/File/Video)', `admin:sub_add:${b.id}`).row();

  if (subButtons.length > 0) {
    keyboard.text(`📂 Manage Sub-Buttons (${subButtons.length})`, `admin:sub_manage:${b.id}`).row();
  }

  keyboard
    .text('✏️ Edit Message / Caption', `admin:btn_edit_msg:${b.id}`).row()
    .text('✏️ Edit Button Name', `admin:btn_edit_name:${b.id}`)
    .text('🔗 Edit Link / Target', `admin:btn_edit_val:${b.id}`).row()
    .text(b.enabled !== false ? '⏸️ Disable Button' : '▶️ Enable Button', `admin:btn_toggle:${b.id}`)
    .text('🗑️ Delete Button', `admin:btn_del:${b.id}`).row();

  // If this is a sub-button itself, allow back to parent
  if (b.url && b.url.startsWith('parent:')) {
    const parentId = b.url.replace('parent:', '');
    keyboard.text('🔙 Back to Parent Menu', `admin:btn_view:${parentId}`);
  } else {
    keyboard.text('🔙 Back to Buttons', 'admin:buttons');
  }

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Sub-buttons management for a parent button
 */
export async function showSubButtonsManager(ctx, parentId) {
  if (!isOwner(ctx.from?.id)) return;

  const buttons = await firestoreService.getButtons();
  const parent = buttons.find(b => b.id === parentId);
  const subButtons = buttons.filter(sub => sub.url === `parent:${parentId}`);

  let text = `📂 *SUB-BUTTONS MANAGER: ${parent?.name || 'Category'}*\n\n`;

  if (subButtons.length === 0) {
    text += `_No sub-buttons added under this button yet._\n`;
  } else {
    text += `_When user clicks "${parent?.name}", these options will appear inside chat:_\n\n`;
    subButtons.forEach((s, idx) => {
      const statusIcon = s.enabled !== false ? '✅' : '⏸️';
      text += `${idx + 1}. ${statusIcon} *${s.name}* [${s.type}]\n`;
    });
  }

  const keyboard = new InlineKeyboard();

  subButtons.forEach(s => {
    const toggleText = s.enabled !== false ? '⏸️' : '▶️';
    keyboard
      .text(`⚙️ ${s.name}`, `admin:btn_view:${s.id}`)
      .text(toggleText, `admin:btn_toggle:${s.id}`)
      .text('🗑️', `admin:btn_del:${s.id}`)
      .row();
  });

  keyboard
    .text('➕ Add Sub-Button', `admin:sub_add:${parentId}`).row()
    .text('🔙 Back to Parent Button', `admin:btn_view:${parentId}`);

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Channels Management Sub-panel
 */
export async function showChannelsManager(ctx) {
  if (!isOwner(ctx.from?.id)) return;

  const channels = await firestoreService.getChannels();
  let text = `📢 *REQUIRED CHANNELS MANAGER*\n\n`;

  if (channels.length === 0) {
    text += `_No channels configured for verification._\n`;
  } else {
    channels.forEach((c, i) => {
      const status = c.enabled !== false ? '✅ Active' : '⏸️ Disabled';
      text += `${i + 1}. *${c.title}* (${c.username || 'No @'})\n   Status: ${status} | Link: ${c.inviteUrl || 'None'}\n`;
    });
  }

  text += `\n_Click below to toggle status or remove:_`;

  const keyboard = new InlineKeyboard();

  channels.forEach(c => {
    const toggleIcon = c.enabled !== false ? '⏸️ Disable' : '▶️ Enable';
    keyboard
      .text(`${toggleIcon} ${c.title}`, `admin:chan_toggle:${c.id}`)
      .text('🗑️ Del', `admin:chan_del:${c.id}`)
      .row();
  });

  keyboard
    .text('➕ Add Channel', 'admin:chan_add').row()
    .text('🔙 Back to Dashboard', 'admin:panel');

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Files & Videos Repository Sub-panel
 */
export async function showFilesManager(ctx) {
  if (!isOwner(ctx.from?.id)) return;

  const files = await firestoreService.getFiles();
  let text = `📁 *FILES, VIDEOS & APK REPOSITORY*\n\n`;

  if (files.length === 0) {
    text += `_No files or videos uploaded yet._\n`;
  } else {
    files.forEach((f, i) => {
      const sizeMb = f.fileSize ? (f.fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown';
      text += `${i + 1}. 📄 *${f.name}* (${sizeMb})\n   File ID: \`${f.telegramFileId}\`\n`;
    });
  }

  text += `\n💡 *How to upload:* Simply send or forward any APK, Video, Audio or Document directly into this chat!`;

  const keyboard = new InlineKeyboard()
    .text('🔄 Refresh Files', 'admin:files').row()
    .text('🔙 Back to Dashboard', 'admin:panel');

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Bot Settings Sub-panel
 */
export async function showSettingsManager(ctx) {
  if (!isOwner(ctx.from?.id)) return;

  const settings = await firestoreService.getBotSettings();

  const text = 
    `⚙️ *BOT CONFIGURATION & SETTINGS*\n\n` +
    `• *Owner ID*: \`${OWNER_TELEGRAM_ID}\` (Hardened)\n` +
    `• *Maintenance Mode*: ${settings.maintenanceMode ? '🔴 ON' : '🟢 OFF'}\n\n` +
    `📝 *Current Messages Configured:*\n` +
    `• *Welcome:* \`${settings.welcomeMessage || 'Default'}\`\n` +
    `• *Join Prompt:* \`${settings.joinRequiredMessage || 'Default'}\`\n` +
    `• *Verified:* \`${settings.verifiedMessage || 'Default'}\``;

  const keyboard = new InlineKeyboard()
    .text('📝 Edit All Messages', 'admin:messages').row()
    .text(settings.maintenanceMode ? '🟢 Disable Maintenance' : '🔴 Enable Maintenance', 'admin:toggle_maintenance').row()
    .text('🔙 Back to Dashboard', 'admin:panel');

  if (ctx.callbackQuery) {
    await safeEditMessageText(ctx, text, { reply_markup: keyboard });
  } else {
    await safeReply(ctx, text, { reply_markup: keyboard });
  }
}

/**
 * Handles all admin callback router actions
 */
export async function handleAdminCallback(ctx) {
  const userId = ctx.from?.id;
  if (!isOwner(userId)) {
    return ctx.answerCallbackQuery({
      text: '⛔ Access Denied! Only Owner (8833095685) can access Admin functions.',
      show_alert: true
    });
  }

  const data = ctx.callbackQuery.data;

  if (data === 'admin:panel') {
    await ctx.answerCallbackQuery();
    return openAdminPanel(ctx);
  }

  if (data === 'admin:messages') {
    await ctx.answerCallbackQuery();
    return showMessagesManager(ctx);
  }

  if (data === 'admin:buttons') {
    await ctx.answerCallbackQuery();
    return showButtonsManager(ctx);
  }

  if (data.startsWith('admin:btn_view:')) {
    const id = data.replace('admin:btn_view:', '');
    await ctx.answerCallbackQuery();
    return showButtonDetail(ctx, id);
  }

  if (data.startsWith('admin:sub_manage:')) {
    const parentId = data.replace('admin:sub_manage:', '');
    await ctx.answerCallbackQuery();
    return showSubButtonsManager(ctx, parentId);
  }

  if (data.startsWith('admin:sub_add:')) {
    const parentId = data.replace('admin:sub_add:', '');
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_SUB_BUTTON_INFO', parentId });

    return safeReply(
      ctx,
      `➕ *Add Sub-Button (Key / File / Video / Link)*\n\n` +
      `Please send details in this format:\n` +
      `\`NAME | TYPE | [VALUE/FILE_ID] | [MESSAGE]\`\n\n` +
      `*Types:* \`TEXT\` (for keys/info), \`FILE\` (for APK/video/doc), \`LINK\`\n\n` +
      `*Examples:*\n` +
      `• \`PUBG VIP KEY | TEXT | | 🔑 PUBG-KEY-9999-ACTIVE\`\n` +
      `• \`BGMI KEY | TEXT | | 🔑 BGMI-KEY-8888-ACTIVE\`\n` +
      `• \`Tutorial Video | FILE | <telegramFileId> | 🎥 Watch activation guide\`\n` +
      `• \`Special APK | FILE | <telegramFileId> | 📦 Download Mod APK\`\n\n` +
      `_Send details now, or send /cancel to abort._`
    );
  }

  if (data.startsWith('admin:attach_as_sub:')) {
    const fileId = data.replace('admin:attach_as_sub:', '');
    await ctx.answerCallbackQuery();

    const buttons = await firestoreService.getButtons();
    const mainButtons = buttons.filter(b => !b.url || !b.url.startsWith('parent:'));

    if (mainButtons.length === 0) {
      return safeReply(ctx, '⚠️ No main buttons found to attach this file to. Create a main button first!');
    }

    const keyboard = new InlineKeyboard();
    mainButtons.forEach(mb => {
      keyboard.text(`📁 ${mb.name}`, `admin:attach_to_parent:${fileId}:${mb.id}`).row();
    });
    keyboard.text('🔙 Cancel', 'admin:panel');

    return safeReply(ctx, `📂 *Select which Main Button/Category to add this file to:*`, {
      reply_markup: keyboard
    });
  }

  if (data.startsWith('admin:attach_to_parent:')) {
    const parts = data.replace('admin:attach_to_parent:', '').split(':');
    const [fileRecordId, parentId] = parts;
    await ctx.answerCallbackQuery();

    const files = await firestoreService.getFiles();
    const file = files.find(f => f.id === fileRecordId);
    const buttons = await firestoreService.getButtons();
    const parent = buttons.find(b => b.id === parentId);

    if (file && parent) {
      const existingSub = firestoreService.getAllSubButtons ? await firestoreService.getAllSubButtons(parentId) : [];
      await firestoreService.addButton({
        name: `📥 ${file.name.substring(0, 20)}`,
        type: 'FILE',
        url: `parent:${parentId}`,
        telegramFileId: file.telegramFileId,
        message: `📦 Download: *${file.name}*`,
        position: existingSub.length + 1,
        enabled: true
      });

      await safeReply(ctx, `✅ *File attached as Sub-Button under "${parent.name}"!*`);
      return showButtonDetail(ctx, parentId);
    }
  }

  if (data === 'admin:channels') {
    await ctx.answerCallbackQuery();
    return showChannelsManager(ctx);
  }

  if (data === 'admin:files') {
    await ctx.answerCallbackQuery();
    return showFilesManager(ctx);
  }

  if (data === 'admin:settings') {
    await ctx.answerCallbackQuery();
    return showSettingsManager(ctx);
  }

  // Edit bot messages live
  if (data === 'admin:edit_msg:welcome') {
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_WELCOME_MSG' });
    return safeReply(
      ctx,
      `✏️ *Edit Welcome Message*\n\n` +
      `Abhi jo message likhkar bhejoge, wo bot ka naya Welcome message ban jayega!\n\n` +
      `💡 *Variables:*\n` +
      `• \`{name}\` - User ka naam\n` +
      `• \`{username}\` - User ka @username\n` +
      `• \`{id}\` - User ka Telegram ID\n\n` +
      `_Send your new message now, or send /cancel to cancel._`
    );
  }

  if (data === 'admin:edit_msg:join') {
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_JOIN_MSG' });
    return safeReply(
      ctx,
      `✏️ *Edit Channel Join Required Prompt*\n\n` +
      `Abhi jo message likhkar bhejoge, wo channels list ke upar dikhayi dega!\n\n` +
      `💡 *Variables:*\n` +
      `• \`{name}\` - User ka naam\n` +
      `• \`{username}\` - User ka @username\n\n` +
      `_Send your new message now, or send /cancel to cancel._`
    );
  }

  if (data === 'admin:edit_msg:verified') {
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_VERIFIED_MSG' });
    return safeReply(
      ctx,
      `✏️ *Edit Verification Success Message*\n\n` +
      `Jab user channel join karke Check Join dabata hai aur verified hota hai, tab ye message aayega!\n\n` +
      `💡 *Variables:*\n` +
      `• \`{name}\` - User ka naam\n` +
      `• \`{username}\` - User ka @username\n\n` +
      `_Send your new message now, or send /cancel to cancel._`
    );
  }

  if (data === 'admin:msg_reset') {
    await firestoreService.updateBotSettings({
      welcomeMessage: "👋 *Welcome, {name}!*",
      joinRequiredMessage: "🔔 *𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹 𝗖𝗵𝗮𝗻𝗻𝗲𝗹 𝗧𝗼 𝗨𝗻𝗹𝗼𝗰𝗸:*",
      verifiedMessage: "👋 *Welcome, {name}!*"
    });
    await ctx.answerCallbackQuery({ text: 'All messages reset to clean defaults!' });
    return showMessagesManager(ctx);
  }

  // Edit dynamic button specifics
  if (data.startsWith('admin:btn_edit_msg:')) {
    const id = data.replace('admin:btn_edit_msg:', '');
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_BTN_MSG', buttonId: id });
    return safeReply(
      ctx,
      `✏️ *Edit Button Message / Caption*\n\n` +
      `Send the new text or file caption that should be sent when a user clicks this button.\n\n` +
      `💡 *Variables:*\n• \`{name}\` - User's name\n• \`{username}\` - User's @username\n\n` +
      `_Send your new message now, or send /cancel to cancel._`
    );
  }

  if (data.startsWith('admin:btn_edit_name:')) {
    const id = data.replace('admin:btn_edit_name:', '');
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_BTN_NAME', buttonId: id });
    return safeReply(
      ctx,
      `✏️ *Edit Button Name / Label*\n\n` +
      `Send the new name for this button (e.g. \`📦 𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧\` or \`💬 𝗦𝗨𝗣𝗣𝗢𝗥𝗧\`):\n\n` +
      `_Send your new button name now, or send /cancel to cancel._`
    );
  }

  if (data.startsWith('admin:btn_edit_val:')) {
    const id = data.replace('admin:btn_edit_val:', '');
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_BTN_VALUE', buttonId: id });
    return safeReply(
      ctx,
      `🔗 *Edit Button Target / Value*\n\n` +
      `Send the new URL (for LINK/CHANNEL type) or Telegram File ID (for FILE/VIDEO type):\n\n` +
      `_Send the value now, or send /cancel to cancel._`
    );
  }

  if (data.startsWith('admin:btn_toggle:')) {
    const id = data.replace('admin:btn_toggle:', '');
    const buttons = await firestoreService.getButtons();
    const btn = buttons.find(b => b.id === id);
    if (btn) {
      await firestoreService.updateButton(id, { enabled: btn.enabled === false ? true : false });
      await ctx.answerCallbackQuery({ text: 'Button status updated!' });
    }
    if (btn?.url && btn.url.startsWith('parent:')) {
      return showSubButtonsManager(ctx, btn.url.replace('parent:', ''));
    }
    return showButtonsManager(ctx);
  }

  if (data.startsWith('admin:btn_del:')) {
    const id = data.replace('admin:btn_del:', '');
    const buttons = await firestoreService.getButtons();
    const btn = buttons.find(b => b.id === id);
    const parentId = btn?.url?.startsWith('parent:') ? btn.url.replace('parent:', '') : null;

    await firestoreService.deleteButton(id);
    await ctx.answerCallbackQuery({ text: 'Button deleted!' });

    if (parentId) {
      return showSubButtonsManager(ctx, parentId);
    }
    return showButtonsManager(ctx);
  }

  if (data.startsWith('admin:set_apk:')) {
    const fileId = data.replace('admin:set_apk:', '');
    const files = await firestoreService.getFiles();
    const file = files.find(f => f.id === fileId);

    if (file) {
      const buttons = await firestoreService.getButtons();
      let apkBtn = buttons.find(b => b.name.includes('APK') && (!b.url || !b.url.startsWith('parent:')));

      if (!apkBtn) {
        apkBtn = await firestoreService.addButton({
          name: '📦 𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧',
          type: 'TEXT',
          message: '📦 *𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧𝗦 𝗠𝗘𝗡𝗨*\n\n🎒 *Aapko konsa APK / App chahiye? Niche select karein:*',
          position: 1,
          enabled: true
        });
      } else {
        await firestoreService.updateButton(apkBtn.id, {
          type: 'TEXT',
          telegramFileId: '',
          message: '📦 *𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧𝗦 𝗠𝗘𝗡𝗨*\n\n🎒 *Aapko konsa APK / App chahiye? Niche select karein:*'
        });
      }

      const existingSubs = firestoreService.getAllSubButtons ? await firestoreService.getAllSubButtons(apkBtn.id) : [];
      const cleanName = file.name.replace(/\.[^/.]+$/, '');

      await firestoreService.addButton({
        name: `📱 ${cleanName}`,
        type: 'FILE',
        url: `parent:${apkBtn.id}`,
        telegramFileId: file.telegramFileId,
        message: `📦 *${file.name}*\n\n🎒 *Doraemon 4D Pocket Gadget Ready!*\n⚡ *Status:* Verified & Working\nTap download to install directly!`,
        position: existingSubs.length + 1,
        enabled: true
      });

      await ctx.answerCallbackQuery({ text: `✅ Added "${cleanName}" to APK Gadgets!` });
      await safeReply(ctx, `🎉 *APK Added to Menu!*\n\nUsers who click *📦 𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧* will now see *📱 ${cleanName}* in the options, and can select it to download.`);
    }
    return showButtonsManager(ctx);
  }

  if (data.startsWith('admin:quick_btn:')) {
    const fileId = data.replace('admin:quick_btn:', '');
    const files = await firestoreService.getFiles();
    const file = files.find(f => f.id === fileId);

    if (file) {
      const buttons = await firestoreService.getButtons();
      await firestoreService.addButton({
        name: `📥 ${file.name.substring(0, 20)}`,
        type: 'FILE',
        telegramFileId: file.telegramFileId,
        message: `📦 Here is your download: *${file.name}*`,
        position: buttons.length + 1,
        enabled: true
      });

      await ctx.answerCallbackQuery({ text: `✅ Button created for ${file.name}!` });
      await safeReply(ctx, `✅ New dynamic button added to Main Menu!`);
    }
    return showButtonsManager(ctx);
  }

  if (data === 'admin:btn_add') {
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_BUTTON_INFO' });
    return safeReply(
      ctx,
      `➕ *Add New Main Button*\n\nPlease send the button details in this format:\n` +
      `\`NAME | TYPE | VALUE | POSITION\`\n\n` +
      `*Types:* \`FILE\`, \`LINK\`, \`TEXT\`, \`CHANNEL\`\n\n` +
      `*Examples:*\n` +
      `• \`📱 Download App | LINK | https://example.com | 1\`\n` +
      `• \`💬 VIP Support | TEXT | Contact @vip_support for activation | 2\`\n` +
      `• \`📦 Latest APK | FILE | <telegram_file_id> | 3\`\n\n` +
      `_Or send /cancel to cancel._`
    );
  }

  if (data.startsWith('admin:chan_toggle:')) {
    const id = data.replace('admin:chan_toggle:', '');
    const channels = await firestoreService.getChannels();
    const chan = channels.find(c => c.id === id);
    if (chan) {
      await firestoreService.updateChannel(id, { enabled: chan.enabled === false ? true : false });
      await ctx.answerCallbackQuery({ text: 'Channel status updated!' });
    }
    return showChannelsManager(ctx);
  }

  if (data.startsWith('admin:chan_del:')) {
    const id = data.replace('admin:chan_del:', '');
    await firestoreService.deleteChannel(id);
    await ctx.answerCallbackQuery({ text: 'Channel deleted!' });
    return showChannelsManager(ctx);
  }

  if (data === 'admin:chan_add') {
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_CHANNEL_INFO' });
    return safeReply(
      ctx,
      `➕ *Add Required Channel*\n\nPlease send channel details in this format:\n` +
      `\`TITLE | USERNAME_OR_CHAT_ID | INVITE_URL\`\n\n` +
      `*Example:*\n` +
      `\`Official Channel | @mychannel | https://t.me/+AbCdEf12345\`\n\n` +
      `⚠️ *IMPORTANT*: Bot MUST be added as an Administrator in that channel so it can verify memberships!`
    );
  }

  if (data === 'admin:toggle_maintenance') {
    const settings = await firestoreService.getBotSettings();
    const newStatus = !settings.maintenanceMode;
    await firestoreService.updateBotSettings({ maintenanceMode: newStatus });
    await ctx.answerCallbackQuery({ text: `Maintenance mode: ${newStatus ? 'ENABLED' : 'DISABLED'}` });
    return showSettingsManager(ctx);
  }

  if (data === 'admin:broadcast') {
    await ctx.answerCallbackQuery();
    adminSessionState.set(userId, { state: 'AWAITING_BROADCAST_MESSAGE' });
    return safeReply(
      ctx,
      `📣 *Broadcast Announcement*\n\nPlease send the message you want to broadcast to all verified bot users.\nSupports standard Markdown formatting.\n\n_Send /cancel to cancel._`
    );
  }
}
