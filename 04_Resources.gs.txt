/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        04_Resources.gs — Resource CRUD · Approval · Favorite · Rating · Stats · Reports
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/* ── code generator ── */
function _resNextCode_() {
  var rows = DB_readAll(SHEETS.RESOURCES);
  var max = 0;
  rows.forEach(function (r) {
    var m = String(r.code || '').match(/RES(\d+)/);
    if (m) { var n = Number(m[1]); if (n > max) max = n; }
  });
  var n = max + 1;
  return 'RES' + ('00000' + n).slice(-5);
}

/* ── public view mapper (resolve labels via maps) ── */
function _resView_(r, userMap, catMap, lvlMap, typeMap) {
  var up = userMap[r.uploaded_by];
  var rc = cfg_num_(r.rating_count), rs = cfg_num_(r.rating_sum);
  return {
    id: r.id, code: r.code, title: r.title, description: r.description,
    category: r.category, category_label: (catMap[r.category] || { label: r.category }).label,
    category_color: (catMap[r.category] || {}).color || '#64748b',
    category_icon: (catMap[r.category] || {}).icon || 'bi-tag',
    level: r.level, level_label: (lvlMap[r.level] || { label: r.level }).label,
    type: r.type, type_label: (typeMap[r.type] || { label: r.type }).label,
    type_color: (typeMap[r.type] || {}).color || '#64748b',
    type_icon: (typeMap[r.type] || {}).icon || 'bi-collection',
    subject: r.subject, tags: r.tags,
    file_url: r.file_url, file_id: r.file_id, file_name: r.file_name, file_type: r.file_type,
    file_size: cfg_num_(r.file_size), thumbnail: r.thumbnail, external_url: r.external_url,
    downloads: cfg_num_(r.downloads), views: cfg_num_(r.views),
    rating: rc > 0 ? Math.round((rs / rc) * 10) / 10 : 0, rating_count: rc,
    status: r.status, reject_reason: r.reject_reason, featured: _yes_(r.featured),
    uploaded_by: r.uploaded_by,
    uploader_name: up ? up.full_name : 'ไม่ทราบ',
    uploader_avatar: up ? up.avatar : '',
    reviewed_by: r.reviewed_by, reviewed_at: r.reviewed_at,
    created_at: r.created_at, updated_at: r.updated_at
  };
}
function _maps_() {
  return {
    user: DB_index(SHEETS.USERS),
    cat: _byKey_(DB_readAll(SHEETS.CATEGORIES)),
    lvl: _byKey_(DB_readAll(SHEETS.LEVELS)),
    type: _byKey_(DB_readAll(SHEETS.RESTYPES))
  };
}
function _byKey_(rows) { var m = {}; rows.forEach(function (r) { m[r.key] = r; }); return m; }

