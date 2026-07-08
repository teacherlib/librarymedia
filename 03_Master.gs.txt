/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        03_Master.gs — Configurable master data (Categories/Levels/ResTypes)
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/* map sheet → defaults + caps + icon presence */
function _masterMeta_(sheet) {
  if (sheet === SHEETS.CATEGORIES) return { defaults: CATEGORY_DEFAULTS, icon: true, label: 'กลุ่มสาระการเรียนรู้' };
  if (sheet === SHEETS.LEVELS) return { defaults: LEVEL_DEFAULTS, icon: false, label: 'ระดับชั้น' };
  if (sheet === SHEETS.RESTYPES) return { defaults: RESTYPE_DEFAULTS, icon: true, label: 'ประเภทสื่อ' };
  throw new Error('ไม่รู้จัก master: ' + sheet);
}

/* ── ensure defaults (internal, no auth) ── */
function Master_ensureDefaults_(sheet) {
  DB_ensureSchema_(sheet);
  var meta = _masterMeta_(sheet);
  var map = {};
  DB_readAll(sheet).forEach(function (r) { map[r.key] = 1; });
  var toAdd = [];
  meta.defaults.forEach(function (d, idx) {
    if (map[d.key]) return;
    var row = { key: d.key, label: d.label, sort_order: idx + 1, is_active: 'yes' };
    if (meta.icon) { row.icon = d.icon || 'bi-tag'; row.color = d.color || '#64748b'; row.description = ''; }
    toAdd.push(row);
  });
  if (toAdd.length) DB_bulkInsert(sheet, toAdd);
}
function Master_ensureAll_() {
  Master_ensureDefaults_(SHEETS.CATEGORIES);
  Master_ensureDefaults_(SHEETS.LEVELS);
  Master_ensureDefaults_(SHEETS.RESTYPES);
}

/* ── public list (for bundle / client) ── */
function Master_listPublic_(sheet) {
  return DB_readAll(sheet)
    .filter(function (r) { return _yes_(r.is_active); })
    .sort(function (a, b) { return cfg_num_(a.sort_order) - cfg_num_(b.sort_order); })
    .map(function (r) {
      var o = { id: r.id, key: r.key, label: r.label, sort_order: cfg_num_(r.sort_order), is_active: 'yes' };
      if (r.icon !== undefined) { o.icon = r.icon || 'bi-tag'; o.color = r.color || '#64748b'; o.description = r.description || ''; }
      return o;
    });
}

/* ── full list (admin, includes inactive + usage count) ── */
function Master_list(user, p) {
  var sheet = _sheetFromKind_(p && p.kind);
  Auth_requireCap(user, 'master.view|master.manage');
  Master_ensureDefaults_(sheet);
  var usageField = _usageField_(sheet);
  var resources = DB_readAll(SHEETS.RESOURCES);
  var usage = {};
  resources.forEach(function (r) { var k = r[usageField]; usage[k] = (usage[k] || 0) + 1; });
  var items = DB_readAll(sheet)
    .sort(function (a, b) { return cfg_num_(a.sort_order) - cfg_num_(b.sort_order); })
    .map(function (r) {
      var o = {
        id: r.id, key: r.key, label: r.label, sort_order: cfg_num_(r.sort_order),
        is_active: _yes_(r.is_active) ? 'yes' : 'no', usage: usage[r.key] || 0
      };
      if (r.icon !== undefined) { o.icon = r.icon || 'bi-tag'; o.color = r.color || '#64748b'; o.description = r.description || ''; }
      return o;
    });
  return { items: items, kind: p.kind, has_icon: _masterMeta_(sheet).icon, label: _masterMeta_(sheet).label };
}

function _sheetFromKind_(kind) {
  if (kind === 'category') return SHEETS.CATEGORIES;
  if (kind === 'level') return SHEETS.LEVELS;
  if (kind === 'restype') return SHEETS.RESTYPES;
  throw new Error('ไม่รู้จักประเภท master: ' + kind);
}
function _usageField_(sheet) {
  if (sheet === SHEETS.CATEGORIES) return 'category';
  if (sheet === SHEETS.LEVELS) return 'level';
  if (sheet === SHEETS.RESTYPES) return 'type';
  return '';
}

