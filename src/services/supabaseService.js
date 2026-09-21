import { supabase } from '../config/supabase.js';

class MemoryCache {
  constructor(ttlMs = 30000) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
  set(key, data) {
    this.cache.set(key, { data, expiry: Date.now() + this.ttlMs });
  }
  invalidate(keyPrefix) {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }
    for (const k of this.cache.keys()) {
      if (k.startsWith(keyPrefix)) this.cache.delete(k);
    }
  }
}

const DEFAULT_SETTINGS = {
  welcomeMessage: "👋 *Welcome, {name}!*",
  joinRequiredMessage: "🔔 *𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹 𝗖𝗵𝗮𝗻𝗻𝗲𝗹 𝗧𝗼 𝗨𝗻𝗹𝗼𝗰𝗸:*",
  verifiedMessage: "👋 *Welcome, {name}!*",
  maintenanceMode: false,
  ownerTelegramId: "8833095685"
};

export class SupabaseService {
  constructor() {
    this.cache = new MemoryCache(30000);
  }

  clearCache() {
    this.cache.invalidate();
  }

  // ==================== SETTINGS ====================
  async getBotSettings() {
    const cached = this.cache.get('settings');
    if (cached) return cached;

    if (!supabase) return DEFAULT_SETTINGS;
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'bot_config')
        .single();

      if (error || !data) return DEFAULT_SETTINGS;

      const res = {
        welcomeMessage: data.welcome_message || DEFAULT_SETTINGS.welcomeMessage,
        joinRequiredMessage: data.join_required_message || DEFAULT_SETTINGS.joinRequiredMessage,
        verifiedMessage: data.verified_message || DEFAULT_SETTINGS.verifiedMessage,
        maintenanceMode: data.maintenance_mode ?? false,
        ownerTelegramId: data.owner_telegram_id || '8833095685'
      };
      this.cache.set('settings', res);
      return res;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async updateBotSettings(data) {
    if (!supabase) return data;
    this.cache.invalidate('settings');
    const updatePayload = {};
    if (data.welcomeMessage !== undefined) updatePayload.welcome_message = data.welcomeMessage;
    if (data.joinRequiredMessage !== undefined) updatePayload.join_required_message = data.joinRequiredMessage;
    if (data.verifiedMessage !== undefined) updatePayload.verified_message = data.verifiedMessage;
    if (data.maintenanceMode !== undefined) updatePayload.maintenance_mode = data.maintenanceMode;
    if (data.ownerTelegramId !== undefined) updatePayload.owner_telegram_id = data.ownerTelegramId;
    updatePayload.updated_at = new Date().toISOString();

    await supabase.from('settings').upsert({ id: 'bot_config', ...updatePayload });
    return data;
  }

