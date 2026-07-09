/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        09_Public.gs — Public landing endpoints (no auth)
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Public_statsLite_() {
  var ver = _verAll_([SHEETS.RESOURCES, SHEETS.USERS, SHEETS.DOWNLOADS]);
  return Cache_compute_('pub:lite:v' + ver, 120, function () {
    var rows = DB_readAll(SHEETS.RESOURCES);
    var approved = rows.filter(function (r) { return r.status === STATUS.APPROVED; });
    var dl = 0; approved.forEach(function (r) { dl += cfg_num_(r.downloads); });
    return {
      resources: approved.length,
      downloads: dl,
      teachers: DB_readAll(SHEETS.USERS).filter(function (u) { return _yes_(u.is_active); }).length,
      categories: DB_readAll(SHEETS.CATEGORIES).filter(function (c) { return _yes_(c.is_active); }).length
    };
  });
}

function _pubResView_(r, m) {
  var up = m.user[r.uploaded_by];
  var rc = cfg_num_(r.rating_count), rs = cfg_num_(r.rating_sum);
  return {
    id: r.id, code: r.code, title: r.title,
    description: String(r.description || '').substring(0, 220),
    category_label: (m.cat[r.category] || { label: r.category }).label,
    category_color: (m.cat[r.category] || {}).color || '#64748b',
    category_icon: (m.cat[r.category] || {}).icon || 'bi-tag',
    level_label: (m.lvl[r.level] || { label: r.level }).label,
    type_label: (m.type[r.type] || { label: r.type }).label,
    type_color: (m.type[r.type] || {}).color || '#64748b',
    type_icon: (m.type[r.type] || {}).icon || 'bi-collection',
    thumbnail: r.thumbnail, downloads: cfg_num_(r.downloads), views: cfg_num_(r.views),
    rating: rc ? Math.round((rs / rc) * 10) / 10 : 0, rating_count: rc,
    uploader_name: up ? up.full_name : 'ครู', featured: _yes_(r.featured), created_at: r.created_at
  };
}

function Public_home() {
  var ver = _verAll_([SHEETS.RESOURCES, SHEETS.USERS, SHEETS.CATEGORIES, SHEETS.RESTYPES, SHEETS.DOWNLOADS]);
  return Cache_compute_('pub:home:v' + ver, 120, function () {
    var m = _maps_();
    var rows = DB_readAll(SHEETS.RESOURCES).filter(function (r) { return r.status === STATUS.APPROVED; });
    var featured = rows.filter(function (r) { return _yes_(r.featured); })
      .sort(function (a, b) { return cfg_num_(b.downloads) - cfg_num_(a.downloads); }).slice(0, 6);
    if (featured.length < 6) {
      var more = rows.filter(function (r) { return !_yes_(r.featured); })
        .sort(function (a, b) { return cfg_num_(b.downloads) - cfg_num_(a.downloads); }).slice(0, 6 - featured.length);
      featured = featured.concat(more);
    }
    var recent = rows.slice().sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; }).slice(0, 8);
    var popular = rows.slice().sort(function (a, b) { return cfg_num_(b.downloads) - cfg_num_(a.downloads); }).slice(0, 8);

    // category counts
    var byCat = {};
    rows.forEach(function (r) { byCat[r.category] = (byCat[r.category] || 0) + 1; });
    var cats = DB_readAll(SHEETS.CATEGORIES).filter(function (c) { return _yes_(c.is_active); })
      .sort(function (a, b) { return cfg_num_(a.sort_order) - cfg_num_(b.sort_order); })
      .map(function (c) { return { key: c.key, label: c.label, icon: c.icon, color: c.color, count: byCat[c.key] || 0 }; });

    // contributors
    var contrib = {};
    rows.forEach(function (r) { contrib[r.uploaded_by] = (contrib[r.uploaded_by] || 0) + 1; });
    var top = Object.keys(contrib).map(function (uid) {
      var u = m.user[uid] || {};
      return { name: u.full_name || 'ครู', avatar: u.avatar || '', subject_group: u.subject_group || '', count: contrib[uid] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 6);

    return {
      stats: Public_statsLite_(),
      featured: featured.map(function (r) { return _pubResView_(r, m); }),
      recent: recent.map(function (r) { return _pubResView_(r, m); }),
      popular: popular.map(function (r) { return _pubResView_(r, m); }),
      categories: cats,
      types: Master_listPublic_(SHEETS.RESTYPES),
      contributors: top
    };
  });
}

/* public browse (limited, approved only) */
function Public_browse(p) {
  p = p || {};
  var m = _maps_();
  var q = String(p.q || '').trim().toLowerCase();
  var fCat = String(p.category || ''), fLvl = String(p.level || ''), fType = String(p.type || '');
  var rows = DB_readAll(SHEETS.RESOURCES).filter(function (r) {
    if (r.status !== STATUS.APPROVED) return false;
    if (fCat && r.category !== fCat) return false;
    if (fLvl && r.level !== fLvl) return false;
    if (fType && r.type !== fType) return false;
    if (q) { var hay = (r.title + ' ' + r.description + ' ' + r.subject + ' ' + r.tags).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
    return true;
  });
  var sort = String(p.sort || 'recent');
  rows.sort(function (a, b) {
    if (sort === 'popular') return cfg_num_(b.downloads) - cfg_num_(a.downloads);
    return String(b.created_at) < String(a.created_at) ? -1 : 1;
  });
  var total = rows.length;
  var page = Math.max(1, cfg_num_(p.page) || 1), per = 18;
  return {
    items: rows.slice((page - 1) * per, page * per).map(function (r) { return _pubResView_(r, m); }),
    total: total, page: page, per: per, pages: Math.max(1, Math.ceil(total / per))
  };
}
