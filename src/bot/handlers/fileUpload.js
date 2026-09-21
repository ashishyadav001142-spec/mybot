import { InlineKeyboard } from 'grammy';
import { isOwner } from '../middlewares/auth.js';
import { dbService as firestoreService } from '../../services/db.js';
import { adminSessionState, openAdminPanel, showMessagesManager, showButtonDetail, showButtonsManager } from './admin.js';
import { safeReply, formatMessage } from '../../utils/format.js';

/**
 * Handles incoming Telegram media (Documents, APKs, Videos, Photos, Audio) from Owner
 * Automatically saves to Supabase Storage and Supabase database!
 */
export async function handleMediaUpload(ctx) {
  const userId = ctx.from?.id;
  if (!isOwner(userId)) return;

  let fileId = '';
  let fileName = 'file';
  let fileSize = 0;
  let mimeType = 'application/octet-stream';
  let mediaLabel = 'File';

  if (ctx.message?.document) {
    const doc = ctx.message.document;
    fileId = doc.file_id;
    fileName = doc.file_name || 'document.apk';
    fileSize = doc.file_size || 0;
    mimeType = doc.mime_type || 'application/vnd.android.package-archive';
    mediaLabel = fileName.toLowerCase().endsWith('.apk') ? 'APK' : 'Document';
  } else if (ctx.message?.video) {
    const vid = ctx.message.video;
    fileId = vid.file_id;
    fileName = vid.file_name || `video_${Date.now()}.mp4`;
    fileSize = vid.file_size || 0;
    mimeType = vid.mime_type || 'video/mp4';
    mediaLabel = 'Video';
  } else if (ctx.message?.photo) {
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    fileId = best.file_id;
    fileName = `photo_${Date.now()}.jpg`;
    fileSize = best.file_size || 0;
    mimeType = 'image/jpeg';
    mediaLabel = 'Photo';
  } else if (ctx.message?.audio) {
    const aud = ctx.message.audio;
    fileId = aud.file_id;
    fileName = aud.file_name || `audio_${Date.now()}.mp3`;
    fileSize = aud.file_size || 0;
    mimeType = aud.mime_type || 'audio/mpeg';
    mediaLabel = 'Audio';
  } else if (ctx.message?.animation) {
    const anim = ctx.message.animation;
    fileId = anim.file_id;
    fileName = anim.file_name || `animation_${Date.now()}.mp4`;
    fileSize = anim.file_size || 0;
    mimeType = anim.mime_type || 'video/mp4';
    mediaLabel = 'Video Clip';
  }

  if (!fileId) return;

  const statusMsg = await safeReply(ctx, `⏳ *Syncing ${mediaLabel} to Supabase & Telegram...*`);

  try {
    let storageUrl = '';
    
    // If file is <= 20MB, mirror to Supabase Storage
    if (fileSize && fileSize <= 20 * 1024 * 1024) {
      try {
        const fileInfo = await ctx.api.getFile(fileId);
        if (fileInfo.file_path && process.env.TELEGRAM_BOT_TOKEN) {
          const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
          const fileRes = await fetch(downloadUrl);
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (firestoreService.uploadToStorage) {
              storageUrl = await firestoreService.uploadToStorage(fileName, buffer, mimeType);
            }
          }
        }
      } catch (err) {
        console.warn('Could not mirror file buffer to Supabase storage:', err.message);
      }
    }

    // Save metadata in Supabase files table
    const fileRecord = await firestoreService.addFile({
      name: fileName,
      telegramFileId: fileId,
      fileSize: fileSize,
      mimeType: mimeType,
      description: `Uploaded ${mediaLabel} by Owner (8833095685)`,
      storageUrl: storageUrl || ''
    });

    const sizeMb = fileSize ? (fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown';

    const keyboard = new InlineKeyboard()
      .text('📱 Set as Main APK Button', `admin:set_apk:${fileRecord.id}`).row()
      .text('➕ Create as New Main Button', `admin:quick_btn:${fileRecord.id}`).row()
      .text('📂 Add as Sub-Button under Menu', `admin:attach_as_sub:${fileRecord.id}`).row()
      .text('📁 View All Files', 'admin:files');

    const storageLine = storageUrl ? `• *Supabase Storage:* [Direct Cloud Link](${storageUrl})\n` : '';

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `✅ *${mediaLabel} Successfully Stored in Supabase!*\n\n` +
      `• *Name:* \`${fileName}\`\n` +
      `• *Type:* \`${mediaLabel}\` (${mimeType})\n` +
      `• *Size:* \`${sizeMb}\`\n` +
      storageLine +
      `• *Telegram File ID:*\n\`${fileId}\`\n\n` +
      `_Choose how you want to use this ${mediaLabel} below:_`,
      {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }
    );
  } catch (err) {
    console.error('Error handling media upload:', err);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `❌ Failed to save ${mediaLabel} in Supabase: ${err.message}`
    );
  }
}

