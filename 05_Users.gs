/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        05_Users.gs — User management · Profile
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function _userView_(u, counts) {
  return {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role, role_label: ROLE_LABEL[u.role] || u.role,
    email: u.email, phone: u.phone, avatar: u.avatar, school: u.school, position: u.position,
    subject_group: u.subject_group, is_active: _yes_(u.is_active) ? 'yes' : 'no',
    last_login: u.last_login, created_at: u.created_at,
    resources: (counts && counts[u.id]) || 0
  };
}

function Users_list(user, p) {
  Auth_requireCap(user, 'user.view_all|user.manage');
  var counts = {};
  DB_readAll(SHEETS.RESOURCES).forEach(function (r) { counts[r.uploaded_by] = (counts[r.uploaded_by] || 0) + 1; });
  var q = String((p && p.q) || '').trim().toLowerCase();
  var fRole = String((p && p.role) || '');
  var items = DB_readAll(SHEETS.USERS).filter(function (u) {
    if (fRole && u.role !== fRole) return false;
    if (q) { var hay = (u.username + ' ' + u.full_name + ' ' + u.email + ' ' + u.subject_group).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
    return true;
  }).sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; })
    .map(function (u) { return _userView_(u, counts); });
  return { items: items, total: items.length };
}

function Users_get(user, p) {
  Auth_requireCap(user, 'user.view_all|user.manage');
  var u = DB_get(SHEETS.USERS, p && p.id);
  if (!u) throw new Error('ไม่พบผู้ใช้');
  return _userView_(u, null);
}

function Users_save(user, p) {
  Auth_requireCap(user, 'user.manage');
  p = p || {};
  var full = String(p.full_name || '').trim();
  if (full.length < 2) throw new Error('กรุณากรอกชื่อ-สกุล');
  var role = String(p.role || 'teacher');
  if (!ROLE_LABEL[role]) throw new Error('บทบาทไม่ถูกต้อง');
  var fields = {
    full_name: full, role: role,
    email: String(p.email || ''), phone: String(p.phone || ''),
    school: String(p.school || ''), position: String(p.position || ''),
    subject_group: String(p.subject_group || ''),
    is_active: _yes_(p.is_active) ? 'yes' : 'no',
    avatar: String(p.avatar || '')
  };

  if (p.id) {
    var cur = DB_get(SHEETS.USERS, p.id);
    if (!cur) throw new Error('ไม่พบผู้ใช้');
    // last-admin protection
    if (cur.role === 'admin' && (role !== 'admin' || fields.is_active === 'no') && Sec_activeAdminCount_() <= 1)
      throw new Error('ไม่สามารถลด/ปิดสิทธิ์ผู้ดูแลคนสุดท้ายได้');
    // self protection
    if (String(cur.id) === String(user.id)) {
      if (role !== cur.role) throw new Error('ไม่สามารถเปลี่ยนบทบาทของตัวเองได้');
      if (fields.is_active === 'no') throw new Error('ไม่สามารถปิดบัญชีตัวเองได้');
    }
    DB_update(SHEETS.USERS, p.id, fields);
    if (fields.is_active === 'no') DB_deleteWhere(SHEETS.SESSIONS, function (s) { return String(s.user_id) === String(p.id); });
    Audit_log_(user, 'user.update', 'user', p.id, { username: cur.username });
    return { ok: true, id: p.id };
  }

  // create
  var username = String(p.username || '').trim().toLowerCase();
  if (!/^[-a-z0-9_.]{3,30}$/.test(username)) throw new Error('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ . - ยาว 3-30 ตัว');
  if (DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === username; })) throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  var pw = String(p.password || '');
  Sec_requirePassword_(pw);
  var salt = cfg_salt_();
  fields.username = username; fields.password_hash = Sec_hash_(pw, salt); fields.salt = salt;
  var ins = DB_insert(SHEETS.USERS, fields);
  Audit_log_(user, 'user.create', 'user', ins.id, { username: username, role: role });
  return { ok: true, id: ins.id };
}

