import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from '../config/env.js';
import { requireOwner, isOwner } from './middlewares/auth.js';
import { handleStart } from './handlers/start.js';
import { verifyUserChannels } from './handlers/verification.js';
import { 
  showMainMenu, 
  handleDynamicButtonClick, 
  handleButtonExecution, 
  handleSubButtonClick, 
  handleParentView 
} from './handlers/menu.js';
import { dbService as firestoreService } from '../services/db.js';
import { 
  openAdminPanel, 
  showButtonsManager, 
  showChannelsManager, 
  showFilesManager, 
  showMessagesManager,
  handleAdminCallback 
} from './handlers/admin.js';
import { handleMediaUpload, handleAdminTextSession } from './handlers/fileUpload.js';
import { toSmallCaps } from '../utils/format.js';

let bot = null;

export function initBot() {
  if (!config.botToken) {
    console.warn('⚠️ [Bot] TELEGRAM_BOT_TOKEN is not defined in environment. Bot initialization skipped.');
    return null;
  }

  bot = new Bot(config.botToken);

  // ==================== ERROR BOUNDARY ====================
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`🚨 [Grammy Error] Update ID ${ctx.update.update_id} failed:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error(`Telegram API Error: ${e.description} (code: ${e.error_code})`);
    } else if (e instanceof HttpError) {
      console.error(`Network HTTP Error: ${e.message}`);
    } else {
      console.error(`Unknown Error:`, e);
    }
  });

  // Set Telegram Native Command Menu & Chat Menu Button (3 lines button: ONLY /start)
  bot.api.setMyCommands([
    { command: 'start', description: '🚀 sᴛᴀʀᴛ' }
  ]).catch(err => console.warn('Could not register bot commands:', err.message));

  bot.api.setChatMenuButton({
    menu_button: { type: 'commands' }
  }).catch(err => console.warn('Could not set chat menu button:', err.message));

  // ==================== PUBLIC USER COMMANDS ====================
  bot.command('start', handleStart);
  bot.command('restart', handleStart);
  bot.command('menu', showMainMenu);

  // ==================== ADMIN ONLY COMMANDS ====================
  // Strictly validated by requireOwner middleware (Owner ID: 8833095685)
  bot.command('admin', requireOwner, openAdminPanel);
  bot.command('buttons', requireOwner, showButtonsManager);
  bot.command('channels', requireOwner, showChannelsManager);
  bot.command('files', requireOwner, showFilesManager);
  bot.command('messages', requireOwner, showMessagesManager);


  // ==================== CALLBACK ROUTING ====================
  bot.callbackQuery('flow:start_verification', async (ctx) => {
    await verifyUserChannels(ctx, false);
  });

  bot.callbackQuery('flow:check_join', async (ctx) => {
    await verifyUserChannels(ctx, true);
  });

  bot.callbackQuery('flow:restart', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await handleStart(ctx);
  });

  bot.callbackQuery('flow:menu', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.replyWithChatAction('typing').catch(() => {});
    await showMainMenu(ctx);
  });

  // Interactive Sub-Button clicks (e.g. subbtn:123)
  bot.callbackQuery(/^subbtn:/, handleSubButtonClick);

  // Back to parent sub-menu
  bot.callbackQuery(/^parent_view:/, handleParentView);

  // Dynamic button clicks (fallback)
  bot.callbackQuery(/^btn:/, handleDynamicButtonClick);

  // Admin panel callbacks (admin:*)
  bot.callbackQuery(/^admin:/, requireOwner, handleAdminCallback);

  // ==================== UNIVERSAL MEDIA UPLOADS ====================
  // Handles Documents, APKs, Videos, Photos, Audio, Animations from Owner
  bot.on(
    ['message:document', 'message:video', 'message:photo', 'message:audio', 'message:animation'],
    handleMediaUpload
  );

  // Text handling: Persistent bottom keyboard buttons & Admin text sessions
  bot.on('message:text', async (ctx, next) => {
    const handled = await handleAdminTextSession(ctx);
    if (handled) return;

    const text = ctx.message?.text?.trim();
    if (!text) return next();

    const userId = ctx.from?.id;

    // 1. Big Restart / Start Button in Center
    const isRestartOrStart = [
      '🔄 ʀᴇsᴛᴀʀᴛ', '🔄 RESTART', '🔄 𝗥𝗘𝗦𝗧𝗔𝗥𝗧', '🔄 ʀᴇsᴛᴀʀᴛ 💀', '🚀 ʀᴇsᴛᴀʀᴛ', '🚀 RESTART', 'Restart', 'restart', 'RESTART', '/restart',
      '🚀 𝗦𝗧𝗔𝗥𝗧 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀', '🚀 START DORAEMON PANEL 💀', '🚀 𝗦𝗧𝗔𝗥𝗧 / 𝗠𝗘𝗡𝗨', '🚀 START / MENU', '🚀 START', 'Start', 'start', 'START', '/start'
    ].includes(text) || text.includes('ʀᴇsᴛᴀʀᴛ') || text.toLowerCase() === 'restart' || text.toLowerCase() === 'start';

    if (isRestartOrStart) {
      await ctx.replyWithChatAction('typing').catch(() => {});
      return handleStart(ctx);
    }

    // 2. Refresh Menu
    if ([
      '🔄 ʀᴇғʀᴇsʜ ᴍᴇɴᴜ', '🔄 REFRESH MENU', '🔄 𝗥𝗘𝗙𝗥𝗘𝗦𝗛 𝗠𝗘𝗡𝗨', '🔄 ʀᴇғʀᴇsʜ', '🔄 REFRESH', '🔄 𝗥𝗘𝗙𝗥𝗘𝗦𝗛'
    ].includes(text) || text.includes('ʀᴇғʀᴇsʜ')) {
      await ctx.replyWithChatAction('typing').catch(() => {});
      return showMainMenu(ctx);
    }

    // 3. Admin Panel
    if ([
      '🛡️ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ', '🛡️ ADMIN PANEL', '🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟', '/admin'
    ].includes(text) || text.includes('ᴀᴅᴍɪɴ')) {
      if (isOwner(userId)) {
        return openAdminPanel(ctx);
      }
    }

    // 4. Dynamic buttons (APKs, VIP Keys, Links from bottom keyboard outside chat)
    const buttons = await firestoreService.getButtons();
    const matchedButton = buttons.find(b => {
      const bName = (b.name || '').trim();
      const bSmall = toSmallCaps(bName);
      const tSmall = toSmallCaps(text);
      return (
        bName === text ||
        bName.toLowerCase() === text.toLowerCase() ||
        bSmall === tSmall ||
        bSmall === text ||
        bName === tSmall
      );
    });
    if (matchedButton) {
      return handleButtonExecution(ctx, matchedButton);
    }

    return next();
  });

  console.log('🤖 [Bot] Telegram Bot handlers registered successfully.');
  return bot;
}

export { bot };
