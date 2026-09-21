// Redirect console.log to console.error so MCP JSON-RPC stdio protocol is never corrupted
console.log = console.error;

import WebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Bot } from 'grammy';
import { supabaseService } from '../services/supabaseService.js';

const server = new McpServer({
  name: 'telegram-bot-mcp',
  version: '1.0.0'
});

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = botToken ? new Bot(botToken) : null;

// Tool 1: get_bot_info
server.tool(
  'get_bot_info',
  'Get Telegram Bot details including username, ID, and live connection status',
  {},
  async () => {
    if (!bot) {
      return {
        content: [{ type: 'text', text: 'Telegram Bot Token is not configured.' }]
      };
    }
    try {
      const me = await bot.api.getMe();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'online',
            id: me.id,
            firstName: me.first_name,
            username: `@${me.username}`,
            canJoinGroups: me.can_join_groups,
            supportsInlineQueries: me.supports_inline_queries
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to fetch bot info: ${err.message}` }]
      };
    }
  }
);

// Tool 2: get_bot_stats
server.tool(
  'get_bot_stats',
  'Fetch live statistics from Supabase (total users, verified users, channels, dynamic buttons, uploaded files)',
  {},
  async () => {
    try {
      const stats = await supabaseService.getStats();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching stats: ${err.message}` }]
      };
    }
  }
);

// Tool 3: list_buttons
server.tool(
  'list_buttons',
  'List all dynamic menu buttons registered in Supabase database',
  {},
  async () => {
    try {
      const buttons = await supabaseService.getButtons();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(buttons, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error listing buttons: ${err.message}` }]
      };
    }
  }
);

// Tool 4: add_button
server.tool(
  'add_button',
  'Create a new dynamic button in Supabase (types: FILE, LINK, TEXT, CHANNEL)',
  {
    name: z.string().describe('Display text on the button, e.g. "📱 DOWNLOAD APK"'),
    type: z.enum(['FILE', 'LINK', 'TEXT', 'CHANNEL']).describe('Type of button action'),
    url: z.string().optional().describe('URL if type is LINK or CHANNEL'),
    telegramFileId: z.string().optional().describe('Telegram file_id if type is FILE'),
    message: z.string().optional().describe('Markdown text response if type is TEXT or FILE caption'),
    position: z.number().default(1).describe('Position order in menu'),
    enabled: z.boolean().default(true).describe('Whether the button is visible')
  },
  async (args) => {
    try {
      const id = await supabaseService.addButton({
        name: args.name,
        type: args.type,
        url: args.url || '',
        telegramFileId: args.telegramFileId || '',
        message: args.message || '',
        position: args.position,
        enabled: args.enabled
      });
      return {
        content: [{
          type: 'text',
          text: `✅ Button "${args.name}" successfully created with ID: ${id}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error adding button: ${err.message}` }]
      };
    }
  }
);

// Tool 5: toggle_button
server.tool(
  'toggle_button',
  'Enable or disable a dynamic button by its ID in Supabase',
  {
    buttonId: z.string().describe('ID of the button'),
    enabled: z.boolean().describe('True to enable, false to disable')
  },
  async ({ buttonId, enabled }) => {
    try {
      await supabaseService.toggleButton(buttonId, enabled);
      return {
        content: [{
          type: 'text',
          text: `✅ Button ${buttonId} status updated to: ${enabled ? 'Enabled' : 'Disabled'}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error toggling button: ${err.message}` }]
      };
    }
  }
);

// Tool 6: delete_button
server.tool(
  'delete_button',
  'Delete a dynamic button by its ID from Supabase',
  {
    buttonId: z.string().describe('ID of the button to delete')
  },
  async ({ buttonId }) => {
    try {
      await supabaseService.deleteButton(buttonId);
      return {
        content: [{
          type: 'text',
          text: `✅ Button ${buttonId} deleted successfully.`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error deleting button: ${err.message}` }]
      };
    }
  }
);

// Tool 7: list_channels
server.tool(
  'list_channels',
  'List all required verification channels in Supabase',
  {},
  async () => {
    try {
      const channels = await supabaseService.getChannels();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(channels, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error listing channels: ${err.message}` }]
      };
    }
  }
);

// Tool 8: add_channel
server.tool(
  'add_channel',
  'Add a new mandatory verification channel to Supabase',
  {
    title: z.string().describe('Channel title e.g. "Main Channel"'),
    username: z.string().describe('Channel username with @ e.g. "@mychannel" or numeric ID'),
    inviteUrl: z.string().describe('Invite link e.g. "https://t.me/mychannel"'),
    position: z.number().default(1),
    enabled: z.boolean().default(true)
  },
  async (args) => {
    try {
      const id = await supabaseService.addChannel({
        title: args.title,
        username: args.username,
        inviteUrl: args.inviteUrl,
        position: args.position,
        enabled: args.enabled
      });
      return {
        content: [{
          type: 'text',
          text: `✅ Channel "${args.title}" added with ID: ${id}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error adding channel: ${err.message}` }]
      };
    }
  }
);

// Tool 9: get_bot_settings
server.tool(
  'get_bot_settings',
  'Retrieve current bot welcome message, join required message, and maintenance mode status from Supabase',
  {},
  async () => {
    try {
      const settings = await supabaseService.getBotSettings();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(settings, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching settings: ${err.message}` }]
      };
    }
  }
);

// Tool 10: update_bot_settings
server.tool(
  'update_bot_settings',
  'Update bot welcome message, verification prompt, or maintenance mode in Supabase',
  {
    welcomeMessage: z.string().optional(),
    joinRequiredMessage: z.string().optional(),
    verifiedMessage: z.string().optional(),
    maintenanceMode: z.boolean().optional()
  },
  async (args) => {
    try {
      const updated = await supabaseService.updateBotSettings(args);
      return {
        content: [{
          type: 'text',
          text: `✅ Settings updated: ${JSON.stringify(updated, null, 2)}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error updating settings: ${err.message}` }]
      };
    }
  }
);

// Tool 11: broadcast_message
server.tool(
  'broadcast_message',
  'Broadcast a message to all verified bot users via Telegram Bot API',
  {
    message: z.string().describe('The Markdown formatted announcement to broadcast')
  },
  async ({ message }) => {
    if (!bot) {
      return {
        content: [{ type: 'text', text: 'Telegram Bot is not initialized.' }]
      };
    }
    try {
      const users = await supabaseService.getAllVerifiedUsers();
      if (!users || users.length === 0) {
        return {
          content: [{ type: 'text', text: 'No verified users found in Supabase database.' }]
        };
      }

      let sent = 0;
      let failed = 0;
      for (const u of users) {
        try {
          await bot.api.sendMessage(u.telegramId, message, { parse_mode: 'Markdown' });
          sent++;
        } catch {
          failed++;
        }
      }

      return {
        content: [{
          type: 'text',
          text: `📣 Broadcast complete: Successfully sent to ${sent} users, failed for ${failed} users.`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error during broadcast: ${err.message}` }]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.exit(1);
});
