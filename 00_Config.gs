/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน (Teaching Resource Library)
 *  File:        00_Config.gs — ค่าคงที่ + Schemas + RBAC + Security + helpers
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/* ─────────────── APP CONSTANTS (single source of truth) ─────────────── */
var APP = Object.freeze({
  NAME: 'คลังสื่อการสอน',
  TITLE: 'TRL · คลังสื่อการสอนสำหรับโรงเรียน',
  SHORT: 'TRL',
  VERSION: '1.0.0',
  LAST_UPDATED: '2026-06-19',
  ORG: 'โรงเรียนในสังกัด สพฐ.',
  DESCRIPTION: 'คลังสื่อการสอนออนไลน์ — รวบรวม จัดเก็บ ค้นหา และแบ่งปันสื่อการเรียนการสอนสำหรับครู',
  LOGO_ICON: 'collection-play-fill',
  TIMEZONE: 'Asia/Bangkok',
  DEV: {
    NAME: 'ครูวิรัตน์ หาดคำ',
    URL: 'https://www.kruwirat.com',
    LOGO: 'https://mts-ssk3.com/uploads/team/team_1771053860_6990232440dc8.png'
  }
});

/* ─────────────── SHEET NAMES ─────────────── */
var SHEETS = Object.freeze({
  USERS: 'Users',
  SESSIONS: 'Sessions',
  SETTINGS: 'Settings',
  AUDIT: 'Audit',
  RESOURCES: 'Resources',
  CATEGORIES: 'Categories',
  LEVELS: 'Levels',
  RESTYPES: 'ResTypes',
  FAVORITES: 'Favorites',
  RATINGS: 'Ratings',
  DOWNLOADS: 'Downloads'
});

