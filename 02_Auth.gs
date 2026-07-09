/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        02_Auth.gs — Authentication · Sessions · Bootstrap
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/* ─── public user (strip secrets) ─── */
function Auth_publicUser_(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    email: u.email, phone: u.phone, avatar: u.avatar, school: u.school,
    position: u.position, subject_group: u.subject_group,
    is_active: u.is_active, last_login: u.last_login, created_at: u.created_at
  };
}

/* ─── verify token → user ─── */
function Auth_verify_(token) {
  if (!token) throw new Error('ต้องเข้าสู่ระบบก่อน');
  var sess = DB_get(SHEETS.SESSIONS, token);
  if (!sess) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  if (sess.expires_at && Date.parse(sess.expires_at) < (new Date()).getTime()) {
    try { DB_delete(SHEETS.SESSIONS, token); } catch (e) {}
    throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  }
  var u = DB_get(SHEETS.USERS, sess.user_id);
  if (!u || !_yes_(u.is_active)) throw new Error('บัญชีถูกระงับหรือไม่พบในระบบ');
  return u;
}
function Auth_requireCap(user, cap) {
  if (!user) throw new Error('ต้องเข้าสู่ระบบก่อน');
  if (!hasCap_(user.role, cap)) throw new Error('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้ (' + cap + ')');
  return true;
}

/* ─── login ─── */
function Auth_login(p) {
  var username = String((p && p.username) || '').trim().toLowerCase().substring(0, 60);
  var pw = String((p && p.password) || '');
  if (!username || !pw) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

  var lockUntil = Sec_lockedUntil_(username);
  if (lockUntil && lockUntil > (new Date()).getTime()) {
    var mins = Math.ceil((lockUntil - (new Date()).getTime()) / 60000);
    throw new Error('พยายามเข้าสู่ระบบผิดหลายครั้ง — กรุณารอ ' + mins + ' นาที');
  }

  var u = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === username; });
  var ver = (u && _yes_(u.is_active)) ? Sec_verify_(pw, u.salt, u.password_hash) : { ok: false };
  if (!ver.ok) {
    var n = Sec_recordFail_(username);
    Audit_log_(u ? { id: u.id, username: u.username, role: u.role } : { id: '', username: username, role: '' },
               'auth.fail', 'auth', '', { attempts: n });
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  Sec_clearFail_(username);

  // auto-upgrade legacy hash
  if (ver.upgrade) {
    var salt = cfg_salt_();
    DB_update(SHEETS.USERS, u.id, { salt: salt, password_hash: Sec_hash_(pw, salt) });
  }

  var token = Sec_token_();
  var now = new Date();
  var expires = new Date(now.getTime() + SEC.SESSION_HOURS * 3600 * 1000);
  DB_insert(SHEETS.SESSIONS, {
    token: token, user_id: u.id, created_at: cfg_iso_(now),
    expires_at: cfg_iso_(expires), user_agent: String((p && p.ua) || '').substring(0, 200)
  });
  DB_update(SHEETS.USERS, u.id, { last_login: cfg_now_() });
  Audit_log_(u, 'auth.login', 'auth', u.id, {});

  var pu = Auth_publicUser_(u);
  return { token: token, user: pu, caps: capsForRole_(u.role) };
}

/* ─── logout ─── */
function Auth_logout(token) {
  if (token) { try { DB_delete(SHEETS.SESSIONS, token); } catch (e) {} }
  return { ok: true };
}

/* ─── register (self) ─── */
function Auth_register(p) {
  var settings = Settings_map_();
  if (!_yes_(settings.allow_self_register)) throw new Error('ระบบปิดการสมัครสมาชิกด้วยตนเอง');
  var username = String((p && p.username) || '').trim().toLowerCase();
  if (!/^[-a-z0-9_.]{3,30}$/.test(username)) throw new Error('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ . - ยาว 3-30 ตัว');
  if (DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === username; }))
    throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  var pw = String((p && p.password) || '');
  Sec_requirePassword_(pw);
  var full = String((p && p.full_name) || '').trim();
  if (full.length < 2) throw new Error('กรุณากรอกชื่อ-สกุล');

  var salt = cfg_salt_();
  var u = DB_insert(SHEETS.USERS, {
    username: username, password_hash: Sec_hash_(pw, salt), salt: salt,
    full_name: full, role: 'teacher', email: String((p && p.email) || ''),
    phone: String((p && p.phone) || ''), school: String((p && p.school) || ''),
    subject_group: String((p && p.subject_group) || ''), is_active: 'yes'
  });
  Audit_log_({ id: u.id, username: u.username, role: 'teacher' }, 'auth.register', 'user', u.id, {});
  return Auth_login({ username: username, password: pw, ua: (p && p.ua) || '' });
}

