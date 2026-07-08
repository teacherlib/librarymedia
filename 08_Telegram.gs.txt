/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        08_Telegram.gs — Telegram bot notification (best-effort)
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Telegram_settings_() {
  var s = Settings_map_();
  return {
    enabled: _yes_(s.tg_enabled),
    token: String(s.tg_token || '').trim(),
    admins: String(s.tg_admin_chat_ids || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
    notify_new: _yes_(s.tg_notify_new),
    notify_approve: _yes_(s.tg_notify_approve)
  };
}
function _tgEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function Telegram_send_(chatId, text) {
  var cfg = Telegram_settings_();
  if (!cfg.enabled || !cfg.token || !chatId) return { ok: false };
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ chat_id: String(chatId), text: String(text).substring(0, 4096), parse_mode: 'HTML', disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
    return { ok: res.getResponseCode() < 300 };
  } catch (e) { return { ok: false, error: String(e) }; }
}
function Telegram_broadcastAdmins_(text) {
  var cfg = Telegram_settings_();
  cfg.admins.forEach(function (id) { Telegram_send_(id, text); });
}

function Telegram_notifyNew(res, user) {
  var cfg = Telegram_settings_();
  if (!cfg.enabled || !cfg.notify_new) return;
  var txt = '📥 <b>สื่อใหม่รออนุมัติ</b>\n'
    + '━━━━━━━━━━━━━━━\n'
    + '📚 ' + _tgEsc_(res.title) + '\n'
    + '👤 โดย: ' + _tgEsc_(user.full_name) + '\n'
    + '🏷 รหัส: ' + _tgEsc_(res.code) + '\n'
    + '⏰ ' + _tgEsc_(cfg_time_(res.created_at || cfg_now_()));
  Telegram_broadcastAdmins_(txt);
}
function Telegram_notifyApprove(res, user, ok, reason) {
  var cfg = Telegram_settings_();
  if (!cfg.enabled || !cfg.notify_approve) return;
  var uploader = DB_get(SHEETS.USERS, res.uploaded_by);
  var txt = (ok ? '✅ <b>สื่อได้รับการเผยแพร่</b>\n' : '↩️ <b>สื่อถูกตีกลับ</b>\n')
    + '━━━━━━━━━━━━━━━\n'
    + '📚 ' + _tgEsc_(res.title) + '\n'
    + '👤 ผู้ตรวจ: ' + _tgEsc_(user.full_name) + '\n'
    + (reason ? '📝 เหตุผล: ' + _tgEsc_(reason) + '\n' : '')
    + '⏰ ' + _tgEsc_(cfg_time_(cfg_now_()));
  Telegram_broadcastAdmins_(txt);
  if (uploader && uploader.email) { /* could email — skip */ }
}

/* admin tools */
function Telegram_getMe(user, p) {
  Auth_requireCap(user, 'setting.manage');
  var token = String((p && p.token) || Settings_map_().tg_token || '').trim();
  if (!token) throw new Error('ยังไม่ได้ตั้งค่า Token');
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe', { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    if (!data.ok) throw new Error('Token ไม่ถูกต้อง');
    return { ok: true, username: data.result.username, name: data.result.first_name, link: 'https://t.me/' + data.result.username };
  } catch (e) { throw new Error('เชื่อมต่อบอทไม่สำเร็จ: ' + e.message); }
}
function Telegram_getUpdates(user, p) {
  Auth_requireCap(user, 'setting.manage');
  var token = String((p && p.token) || Settings_map_().tg_token || '').trim();
  if (!token) throw new Error('ยังไม่ได้ตั้งค่า Token');
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true });
    var data = JSON.parse(res.getContentText());
    var seen = {}, out = [];
    (data.result || []).forEach(function (u) {
      var chat = (u.message && u.message.chat) || (u.channel_post && u.channel_post.chat);
      if (chat && !seen[chat.id]) { seen[chat.id] = 1; out.push({ id: String(chat.id), title: chat.title || (chat.first_name || '') + ' ' + (chat.last_name || ''), type: chat.type }); }
    });
    return { ok: true, chats: out };
  } catch (e) { throw new Error('ดึงข้อมูลไม่สำเร็จ: ' + e.message); }
}
function Telegram_test(user, p) {
  Auth_requireCap(user, 'setting.manage');
  var cfg = Telegram_settings_();
  if (!cfg.token) throw new Error('ยังไม่ได้ตั้งค่า Token');
  if (!cfg.admins.length) throw new Error('ยังไม่ได้ตั้งค่า Chat ID');
  var sent = 0;
  cfg.admins.forEach(function (id) { var r = Telegram_send_(id, '🔔 <b>ทดสอบการแจ้งเตือน</b>\nระบบคลังสื่อการสอน TRL พร้อมใช้งาน'); if (r.ok) sent++; });
  return { ok: true, sent: sent, total: cfg.admins.length };
}