/* ── LIST ── */
function Resources_list(user, p) {
  p = p || {};
  Auth_requireCap(user, 'resource.view_all');
  var m = _maps_();
  var rows = DB_readAll(SHEETS.RESOURCES);
  var isReviewer = hasCap_(user.role, 'resource.approve') || hasCap_(user.role, 'resource.manage');

  var scope = String(p.scope || 'all');     // all | mine | favorites | pending
  var favSet = {};
  if (scope === 'favorites') {
    DB_readAll(SHEETS.FAVORITES).forEach(function (f) { if (String(f.user_id) === String(user.id)) favSet[f.resource_id] = 1; });
  }

  var q = String(p.q || '').trim().toLowerCase();
  var fCat = String(p.category || ''), fLvl = String(p.level || ''), fType = String(p.type || ''), fStatus = String(p.status || '');

  var list = rows.filter(function (r) {
    // visibility
    var own = String(r.uploaded_by) === String(user.id);
    if (!isReviewer) {
      // ครูเห็น: ที่เผยแพร่แล้ว + ของตัวเองทุกสถานะ
      if (r.status !== STATUS.APPROVED && !own) return false;
    }
    if (scope === 'mine' && !own) return false;
    if (scope === 'favorites' && !favSet[r.id]) return false;
    if (scope === 'pending' && r.status !== STATUS.PENDING) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fCat && r.category !== fCat) return false;
    if (fLvl && r.level !== fLvl) return false;
    if (fType && r.type !== fType) return false;
    if (q) {
      var hay = (r.title + ' ' + r.description + ' ' + r.subject + ' ' + r.tags + ' ' + r.code).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  // sort
  var sort = String(p.sort || 'recent');
  list.sort(function (a, b) {
    if (sort === 'popular') return cfg_num_(b.downloads) - cfg_num_(a.downloads);
    if (sort === 'views') return cfg_num_(b.views) - cfg_num_(a.views);
    if (sort === 'rating') {
      var ra = cfg_num_(a.rating_count) ? cfg_num_(a.rating_sum) / cfg_num_(a.rating_count) : 0;
      var rb = cfg_num_(b.rating_count) ? cfg_num_(b.rating_sum) / cfg_num_(b.rating_count) : 0;
      return rb - ra;
    }
    if (sort === 'title') return String(a.title) < String(b.title) ? -1 : 1;
    return String(b.created_at) < String(a.created_at) ? -1 : 1; // recent
  });

  var total = list.length;
  var page = Math.max(1, cfg_num_(p.page) || 1);
  var per = Math.min(60, Math.max(6, cfg_num_(p.per) || 24));
  var slice = list.slice((page - 1) * per, page * per);
  var items = slice.map(function (r) { return _resView_(r, m.user, m.cat, m.lvl, m.type); });
  return { items: items, total: total, page: page, per: per, pages: Math.max(1, Math.ceil(total / per)) };
}

/* ── GET detail ── */
function Resources_get(user, p) {
  Auth_requireCap(user, 'resource.view_all');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อนี้');
  var isReviewer = hasCap_(user.role, 'resource.approve') || hasCap_(user.role, 'resource.manage');
  var own = String(r.uploaded_by) === String(user.id);
  if (!isReviewer && r.status !== STATUS.APPROVED && !own) throw new Error('สื่อนี้ยังไม่เผยแพร่');

  var m = _maps_();
  var view = _resView_(r, m.user, m.cat, m.lvl, m.type);
  view.can_edit = own || hasCap_(user.role, 'resource.edit_all');
  view.can_delete = (own && hasCap_(user.role, 'resource.delete_own')) || hasCap_(user.role, 'resource.delete_all') || hasCap_(user.role, 'resource.manage');
  view.can_approve = hasCap_(user.role, 'resource.approve') || hasCap_(user.role, 'resource.manage');
  view.can_feature = hasCap_(user.role, 'resource.feature') || hasCap_(user.role, 'resource.manage');

  // my favorite / rating
  view.is_favorite = !!DB_findOne(SHEETS.FAVORITES, function (f) { return String(f.user_id) === String(user.id) && String(f.resource_id) === String(r.id); });
  var myR = DB_findOne(SHEETS.RATINGS, function (x) { return String(x.user_id) === String(user.id) && String(x.resource_id) === String(r.id); });
  view.my_rating = myR ? cfg_num_(myR.score) : 0;
  view.my_comment = myR ? (myR.comment || '') : '';

  // recent ratings/comments
  view.reviews = DB_readAll(SHEETS.RATINGS)
    .filter(function (x) { return String(x.resource_id) === String(r.id) && String(x.comment || '').trim(); })
    .sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; })
    .slice(0, 20)
    .map(function (x) { var u = m.user[x.user_id]; return { name: u ? u.full_name : 'ผู้ใช้', avatar: u ? u.avatar : '', score: cfg_num_(x.score), comment: x.comment, created_at: x.created_at }; });

  // increment views (non-blocking correctness)
  try { DB_update(SHEETS.RESOURCES, r.id, { views: cfg_num_(r.views) + 1 }); view.views = cfg_num_(r.views) + 1; } catch (e) {}
  return view;
}