/* ─── change password (self) ─── */
function Auth_changePassword(user, p) {
  var old = String((p && p.old_password) || '');
  var neu = String((p && p.new_password) || '');
  var u = DB_get(SHEETS.USERS, user.id);
  if (!u) throw new Error('ไม่พบบัญชี');
  var ver = Sec_verify_(old, u.salt, u.password_hash);
  if (!ver.ok) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  Sec_requirePassword_(neu);
  var salt = cfg_salt_();
  DB_update(SHEETS.USERS, u.id, { salt: salt, password_hash: Sec_hash_(neu, salt) });
  Audit_log_(user, 'auth.change_password', 'user', u.id, {});
  // ลบ session อื่น (คงปัจจุบันได้) — ที่นี่เก็บไว้ทั้งหมด เพื่อ UX
  return { ok: true };
}

/* ─── active admin count (last-admin protection) ─── */
function Sec_activeAdminCount_() {
  return DB_readAll(SHEETS.USERS).filter(function (x) { return x.role === 'admin' && _yes_(x.is_active); }).length;
}

/* ─── session GC ─── */
function Auth_gc_() {
  var now = (new Date()).getTime(), del = 0;
  var rows = DB_readAll(SHEETS.SESSIONS);
  for (var i = 0; i < rows.length && del < 50; i++) {
    if (rows[i].expires_at && Date.parse(rows[i].expires_at) < now) {
      try { DB_delete(SHEETS.SESSIONS, rows[i].token); del++; } catch (e) {}
    }
  }
  return del;
}

/* ═══════════ PUBLIC BUNDLE + BOOTSTRAP ═══════════ */
function App_publicBundle_() {
  var ver = _verAll_([SHEETS.SETTINGS, SHEETS.USERS, SHEETS.CATEGORIES, SHEETS.LEVELS, SHEETS.RESTYPES, SHEETS.RESOURCES]);
  return Cache_compute_('boot:public:v' + ver, 120, function () {
    var settings = Settings_getPublic_();
    var users = DB_readAll(SHEETS.USERS);
    var hasUsers = users.length > 0;
    var demo = [];
    if (_yes_(settings.show_demo_users)) {
      DEMO_USERS.forEach(function (d) {
        if (DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === d.username; }))
          demo.push({ username: d.username, role: d.role, full_name: d.full_name });
      });
    }
    return {
      app: { name: APP.NAME, title: APP.TITLE, short: APP.SHORT, version: APP.VERSION, org: APP.ORG, icon: APP.LOGO_ICON, last_updated: APP.LAST_UPDATED },
      dev: APP.DEV,
      settings: settings,
      roles: ROLE_LABEL,
      statuses: STATUS_LABEL,
      categories: Master_listPublic_(SHEETS.CATEGORIES),
      levels: Master_listPublic_(SHEETS.LEVELS),
      restypes: Master_listPublic_(SHEETS.RESTYPES),
      demo: demo,
      demo_password: _yes_(settings.show_demo_users) ? DEMO_PASSWORD : '',
      has_users: hasUsers,
      public_stats: Public_statsLite_()
    };
  });
}

/* main bootstrap — เรียกจาก client หลังมี token / verify */
function App_bootstrap(token) {
  var bundle = App_publicBundle_();
  var out = {};
  Object.keys(bundle).forEach(function (k) { out[k] = bundle[k]; });
  out.me = null; out.caps = [];
  if (token) {
    try {
      var u = Auth_verify_(token);
      out.me = Auth_publicUser_(u);
      out.caps = capsForRole_(u.role);
    } catch (e) { out.me = null; out.caps = []; }
  }
  return out;
}

/* demo quick-login (ใช้ flow login จริง) */
function Auth_demoLogin(p) {
  var settings = Settings_map_();
  if (!_yes_(settings.show_demo_users)) throw new Error('ปิดบัญชีทดลองแล้ว');
  var username = String((p && p.username) || '').toLowerCase();
  if (!DEMO_USERS.some(function (d) { return d.username === username; })) throw new Error('ไม่ใช่บัญชีทดลอง');
  return Auth_login({ username: username, password: DEMO_PASSWORD, ua: (p && p.ua) || '' });
}
