/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        11_Audit.gs — Append-only audit log
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var AUDIT_LABEL = Object.freeze({
  'auth.login': 'เข้าสู่ระบบ', 'auth.logout': 'ออกจากระบบ', 'auth.fail': 'เข้าสู่ระบบล้มเหลว',
  'auth.register': 'สมัครสมาชิก', 'auth.change_password': 'เปลี่ยนรหัสผ่าน',
  'resource.create': 'เพิ่มสื่อ', 'resource.update': 'แก้ไขสื่อ', 'resource.submit': 'ส่งสื่อ',
  'resource.approve': 'อนุมัติสื่อ', 'resource.reject': 'ตีกลับสื่อ', 'resource.feature': 'ตั้งสื่อแนะนำ',
  'resource.delete': 'ลบสื่อ', 'resource.download': 'ดาวน์โหลด',
  'rating.save': 'ให้คะแนน', 'master.create': 'เพิ่มข้อมูลหลัก', 'master.update': 'แก้ข้อมูลหลัก',
  'master.delete': 'ลบข้อมูลหลัก', 'master.toggle': 'สลับสถานะข้อมูลหลัก', 'master.reorder': 'จัดลำดับ',
  'user.create': 'เพิ่มผู้ใช้', 'user.update': 'แก้ผู้ใช้', 'user.delete': 'ลบผู้ใช้',
  'user.toggle': 'สลับสถานะผู้ใช้', 'user.reset_password': 'รีเซ็ตรหัสผ่าน',
  'profile.update': 'แก้โปรไฟล์', 'setting.update': 'แก้ไขการตั้งค่า', 'file.upload': 'อัปโหลดไฟล์'
});

function Audit_log_(user, action, entity, entity_id, meta) {
  try {
    DB_insert(SHEETS.AUDIT, {
      user_id: (user && user.id) || '', username: (user && user.username) || '',
      action: action, entity: entity || '', entity_id: entity_id || '',
      meta: meta ? JSON.stringify(meta) : '', created_at: cfg_now_()
    });
  } catch (e) {}
}

function Audit_list(user, p) {
  Auth_requireCap(user, 'audit.view_all');
  var q = String((p && p.q) || '').trim().toLowerCase();
  var fAction = String((p && p.action) || '');
  var rows = DB_readAll(SHEETS.AUDIT).filter(function (a) {
    if (fAction && a.action !== fAction) return false;
    if (q) { var hay = (a.username + ' ' + a.action + ' ' + a.entity + ' ' + a.meta).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
    return true;
  }).sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; });
  var page = Math.max(1, cfg_num_(p && p.page) || 1), per = 50;
  return {
    items: rows.slice((page - 1) * per, page * per).map(function (a) {
      return { id: a.id, username: a.username, action: a.action, action_label: AUDIT_LABEL[a.action] || a.action, entity: a.entity, entity_id: a.entity_id, meta: a.meta, created_at: a.created_at };
    }),
    total: rows.length, page: page, per: per, pages: Math.max(1, Math.ceil(rows.length / per)),
    actions: AUDIT_LABEL
  };
}