/**
 * Handles text input from Owner when in interactive prompt sessions
 */
export async function handleAdminTextSession(ctx) {
  const userId = ctx.from?.id;
  if (!isOwner(userId)) return false;

  const session = adminSessionState.get(userId);
  if (!session) return false;

  const rawText = ctx.message?.text;
  if (!rawText) return false;
  const text = rawText.trim();

  if (text === '/cancel') {
    adminSessionState.delete(userId);
    await safeReply(ctx, '❌ Action cancelled.');
    await openAdminPanel(ctx);
    return true;
  }

  // 1. Handle Welcome Message update
  if (session.state === 'AWAITING_WELCOME_MSG') {
    adminSessionState.delete(userId);
    await firestoreService.updateBotSettings({ welcomeMessage: rawText });
    const preview = formatMessage(rawText, ctx.from);

    await safeReply(
      ctx,
      `✅ *Welcome Message Live Updated!*\n\n` +
      `Ab jo bhi user \`/start\` ya menu dabayega, use ye message milega:\n\n` +
      `*Live Preview:*\n${preview}`
    );
    await showMessagesManager(ctx);
    return true;
  }

  // 2. Handle Join Required Message update
  if (session.state === 'AWAITING_JOIN_MSG') {
    adminSessionState.delete(userId);
    await firestoreService.updateBotSettings({ joinRequiredMessage: rawText });
    const preview = formatMessage(rawText, ctx.from);

    await safeReply(
      ctx,
      `✅ *Join Required Prompt Live Updated!*\n\n` +
      `Ab unjoined users ko channels ke upar ye prompt dikhega:\n\n` +
      `*Live Preview:*\n${preview}`
    );
    await showMessagesManager(ctx);
    return true;
  }

  // 3. Handle Verified Message update
  if (session.state === 'AWAITING_VERIFIED_MSG') {
    adminSessionState.delete(userId);
    await firestoreService.updateBotSettings({ verifiedMessage: rawText });
    const preview = formatMessage(rawText, ctx.from);

    await safeReply(
      ctx,
      `✅ *Verified Success Message Live Updated!*\n\n` +
      `Ab channel verification successful hone par ye message aayega:\n\n` +
      `*Live Preview:*\n${preview}`
    );
    await showMessagesManager(ctx);
    return true;
  }

  // 4. Handle Button Message / Caption update
  if (session.state === 'AWAITING_BTN_MSG') {
    const buttonId = session.buttonId;
    adminSessionState.delete(userId);

    await firestoreService.updateButton(buttonId, { message: rawText });
    const preview = formatMessage(rawText, ctx.from);

    await safeReply(
      ctx,
      `✅ *Button Message/Caption Updated!*\n\n` +
      `*Live Preview:*\n${preview}`
    );
    await showButtonDetail(ctx, buttonId);
    return true;
  }

  // 5. Handle Button Name update
  if (session.state === 'AWAITING_BTN_NAME') {
    const buttonId = session.buttonId;
    adminSessionState.delete(userId);

    await firestoreService.updateButton(buttonId, { name: text });

    await safeReply(ctx, `✅ *Button Name Updated to:* *${text}*`);
    await showButtonDetail(ctx, buttonId);
    return true;
  }

  // 6. Handle Button Value / URL / File ID update
  if (session.state === 'AWAITING_BTN_VALUE') {
    const buttonId = session.buttonId;
    adminSessionState.delete(userId);

    const buttons = await firestoreService.getButtons();
    const btn = buttons.find(b => b.id === buttonId);
    const patch = {};
    if (btn && btn.type === 'FILE') {
      patch.telegramFileId = text;
    } else {
      patch.url = text;
    }

    await firestoreService.updateButton(buttonId, patch);
    await safeReply(ctx, `✅ *Button Target / Value Updated!*`);
    await showButtonDetail(ctx, buttonId);
    return true;
  }

  // 7. Handle Add Sub-Button (Nested under a parent button)
  if (session.state === 'AWAITING_SUB_BUTTON_INFO') {
    const parentId = session.parentId;
    const parts = text.split('|').map(p => p.trim());
    if (parts.length < 2) {
      await safeReply(
        ctx,
        `⚠️ *Invalid Format!* Please use:\n\`NAME | TYPE | [VALUE] | [MESSAGE]\`\n\nExamples:\n• \`PUBG Key | TEXT | | 🔑 PUBG-VIP-2026-ACTIVE\`\n• \`Demo Video | FILE | <telegramFileId> | 🎥 Watch Video\``
      );
      return true;
    }

    const [name, rawType, value, customMsg] = parts;
    let type = rawType ? rawType.toUpperCase() : 'TEXT';
    if (!['FILE', 'LINK', 'TEXT', 'CHANNEL'].includes(type)) {
      type = 'TEXT';
    }

    const existingSub = firestoreService.getAllSubButtons ? await firestoreService.getAllSubButtons(parentId) : [];

    const btnData = {
      name,
      type,
      url: `parent:${parentId}`,
      telegramFileId: type === 'FILE' ? (value || '') : '',
      message: customMsg || (type === 'TEXT' ? (value || '') : ''),
      position: existingSub.length + 1,
      enabled: true
    };

    if (type === 'LINK' || type === 'CHANNEL') {
      btnData.telegramFileId = value || '';
    }

    await firestoreService.addButton(btnData);
    adminSessionState.delete(userId);

    await safeReply(ctx, `✅ *Sub-Button Added Successfully!*\n\n• Name: *${name}*\n• Type: \`${type}\`\n• Attached under parent button!`);
    await showButtonDetail(ctx, parentId);
    return true;
  }

  // 8. Handle Add Main Button
  if (session.state === 'AWAITING_BUTTON_INFO') {
    const parts = text.split('|').map(p => p.trim());
    if (parts.length < 3) {
      await safeReply(
        ctx,
        `⚠️ *Invalid Format!* Please use:\n\`NAME | TYPE | VALUE | [POSITION]\`\n\nExample:\n\`📱 Download APK | FILE | <telegram_file_id> | 1\``
      );
      return true;
    }

    const [name, rawType, value, posStr] = parts;
    const type = rawType.toUpperCase();
    const position = posStr ? parseInt(posStr, 10) : 0;

    const btnData = {
      name,
      type,
      position: isNaN(position) ? 0 : position,
      enabled: true
    };

    if (type === 'FILE') {
      btnData.telegramFileId = value;
    } else if (type === 'LINK' || type === 'CHANNEL') {
      btnData.url = value;
    } else {
      btnData.message = value;
    }

    await firestoreService.addButton(btnData);
    adminSessionState.delete(userId);

    await safeReply(ctx, `✅ *Button Added Successfully!*\n\n• Name: *${name}*\n• Type: *${type}*\n• Position: *${btnData.position}*`);
    await openAdminPanel(ctx);
    return true;
  }

  // 9. Handle Add Channel
  if (session.state === 'AWAITING_CHANNEL_INFO') {
    const parts = text.split('|').map(p => p.trim());
    if (parts.length < 2) {
      await safeReply(
        ctx,
        `⚠️ *Invalid Format!* Please use:\n\`TITLE | USERNAME_OR_CHAT_ID | [INVITE_URL]\`\n\nExample:\n\`Official Channel | @mychannel | https://t.me/+AbCdEf\``
      );
      return true;
    }

    const [title, username, inviteUrl] = parts;

    await firestoreService.addChannel({
      title,
      username,
      inviteUrl: inviteUrl || (username.startsWith('@') ? `https://t.me/${username.replace('@', '')}` : ''),
      enabled: true
    });

    adminSessionState.delete(userId);

    await safeReply(
      ctx,
      `✅ *Channel Added to Verification List!*\n\n• Title: *${title}*\n• Username/ID: *${username}*\n\n⚠️ Ensure the bot is an Administrator in this channel.`
    );
    await openAdminPanel(ctx);
    return true;
  }

  // 10. Handle Broadcast Message
  if (session.state === 'AWAITING_BROADCAST_MESSAGE') {
    adminSessionState.delete(userId);

    const verifiedUsers = await firestoreService.getAllVerifiedUsers();
    if (verifiedUsers.length === 0) {
      await safeReply(ctx, '⚠️ No verified users found to broadcast to.');
      await openAdminPanel(ctx);
      return true;
    }

    const statusMsg = await safeReply(ctx, `🚀 Starting broadcast to ${verifiedUsers.length} verified users...`);
    let sentCount = 0;
    let failCount = 0;

    for (const u of verifiedUsers) {
      try {
        await ctx.api.sendMessage(u.telegramId, text, { parse_mode: 'Markdown' });
        sentCount++;
      } catch (err) {
        failCount++;
      }
      // Gentle throttle to respect Telegram rate limits
      await new Promise(r => setTimeout(r, 40));
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `📢 *Broadcast Completed!*\n\n• Successfully Sent: *${sentCount}*\n• Failed / Blocked: *${failCount}*\n• Total Target: *${verifiedUsers.length}*`,
      { parse_mode: 'Markdown' }
    );
    await openAdminPanel(ctx);
    return true;
  }

  return false;
}