/* ── SAVE (create/update) ── */
function Resources_save(user, p) {
  Auth_requireCap(user, 'resource.create');
  p = p || {};
  var title = String(p.title || '').trim();
  if (title.length < 3) throw new Error('กรุณากรอกชื่อสื่ออย่างน้อย 3 ตัวอักษร');
  if (title.length > 200) throw new Error('ชื่อสื่อยาวเกินไป');
  if (!String(p.category || '').trim()) throw new Error('กรุณาเลือกกลุ่มสาระการเรียนรู้');
  if (!String(p.level || '').trim()) throw new Error('กรุณาเลือกระดับชั้น');
  if (!String(p.type || '').trim()) throw new Error('กรุณาเลือกประเภทสื่อ');
  if (!String(p.file_url || '').trim() && !String(p.external_url || '').trim())
    throw new Error('กรุณาแนบไฟล์ หรือใส่ลิงก์สื่อภายนอก');

  var fields = {
    title: title,
    description: String(p.description || '').substring(0, 4000),
    category: String(p.category || ''), level: String(p.level || ''), type: String(p.type || ''),
    subject: String(p.subject || '').substring(0, 200),
    tags: String(p.tags || '').substring(0, 300),
    file_url: String(p.file_url || ''), file_id: String(p.file_id || ''),
    file_name: String(p.file_name || ''), file_type: String(p.file_type || ''),
    file_size: cfg_num_(p.file_size), thumbnail: String(p.thumbnail || ''),
    external_url: String(p.external_url || '')
  };

  var requireApproval = _yes_(Settings_map_().require_approval);

  if (p.id) {
    var cur = DB_get(SHEETS.RESOURCES, p.id);
    if (!cur) throw new Error('ไม่พบสื่อ');
    var own = String(cur.uploaded_by) === String(user.id);
    if (!own && !hasCap_(user.role, 'resource.edit_all')) throw new Error('คุณไม่มีสิทธิ์แก้ไขสื่อนี้');
    // ครูแก้สื่อที่เผยแพร่แล้ว → กลับเป็นรออนุมัติ (ถ้าระบบต้องอนุมัติ และไม่ใช่ reviewer)
    if (requireApproval && !hasCap_(user.role, 'resource.approve') && cur.status === STATUS.APPROVED) {
      fields.status = STATUS.PENDING; fields.reject_reason = '';
    }
    DB_update(SHEETS.RESOURCES, p.id, fields);
    Audit_log_(user, 'resource.update', 'resource', p.id, { title: title });
    return { ok: true, id: p.id };
  }

  // create
  var submit = !!p.submit;   // ส่งเข้าระบบเลย หรือเก็บเป็นร่าง
  fields.code = _resNextCode_();
  fields.uploaded_by = user.id;
  fields.downloads = 0; fields.views = 0; fields.rating_sum = 0; fields.rating_count = 0; fields.featured = 'no';
  if (!submit) {
    fields.status = STATUS.DRAFT;
  } else if (requireApproval && !hasCap_(user.role, 'resource.approve')) {
    fields.status = STATUS.PENDING;
  } else {
    fields.status = STATUS.APPROVED; fields.reviewed_by = user.id; fields.reviewed_at = cfg_now_();
  }
  var ins = DB_insert(SHEETS.RESOURCES, fields);
  Audit_log_(user, 'resource.create', 'resource', ins.id, { title: title, status: fields.status });
  if (fields.status === STATUS.PENDING) { try { Telegram_notifyNew(ins, user); } catch (e) {} }
  return { ok: true, id: ins.id, status: fields.status };
}

/* ── submit draft → pending ── */
function Resources_submit(user, p) {
  Auth_requireCap(user, 'resource.create');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อ');
  if (String(r.uploaded_by) !== String(user.id) && !hasCap_(user.role, 'resource.edit_all')) throw new Error('ไม่มีสิทธิ์');
  var requireApproval = _yes_(Settings_map_().require_approval);
  if (requireApproval && !hasCap_(user.role, 'resource.approve')) {
    DB_update(SHEETS.RESOURCES, r.id, { status: STATUS.PENDING, reject_reason: '' });
    try { Telegram_notifyNew(r, user); } catch (e) {}
  } else {
    DB_update(SHEETS.RESOURCES, r.id, { status: STATUS.APPROVED, reviewed_by: user.id, reviewed_at: cfg_now_(), reject_reason: '' });
  }
  Audit_log_(user, 'resource.submit', 'resource', r.id, {});
  return { ok: true };
}