/* ── upsert ── */
function Master_upsert(user, p) {
  Auth_requireCap(user, 'master.manage');
  var sheet = _sheetFromKind_(p && p.kind);
  var meta = _masterMeta_(sheet);
  var key = String((p && p.key) || '').trim().toLowerCase();
  if (!/^[-a-z0-9_]{1,30}$/.test(key)) throw new Error('รหัส (key) ต้องเป็น a-z, 0-9, _ - ยาว 1-30 ตัว');
  var label = String((p && p.label) || '').trim();
  if (label.length < 1) throw new Error('กรุณากรอกชื่อ');

  var existing = DB_findOne(sheet, function (x) { return x.key === key; });
  var row = {
    key: key, label: label,
    sort_order: (p && p.sort_order != null) ? cfg_num_(p.sort_order) : 999,
    is_active: _yes_(p && p.is_active) ? 'yes' : 'no'
  };
  if (meta.icon) { row.icon = String((p && p.icon) || 'bi-tag'); row.color = String((p && p.color) || '#64748b'); row.description = String((p && p.description) || ''); }

  if (p && p.id) {
    var cur = DB_get(sheet, p.id);
    if (!cur) throw new Error('ไม่พบรายการ');
    // ห้ามเปลี่ยน key ถ้ามีการใช้งานแล้ว
    if (cur.key !== key) {
      var uf = _usageField_(sheet);
      var used = DB_findOne(SHEETS.RESOURCES, function (x) { return x[uf] === cur.key; });
      if (used) throw new Error('ไม่สามารถเปลี่ยนรหัสได้ เนื่องจากมีสื่อใช้งานอยู่ — สร้างรายการใหม่แทน');
    }
    DB_update(sheet, p.id, row);
    Audit_log_(user, 'master.update', p.kind, p.id, { key: key });
    return { ok: true, id: p.id };
  }
  if (existing) throw new Error('มีรหัสนี้อยู่แล้ว');
  var ins = DB_insert(sheet, row);
  Audit_log_(user, 'master.create', p.kind, ins.id, { key: key });
  return { ok: true, id: ins.id };
}

/* ── toggle active ── */
function Master_toggle(user, p) {
  Auth_requireCap(user, 'master.manage');
  var sheet = _sheetFromKind_(p && p.kind);
  var cur = DB_get(sheet, p && p.id);
  if (!cur) throw new Error('ไม่พบรายการ');
  DB_update(sheet, cur.id, { is_active: _yes_(cur.is_active) ? 'no' : 'yes' });
  Audit_log_(user, 'master.toggle', p.kind, cur.id, { is_active: _yes_(cur.is_active) ? 'no' : 'yes' });
  return { ok: true };
}

/* ── delete (block ถ้ามีการใช้งาน) ── */
function Master_delete(user, p) {
  Auth_requireCap(user, 'master.manage');
  var sheet = _sheetFromKind_(p && p.kind);
  var cur = DB_get(sheet, p && p.id);
  if (!cur) throw new Error('ไม่พบรายการ');
  var uf = _usageField_(sheet);
  var used = DB_findOne(SHEETS.RESOURCES, function (x) { return x[uf] === cur.key; });
  if (used) throw new Error('ไม่สามารถลบได้ เนื่องจากมีสื่อใช้งานอยู่ — ใช้ "ปิดใช้งาน" แทน');
  DB_delete(sheet, cur.id);
  Audit_log_(user, 'master.delete', p.kind, cur.id, { key: cur.key });
  return { ok: true };
}

/* ── reorder ── */
function Master_reorder(user, p) {
  Auth_requireCap(user, 'master.manage');
  var sheet = _sheetFromKind_(p && p.kind);
  var ids = (p && p.ids) || [];
  ids.forEach(function (id, idx) { DB_update(sheet, id, { sort_order: idx + 1 }); });
  Audit_log_(user, 'master.reorder', p.kind, '', { count: ids.length });
  return { ok: true };
}
