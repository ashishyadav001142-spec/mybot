import { db, isInitialized } from '../config/firebase.js';

const DEFAULT_SETTINGS = {
  welcomeMessage: "👋 Welcome to our Official Bot!\n\nPlease click the button below to get started.",
  joinRequiredMessage: "⚠️ You must join our required channels before accessing the bot features.\n\nPlease join all channels below and click 'Check Join' to continue:",
  verifiedMessage: "🎉 Verification Successful!\n\nWelcome to the Main Menu. Choose an option below:",
  maintenanceMode: false,
  ownerTelegramId: "8833095685"
};

class FirestoreService {
  // In-memory cache fallback if Firestore is not yet connected
  fallbackSettings = { ...DEFAULT_SETTINGS };
  fallbackButtons = [
    { id: 'btn_apk', name: '📱 APK FILE', type: 'FILE', telegramFileId: 'sample_file_id', message: 'Here is your APK file:', position: 1, enabled: true },
    { id: 'btn_key', name: '🔑 GET KEY', type: 'TEXT', message: 'Your license key is active! Contact support for VIP access.', position: 2, enabled: true },
    { id: 'btn_channel', name: '📢 TELEGRAM CHANNEL', type: 'LINK', url: 'https://t.me/telegram', position: 3, enabled: true },
    { id: 'btn_support', name: '💬 SUPPORT', type: 'LINK', url: 'https://t.me/support', position: 4, enabled: true }
  ];
  fallbackChannels = [];
  fallbackFiles = [];