  // ==================== BUTTONS ====================
  async getButtons() {
    const cached = this.cache.get('buttons');
    if (cached) return cached;

    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('buttons')
        .select('*')
        .order('position', { ascending: true });

      if (error || !data) return [];
      const res = data.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        url: b.url,
        telegramFileId: b.telegram_file_id,
        message: b.message,
        position: b.position,
        enabled: b.enabled,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      }));
      this.cache.set('buttons', res);
      return res;
    } catch {
      return [];
    }
  }

  async getEnabledButtons() {
    const buttons = await this.getButtons();
    return buttons.filter(b => b.enabled !== false);
  }

  async getMainButtons() {
    const buttons = await this.getButtons();
    return buttons.filter(b => b.enabled !== false && (!b.url || !b.url.startsWith('parent:')));
  }

  async getSubButtons(parentId) {
    const buttons = await this.getButtons();
    return buttons.filter(b => b.enabled !== false && b.url === `parent:${parentId}`);
  }

  async getAllSubButtons(parentId) {
    const buttons = await this.getButtons();
    return buttons.filter(b => b.url === `parent:${parentId}`);
  }

  async addButton({ name, type, url = '', telegramFileId = '', message = '', position = 0, enabled = true }) {
    if (!supabase) return null;
    this.cache.invalidate('buttons');
    const { data, error } = await supabase.from('buttons').insert({
      name,
      type,
      url,
      telegram_file_id: telegramFileId,
      message,
      position: Number(position) || 0,
      enabled: Boolean(enabled)
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      url: data.url,
      telegramFileId: data.telegram_file_id,
      message: data.message,
      position: data.position,
      enabled: data.enabled
    };
  }

  async updateButton(id, updateData) {
    if (!supabase) return null;
    this.cache.invalidate('buttons');
    const payload = {};
    if (updateData.name !== undefined) payload.name = updateData.name;
    if (updateData.type !== undefined) payload.type = updateData.type;
    if (updateData.url !== undefined) payload.url = updateData.url;
    if (updateData.telegramFileId !== undefined) payload.telegram_file_id = updateData.telegramFileId;
    if (updateData.message !== undefined) payload.message = updateData.message;
    if (updateData.position !== undefined) payload.position = updateData.position;
    if (updateData.enabled !== undefined) payload.enabled = updateData.enabled;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('buttons').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteButton(id) {
    if (!supabase) return false;
    this.cache.invalidate('buttons');
    await supabase.from('buttons').delete().eq('id', id);
    await supabase.from('buttons').delete().eq('url', `parent:${id}`);
    return true;
  }

  async reorderButtons(orderedIds) {
    if (!supabase || !Array.isArray(orderedIds)) return false;
    this.cache.invalidate('buttons');
    for (let index = 0; index < orderedIds.length; index++) {
      await supabase.from('buttons').update({ position: index + 1 }).eq('id', orderedIds[index]);
    }
    return true;
  }

  // ==================== CHANNELS ====================
  async getChannels() {
    const cached = this.cache.get('channels');
    if (cached) return cached;

    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('position', { ascending: true });

      if (error || !data) return [];
      const res = data.map(c => ({
        id: c.id,
        title: c.title,
        username: c.username,
        inviteUrl: c.invite_url,
        position: c.position,
        enabled: c.enabled,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }));
      this.cache.set('channels', res);
      return res;
    } catch {
      return [];
    }
  }

  async getEnabledChannels() {
    const channels = await this.getChannels();
    return channels.filter(c => c.enabled !== false);
  }

  async addChannel({ title, username, inviteUrl, position = 0, enabled = true }) {
    if (!supabase) return null;
    this.cache.invalidate('channels');
    const formattedUsername = username ? (username.startsWith('@') || username.startsWith('-100') ? username : `@${username}`) : '';
    const { data, error } = await supabase.from('channels').insert({
      title: title || username,
      username: formattedUsername,
      invite_url: inviteUrl || '',
      position: Number(position) || 0,
      enabled: Boolean(enabled)
    }).select().single();

    if (error) throw error;
    return data;
  }

  async updateChannel(id, updateData) {
    if (!supabase) return null;
    this.cache.invalidate('channels');
    const payload = {};
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.username !== undefined) payload.username = updateData.username;
    if (updateData.inviteUrl !== undefined) payload.invite_url = updateData.inviteUrl;
    if (updateData.enabled !== undefined) payload.enabled = updateData.enabled;
    if (updateData.position !== undefined) payload.position = updateData.position;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('channels').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteChannel(id) {
    if (!supabase) return false;
    this.cache.invalidate('channels');
    await supabase.from('channels').delete().eq('id', id);
    return true;
  }

  // ==================== FILES ====================
  async getFiles() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map(f => ({
        id: f.id,
        name: f.name,
        telegramFileId: f.telegram_file_id,
        fileSize: f.file_size,
        mimeType: f.mime_type,
        description: f.description,
        createdAt: f.created_at
      }));
    } catch {
      return [];
    }
  }

  async uploadToStorage(fileName, buffer, mimeType = 'application/octet-stream') {
    if (!supabase) return null;
    try {
      const cleanName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('bot-files')
        .upload(cleanName, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.error('Storage upload error:', error.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('bot-files')
        .getPublicUrl(cleanName);

      return publicUrlData?.publicUrl || null;
    } catch (err) {
      console.error('Failed to upload to Supabase storage:', err.message);
      return null;
    }
  }

  async addFile({ name, telegramFileId, fileSize = 0, mimeType = '', description = '', storageUrl = '' }) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('files').insert({
      name,
      telegram_file_id: telegramFileId,
      file_size: Number(fileSize) || 0,
      mime_type: mimeType || 'application/octet-stream',
      description: description || '',
      storage_url: storageUrl || ''
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      telegramFileId: data.telegram_file_id,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      description: data.description,
      storageUrl: data.storage_url,
      createdAt: data.created_at
    };
  }

  async deleteFile(id) {
    if (!supabase) return false;
    await supabase.from('files').delete().eq('id', id);
    return true;
  }

  // ==================== USERS & STATS ====================
  async getUser(telegramId) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', String(telegramId))
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        telegramId: data.telegram_id,
        username: data.username,
        firstName: data.first_name,
        lastName: data.last_name,
        isVerified: data.is_verified
      };
    } catch {
      return null;
    }
  }

  async upsertUser({ telegramId, username, firstName, lastName, isVerified = false }) {
    if (!supabase) return null;
    const strId = String(telegramId);
    const { data, error } = await supabase.from('users').upsert({
      telegram_id: strId,
      username: username || '',
      first_name: firstName || '',
      last_name: lastName || '',
      is_verified: Boolean(isVerified),
      last_active_at: new Date().toISOString()
    }).select().single();

    return data;
  }

  async setUserVerified(telegramId, isVerified = true) {
    if (!supabase) return true;
    await supabase.from('users').update({
      is_verified: Boolean(isVerified),
      last_active_at: new Date().toISOString()
    }).eq('telegram_id', String(telegramId));
    return true;
  }

  async getStats() {
    const cached = this.cache.get('stats');
    if (cached) return cached;

    if (!supabase) {
      return { totalUsers: 0, verifiedUsers: 0, channelsCount: 0, buttonsCount: 0, filesCount: 0 };
    }
    try {
      const [u, v, c, b, f] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('channels').select('*', { count: 'exact', head: true }),
        supabase.from('buttons').select('*', { count: 'exact', head: true }),
        supabase.from('files').select('*', { count: 'exact', head: true })
      ]);

      const res = {
        totalUsers: u.count || 0,
        verifiedUsers: v.count || 0,
        channelsCount: c.count || 0,
        buttonsCount: b.count || 0,
        filesCount: f.count || 0
      };
      this.cache.set('stats', res);
      return res;
    } catch {
      return { totalUsers: 0, verifiedUsers: 0, channelsCount: 0, buttonsCount: 0, filesCount: 0 };
    }
  }

  async getAllVerifiedUsers() {
    if (!supabase) return [];
    const { data } = await supabase.from('users').select('*').eq('is_verified', true);
    return (data || []).map(u => ({ telegramId: u.telegram_id, ...u }));
  }

  async isAdminEmail(email) {
    if (!supabase || !email) return false;
    const { data } = await supabase.from('admins').select('id').eq('email', email.toLowerCase()).single();
    return Boolean(data);
  }
}

export const supabaseService = new SupabaseService();
