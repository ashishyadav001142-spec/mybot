import { dbService } from '../src/services/db.js';

async function seed() {
  console.log('🌱 Starting initial database seed...');

  try {
    // 1. Seed Bot Settings
    console.log('⚙️ Seeding bot settings...');
    await dbService.updateBotSettings({
      welcomeMessage: "👋 Welcome to our Official Telegram Bot!\n\nPlease click the button below to get started.",
      joinRequiredMessage: "⚠️ You must join our required channels before accessing the bot features.\n\nPlease join all channels below and click 'Check Join' to continue:",
      verifiedMessage: "🎉 Verification Successful!\n\nWelcome to the Main Menu. Choose an option below:",
      maintenanceMode: false,
      ownerTelegramId: "8833095685"
    });

    // 2. Seed Default Dynamic Buttons
    console.log('🔘 Seeding default dynamic buttons...');
    const existingButtons = await dbService.getButtons();
    if (existingButtons.length === 0) {
      await dbService.addButton({
        name: '📱 APK FILE',
        type: 'FILE',
        telegramFileId: 'SAMPLE_APK_FILE_ID',
        message: '📦 Here is the latest APK application build. Tap to install on your Android device!',
        position: 1,
        enabled: true
      });

      await dbService.addButton({
        name: '🔑 GET KEY',
        type: 'TEXT',
        message: '🔑 *License Key Access*\n\nYour free trial key is: `DEMO-2026-ACTIVE`\n\nFor unlimited VIP license keys, contact our official support team.',
        position: 2,
        enabled: true
      });

      await dbService.addButton({
        name: '📢 TELEGRAM',
        type: 'LINK',
        url: 'https://t.me/telegram',
        position: 3,
        enabled: true
      });

      await dbService.addButton({
        name: '💬 SUPPORT',
        type: 'LINK',
        url: 'https://t.me/BotSupport',
        position: 4,
        enabled: true
      });
    }

    // 3. Seed Sample Channel (Example)
    console.log('📢 Checking channels...');
    const existingChannels = await dbService.getChannels();
    if (existingChannels.length === 0) {
      await dbService.addChannel({
        title: 'Official Updates Channel',
        username: '@telegram',
        inviteUrl: 'https://t.me/telegram',
        position: 1,
        enabled: true
      });
    }

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

seed();