  // ==================== SETTINGS ====================
  async getBotSettings() {
    if (!isInitialized || !db) return this.fallbackSettings;
    try {
      const doc = await db.collection('settings').doc('bot_config').get();
      if (!doc.exists) {
        // Initialize default settings doc
        await db.collection('settings').doc('bot_config').set(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...doc.data() };
    } catch (error) {
      console.error('Error fetching bot settings:', error.message);
      return this.fallbackSettings;
    }
  }

  async updateBotSettings(data) {
    if (!isInitialized || !db) {
      this.fallbackSettings = { ...this.fallbackSettings, ...data };
      return this.fallbackSettings;
    }
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    await db.collection('settings').doc('bot_config').set(updateData, { merge: true });
    return updateData;
  }

  // ==================== CHANNELS ====================
  async getChannels() {
    if (!isInitialized || !db) return this.fallbackChannels;
    try {
      const snapshot = await db.collection('channels').orderBy('position', 'asc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
      // Fallback query without order if index not ready
      const snapshot = await db.collection('channels').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  }

  async getEnabledChannels() {
    const channels = await this.getChannels();
    return channels.filter(c => c.enabled !== false);
  }

  async addChannel({ title, username, inviteUrl, position = 0, enabled = true }) {
    const channelData = {
      title: title || username || 'Required Channel',
      username: username ? (username.startsWith('@') || username.startsWith('-100') ? username : `@${username}`) : '',
      inviteUrl: inviteUrl || '',
      position: Number(position) || 0,
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!isInitialized || !db) {
      const id = `chan_${Date.now()}`;
      const item = { id, ...channelData };
      this.fallbackChannels.push(item);
      return item;
    }

    const docRef = await db.collection('channels').add(channelData);
    return { id: docRef.id, ...channelData };
  }

  async updateChannel(id, data) {
    if (!isInitialized || !db) {
      const idx = this.fallbackChannels.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.fallbackChannels[idx] = { ...this.fallbackChannels[idx], ...data };
        return this.fallbackChannels[idx];
      }
      return null;
    }
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('channels').doc(id).update(updateData);
    return { id, ...updateData };
  }

  async deleteChannel(id) {
    if (!isInitialized || !db) {
      this.fallbackChannels = this.fallbackChannels.filter(c => c.id !== id);
      return true;
    }
    await db.collection('channels').doc(id).delete();
    return true;
  }

  // ==================== DYNAMIC BUTTONS ====================
  async getButtons() {
    if (!isInitialized || !db) return this.fallbackButtons;
    try {
      const snapshot = await db.collection('buttons').orderBy('position', 'asc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
      const snapshot = await db.collection('buttons').get();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.position || 0) - (b.position || 0));
    }
  }

  async getEnabledButtons() {
    const buttons = await this.getButtons();
    return buttons.filter(b => b.enabled !== false);
  }

  async addButton({ name, type, url = '', telegramFileId = '', message = '', position = 0, enabled = true }) {
    const buttonData = {
      name,
      type, // 'FILE' | 'LINK' | 'TEXT' | 'CHANNEL'
      url: url || '',
      telegramFileId: telegramFileId || '',
      message: message || '',
      position: Number(position) || 0,
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!isInitialized || !db) {
      const id = `btn_${Date.now()}`;
      const item = { id, ...buttonData };
      this.fallbackButtons.push(item);
      return item;
    }

    const docRef = await db.collection('buttons').add(buttonData);
    return { id: docRef.id, ...buttonData };
  }

  async updateButton(id, data) {
    if (!isInitialized || !db) {
      const idx = this.fallbackButtons.findIndex(b => b.id === id);
      if (idx !== -1) {
        this.fallbackButtons[idx] = { ...this.fallbackButtons[idx], ...data };
        return this.fallbackButtons[idx];
      }
      return null;
    }
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('buttons').doc(id).update(updateData);
    return { id, ...updateData };
  }

  async deleteButton(id) {
    if (!isInitialized || !db) {
      this.fallbackButtons = this.fallbackButtons.filter(b => b.id !== id);
      return true;
    }
    await db.collection('buttons').doc(id).delete();
    return true;
  }

  async reorderButtons(orderedIds) {
    if (!Array.isArray(orderedIds)) return false;
    if (!isInitialized || !db) {
      orderedIds.forEach((id, index) => {
        const btn = this.fallbackButtons.find(b => b.id === id);
        if (btn) btn.position = index + 1;
      });
      return true;
    }

    const batch = db.batch();
    orderedIds.forEach((id, index) => {
      const ref = db.collection('buttons').doc(id);
      batch.update(ref, { position: index + 1, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    return true;
  }

  // ==================== FILES ====================
  async getFiles() {
    if (!isInitialized || !db) return this.fallbackFiles;
    try {
      const snapshot = await db.collection('files').orderBy('createdAt', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
      const snapshot = await db.collection('files').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  }

  async addFile({ name, telegramFileId, fileSize = 0, mimeType = '', description = '' }) {
    const fileData = {
      name,
      telegramFileId,
      fileSize: Number(fileSize) || 0,
      mimeType: mimeType || 'application/octet-stream',
      description: description || '',
      createdAt: new Date().toISOString()
    };

    if (!isInitialized || !db) {
      const id = `file_${Date.now()}`;
      const item = { id, ...fileData };
      this.fallbackFiles.push(item);
      return item;
    }

    const docRef = await db.collection('files').add(fileData);
    return { id: docRef.id, ...fileData };
  }

  async deleteFile(id) {
    if (!isInitialized || !db) {
      this.fallbackFiles = this.fallbackFiles.filter(f => f.id !== id);
      return true;
    }
    await db.collection('files').doc(id).delete();
    return true;
  }

  // ==================== USERS & STATS ====================
  async upsertUser({ telegramId, username, firstName, lastName, isVerified = false }) {
    const strId = String(telegramId);
    const userData = {
      telegramId: strId,
      username: username || '',
      firstName: firstName || '',
      lastName: lastName || '',
      isVerified: Boolean(isVerified),
      lastActiveAt: new Date().toISOString()
    };

    if (!isInitialized || !db) return userData;

    const userRef = db.collection('users').doc(strId);
    const doc = await userRef.get();
    if (!doc.exists) {
      userData.joinedAt = new Date().toISOString();
      await userRef.set(userData);
    } else {
      await userRef.set(userData, { merge: true });
    }
    return userData;
  }

  async setUserVerified(telegramId, isVerified = true) {
    const strId = String(telegramId);
    if (!isInitialized || !db) return true;
    await db.collection('users').doc(strId).set({
      isVerified: Boolean(isVerified),
      verifiedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }, { merge: true });
    return true;
  }

  async getStats() {
    if (!isInitialized || !db) {
      return {
        totalUsers: 1,
        verifiedUsers: 1,
        channelsCount: this.fallbackChannels.length,
        buttonsCount: this.fallbackButtons.length,
        filesCount: this.fallbackFiles.length
      };
    }

    try {
      const [usersSnap, verifiedSnap, channelsSnap, buttonsSnap, filesSnap] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('users').where('isVerified', '==', true).count().get(),
        db.collection('channels').count().get(),
        db.collection('buttons').count().get(),
        db.collection('files').count().get()
      ]);

      return {
        totalUsers: usersSnap.data().count,
        verifiedUsers: verifiedSnap.data().count,
        channelsCount: channelsSnap.data().count,
        buttonsCount: buttonsSnap.data().count,
        filesCount: filesSnap.data().count
      };
    } catch {
      // If .count() is not supported on older SDK
      const users = await db.collection('users').get();
      const verified = users.docs.filter(d => d.data().isVerified).length;
      const channels = await db.collection('channels').get();
      const buttons = await db.collection('buttons').get();
      const files = await db.collection('files').get();

      return {
        totalUsers: users.size,
        verifiedUsers: verified,
        channelsCount: channels.size,
        buttonsCount: buttons.size,
        filesCount: files.size
      };
    }
  }

  async getAllVerifiedUsers() {
    if (!isInitialized || !db) return [];
    const snap = await db.collection('users').where('isVerified', '==', true).get();
    return snap.docs.map(d => d.data());
  }

  // ==================== ADMINS ====================
  async isAdminEmail(email) {
    if (!email) return false;
    if (!isInitialized || !db) return true; // dev bypass
    const snap = await db.collection('admins').where('email', '==', email.toLowerCase()).get();
    return !snap.empty;
  }
}

export const firestoreService = new FirestoreService();