/* ── approve ── */
function Resources_approve(user, p) {
  Auth_requireCap(user, 'resource.approve');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อ');
  DB_update(SHEETS.RESOURCES, r.id, { status: STATUS.APPROVED, reviewed_by: user.id, reviewed_at: cfg_now_(), reject_reason: '' });
  Audit_log_(user, 'resource.approve', 'resource', r.id, { title: r.title });
  try { Telegram_notifyApprove(r, user, true); } catch (e) {}
  return { ok: true };
}
function Resources_reject(user, p) {
  Auth_requireCap(user, 'resource.approve');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อ');
  var reason = String((p && p.reason) || '').trim();
  if (reason.length < 3) throw new Error('กรุณาระบุเหตุผลการตีกลับ');
  DB_update(SHEETS.RESOURCES, r.id, { status: STATUS.REJECTED, reviewed_by: user.id, reviewed_at: cfg_now_(), reject_reason: reason });
  Audit_log_(user, 'resource.reject', 'resource', r.id, { reason: reason });
  try { Telegram_notifyApprove(r, user, false, reason); } catch (e) {}
  return { ok: true };
}
function Resources_feature(user, p) {
  Auth_requireCap(user, 'resource.feature');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อ');
  DB_update(SHEETS.RESOURCES, r.id, { featured: _yes_(r.featured) ? 'no' : 'yes' });
  Audit_log_(user, 'resource.feature', 'resource', r.id, { featured: _yes_(r.featured) ? 'no' : 'yes' });
  return { ok: true };
}

/* ── delete ── */
function Resources_delete(user, p) {
  Auth_requireCap(user, 'resource.delete_own|resource.delete_all|resource.manage');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อ');
  var own = String(r.uploaded_by) === String(user.id);
  if (!own && !hasCap_(user.role, 'resource.delete_all') && !hasCap_(user.role, 'resource.manage'))
    throw new Error('คุณไม่มีสิทธิ์ลบสื่อนี้');
  DB_delete(SHEETS.RESOURCES, r.id);
  DB_deleteWhere(SHEETS.FAVORITES, function (f) { return String(f.resource_id) === String(r.id); });
  DB_deleteWhere(SHEETS.RATINGS, function (x) { return String(x.resource_id) === String(r.id); });
  Audit_log_(user, 'resource.delete', 'resource', r.id, { title: r.title });
  return { ok: true };
}

/* ── download (record + count) ── */
function Resources_download(user, p) {
  Auth_requireCap(user, 'resource.download');
  var r = DB_get(SHEETS.RESOURCES, p && p.id);
  if (!r) throw new Error('ไม่พบสื่อ');
  if (r.status !== STATUS.APPROVED && String(r.uploaded_by) !== String(user.id) && !hasCap_(user.role, 'resource.approve'))
    throw new Error('สื่อนี้ยังไม่เผยแพร่');
  DB_insert(SHEETS.DOWNLOADS, { resource_id: r.id, user_id: user.id });
  DB_update(SHEETS.RESOURCES, r.id, { downloads: cfg_num_(r.downloads) + 1 });
  Audit_log_(user, 'resource.download', 'resource', r.id, {});
  return { ok: true, url: r.file_url || r.external_url, name: r.file_name || r.title, downloads: cfg_num_(r.downloads) + 1 };
}

/* ── favorite ── */
function Favorite_toggle(user, p) {
  Auth_requireCap(user, 'favorite.manage');
  var rid = String((p && p.id) || '');
  if (!DB_get(SHEETS.RESOURCES, rid)) throw new Error('ไม่พบสื่อ');
  var existing = DB_findOne(SHEETS.FAVORITES, function (f) { return String(f.user_id) === String(user.id) && String(f.resource_id) === rid; });
  if (existing) { DB_delete(SHEETS.FAVORITES, existing.id); return { ok: true, favorite: false }; }
  DB_insert(SHEETS.FAVORITES, { user_id: user.id, resource_id: rid });
  return { ok: true, favorite: true };
}

