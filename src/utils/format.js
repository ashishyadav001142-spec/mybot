/**
 * Formats template strings with dynamic user variables.
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

  return template
    .replace(/{name}/gi, name)
    .replace(/{first_name}/gi, name)
    .replace(/{username}/gi, username)
    .replace(/{id}/gi, String(id));
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
        throw e;
      }
    }
    throw err;
  }
}