function Users_resetPassword(user, p) {
  Auth_requireCap(user, 'user.manage');
  var u = DB_get(SHEETS.USERS, p && p.id);
  if (!u) throw new Error('ไม่พบผู้ใช้');
  var temp = String((p && p.password) || '').trim() || Sec_tempPassword_();
  if ((p && p.password)) Sec_requirePassword_(temp);
  var salt = cfg_salt_();
  DB_update(SHEETS.USERS, u.id, { salt: salt, password_hash: Sec_hash_(temp, salt) });
  DB_deleteWhere(SHEETS.SESSIONS, function (s) { return String(s.user_id) === String(u.id); });
  Audit_log_(user, 'user.reset_password', 'user', u.id, {});
  return { ok: true, temp_password: temp };
}

function Users_toggle(user, p) {
  Auth_requireCap(user, 'user.manage');
  var u = DB_get(SHEETS.USERS, p && p.id);
  if (!u) throw new Error('ไม่พบผู้ใช้');
  var next = _yes_(u.is_active) ? 'no' : 'yes';
  if (next === 'no') {
    if (String(u.id) === String(user.id)) throw new Error('ไม่สามารถปิดบัญชีตัวเองได้');
    if (u.role === 'admin' && Sec_activeAdminCount_() <= 1) throw new Error('ไม่สามารถปิดผู้ดูแลคนสุดท้ายได้');
    DB_deleteWhere(SHEETS.SESSIONS, function (s) { return String(s.user_id) === String(u.id); });
  }
  DB_update(SHEETS.USERS, u.id, { is_active: next });
  Audit_log_(user, 'user.toggle', 'user', u.id, { is_active: next });
  return { ok: true };
}

function Users_delete(user, p) {
  Auth_requireCap(user, 'user.manage');
  var u = DB_get(SHEETS.USERS, p && p.id);
  if (!u) throw new Error('ไม่พบผู้ใช้');
  if (String(u.id) === String(user.id)) throw new Error('ไม่สามารถลบบัญชีตัวเองได้');
  if (u.role === 'admin' && Sec_activeAdminCount_() <= 1) throw new Error('ไม่สามารถลบผู้ดูแลคนสุดท้ายได้');
  var hasRes = DB_findOne(SHEETS.RESOURCES, function (r) { return String(r.uploaded_by) === String(u.id); });
  if (hasRes) throw new Error('ผู้ใช้นี้มีสื่อในระบบ — ใช้ "ปิดบัญชี" แทนการลบ');
  DB_delete(SHEETS.USERS, u.id);
  DB_deleteWhere(SHEETS.SESSIONS, function (s) { return String(s.user_id) === String(u.id); });
  Audit_log_(user, 'user.delete', 'user', u.id, { username: u.username });
  return { ok: true };
}

/* ── PROFILE (self) ── */
function Profile_update(user, p) {
  p = p || {};
  var full = String(p.full_name || '').trim();
  if (full.length < 2) throw new Error('กรุณากรอกชื่อ-สกุล');
  var fields = {
    full_name: full, email: String(p.email || ''), phone: String(p.phone || ''),
    school: String(p.school || ''), position: String(p.position || ''),
    subject_group: String(p.subject_group || '')
  };
  if (p.avatar !== undefined) fields.avatar = String(p.avatar || '');
  DB_update(SHEETS.USERS, user.id, fields);
  Audit_log_(user, 'profile.update', 'user', user.id, {});
  var u = DB_get(SHEETS.USERS, user.id);
  return { ok: true, user: Auth_publicUser_(u) };
}
function Profile_setAvatar(user, p) {
  var r = Files_uploadAvatar(user, p);
  DB_update(SHEETS.USERS, user.id, { avatar: r.url });
  var u = DB_get(SHEETS.USERS, user.id);
  return { ok: true, avatar: r.url, user: Auth_publicUser_(u) };
}
