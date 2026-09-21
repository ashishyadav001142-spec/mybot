#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
====================================================================
🤖 PRIME DORAEMON TELEGRAM BOT (SINGLE-FILE HIGH PERFORMANCE EDITION)
====================================================================
• Ultra-fast response (< 0.05s) via Telegram Long Polling
• Built-in persistent SQLite database (zero configuration)
• Pure Small-Caps stylish Unicode typography
• 2 buttons per line layout ("chat ke bahar" bottom keyboard + inline)
• Hierarchy: Buttons ➔ Apps ➔ Files/Videos/APKs
• "⚠️ ɴᴏ ᴅᴀᴛᴀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴜʀʀᴇɴᴛʟʏ" intelligent fallback
• Full Admin Panel with Add Button, Add App, Add File & Channel Verification
====================================================================
"""

import os
import re
import sys
import time
import sqlite3
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

class RenderHealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Prime Doraemon Bot is running 24/7!")
    def log_message(self, format, *args):
        pass  # Suppress access logs

def start_health_server():
    port = int(os.getenv("PORT", 10000))
    try:
        server = HTTPServer(("0.0.0.0", port), RenderHealthCheckHandler)
        logging.info(f"🌐 Health server listening on port {port} for Render / Cloud")
        server.serve_forever()
    except Exception as e:
        logging.warning(f"Could not start health server: {e}")

threading.Thread(target=start_health_server, daemon=True).start()

try:
    import telebot
    from telebot import types
except ImportError:
    print("❌ telebot not found! Please run: pip install pyTelegramBotAPI")
    sys.exit(1)

# ==================== CONFIGURATION ====================
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8900144270:AAHW66XzSpBf-AE3COhQw4duFyznhzlPWi4")
OWNER_ID = int(os.getenv("OWNER_TELEGRAM_ID", "8833095685"))
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot_database.db")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="Markdown")

# Global admin interactive state store (Persistent in memory for long polling)
admin_sessions = {}

# ==================== STYLISH FONT UTILITIES ====================
SMALL_CAPS_MAP = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
    'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
    's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ',
    'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ',
    'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
}

def to_small_caps(text: str) -> str:
    """Converts English text to stylish Small-Caps Unicode"""
    if not text:
        return ""
    return "".join(SMALL_CAPS_MAP.get(c, c) for c in str(text))

def style_text(text: str) -> str:
    """Applies Small-Caps styling while keeping URLs and mentions intact"""
    if not text:
        return ""
    def repl(m):
        url, mention, word = m.groups()
        if url: return url
        if mention: return mention
        if word: return to_small_caps(word)
        return m.group(0)
    return re.sub(r'(https?://[^\s\)]+)|(@[a-zA-Z0-9_]+)|([a-zA-Z]+)', repl, text)

def format_msg(template: str, user) -> str:
    if not template:
        return ""
    name = getattr(user, 'first_name', '') or 'User'
    username = f"@{user.username}" if getattr(user, 'username', None) else name
    user_id = str(getattr(user, 'id', ''))
    
    formatted = template.replace("{name}", name).replace("{username}", username).replace("{id}", user_id)
    return style_text(formatted)

def is_owner(user_id) -> bool:
    return int(user_id) == OWNER_ID

# ==================== DATABASE INITIALIZATION ====================
def get_db():
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                is_verified INTEGER DEFAULT 0,
                created_at TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS buttons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'TEXT',
                url TEXT DEFAULT '',
                telegram_file_id TEXT DEFAULT '',
                message TEXT DEFAULT '',
                position INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                created_at TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                target_chat TEXT,
                invite_url TEXT,
                enabled INTEGER DEFAULT 1
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        conn.commit()

        # Seed initial defaults if table empty
        cursor.execute("SELECT COUNT(*) FROM buttons WHERE url = '' OR url IS NULL OR url NOT LIKE 'parent:%'")
        if cursor.fetchone()[0] == 0:
            now = datetime.utcnow().isoformat()
            cursor.execute("INSERT INTO buttons (name, type, message, position, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                           ("BGMI", "TEXT", "📂 *BGMI*\n\n🎒 Niche se file ya option select karein:", 1, 1, now))
            cursor.execute("INSERT INTO buttons (name, type, message, position, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                           ("ᴘᴀɴᴇʟ", "TEXT", "📂 *ᴘᴀɴᴇʟ*\n\n🎒 Niche se file ya option select karein:", 2, 1, now))
            cursor.execute("INSERT INTO buttons (name, type, message, position, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                           ("ᴍᴏᴅ ᴍᴇɴᴜ", "TEXT", "📂 *ᴍᴏᴅ ᴍᴇɴᴜ*\n\n🎒 Niche se file ya option select karein:", 3, 1, now))
            conn.commit()

        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('welcome_message', '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*')")
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('join_message', '🔔 *ᴊᴏɪɴ ᴏᴜʀ ᴏғғɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟs ᴛᴏ ᴜɴʟᴏᴄᴋ:*')")
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('verified_message', '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*')")
        conn.commit()

init_db()

# ==================== DATABASE HELPERS ====================
def upsert_user(user):
    with get_db() as conn:
        conn.execute("""
            INSERT INTO users (user_id, username, first_name, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username=excluded.username,
                first_name=excluded.first_name
        """, (user.id, user.username or '', user.first_name or '', datetime.utcnow().isoformat()))
        conn.commit()

def set_user_verified(user_id, status=1):
    with get_db() as conn:
        conn.execute("UPDATE users SET is_verified = ? WHERE user_id = ?", (1 if status else 0, user_id))
        conn.commit()

def is_user_verified(user_id) -> bool:
    if is_owner(user_id):
        return True
    with get_db() as conn:
        row = conn.execute("SELECT is_verified FROM users WHERE user_id = ?", (user_id,)).fetchone()
        return bool(row and row['is_verified'])

def get_setting(key: str, default: str = "") -> str:
    with get_db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row['value'] if row else default

def update_setting(key: str, value: str):
    with get_db() as conn:
        conn.execute("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
        conn.commit()

def get_main_buttons():
    with get_db() as conn:
        return conn.execute("SELECT * FROM buttons WHERE enabled = 1 AND (url IS NULL OR url = '' OR url NOT LIKE 'parent:%') ORDER BY position ASC, id ASC").fetchall()

def get_all_buttons():
    with get_db() as conn:
        return conn.execute("SELECT * FROM buttons ORDER BY position ASC, id ASC").fetchall()

def get_sub_buttons(parent_id):
    with get_db() as conn:
        return conn.execute("SELECT * FROM buttons WHERE enabled = 1 AND url = ? ORDER BY position ASC, id ASC", (f"parent:{parent_id}",)).fetchall()

def get_all_sub_buttons(parent_id):
    with get_db() as conn:
        return conn.execute("SELECT * FROM buttons WHERE url = ? ORDER BY position ASC, id ASC", (f"parent:{parent_id}",)).fetchall()

def get_button_by_id(button_id):
    with get_db() as conn:
        return conn.execute("SELECT * FROM buttons WHERE id = ?", (button_id,)).fetchone()

def get_enabled_channels():
    with get_db() as conn:
        return conn.execute("SELECT * FROM channels WHERE enabled = 1").fetchall()

def get_all_channels():
    with get_db() as conn:
        return conn.execute("SELECT * FROM channels").fetchall()

# ==================== KEYBOARD GENERATORS ====================
def build_bottom_keyboard(user_id):
    """
    Builds the stylish bottom ReplyKeyboard (Chat ke bahar):
    - Strictly 2 buttons per line ('ek line me do')
    - Row 1: 🔄 ʀᴇsᴛᴀʀᴛ, Button 1
    - Following rows: 2 buttons per row
    - Includes Admin Panel for Owner
    """
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    buttons = get_main_buttons()

    items = ['🔄 ʀᴇsᴛᴀʀᴛ']
    for b in buttons:
        items.append(to_small_caps(b['name']))
    items.append('🔄 ʀᴇғʀᴇsʜ ᴍᴇɴᴜ')

    if is_owner(user_id):
        items.append('🛡️ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ')

    # Add items 2 per row
    row = []
    for item in items:
        row.append(types.KeyboardButton(item))
        if len(row) == 2:
            markup.add(*row)
            row = []
    if row:
        markup.add(*row)

    return markup

def build_inline_menu(user_id):
    """Builds inline menu inside chat bubble (2 per line)"""
    markup = types.InlineKeyboardMarkup(row_width=2)
    buttons = get_main_buttons()

    items = [types.InlineKeyboardButton('🔄 ʀᴇsᴛᴀʀᴛ', callback_data='flow:restart')]
    for b in buttons:
        items.append(types.InlineKeyboardButton(to_small_caps(b['name']), callback_data=f"btn:action:{b['id']}"))
    items.append(types.InlineKeyboardButton('🔄 ʀᴇғʀᴇsʜ', callback_data='flow:menu'))

    if is_owner(user_id):
        items.append(types.InlineKeyboardButton('🛡️ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ', callback_data='admin:panel'))

    for i in range(0, len(items), 2):
        markup.row(*items[i:i+2])

    return markup

# ==================== CHANNEL VERIFICATION ====================
def check_unjoined_channels(user_id):
    """Returns list of mandatory channels that the user has NOT joined yet"""
    if is_owner(user_id):
        return []
    if is_user_verified(user_id):
        return []

    channels = get_enabled_channels()
    if not channels:
        return []

    unjoined = []
    for chan in channels:
        target = chan['target_chat']
        if not target:
            continue
        try:
            member = bot.get_chat_member(target, user_id)
            if member.status not in ['creator', 'administrator', 'member']:
                unjoined.append(chan)
        except Exception as e:
            # If user not found, channel is unjoined
            if 'user not found' in str(e).lower():
                unjoined.append(chan)
            else:
                logging.warning(f"Could not verify channel {target}: {e}")

    return unjoined

# ==================== SAFE SEND / EDIT HELPERS ====================
def safe_send_message(chat_id, text, reply_markup=None):
    try:
        return bot.send_message(chat_id, text, reply_markup=reply_markup, parse_mode="Markdown")
    except Exception:
        try:
            return bot.send_message(chat_id, text, reply_markup=reply_markup, parse_mode=None)
        except Exception as e:
            logging.error(f"Failed to send message: {e}")
            return None

def safe_edit_message(chat_id, message_id, text, reply_markup=None):
    try:
        return bot.edit_message_text(text, chat_id=chat_id, message_id=message_id, reply_markup=reply_markup, parse_mode="Markdown")
    except Exception as e:
        if 'message is not modified' in str(e).lower():
            return None
        try:
            return bot.edit_message_text(text, chat_id=chat_id, message_id=message_id, reply_markup=reply_markup, parse_mode=None)
        except Exception:
            return safe_send_message(chat_id, text, reply_markup=reply_markup)

# ==================== COMMAND HANDLERS ====================
@bot.message_handler(commands=['start', 'restart'])
def cmd_start(message):
    user = message.from_user
    upsert_user(user)

    unjoined = check_unjoined_channels(user.id)
    if unjoined:
        markup = types.InlineKeyboardMarkup()
        for idx, chan in enumerate(unjoined):
            link = chan['invite_url'] or (f"https://t.me/{chan['target_chat'].replace('@', '')}" if chan['target_chat'].startswith('@') else "#")
            title = to_small_caps(chan['title'] or f"ᴄʜᴀɴɴᴇʟ {idx+1}")
            markup.add(types.InlineKeyboardButton(f"📢 ᴊᴏɪɴ {title}", url=link))
        markup.add(types.InlineKeyboardButton("🔄 ᴄʜᴇᴄᴋ ᴊᴏɪɴ", callback_data="flow:check_join"))

        join_prompt = get_setting('join_message', '🔔 *ᴊᴏɪɴ ᴏᴜʀ ᴏғғɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟs ᴛᴏ ᴜɴʟᴏᴄᴋ:*')
        return safe_send_message(message.chat.id, format_msg(join_prompt, user), reply_markup=markup)

    set_user_verified(user.id, 1)
    bottom_kb = build_bottom_keyboard(user.id)
    welcome_text = get_setting('welcome_message', '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*')
    safe_send_message(message.chat.id, format_msg(welcome_text, user), reply_markup=bottom_kb)

@bot.message_handler(commands=['menu'])
def cmd_menu(message):
    inline_kb = build_inline_menu(message.from_user.id)
    welcome_text = get_setting('welcome_message', '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*')
    safe_send_message(message.chat.id, format_msg(welcome_text, message.from_user), reply_markup=inline_kb)

@bot.message_handler(commands=['admin'])
def cmd_admin(message):
    if not is_owner(message.from_user.id):
        return safe_send_message(message.chat.id, "⛔ *Access Denied!* Only Owner can access this panel.")
    show_admin_panel(message.chat.id)

# ==================== BUTTON EXECUTION FLOW ====================
def execute_button(chat_id, user, button, message_id=None):
    """
    Executes a dynamic button with intelligent 'No Data Available Currently' detection:
    1. If it has Apps/sub-buttons ➔ Display Apps (2 per row).
    2. If it has a direct file ➔ Send file.
    3. If it has NO apps and NO files ➔ Display '⚠️ ɴᴏ ᴅᴀᴛᴀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴜʀʀᴇɴᴛʟʏ'
    """
    sub_buttons = get_sub_buttons(button['id'])

    # 1. Has Apps / Sub-options
    if sub_buttons:
        markup = types.InlineKeyboardMarkup(row_width=2)
        items = [types.InlineKeyboardButton(to_small_caps(s['name']), callback_data=f"subbtn:{s['id']}") for s in sub_buttons]
        for i in range(0, len(items), 2):
            markup.row(*items[i:i+2])
        markup.add(types.InlineKeyboardButton('🔙 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data='flow:menu'))

        prompt = format_msg(button['message'] or f"📂 *{to_small_caps(button['name'])}*\n\n_ᴘʟᴇᴀsᴇ sᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ ʙᴇʟᴏᴡ:_", user)
        if message_id:
            return safe_edit_message(chat_id, message_id, prompt, reply_markup=markup)
        return safe_send_message(chat_id, prompt, reply_markup=markup)

    # 2. Direct File Button
    if button['type'] == 'FILE' and button['telegram_file_id']:
        caption = format_msg(button['message'] or f"📦 *{to_small_caps(button['name'])}*\n\n🎒 *Doraemon 4D Pocket Gadget Ready!*", user)
        bottom_kb = build_bottom_keyboard(user.id)
        try:
            bot.send_document(chat_id, button['telegram_file_id'], caption=caption, reply_markup=bottom_kb, parse_mode="Markdown")
            return
        except Exception:
            pass

    # 3. Direct Link Button
    if button['type'] in ['LINK', 'CHANNEL'] and button['url']:
        url = button['url']
        bottom_kb = build_bottom_keyboard(user.id)
        text = format_msg(button['message'] or f"🔗 *{to_small_caps(button['name'])}*\n\n👉 [Click Here to Access]({url})", user)
        return safe_send_message(chat_id, text, reply_markup=bottom_kb)

    # 4. NO DATA AVAILABLE CURRENTLY (No Apps & No Files)
    no_data_kb = types.InlineKeyboardMarkup()
    no_data_kb.add(types.InlineKeyboardButton('🏠 ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data='flow:menu'))

    no_data_msg = format_msg(
        f"📁 *{to_small_caps(button['name'])}*\n\n⚠️ *ɴᴏ ᴅᴀᴛᴀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴜʀʀᴇɴᴛʟʏ*\n_ᴄᴜʀʀᴇɴᴛʟʏ ᴛʜᴇʀᴇ ᴀʀᴇ ɴᴏ ᴀᴘᴘs ᴏʀ ғɪʟᴇs ɪɴ ᴛʜɪs sᴇᴄᴛɪᴏɴ._",
        user
    )
    if message_id:
        return safe_edit_message(chat_id, message_id, no_data_msg, reply_markup=no_data_kb)
    bottom_kb = build_bottom_keyboard(user.id)
    return safe_send_message(chat_id, no_data_msg, reply_markup=bottom_kb)

def execute_sub_button(chat_id, user, sub_btn, message_id=None):
    """
    Executes a sub-button (App):
    1. If App has files inside ➔ Show file list (2 per row).
    2. If App has a direct file ➔ Send file.
    3. If App is empty ➔ Display '⚠️ ɴᴏ ᴅᴀᴛᴀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴜʀʀᴇɴᴛʟʏ'.
    """
    child_buttons = get_sub_buttons(sub_btn['id'])

    # Find parent button for back navigation
    parent_id = sub_btn['url'].replace('parent:', '') if sub_btn['url'].startswith('parent:') else None
    parent_btn = get_button_by_id(parent_id) if parent_id else None

    back_kb = types.InlineKeyboardMarkup(row_width=2)
    if parent_btn:
        back_kb.add(types.InlineKeyboardButton(f"🔙 ʙᴀᴄᴋ ᴛᴏ {to_small_caps(parent_btn['name'])}", callback_data=f"btn:action:{parent_btn['id']}"))
    back_kb.add(types.InlineKeyboardButton('🏠 ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data='flow:menu'))

    # 1. App has nested files
    if child_buttons:
        markup = types.InlineKeyboardMarkup(row_width=2)
        items = [types.InlineKeyboardButton(to_small_caps(c['name']), callback_data=f"subbtn:{c['id']}") for c in child_buttons]
        for i in range(0, len(items), 2):
            markup.row(*items[i:i+2])
        if parent_btn:
            markup.add(types.InlineKeyboardButton(f"🔙 ʙᴀᴄᴋ ᴛᴏ {to_small_caps(parent_btn['name'])}", callback_data=f"btn:action:{parent_btn['id']}"))
        markup.add(types.InlineKeyboardButton('🏠 ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data='flow:menu'))

        prompt = format_msg(sub_btn['message'] or f"📱 *{to_small_caps(sub_btn['name'])}*\n\n_ᴘʟᴇᴀsᴇ sᴇʟᴇᴄᴛ ᴀ ғɪʟᴇ ʙᴇʟᴏᴡ:_", user)
        if message_id:
            return safe_edit_message(chat_id, message_id, prompt, reply_markup=markup)
        return safe_send_message(chat_id, prompt, reply_markup=markup)

    # 2. App itself is a direct file
    if sub_btn['type'] == 'FILE' and sub_btn['telegram_file_id']:
        caption = format_msg(sub_btn['message'] or f"📦 *{to_small_caps(sub_btn['name'])}*\n\n⚡ *File ready to install!*", user)
        try:
            bot.send_document(chat_id, sub_btn['telegram_file_id'], caption=caption, reply_markup=back_kb, parse_mode="Markdown")
            return
        except Exception:
            pass

    # 3. Empty App ➔ '⚠️ ɴᴏ ᴅᴀᴛᴀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴜʀʀᴇɴᴛʟʏ'
    no_data_text = format_msg(
        f"📱 *{to_small_caps(sub_btn['name'])}*\n\n⚠️ *ɴᴏ ᴅᴀᴛᴀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴜʀʀᴇɴᴛʟʏ*\n_ᴄᴜʀʀᴇɴᴛʟʏ ᴛʜᴇʀᴇ ᴀʀᴇ ɴᴏ ғɪʟᴇs ᴜᴘʟᴏᴀᴅᴇᴅ ʜᴇʀᴇ._",
        user
    )
    if message_id:
        return safe_edit_message(chat_id, message_id, no_data_text, reply_markup=back_kb)
    return safe_send_message(chat_id, no_data_text, reply_markup=back_kb)

# ==================== ADMIN PANEL INTERFACE ====================
def show_admin_panel(chat_id, message_id=None):
    with get_db() as conn:
        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        verified_users = conn.execute("SELECT COUNT(*) FROM users WHERE is_verified = 1").fetchone()[0]
        total_buttons = conn.execute("SELECT COUNT(*) FROM buttons WHERE enabled = 1").fetchone()[0]
        total_channels = conn.execute("SELECT COUNT(*) FROM channels WHERE enabled = 1").fetchone()[0]
        total_files = conn.execute("SELECT COUNT(*) FROM buttons WHERE type = 'FILE'").fetchone()[0]

    text = (
        f"╭──────────────────────────────╮\n"
        f"│  🛡️ 𝗗𝗢𝗥𝗔𝗘𝗠𝗢𝗡 𝗔𝗗𝗠𝗜𝗡 💀 𝗣𝗔𝗡𝗘𝗟  │\n"
        f"╰──────────────────────────────╯\n\n"
        f"👑 *𝗢𝗪𝗡𝗘𝗥 𝗖𝗢𝗡𝗧𝗥𝗢𝗟 𝗖𝗘𝗡𝗧𝗘𝗥*\n"
        f"🆔 *Owner ID:* `{OWNER_ID}`\n\n"
        f"📊 *𝗟𝗜𝗩𝗘 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗖𝗦:*\n"
        f"• 👥 Total Users: *{total_users}*\n"
        f"• ✅ Verified Users: *{verified_users}*\n"
        f"• 🔘 Active Buttons: *{total_buttons}*\n"
        f"• 📢 Required Channels: *{total_channels}*\n"
        f"• 📁 Uploaded Files: *{total_files}*\n\n"
        f"_Select an administration module below:_"
    )

    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton('🔘 ᴅʏɴᴀᴍɪᴄ ʙᴜᴛᴛᴏɴs', callback_data='admin:buttons'),
        types.InlineKeyboardButton('📱 ᴀᴅᴅ ᴀᴘᴘ', callback_data='admin:app_add_start')
    )
    markup.add(
        types.InlineKeyboardButton('📁 ғɪʟᴇs ᴍᴀɴᴀɢᴇʀ', callback_data='admin:files'),
        types.InlineKeyboardButton('➕ ᴀᴅᴅ ғɪʟᴇ', callback_data='admin:file_add_start')
    )
    markup.add(
        types.InlineKeyboardButton('📢 ʀᴇǫᴜɪʀᴇᴅ ᴄʜᴀɴɴᴇʟs', callback_data='admin:channels'),
        types.InlineKeyboardButton('📝 ᴇᴅɪᴛ ᴍᴇssᴀɢᴇs', callback_data='admin:messages')
    )
    markup.add(
        types.InlineKeyboardButton('📣 ʙʀᴏᴀᴅᴄᴀsᴛ ᴍsɢ', callback_data='admin:broadcast'),
        types.InlineKeyboardButton('🔄 ʀᴇғʀᴇsʜ sᴛᴀᴛs', callback_data='admin:panel')
    )
    markup.add(types.InlineKeyboardButton('🔙 ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data='flow:menu'))

    if message_id:
        return safe_edit_message(chat_id, message_id, text, reply_markup=markup)
    return safe_send_message(chat_id, text, reply_markup=markup)

def show_buttons_manager(chat_id, message_id=None):
    buttons = get_main_buttons()
    text = "🔘 *DYNAMIC BUTTONS & MENUS MANAGER*\n\n"

    if not buttons:
        text += "_No buttons created yet._\n"
    else:
        text += "_Click ⚙️ to view & edit, ⏸️ to toggle, 🗑️ to delete:_\n\n"
        for i, b in enumerate(buttons):
            status = '✅' if b['enabled'] else '⏸️'
            subs = get_sub_buttons(b['id'])
            sub_tag = f" 📂 [{len(subs)} Apps/Items]" if subs else ""
            text += f"{i+1}. {status} *{b['name']}* [{b['type']}]{sub_tag}\n"

    markup = types.InlineKeyboardMarkup()
    for b in buttons:
        toggle_icon = '⏸️' if b['enabled'] else '▶️'
        markup.row(
            types.InlineKeyboardButton(f"⚙️ {to_small_caps(b['name'])}", callback_data=f"admin:btn_view:{b['id']}"),
            types.InlineKeyboardButton(toggle_icon, callback_data=f"admin:btn_toggle:{b['id']}"),
            types.InlineKeyboardButton("🗑️", callback_data=f"admin:btn_del:{b['id']}")
        )

    markup.row(
        types.InlineKeyboardButton('➕ ᴀᴅᴅ ɴᴇᴡ ʙᴜᴛᴛᴏɴ', callback_data='admin:btn_add'),
        types.InlineKeyboardButton('📱 ᴀᴅᴅ ᴀᴘᴘ', callback_data='admin:app_add_start')
    )
    markup.row(
        types.InlineKeyboardButton('📁 ᴀᴅᴅ ғɪʟᴇ', callback_data='admin:file_add_start'),
        types.InlineKeyboardButton('🔙 ʙᴀᴄᴋ ᴛᴏ ᴅᴀsʜʙᴏᴀʀᴅ', callback_data='admin:panel')
    )

    if message_id:
        return safe_edit_message(chat_id, message_id, text, reply_markup=markup)
    return safe_send_message(chat_id, text, reply_markup=markup)

# ==================== CALLBACK QUERY ROUTER ====================
@bot.callback_query_handler(func=lambda call: True)
def on_callback(call):
    chat_id = call.message.chat.id
    user_id = call.from_user.id
    data = call.data
    msg_id = call.message.message_id

    # Instant acknowledgement to stop Telegram loading spinner (< 5ms)
    try:
        bot.answer_callback_query(call.id)
    except Exception:
        pass

    # 1. Public flows
    if data == 'flow:restart':
        return cmd_start(call.message)
    if data == 'flow:menu':
        inline_kb = build_inline_menu(user_id)
        welcome_text = get_setting('welcome_message', '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*')
        return safe_edit_message(chat_id, msg_id, format_msg(welcome_text, call.from_user), reply_markup=inline_kb)

    if data == 'flow:check_join':
        unjoined = check_unjoined_channels(user_id)
        if unjoined:
            try:
                bot.answer_callback_query(call.id, "⚠️ Please join all channels first!", show_alert=True)
            except Exception:
                pass
            return
        set_user_verified(user_id, 1)
        bottom_kb = build_bottom_keyboard(user_id)
        welcome_text = get_setting('verified_message', '👋 *ᴡᴇʟᴄᴏᴍᴇ, {name}!*')
        safe_send_message(chat_id, format_msg(welcome_text, call.from_user), reply_markup=bottom_kb)
        return

    # 2. Dynamic button execution
    if data.startswith('btn:action:'):
        btn_id = data.replace('btn:action:', '')
        btn = get_button_by_id(btn_id)
        if btn:
            return execute_button(chat_id, call.from_user, btn, message_id=msg_id)

    if data.startswith('subbtn:'):
        sub_id = data.replace('subbtn:', '')
        sub_btn = get_button_by_id(sub_id)
        if sub_btn:
            return execute_sub_button(chat_id, call.from_user, sub_btn, message_id=msg_id)

    # 3. Admin functions (Owner only)
    if data.startswith('admin:'):
        if not is_owner(user_id):
            return

        if data == 'admin:panel':
            return show_admin_panel(chat_id, message_id=msg_id)
        if data == 'admin:buttons':
            return show_buttons_manager(chat_id, message_id=msg_id)

        # Toggle button
        if data.startswith('admin:btn_toggle:'):
            b_id = data.replace('admin:btn_toggle:', '')
            with get_db() as conn:
                b = conn.execute("SELECT enabled FROM buttons WHERE id = ?", (b_id,)).fetchone()
                if b:
                    new_val = 0 if b['enabled'] else 1
                    conn.execute("UPDATE buttons SET enabled = ? WHERE id = ?", (new_val, b_id))
                    conn.commit()
            return show_buttons_manager(chat_id, message_id=msg_id)

        # Delete button
        if data.startswith('admin:btn_del:'):
            b_id = data.replace('admin:btn_del:', '')
            with get_db() as conn:
                conn.execute("DELETE FROM buttons WHERE id = ? OR url = ?", (b_id, f"parent:{b_id}"))
                conn.commit()
            return show_buttons_manager(chat_id, message_id=msg_id)

        # Add Button flow
        if data == 'admin:btn_add':
            admin_sessions[user_id] = {'state': 'AWAITING_BUTTON_NAME'}
            text = (
                "➕ *Add New Main Button*\n\n"
                "Sirf naye button ka *Naam* likhkar bhejiye (e.g. `📦 BGMI MODS` ya `📱 APKS`):\n\n"
                "_Naam likhte hi button sidha add ho jayega!_ (Cancel ke liye /cancel)"
            )
            return safe_edit_message(chat_id, msg_id, text)

        # Add App flow - Step 1: Select parent button
        if data == 'admin:app_add_start':
            buttons = get_main_buttons()
            if not buttons:
                return safe_edit_message(chat_id, msg_id, "⚠️ *Pehle koi Main Button create karein!*")
            markup = types.InlineKeyboardMarkup()
            for mb in buttons:
                markup.add(types.InlineKeyboardButton(f"📁 {to_small_caps(mb['name'])}", callback_data=f"admin:app_sel_btn:{mb['id']}"))
            markup.add(types.InlineKeyboardButton('🔙 Cancel', callback_data='admin:buttons'))
            return safe_edit_message(chat_id, msg_id, "📱 *Step 1: Button Select Karein*\n\nYe App konse Button ke andar add karni hai?", reply_markup=markup)

        if data.startswith('admin:app_sel_btn:'):
            parent_id = data.replace('admin:app_sel_btn:', '')
            parent = get_button_by_id(parent_id)
            if not parent:
                return show_buttons_manager(chat_id, message_id=msg_id)
            admin_sessions[user_id] = {'state': 'AWAITING_APP_NAME', 'parent_id': parent_id, 'parent_name': parent['name']}
            return safe_edit_message(
                chat_id, msg_id,
                f"📁 *Target Button:* *{parent['name']}*\n\n"
                f"📝 *Step 2: App ka Name bhejiye*\n"
                f"Is App ka naam likhkar bhejiye (e.g. `BGMI 32-Bit` ya `VIP Injector`):\n\n"
                f"_Naam bhejte hi App '{parent['name']}' ke andar save ho jayegi!_ (/cancel to abort)"
            )

        # Add File flow - Step 1: Select Button
        if data == 'admin:file_add_start':
            buttons = get_main_buttons()
            if not buttons:
                return safe_edit_message(chat_id, msg_id, "⚠️ *Pehle koi Button banayein!*")
            markup = types.InlineKeyboardMarkup()
            for mb in buttons:
                markup.add(types.InlineKeyboardButton(f"📁 {to_small_caps(mb['name'])}", callback_data=f"admin:file_sel_btn:{mb['id']}"))
            markup.add(types.InlineKeyboardButton('🔙 Cancel', callback_data='admin:panel'))
            return safe_edit_message(chat_id, msg_id, "📂 *Step 1: Button Select Karein*\n\nYe file konse Button ke andar add karni hai?", reply_markup=markup)

        if data.startswith('admin:file_sel_btn:'):
            parent_id = data.replace('admin:file_sel_btn:', '')
            parent = get_button_by_id(parent_id)
            if not parent:
                return show_admin_panel(chat_id, message_id=msg_id)

            sub_apps = get_sub_buttons(parent_id)
            markup = types.InlineKeyboardMarkup()
            if sub_apps:
                for app in sub_apps:
                    markup.add(types.InlineKeyboardButton(f"📱 {to_small_caps(app['name'])}", callback_data=f"admin:file_sel_app:{parent_id}:{app['id']}"))
                markup.add(types.InlineKeyboardButton('➕ ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴀᴘᴘ', callback_data=f"admin:app_sel_btn:{parent_id}"))
                markup.add(types.InlineKeyboardButton('🔙 ʙᴀᴄᴋ', callback_data='admin:file_add_start'))
                prompt = f"📁 *Selected Button:* *{parent['name']}*\n\n📱 *Step 2: App Select Karein*\nYe file konse App me add karni hai?"
                return safe_edit_message(chat_id, msg_id, prompt, reply_markup=markup)
            else:
                markup.add(types.InlineKeyboardButton(f"📱 Create App in {to_small_caps(parent['name'])}", callback_data=f"admin:app_sel_btn:{parent_id}"))
                markup.add(types.InlineKeyboardButton(f"📄 Add File Directly to {to_small_caps(parent['name'])}", callback_data=f"admin:file_sel_app:{parent_id}:{parent_id}"))
                markup.add(types.InlineKeyboardButton('🔙 Cancel', callback_data='admin:panel'))
                prompt = f"📁 *Selected Button:* *{parent['name']}*\n\n⚠️ *Is button me abhi koi App nahi hai!*\nPehle App banana chahte hain ya direct file add karni hai?"
                return safe_edit_message(chat_id, msg_id, prompt, reply_markup=markup)

        if data.startswith('admin:file_sel_app:'):
            parts = data.replace('admin:file_sel_app:', '').split(':')
            parent_id, app_id = parts
            parent = get_button_by_id(parent_id)
            app = get_button_by_id(app_id)
            if not app:
                return show_admin_panel(chat_id, message_id=msg_id)

            admin_sessions[user_id] = {
                'state': 'AWAITING_FILE_ITEM_NAME',
                'parent_id': parent_id,
                'parent_name': parent['name'] if parent else '',
                'target_app_id': app_id,
                'target_app_name': app['name']
            }

            prompt = (
                f"📁 *Button:* *{parent['name'] if parent else ''}*\n"
                f"📱 *App:* *{app['name']}*\n\n"
                f"📝 *Step 3: File ka Display Name bhejiye*\n"
                f"User ko jo naam dikhana hai wo likhkar bhejiye (e.g. `OBB 64-Bit` ya `VIP Config`):\n\n"
                f"_Send /skip to use original file name._"
            )
            return safe_edit_message(chat_id, msg_id, prompt)

        # Channels Manager
        if data == 'admin:channels':
            channels = get_all_channels()
            text = "📢 *REQUIRED CHANNELS MANAGER*\n\n"
            if not channels:
                text += "_No channels added yet._\n"
            else:
                for idx, ch in enumerate(channels):
                    status = '✅' if ch['enabled'] else '⏸️'
                    text += f"{idx+1}. {status} *{ch['title']}* (`{ch['target_chat']}`)\n"

            markup = types.InlineKeyboardMarkup()
            for ch in channels:
                toggle = '⏸️' if ch['enabled'] else '▶️'
                markup.row(
                    types.InlineKeyboardButton(ch['title'] or 'Channel', url=ch['invite_url'] or 'https://t.me'),
                    types.InlineKeyboardButton(toggle, callback_data=f"admin:chan_toggle:{ch['id']}"),
                    types.InlineKeyboardButton("🗑️", callback_data=f"admin:chan_del:{ch['id']}")
                )
            markup.row(
                types.InlineKeyboardButton('➕ ᴀᴅᴅ ᴄʜᴀɴɴᴇʟ', callback_data='admin:chan_add'),
                types.InlineKeyboardButton('🔙 ʙᴀᴄᴋ', callback_data='admin:panel')
            )
            return safe_edit_message(chat_id, msg_id, text, reply_markup=markup)

        if data == 'admin:chan_add':
            admin_sessions[user_id] = {'state': 'AWAITING_CHAN_INFO'}
            text = (
                "➕ *Add Required Channel*\n\n"
                "Please send channel details in this format:\n"
                "`TITLE | @username_or_chat_id | INVITE_URL`\n\n"
                "*Example:*\n"
                "`My Channel | @mychannel | https://t.me/+AbCdEf`\n\n"
                "_Bot MUST be an Administrator in that channel!_"
            )
            return safe_edit_message(chat_id, msg_id, text)

        if data.startswith('admin:chan_toggle:'):
            cid = data.replace('admin:chan_toggle:', '')
            with get_db() as conn:
                ch = conn.execute("SELECT enabled FROM channels WHERE id = ?", (cid,)).fetchone()
                if ch:
                    conn.execute("UPDATE channels SET enabled = ? WHERE id = ?", (0 if ch['enabled'] else 1, cid))
                    conn.commit()
            return on_callback(types.CallbackQuery(call.id, call.from_user, call.message, call.chat_instance, 'admin:channels'))

        if data.startswith('admin:chan_del:'):
            cid = data.replace('admin:chan_del:', '')
            with get_db() as conn:
                conn.execute("DELETE FROM channels WHERE id = ?", (cid,))
                conn.commit()
            return on_callback(types.CallbackQuery(call.id, call.from_user, call.message, call.chat_instance, 'admin:channels'))

        if data == 'admin:broadcast':
            admin_sessions[user_id] = {'state': 'AWAITING_BROADCAST'}
            return safe_edit_message(chat_id, msg_id, "📣 *Broadcast Announcement*\n\nSend the message you want to broadcast to all users:")

# ==================== TEXT & MEDIA INPUT HANDLER ====================
@bot.message_handler(content_types=['text'])
def on_text(message):
    user_id = message.from_user.id
    text = message.text.strip()

    # 1. Handle Admin Interactive Input Sessions
    if is_owner(user_id) and user_id in admin_sessions:
        session = admin_sessions[user_id]

        if text == '/cancel':
            admin_sessions.pop(user_id, None)
            safe_send_message(message.chat.id, "❌ Action cancelled.")
            return show_admin_panel(message.chat.id)

        # Add Button Name
        if session['state'] == 'AWAITING_BUTTON_NAME':
            admin_sessions.pop(user_id, None)
            btn_name = to_small_caps(text)
            with get_db() as conn:
                count = conn.execute("SELECT COUNT(*) FROM buttons").fetchone()[0]
                conn.execute("INSERT INTO buttons (name, type, message, position, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                             (btn_name, "TEXT", f"📂 *{btn_name}*\n\n🎒 Niche se file ya option select karein:", count + 1, 1, datetime.utcnow().isoformat()))
                conn.commit()
            safe_send_message(message.chat.id, f"✅ *Button '{btn_name}' successfully add ho gaya!*")
            return show_buttons_manager(message.chat.id)

        # Add App Name
        if session['state'] == 'AWAITING_APP_NAME':
            parent_id = session['parent_id']
            parent_name = session['parent_name']
            admin_sessions.pop(user_id, None)
            app_name = to_small_caps(text)
            with get_db() as conn:
                count = conn.execute("SELECT COUNT(*) FROM buttons WHERE url = ?", (f"parent:{parent_id}",)).fetchone()[0]
                conn.execute("INSERT INTO buttons (name, type, url, message, position, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                             (f"📱 {app_name}", "TEXT", f"parent:{parent_id}", f"📱 *{app_name}*\n\n🎒 Niche se file select karein:", count + 1, 1, datetime.utcnow().isoformat()))
                conn.commit()
            safe_send_message(message.chat.id, f"🎉 *App '{app_name}' successfully '{parent_name}' ke andar add ho gayi!*")
            return show_buttons_manager(message.chat.id)

        # File Step 3: Enter File Item Name
        if session['state'] == 'AWAITING_FILE_ITEM_NAME':
            session['item_name'] = "" if text == '/skip' else to_small_caps(text)
            session['state'] = 'AWAITING_FILE_DOCUMENT'
            target_name = session['target_app_name']
            safe_send_message(
                message.chat.id,
                f"📁 *Target:* *{target_name}*\n"
                f"📝 *Display Name:* *{session['item_name'] or 'Original File Name'}*\n\n"
                f"📤 *Ab apni APK, Document ya Video file is chat me send/forward karein!*"
            )
            return

        # Add Channel Info
        if session['state'] == 'AWAITING_CHAN_INFO':
            admin_sessions.pop(user_id, None)
            if '|' in text:
                parts = [p.strip() for p in text.split('|')]
                title, chat_target, inv_url = parts[0], parts[1], parts[2] if len(parts) > 2 else ""
                with get_db() as conn:
                    conn.execute("INSERT INTO channels (title, target_chat, invite_url, enabled) VALUES (?, ?, ?, 1)",
                                 (title, chat_target, inv_url))
                    conn.commit()
                safe_send_message(message.chat.id, f"✅ *Channel '{title}' added successfully!*")
                return on_callback(types.CallbackQuery('0', message.from_user, message, '0', 'admin:channels'))

        # Broadcast Message
        if session['state'] == 'AWAITING_BROADCAST':
            admin_sessions.pop(user_id, None)
            with get_db() as conn:
                users = conn.execute("SELECT user_id FROM users").fetchall()
            sent, failed = 0, 0
            for u in users:
                try:
                    bot.send_message(u['user_id'], text, parse_mode="Markdown")
                    sent += 1
                except Exception:
                    failed += 1
            safe_send_message(message.chat.id, f"📣 *Broadcast Completed!*\n\n• Sent: *{sent}*\n• Failed: *{failed}*")
            return show_admin_panel(message.chat.id)

    # 2. Bottom Keyboard Matchers (Chat ke bahar)
    if text in ['🔄 ʀᴇsᴛᴀʀᴛ', '🔄 RESTART', 'Restart', 'restart', 'Start', 'start']:
        return cmd_start(message)

    if text in ['🔄 ʀᴇғʀᴇsʜ ᴍᴇɴᴜ', '🔄 REFRESH MENU', 'Refresh', 'refresh']:
        return cmd_menu(message)

    if text in ['🛡️ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ', '🛡️ ADMIN PANEL', 'Admin', 'admin'] and is_owner(user_id):
        return show_admin_panel(message.chat.id)

    # 3. Dynamic Button Click Matcher (Bottom Keyboard)
    main_buttons = get_main_buttons()
    for b in main_buttons:
        b_name = b['name'].strip()
        if text.lower() == b_name.lower() or text == to_small_caps(b_name) or text.lower() == to_small_caps(b_name).lower():
            return execute_button(message.chat.id, message.from_user, b)

@bot.message_handler(content_types=['document', 'video', 'audio', 'photo', 'animation'])
def on_media(message):
    user_id = message.from_user.id
    if not is_owner(user_id):
        return

    # Check if in "Add File" session
    session = admin_sessions.get(user_id)
    if not session or session.get('state') != 'AWAITING_FILE_DOCUMENT':
        return

    target_app_id = session['target_app_id']
    target_name = session['target_app_name']
    item_name = session.get('item_name', '')
    admin_sessions.pop(user_id, None)

    file_id = ""
    file_name = "file"
    if message.document:
        file_id = message.document.file_id
        file_name = message.document.file_name or "file.apk"
    elif message.video:
        file_id = message.video.file_id
        file_name = "video.mp4"
    elif message.audio:
        file_id = message.audio.file_id
        file_name = message.audio.file_name or "audio.mp3"
    elif message.photo:
        file_id = message.photo[-1].file_id
        file_name = "photo.jpg"

    final_name = item_name or to_small_caps(file_name)

    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM buttons WHERE url = ?", (f"parent:{target_app_id}",)).fetchone()[0]
        conn.execute("""
            INSERT INTO buttons (name, type, url, telegram_file_id, message, position, enabled, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        """, (f"📄 {final_name}", "FILE", f"parent:{target_app_id}", file_id,
              f"📦 *{final_name}*\n\n🎒 *App:* {target_name}\n⚡ *File ready to install/download!*",
              count + 1, datetime.utcnow().isoformat()))
        conn.commit()

    safe_send_message(
        message.chat.id,
        f"🎉 *File Successfully Added!*\n\n"
        f"• *App / Target:* *{target_name}*\n"
        f"• *File Name:* *{final_name}*\n\n"
        f"👉 *Ab jab koi user '{target_name}' kholega, to use '{final_name}' dikhega aur click karte hi file mil jayegi!*"
    )
    show_buttons_manager(message.chat.id)

# ==================== BOT INITIALIZATION & POLLING ====================
if __name__ == '__main__':
    print("=" * 60)
    print("🚀 PRIME DORAEMON TELEGRAM BOT (SINGLE FILE EDITION)")
    print(f"👑 Owner Telegram ID: {OWNER_ID}")
    print(f"📁 SQLite Database: {DB_FILE}")
    print("⚡ Mode: Telegram Continuous High-Speed Long Polling")
    print("=" * 60)

    try:
        # Register single /start in native menu button
        bot.set_my_commands([
            types.BotCommand("start", "🚀 sᴛᴀʀᴛ")
        ])
    except Exception as e:
        logging.warning(f"Could not set native bot commands: {e}")

    # Remove any existing webhook and flush pending updates
    time.sleep(2)
    try:
        bot.delete_webhook(drop_pending_updates=True)
        print("🧹 Cleaned up old webhooks & dropped stale updates.")
    except Exception as e:
        logging.warning(f"Could not delete webhook: {e}")
    time.sleep(1)

    print("🤖 Bot is live and listening for updates instantly!")
    while True:
        try:
            bot.polling(none_stop=True, interval=0, timeout=20)
        except telebot.apihelper.ApiTelegramException as e:
            if "Conflict" in str(e) or getattr(e, 'error_code', 0) == 409:
                logging.warning("⚠️ 409 Conflict detected (previous instance shutting down). Retrying in 5 seconds...")
                time.sleep(5)
            else:
                logging.error(f"Telegram API Exception: {e}")
                time.sleep(3)
        except Exception as e:
            logging.error(f"Unexpected polling error: {e}")
            time.sleep(3)
