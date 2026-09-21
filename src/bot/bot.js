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

  // Set Telegram Native Command Menu & Chat Menu Button
  bot.api.setMyCommands([
    { command: 'start', description: '🚀 𝗦𝗧𝗔𝗥𝗧 / 𝗠𝗘𝗡𝗨' },
    { command: 'restart', description: '🔄 𝗥𝗘𝗦𝗧𝗔𝗥𝗧' },
    { command: 'menu', description: '🎒 𝟰𝗗 𝗣𝗼𝗰𝗸𝗲𝘁 𝗚𝗮𝗱𝗴𝗲𝘁 𝗠𝗲𝗻𝗨' },
    { command: 'admin', description: '🛡️ 𝗢𝘄𝗻𝗲𝗿 𝗔𝗱𝗺𝗶𝗻 𝗣𝗮𝗻𝗲𝗹' }
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
      '🔄 𝗥𝗘𝗦𝗧𝗔𝗥𝗧', '🔄 RESTART', '🔄 𝗥𝗘𝗦𝗧𝗔𝗥𝗧 💀', '🚀 𝗥𝗘𝗦𝗧𝗔𝗥𝗧', '🚀 RESTART', 'Restart', 'restart', 'RESTART', '/restart',
      '🚀 𝗦𝗧𝗔𝗥𝗧 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀', '🚀 START DORAEMON PANEL 💀', '🚀 𝗦𝗧𝗔𝗥𝗧 / 𝗠𝗘𝗡𝗨', '🚀 START / MENU', '🚀 START', '🚀 𝗨𝗡𝗟𝗢𝗖𝗞 𝟰𝗗 𝗣𝗢𝗖𝗞𝗘𝗧', 'Start', 'start', 'START', '/start'
    ].includes(text) || text.toLowerCase() === 'restart' || text.toLowerCase() === 'start';

    if (isRestartOrStart) {
      await ctx.replyWithChatAction('typing').catch(() => {});
      return handleStart(ctx);
    }

    // 2. Refresh Menu
    if (['🔄 𝗥𝗘𝗙𝗥𝗘𝗦𝗛 𝗠𝗘𝗡𝗨', '🔄 REFRESH MENU', '🔄 𝗥𝗘𝗙𝗥𝗘𝗦𝗛', '🔄 REFRESH'].includes(text)) {
      await ctx.replyWithChatAction('typing').catch(() => {});
      return showMainMenu(ctx);
    }

    // 3. Admin Panel
    if (['🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟', '🛡️ ADMIN PANEL', '/admin'].includes(text)) {
      if (isOwner(userId)) {
        return openAdminPanel(ctx);
      }
    }

    // 4. Dynamic buttons (APKs, VIP Keys, Links from bottom keyboard outside chat)
    const buttons = await firestoreService.getButtons();
    const matchedButton = buttons.find(b => b.name?.trim() === text || b.name?.toLowerCase() === text.toLowerCase());
    if (matchedButton) {
      return handleButtonExecution(ctx, matchedButton);
    }

    return next();
  });

  console.log('🤖 [Bot] Telegram Bot handlers registered successfully.');
  return bot;
}

export { bot };
