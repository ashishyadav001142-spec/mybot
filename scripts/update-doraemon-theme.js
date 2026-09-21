import WebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

import { supabaseService } from '../src/services/supabaseService.js';

async function updateAll() {
  console.log('⚡ Updating Supabase with Doraemon stylish theme...');

  // 1. Update Settings
  await supabaseService.updateBotSettings({
    welcomeMessage: `╭──────────────────────────────╮\n│   🔔 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀 𝗕𝗢𝗧   │\n╰──────────────────────────────╯\n\n👋 *𝗛𝗲𝗹𝗹𝗼 𝗖𝗵𝗮𝗺𝗽!*\n𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 **𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀 𝗕𝗢𝗧**\n\n🎒 *𝟰𝗗 𝗣𝗼𝗰𝗸𝗲𝘁 𝗚𝗮𝗱𝗴𝗲𝘁𝘀 & 𝗩𝗜𝗣 𝗧𝗼𝗼𝗹𝘀*\n⚡ *𝗨𝗹𝘁𝗿𝗮-𝗙𝗮𝘀𝘁 • 𝗦𝗲𝗰𝘂𝗿𝗲 • 𝗣𝗿𝗲𝗺𝗶𝘂𝗺*\n\n👇 *𝗖𝗹𝗶𝗰𝗸 𝗯𝗲𝗹𝗼𝘄 𝘁𝗼 𝘂𝗻𝗹𝗼𝗰𝗸 𝟰𝗗 𝗣𝗼𝗰𝗸𝗲𝘁:*`,
    joinRequiredMessage: `╭──────────────────────────────╮\n│   ⚠️ 𝗝𝗢𝗜𝗡 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗗 ⚠️         │\n╰──────────────────────────────╯\n\n🔔 *𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀 𝗩𝗘𝗥𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡*\n\n🎒 *𝟰𝗗 𝗣𝗼𝗰𝗸𝗲𝘁 𝗚𝗮𝗱𝗴𝗲𝘁𝘀 𝘂𝗻𝗹𝗼𝗰𝗸 𝗸𝗮𝗿𝗻𝗲 𝗸𝗲 𝗹𝗶𝘆𝗲 𝗻𝗶𝗰𝗵𝗲 𝗱𝗶𝘆𝗲 𝗴𝗮𝘆𝗲 𝗰𝗵𝗮𝗻𝗻𝗲𝗹𝘀 𝗷𝗼𝗶𝗻 𝗸𝗮𝗿𝗲𝗶𝗻:*\n\n👇 *𝗝𝗼𝗶𝗻 𝗸𝗮𝗿𝗸𝗲 𝗖𝗵𝗲𝗰𝗸 𝗝𝗼𝗶𝗻 𝗽𝗮𝗿 𝘁𝗮𝗽 𝗸𝗮𝗿𝗲𝗶𝗻:*`,
    verifiedMessage: `╭──────────────────────────────╮\n│   🎉 𝗩𝗘𝗥𝗜𝗙𝗜𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦        │\n╰──────────────────────────────╯\n\n🔔 *𝟰𝗗 𝗣𝗼𝗰𝗸𝗲𝘁 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱!*\n𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 **𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗣𝗔𝗡𝗘𝗟 💀 𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨**\n\n⚡ *𝗦𝗲𝗹𝗲𝗰𝘁 𝗮 𝗚𝗮𝗱𝗴𝗲𝘁 𝗯𝗲𝗹𝗼𝘄:*`
  });

  // 2. Update Dynamic Buttons
  await supabaseService.updateButton('9a5c3e46-4cdf-4f70-90d8-c4fd1a49a63a', {
    name: '📦 𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧',
    message: '📦 *𝗗𝗢𝗥𝗔 𝗔𝗣𝗞 𝗚𝗔𝗗𝗚𝗘𝗧 𝗕𝗨𝗜𝗟𝗗*\n\n🎒 *Doraemon 4D Pocket Application*\n⚡ *Version:* `v2.5.0-ULTRA`\n🛡️ *Security:* `100% Anti-Ban / Verified`\n\n👇 Tap below to install on your Android device!'
  });

  await supabaseService.updateButton('30c645dc-2be6-4c07-8915-cc3c97d427e3', {
    name: '🔑 𝗩𝗜𝗣 𝗟𝗜𝗖𝗘𝗡𝗦𝗘 𝗞𝗘𝗬',
    message: '🔑 *𝗩𝗜𝗣 𝗟𝗜𝗖𝗘𝗡𝗦𝗘 𝗞𝗘𝗬 𝗔𝗖𝗖𝗘𝗦𝗦*\n\n🎒 *4D Pocket Key:* `DORA-VIP-2026-ACTIVE`\n⚡ *Status:* `ACTIVE & UNLIMITED`\n🔔 *Enjoy all Doraemon Panel gadgets!*'
  });

  await supabaseService.updateButton('16955406-52c8-40f4-a327-49603055dbc9', {
    name: '📢 𝗢𝗙𝗙𝗜𝗖𝗜𝗔𝗟 𝗖𝗛𝗔𝗡𝗡𝗘𝗟',
    url: 'https://t.me/telegram'
  });

  await supabaseService.updateButton('7bf60b8b-e592-4d1e-81cc-786be02b27f4', {
    name: '💬 𝗗𝗢𝗥𝗔 𝗦𝗨𝗣𝗣𝗢𝗥𝗧',
    url: 'https://t.me/BotSupport'
  });

  console.log('✅ Settings and Buttons updated to Doraemon stylish theme successfully!');
  process.exit(0);
}

updateAll().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