/* ── rating ── */
function Rating_save(user, p) {
  Auth_requireCap(user, 'rating.manage');
  var rid = String((p && p.id) || '');
  var r = DB_get(SHEETS.RESOURCES, rid);
  if (!r) throw new Error('ไม่พบสื่อ');
  var score = Math.max(1, Math.min(5, Math.round(cfg_num_(p && p.score))));
  if (!score) throw new Error('กรุณาให้คะแนน 1-5 ดาว');
  var comment = String((p && p.comment) || '').substring(0, 1000);
  var existing = DB_findOne(SHEETS.RATINGS, function (x) { return String(x.user_id) === String(user.id) && String(x.resource_id) === rid; });
  if (existing) DB_update(SHEETS.RATINGS, existing.id, { score: score, comment: comment });
  else DB_insert(SHEETS.RATINGS, { resource_id: rid, user_id: user.id, score: score, comment: comment });
  // recompute
  var all = DB_readAll(SHEETS.RATINGS).filter(function (x) { return String(x.resource_id) === rid; });
  var sum = 0; all.forEach(function (x) { sum += cfg_num_(x.score); });
  DB_update(SHEETS.RESOURCES, rid, { rating_sum: sum, rating_count: all.length });
  Audit_log_(user, 'rating.save', 'resource', rid, { score: score });
  return { ok: true, rating: all.length ? Math.round((sum / all.length) * 10) / 10 : 0, rating_count: all.length };
}

/* ═══════════ DASHBOARD STATS (version-keyed compute cache) ═══════════ */
function Resources_stats(user, p) {
  var viewAll = hasCap_(user.role, 'resource.view_all') && (hasCap_(user.role, 'resource.approve') || hasCap_(user.role, 'resource.manage'));
  var ver = _verAll_([SHEETS.RESOURCES, SHEETS.USERS, SHEETS.DOWNLOADS, SHEETS.FAVORITES]);
  var key = 'dash:' + user.id + ':' + (viewAll ? '1' : '0') + ':v' + ver;
  return Cache_compute_(key, 300, function () { return _statsCompute_(user, viewAll); });
}
function _statsCompute_(user, viewAll) {
  var m = _maps_();
  var rows = DB_readAll(SHEETS.RESOURCES);
  var byStatus = { draft: 0, pending: 0, approved: 0, rejected: 0 };
  var byCat = {}, byType = {}, byLevel = {};
  var totalDl = 0, totalViews = 0, mine = 0, mineApproved = 0, myDl = 0;
  var topRes = [];
  rows.forEach(function (r) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byCat[r.category] = (byCat[r.category] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    totalDl += cfg_num_(r.downloads); totalViews += cfg_num_(r.views);
    if (String(r.uploaded_by) === String(user.id)) { mine++; if (r.status === STATUS.APPROVED) mineApproved++; myDl += cfg_num_(r.downloads); }
  });
  // top approved by downloads
  topRes = rows.filter(function (r) { return r.status === STATUS.APPROVED; })
    .sort(function (a, b) { return cfg_num_(b.downloads) - cfg_num_(a.downloads); })
    .slice(0, 8)
    .map(function (r) { return _resView_(r, m.user, m.cat, m.lvl, m.type); });

  // 14-day trend of created/downloaded
  var days = [], dlByDay = {};
  DB_readAll(SHEETS.DOWNLOADS).forEach(function (d) { var k = cfg_d10_(d.created_at); dlByDay[k] = (dlByDay[k] || 0) + 1; });
  var createdByDay = {};
  rows.forEach(function (r) { var k = cfg_d10_(r.created_at); createdByDay[k] = (createdByDay[k] || 0) + 1; });
  var now = new Date();
  for (var i = 13; i >= 0; i--) {
    var d = new Date(now.getTime() - i * 86400000);
    var k = Utilities.formatDate(d, APP.TIMEZONE, 'yyyy-MM-dd');
    days.push({ date: k, created: createdByDay[k] || 0, downloads: dlByDay[k] || 0 });
  }

  // category aggregation for bar
  var catBars = Object.keys(byCat).map(function (k) {
    return { key: k, label: (m.cat[k] || { label: k }).label, color: (m.cat[k] || {}).color || '#64748b', value: byCat[k] };
  }).sort(function (a, b) { return b.value - a.value; });
  var typeBars = Object.keys(byType).map(function (k) {
    return { key: k, label: (m.type[k] || { label: k }).label, color: (m.type[k] || {}).color || '#64748b', value: byType[k] };
  }).sort(function (a, b) { return b.value - a.value; });

  // recent resources
  var recent = rows.sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; })
    .slice(0, 8).map(function (r) { return _resView_(r, m.user, m.cat, m.lvl, m.type); });

  // top contributors
  var contrib = {};
  rows.forEach(function (r) { if (r.status === STATUS.APPROVED) contrib[r.uploaded_by] = (contrib[r.uploaded_by] || 0) + 1; });
  var top = Object.keys(contrib).map(function (uid) {
    var u = m.user[uid] || {};
    return { id: uid, name: u.full_name || 'ผู้ใช้', avatar: u.avatar || '', subject_group: u.subject_group || '', count: contrib[uid] };
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 6);

  return {
    role: user.role, view_all: viewAll,
    total: rows.length, by_status: byStatus,
    total_downloads: totalDl, total_views: totalViews,
    teachers: DB_readAll(SHEETS.USERS).filter(function (x) { return _yes_(x.is_active); }).length,
    mine: mine, mine_approved: mineApproved, my_downloads: myDl,
    pending: byStatus.pending || 0,
    favorites: DB_readAll(SHEETS.FAVORITES).filter(function (f) { return String(f.user_id) === String(user.id); }).length,
    trend: days, cat_bars: catBars, type_bars: typeBars,
    top_resources: topRes, recent: recent, top_contributors: top,
    avg_rating: (function () {
      var rc = 0, rs = 0; rows.forEach(function (r) { rs += cfg_num_(r.rating_sum); rc += cfg_num_(r.rating_count); });
      return rc ? Math.round((rs / rc) * 10) / 10 : 0;
    })()
  };
}

