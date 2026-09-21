export const SMALL_CAPS_MAP = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ғ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
  J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
  S: 's', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
};

/**
 * Converts standard Latin characters to stylish Small-Caps Unicode (e.g. ᴛʜɪs ᴄʜᴀɴɴᴇʟ...)
 */
export function toSmallCaps(str) {
  if (!str || typeof str !== 'string') return '';
  return str.split('').map(char => SMALL_CAPS_MAP[char] || char).join('');
}

/**
 * Applies stylish Small-Caps font to text, preserving URLs, Markdown links, and usernames.
 */
export function styleMessageText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/(https?:\/\/[^\s\)]+)|(@[a-zA-Z0-9_]+)|([a-zA-Z]+)/g, (match, url, mention, word) => {
    if (url) return url;
    if (mention) return mention;
    if (word) return toSmallCaps(word);
    return match;
  });
}

/**
 * Formats template strings with dynamic user variables and converts text to Small-Caps font.
 * Supported variables:
 * - {name}: First name or 'User'
 * - {first_name}: First name or 'User'
 * - {username}: Username (with @) or name
 * - {id}: User Telegram ID
 */
export function formatMessage(template, user = {}) {
  if (!template) return '';
  const name = user.first_name || user.firstName || 'User';
  const username = user.username ? `@${user.username}` : name;
  const id = user.id || user.telegramId || '';

  let formatted = template
    .replace(/{name}/gi, name)
    .replace(/{first_name}/gi, name)
    .replace(/{username}/gi, username)
    .replace(/{id}/gi, String(id));

  return styleMessageText(formatted);
}

/**
 * Safely replies to Telegram ctx with Markdown, falling back to plain text if syntax error occurs.
 */
export async function safeReply(ctx, text, options = {}) {
  try {
    return await ctx.reply(text, { parse_mode: 'Markdown', ...options });
  } catch (err) {
    if (err.description && err.description.includes('can\'t parse entities')) {
      return await ctx.reply(text, { ...options, parse_mode: undefined });
    }
    throw err;
  }
}

/**
 * Safely edits message text in Telegram ctx with Markdown, ignoring idempotent errors
 * and falling back to plain text if syntax error occurs.
 */
export async function safeEditMessageText(ctx, text, options = {}) {
  try {
    return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...options });
  } catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
      return; // Message is already identical, ignore silently
    }
    if (err.description && err.description.includes('can\'t parse entities')) {
      try {
        return await ctx.editMessageText(text, { ...options, parse_mode: undefined });
      } catch (e) {
        if (e.description && e.description.includes('message is not modified')) return;
      }
    }
    // Fallback: If editing fails (message deleted/old/unsupported), gracefully reply
    try {
      return await ctx.reply(text, { parse_mode: 'Markdown', ...options });
    } catch {
      try {
        return await ctx.reply(text, { ...options, parse_mode: undefined });
      } catch {}
    }
  }
}