/* ─────────────── SCHEMAS (col[0] = primary key เสมอ) ─────────────── */
var SCHEMAS = Object.freeze({
  Users: ['id', 'username', 'password_hash', 'salt', 'full_name', 'role', 'email', 'phone',
          'avatar', 'school', 'position', 'subject_group', 'is_active',
          'last_login', 'created_at', 'updated_at'],
  Sessions: ['token', 'user_id', 'created_at', 'expires_at', 'user_agent'],
  Settings: ['key', 'value', 'updated_at'],
  Audit: ['id', 'user_id', 'username', 'action', 'entity', 'entity_id', 'meta', 'created_at'],
  Resources: ['id', 'code', 'title', 'description', 'category', 'level', 'type', 'subject', 'tags',
              'file_url', 'file_id', 'file_name', 'file_type', 'file_size', 'thumbnail', 'external_url',
              'downloads', 'views', 'rating_sum', 'rating_count', 'status', 'reject_reason', 'featured',
              'uploaded_by', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at'],
  Categories: ['id', 'key', 'label', 'icon', 'color', 'description', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  Levels: ['id', 'key', 'label', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  ResTypes: ['id', 'key', 'label', 'icon', 'color', 'description', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  Favorites: ['id', 'user_id', 'resource_id', 'created_at'],
  Ratings: ['id', 'resource_id', 'user_id', 'score', 'comment', 'created_at', 'updated_at'],
  Downloads: ['id', 'resource_id', 'user_id', 'created_at']
});

/* คอลัมน์ที่ต้องบังคับ TEXT format ('@') กัน Sheet auto-coerce */
var TEXT_COLUMNS = Object.freeze([
  'username', 'phone', 'code', 'file_id', 'value', 'key', 'tags', 'external_url',
  'telegram_chat_id', 'thumbnail', 'avatar'
]);
/* คอลัมน์ที่เก็บ "วันที่ล้วน yyyy-MM-dd" (อ่านกลับเป็น string) */
var DATE_COLUMNS = Object.freeze([]);
/* คอลัมน์ที่เก็บ "เวลา HH:mm" */
var TIME_COLUMNS = Object.freeze([]);

/* ─────────────── STATUS / ROLE LABELS ─────────────── */
var STATUS = Object.freeze({ DRAFT: 'draft', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' });
var STATUS_LABEL = Object.freeze({
  draft: 'ฉบับร่าง', pending: 'รออนุมัติ', approved: 'เผยแพร่แล้ว', rejected: 'ตีกลับ'
});
var ROLE_LABEL = Object.freeze({ admin: 'ผู้ดูแลระบบ', academic: 'ครูวิชาการ', teacher: 'ครูผู้สอน' });

/* ─────────────── RBAC: CAPS ─────────────── */
var CAPS = Object.freeze({
  admin: ['resource.manage', 'master.manage', 'user.manage', 'setting.manage', 'audit.view_all',
          'report.view_all', 'file.upload', 'favorite.manage', 'rating.manage'],
  academic: ['resource.view_all', 'resource.approve', 'resource.feature', 'resource.edit_all',
             'resource.create', 'resource.download', 'report.view_all', 'master.view',
             'user.view_all', 'file.upload', 'favorite.manage', 'rating.manage', 'setting.read'],
  teacher: ['resource.view_all', 'resource.create', 'resource.edit_own', 'resource.delete_own',
            'resource.download', 'report.view_own', 'file.upload', 'favorite.manage',
            'rating.manage', 'setting.read']
});

/**
 * hasCap_ — RBAC resolution (mirror client hasCap)
 * 1) '' or '*' → true
 * 2) 'a|b|c' → split('|'), some()
 * 3) exact match
 * 4) restrictive scope (view_own/edit_own/...) → ห้าม inherit จาก .manage
 * 5) hierarchical: 'xxx.<sub>' inherits จาก 'xxx.manage'
 */
function hasCap_(role, cap) {
  if (!cap || cap === '*') return true;
  var arr = CAPS[role];
  if (!Array.isArray(arr)) return false;
  return String(cap).split('|').some(function (c) {
    c = String(c || '').trim();
    if (!c) return false;
    if (c === '*') return true;
    if (arr.indexOf(c) >= 0) return true;
    if (/\.(view_own|edit_own|delete_own|view_self|edit_self|create_own|cancel_own)$/.test(c)) return false;
    var dot = c.indexOf('.');
    if (dot > 0) {
      var prefix = c.substring(0, dot);
      if (arr.indexOf(prefix + '.manage') >= 0) return true;
    }
    return false;
  });
}
function capsForRole_(role) {
  var base = CAPS[role] || [];
  return base.slice();
}

/* ─────────────── SETTINGS DEFAULTS ─────────────── */
var SETTINGS_DEFAULTS = Object.freeze({
  org_name: 'โรงเรียนตัวอย่างวิทยา',
  org_address: '123 หมู่ 4 ต.ในเมือง อ.เมือง จ.ตัวอย่าง 30000',
  org_phone: '0440000000',
  org_logo: '',
  hero_image: '',
  hero_title: 'คลังสื่อการสอน',
  hero_subtitle: 'แหล่งรวมสื่อการเรียนการสอนคุณภาพ สำหรับครูทุกคน',
  theme: 'graphite',
  show_demo_users: 'yes',
  show_user_manual: 'yes',
  allow_self_register: 'no',
  require_approval: 'yes',
  tg_enabled: 'no',
  tg_token: '',
  tg_admin_chat_ids: '',
  tg_notify_new: 'yes',
  tg_notify_approve: 'yes'
});
/* setting ที่ห้ามส่งให้ client ที่ยังไม่ login / non-admin */
var SETTINGS_SENSITIVE = Object.freeze(['tg_token', 'tg_admin_chat_ids']);

/* ─────────────── SECURITY CONST ─────────────── */
var SEC = Object.freeze({ MAX_ATTEMPTS: 5, LOCKOUT_SEC: 900, WINDOW_SEC: 900, SESSION_HOURS: 10 });

/* ─────────────── DEMO USERS (single source) ─────────────── */
var DEMO_PASSWORD = '123456';
var DEMO_USERS = Object.freeze([
  { username: 'admin', role: 'admin', full_name: 'ผู้ดูแล ระบบ', subject_group: 'บริหาร', position: 'ผู้ดูแลระบบ' },
  { username: 'academic', role: 'academic', full_name: 'หัวหน้า งานวิชาการ', subject_group: 'วิชาการ', position: 'หัวหน้าวิชาการ' },
  { username: 'teacher', role: 'teacher', full_name: 'ครูผู้สอน ตัวอย่าง', subject_group: 'วิทยาศาสตร์และเทคโนโลยี', position: 'ครูประจำชั้น' }
]);

/* ─────────────── MASTER DATA DEFAULTS ─────────────── */
var CATEGORY_DEFAULTS = Object.freeze([
  { key: 'thai', label: 'ภาษาไทย', icon: 'bi-translate', color: '#ef4444' },
  { key: 'math', label: 'คณิตศาสตร์', icon: 'bi-calculator', color: '#3b82f6' },
  { key: 'science', label: 'วิทยาศาสตร์และเทคโนโลยี', icon: 'bi-rocket-takeoff', color: '#10b981' },
  { key: 'social', label: 'สังคมศึกษา ศาสนาและวัฒนธรรม', icon: 'bi-globe-asia-australia', color: '#f59e0b' },
  { key: 'health', label: 'สุขศึกษาและพลศึกษา', icon: 'bi-heart-pulse', color: '#ec4899' },
  { key: 'art', label: 'ศิลปะ', icon: 'bi-palette', color: '#8b5cf6' },
  { key: 'career', label: 'การงานอาชีพ', icon: 'bi-tools', color: '#0ea5e9' },
  { key: 'english', label: 'ภาษาต่างประเทศ', icon: 'bi-chat-square-text', color: '#14b8a6' },
  { key: 'guidance', label: 'แนะแนว / กิจกรรมพัฒนาผู้เรียน', icon: 'bi-compass', color: '#64748b' }
]);
var LEVEL_DEFAULTS = Object.freeze([
  { key: 'p1', label: 'ประถมศึกษาปีที่ 1' }, { key: 'p2', label: 'ประถมศึกษาปีที่ 2' },
  { key: 'p3', label: 'ประถมศึกษาปีที่ 3' }, { key: 'p4', label: 'ประถมศึกษาปีที่ 4' },
  { key: 'p5', label: 'ประถมศึกษาปีที่ 5' }, { key: 'p6', label: 'ประถมศึกษาปีที่ 6' },
  { key: 'm1', label: 'มัธยมศึกษาปีที่ 1' }, { key: 'm2', label: 'มัธยมศึกษาปีที่ 2' },
  { key: 'm3', label: 'มัธยมศึกษาปีที่ 3' }, { key: 'm4', label: 'มัธยมศึกษาปีที่ 4' },
  { key: 'm5', label: 'มัธยมศึกษาปีที่ 5' }, { key: 'm6', label: 'มัธยมศึกษาปีที่ 6' },
  { key: 'all', label: 'ทุกระดับชั้น' }
]);
var RESTYPE_DEFAULTS = Object.freeze([
  { key: 'plan', label: 'แผนการจัดการเรียนรู้', icon: 'bi-journal-text', color: '#6366f1' },
  { key: 'slide', label: 'สื่อนำเสนอ (PPT/Slide)', icon: 'bi-easel2', color: '#f97316' },
  { key: 'doc', label: 'เอกสาร/ใบงาน', icon: 'bi-file-earmark-text', color: '#0ea5e9' },
  { key: 'video', label: 'วิดีโอการสอน', icon: 'bi-play-btn', color: '#ef4444' },
  { key: 'image', label: 'ภาพ/อินโฟกราฟิก', icon: 'bi-image', color: '#10b981' },
  { key: 'worksheet', label: 'แบบฝึกหัด', icon: 'bi-pencil-square', color: '#8b5cf6' },
  { key: 'exam', label: 'ข้อสอบ/แบบทดสอบ', icon: 'bi-clipboard-check', color: '#f59e0b' },
  { key: 'game', label: 'เกม/กิจกรรม', icon: 'bi-controller', color: '#ec4899' },
  { key: 'other', label: 'อื่น ๆ', icon: 'bi-collection', color: '#64748b' }
]);

/* ═══════════════ cfg helpers (server-side, deterministic) ═══════════════ */
function cfg_uuid_() {
  return Utilities.getUuid();
}
function cfg_now_() { return cfg_iso_(new Date()); }
function cfg_iso_(d) {
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function cfg_dateOnly_(d) {
  if (d instanceof Date) return Utilities.formatDate(d, APP.TIMEZONE, 'yyyy-MM-dd');
  return String(d == null ? '' : d).substring(0, 10);
}
function cfg_time_(t) {
  if (t instanceof Date && !isNaN(t.getTime())) return Utilities.formatDate(t, APP.TIMEZONE, 'HH:mm');
  var s = String(t == null ? '' : t).trim();
  if (!s) return '';
  if (/^\d{1,2}:\d{2}/.test(s)) { var p = s.split(':'); return _pad2_(p[0]) + ':' + _pad2_(p[1]); }
  var iso = s.match(/T(\d{2}):(\d{2})/); if (iso) return iso[1] + ':' + iso[2];
  var js = s.match(/\s(\d{2}):(\d{2}):\d{2}\s/); if (js) return js[1] + ':' + js[2];
  return s;
}
function cfg_d10_(v) {
  if (v instanceof Date) return cfg_dateOnly_(v);
  return String(v == null ? '' : v).substring(0, 10);
}
function cfg_num_(v) {
  var n = Number(String(v == null ? '' : v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
function cfg_salt_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').substring(0, 8); }
function _pad2_(x) { x = String(x); return x.length < 2 ? '0' + x : x; }
function _yes_(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || v === true || v === 1;
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ═══════════════ SECURITY: PBKDF2-style key stretching ═══════════════ */
function Sec_pbkdf2_(pw, salt, iter) {
  iter = iter || 1000;
  var saltKey = Utilities.newBlob('trl:' + String(salt)).getBytes();
  var acc = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(pw)).getBytes(), saltKey);
  for (var i = 1; i < iter; i++) acc = Utilities.computeHmacSha256Signature(acc, saltKey);
  return Utilities.base64EncodeWebSafe(acc).replace(/=+$/, '');
}
function Sec_hash_(pw, salt) { return 'p2$1000$' + Sec_pbkdf2_(pw, salt, 1000); }
function Sec_verify_(pw, salt, stored) {
  stored = String(stored || '');
  if (stored.indexOf('p2$') === 0) {
    var it = Number(stored.split('$')[1]) || 1000;
    return { ok: Sec_timingEq_('p2$' + it + '$' + Sec_pbkdf2_(pw, salt, it), stored), upgrade: false };
  }
  // legacy SHA-256(salt:pw)
  var legacy = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8)
  ).replace(/=+$/, '');
  return { ok: Sec_timingEq_(legacy, stored), upgrade: true };
}
function Sec_timingEq_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length, n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function Sec_token_() {
  var raw = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + (new Date()).getTime();
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
/* ── brute-force lockout (CacheService) ── */
function Sec_lockedUntil_(u) {
  try { var v = CacheService.getScriptCache().get('sec:lock:' + u); return v ? Number(v) : 0; } catch (e) { return 0; }
}
function Sec_recordFail_(u) {
  try {
    var c = CacheService.getScriptCache(), k = 'sec:fail:' + u, n = (Number(c.get(k)) || 0) + 1;
    c.put(k, String(n), SEC.WINDOW_SEC);
    if (n >= SEC.MAX_ATTEMPTS) { c.put('sec:lock:' + u, String((new Date()).getTime() + SEC.LOCKOUT_SEC * 1000), SEC.LOCKOUT_SEC); c.remove(k); }
    return n;
  } catch (e) { return 0; }
}
function Sec_clearFail_(u) {
  try { var c = CacheService.getScriptCache(); c.remove('sec:fail:' + u); c.remove('sec:lock:' + u); } catch (e) {}
}
/* ── password policy (set-only) ── */
function Sec_passwordPolicy_(pw) {
  pw = String(pw || '');
  if (pw.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
  if (/^(123456|password|qwerty|abc123|000000|111111)$/i.test(pw)) return 'รหัสผ่านคาดเดาง่ายเกินไป';
  return '';
}
function Sec_requirePassword_(pw) { var e = Sec_passwordPolicy_(pw); if (e) throw new Error(e); }
function Sec_tempPassword_() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  var u = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), out = '';
  for (var i = 0; i < 10; i++) out += c.charAt(parseInt(u.charAt(i), 16) % c.length);
  return out + '7a';
}