/* ═══════════ REPORTS ═══════════ */
function Resources_reportOverview(user, p) {
  Auth_requireCap(user, 'report.view_all');
  var ver = _verAll_([SHEETS.RESOURCES, SHEETS.USERS, SHEETS.DOWNLOADS]);
  return Cache_compute_('rpt:overview:v' + ver, 300, function () { return _reportOverviewCompute_(); });
}
function _reportOverviewCompute_() {
  var m = _maps_();
  var rows = DB_readAll(SHEETS.RESOURCES);
  var byStatus = { draft: 0, pending: 0, approved: 0, rejected: 0 };
  var byCat = {}, byLevel = {}, teacherMap = {};
  var submitted = 0, approved = 0, totalDl = 0;
  rows.forEach(function (r) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byCat[r.category] = (byCat[r.category] || 0) + 1;
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    totalDl += cfg_num_(r.downloads);
    if (r.status !== STATUS.DRAFT) submitted++;
    if (r.status === STATUS.APPROVED) approved++;
    var tm = teacherMap[r.uploaded_by];
    if (!tm) { var u = m.user[r.uploaded_by] || {}; tm = teacherMap[r.uploaded_by] = { id: r.uploaded_by, name: u.full_name || 'ผู้ใช้', avatar: u.avatar || '', subject_group: u.subject_group || '', total: 0, approved: 0, downloads: 0, cats: {}, last: '' }; }
    tm.total++; if (r.status === STATUS.APPROVED) tm.approved++;
    tm.downloads += cfg_num_(r.downloads); tm.cats[r.category] = 1;
    var t = r.updated_at || r.created_at; if (t > tm.last) tm.last = t;
  });
  var teachers = Object.keys(teacherMap).map(function (k) {
    var t = teacherMap[k]; t.subjects = Object.keys(t.cats).length; delete t.cats;
    t.rate = t.total ? Math.round((t.approved / t.total) * 1000) / 10 : 0;
    return t;
  }).sort(function (a, b) { return b.total - a.total; });

  // trend 14d
  var dlByDay = {}, createdByDay = {};
  DB_readAll(SHEETS.DOWNLOADS).forEach(function (d) { var k = cfg_d10_(d.created_at); dlByDay[k] = (dlByDay[k] || 0) + 1; });
  rows.forEach(function (r) { var k = cfg_d10_(r.created_at); createdByDay[k] = (createdByDay[k] || 0) + 1; });
  var days = [], now = new Date();
  for (var i = 13; i >= 0; i--) { var d = new Date(now.getTime() - i * 86400000); var k = Utilities.formatDate(d, APP.TIMEZONE, 'yyyy-MM-dd'); days.push({ date: k, created: createdByDay[k] || 0, downloads: dlByDay[k] || 0 }); }

  return {
    total: rows.length, by_status: byStatus, total_downloads: totalDl,
    submitted: submitted, approved: approved,
    completion_rate: submitted ? Math.round((approved / submitted) * 1000) / 10 : 0,
    cat_bars: Object.keys(byCat).map(function (k) { return { key: k, label: (m.cat[k] || { label: k }).label, color: (m.cat[k] || {}).color || '#64748b', value: byCat[k] }; }).sort(function (a, b) { return b.value - a.value; }),
    level_bars: Object.keys(byLevel).map(function (k) { return { key: k, label: (m.lvl[k] || { label: k }).label, value: byLevel[k] }; }).sort(function (a, b) { return b.value - a.value; }),
    trend: days, teachers: teachers,
    generated_at: cfg_now_()
  };
}
function Resources_reportTeacher(user, p) {
  var tid = String((p && p.teacher_id) || user.id);
  if (tid !== String(user.id) && !hasCap_(user.role, 'report.view_all')) throw new Error('คุณไม่มีสิทธิ์ดูรายงานของผู้อื่น');
  var m = _maps_();
  var u = m.user[tid]; if (!u) throw new Error('ไม่พบครู');
  var rows = DB_readAll(SHEETS.RESOURCES).filter(function (r) { return String(r.uploaded_by) === tid; });
  var byStatus = { draft: 0, pending: 0, approved: 0, rejected: 0 }, byCat = {}, byType = {};
  var totalDl = 0, totalViews = 0;
  rows.forEach(function (r) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byCat[r.category] = (byCat[r.category] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    totalDl += cfg_num_(r.downloads); totalViews += cfg_num_(r.views);
  });
  var recent = rows.sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; })
    .slice(0, 20).map(function (r) { return _resView_(r, m.user, m.cat, m.lvl, m.type); });
  return {
    teacher: { id: tid, name: u.full_name, avatar: u.avatar, email: u.email, subject_group: u.subject_group, role: u.role, created_at: u.created_at },
    total: rows.length, by_status: byStatus, total_downloads: totalDl, total_views: totalViews,
    approved: byStatus.approved || 0, subjects: Object.keys(byCat).length,
    cat_bars: Object.keys(byCat).map(function (k) { return { key: k, label: (m.cat[k] || { label: k }).label, color: (m.cat[k] || {}).color || '#64748b', value: byCat[k] }; }).sort(function (a, b) { return b.value - a.value; }),
    type_bars: Object.keys(byType).map(function (k) { return { key: k, label: (m.type[k] || { label: k }).label, color: (m.type[k] || {}).color || '#64748b', value: byType[k] }; }).sort(function (a, b) { return b.value - a.value; }),
    recent: recent, generated_at: cfg_now_()
  };
}
function Resources_teachersList(user, p) {
  Auth_requireCap(user, 'report.view_all');
  var counts = {};
  DB_readAll(SHEETS.RESOURCES).forEach(function (r) { counts[r.uploaded_by] = (counts[r.uploaded_by] || 0) + 1; });
  return {
    items: DB_readAll(SHEETS.USERS).filter(function (u) { return _yes_(u.is_active); })
      .map(function (u) { return { id: u.id, name: u.full_name, subject_group: u.subject_group, count: counts[u.id] || 0 }; })
      .sort(function (a, b) { return b.count - a.count; })
  };
}
