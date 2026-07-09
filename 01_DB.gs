/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        01_DB.gs — Sheet-as-DB layer (cache · version · batch · CRUD)
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var CACHE_TTL = 300;
var __L1 = {};          // name -> {ver, data}  (in-memory memo, keyed by version)
var __VERMEMO = null;   // ScriptProperties snapshot per request
var __BATCH = false, __BATCH_DIRTY = {};

/* เรียกที่ต้น api() + doGet() ทุก request เพื่อ reset memo */
function _resetReq_() { __VERMEMO = null; }

/* ─── version counters (ScriptProperties) ─── */
function _ver_(scope) {
  if (!__VERMEMO) __VERMEMO = PropertiesService.getScriptProperties().getProperties() || {};
  return Number(__VERMEMO['ver:' + scope] || '1');
}
function _bumpVer_(scope) {
  if (__BATCH) { __BATCH_DIRTY[scope] = true; return; }
  var p = PropertiesService.getScriptProperties();
  var v = Number(p.getProperty('ver:' + scope) || '1') + 1;
  p.setProperty('ver:' + scope, String(v));
  if (__VERMEMO) __VERMEMO['ver:' + scope] = String(v);
  delete __L1[scope.replace('sheet:', '')];
}
function _verAll_(scopes) { return scopes.map(function (s) { return _ver_('sheet:' + s); }).join('.'); }

/* ─── CacheService chunked ─── */
function _cache_() { return CacheService.getScriptCache(); }
function _cacheGet_(key) {
  try {
    var raw = _cache_().get(key);
    if (!raw) return null;
    if (raw.indexOf('CHUNK:') === 0) {
      var n = Number(raw.substring(6)), parts = [];
      for (var i = 0; i < n; i++) { var c = _cache_().get(key + ':' + i); if (!c) return null; parts.push(c); }
      return JSON.parse(parts.join(''));
    }
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function _cachePut_(key, val, ttl) {
  try {
    var json = JSON.stringify(val);
    if (json.length < 95000) { _cache_().put(key, json, ttl || CACHE_TTL); return; }
    var n = Math.ceil(json.length / 90000);
    _cache_().put(key, 'CHUNK:' + n, ttl || CACHE_TTL);
    for (var i = 0; i < n; i++) _cache_().put(key + ':' + i, json.substring(i * 90000, (i + 1) * 90000), ttl || CACHE_TTL);
  } catch (e) {}
}
/* version-keyed compute cache (heavy aggregation → instant repeat) */
function Cache_compute_(key, ttl, fn) {
  var c = _cacheGet_(key);
  if (c !== null && c !== undefined) return c;
  var v = fn();
  if (v !== null && v !== undefined) _cachePut_(key, v, ttl || CACHE_TTL);
  return v;
}

/* ─── spreadsheet handles ─── */
function DB_ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function DB_sheet_(name) {
  var ss = DB_ss_(), sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/**
 * DB_ensureSchema_ — ตั้ง header + TEXT format เฉพาะตอน "สร้าง/แก้ schema"
 * (ห้ามตั้ง format ทั้งคอลัมน์ทุก call — hot-path cost)
 */
function DB_ensureSchema_(name) {
  var sh = DB_sheet_(name);
  var cols = SCHEMAS[name];
  if (!cols) throw new Error('ไม่พบ schema: ' + name);
  var lastCol = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0] : [];
  var headerOk = cols.length === lastCol.length && cols.every(function (c, i) { return String(lastCol[i]) === c; });
  if (!headerOk) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // ตั้ง TEXT format เฉพาะตอนสร้าง schema (เกิดครั้งเดียว)
    cols.forEach(function (col, i) {
      if (TEXT_COLUMNS.indexOf(col) >= 0) {
        try { sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch (e) {}
      }
    });
  }
  return sh;
}
function DB_initAllSchemas() { Object.keys(SCHEMAS).forEach(function (n) { DB_ensureSchema_(n); }); }

/* ─── batch mode (seed/import) ─── */
function DB_beginBatch() { __BATCH = true; __BATCH_DIRTY = {}; }
function DB_endBatch() {
  if (!__BATCH) return;
  __BATCH = false;
  SpreadsheetApp.flush();
  var scopes = Object.keys(__BATCH_DIRTY); __BATCH_DIRTY = {};
  if (scopes.length) {
    var p = PropertiesService.getScriptProperties(), cur = p.getProperties() || {}, toSet = {};
    scopes.forEach(function (s) { toSet['ver:' + s] = String(Number(cur['ver:' + s] || '1') + 1); });
    p.setProperties(toSet);
    __VERMEMO = null;
    scopes.forEach(function (s) { delete __L1[s.replace('sheet:', '')]; });
  }
}
function _flush_() { if (!__BATCH) SpreadsheetApp.flush(); }

/* ─── READ ─── */
function DB_readAll(name) {
  var ver = _ver_('sheet:' + name);
  var l1 = __L1[name];
  if (l1 && l1.ver === ver) return l1.data;

  var cacheKey = 'sheet:' + name + ':v' + ver;
  var cached = _cacheGet_(cacheKey);
  if (cached) { __L1[name] = { ver: ver, data: cached }; return cached; }

  var sh = DB_ensureSchema_(name);
  var cols = SCHEMAS[name];
  var last = sh.getLastRow();
  if (last < 2) { var empty = []; _cachePut_(cacheKey, empty); __L1[name] = { ver: ver, data: empty }; return empty; }

  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var result = values.map(function (row) {
    var obj = {};
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i], v = row[i];
      if (v instanceof Date) {
        if (TIME_COLUMNS.indexOf(col) >= 0) v = Utilities.formatDate(v, APP.TIMEZONE, 'HH:mm');
        else if (DATE_COLUMNS.indexOf(col) >= 0) v = Utilities.formatDate(v, APP.TIMEZONE, 'yyyy-MM-dd');
        else v = cfg_iso_(v);
      }
      obj[col] = (v == null) ? '' : v;
    }
    return obj;
  }).filter(function (o) { return String(o[cols[keyIdx]] || '').trim() !== ''; });

  _cachePut_(cacheKey, result);
  __L1[name] = { ver: ver, data: result };
  return result;
}
function DB_index(name) {
  var rows = DB_readAll(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var key = cols[keyIdx], map = {};
  rows.forEach(function (r) { map[String(r[key])] = r; });
  return map;
}
function DB_get(name, id) {
  var rows = DB_readAll(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var key = cols[keyIdx], idS = String(id);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][key]) === idS) return rows[i];
  return null;
}
function DB_findOne(name, pred) {
  var rows = DB_readAll(name);
  for (var i = 0; i < rows.length; i++) if (pred(rows[i])) return rows[i];
  return null;
}

/* ─── WRITE ─── */
function _rowFromObj_(name, obj) {
  return SCHEMAS[name].map(function (c) { var v = obj[c]; return v == null ? '' : v; });
}
function _textColIdx_(name) {
  return SCHEMAS[name].reduce(function (a, c, i) { if (TEXT_COLUMNS.indexOf(c) >= 0) a.push(i); return a; }, []);
}
function DB_insert(name, data) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var now = cfg_now_();
  var obj = {};
  cols.forEach(function (c) { obj[c] = (data[c] !== undefined && data[c] !== null) ? data[c] : ''; });
  if (cols.indexOf('id') >= 0 && !obj.id) obj.id = cfg_uuid_();
  if (cols.indexOf('created_at') >= 0 && !obj.created_at) obj.created_at = now;
  if (cols.indexOf('updated_at') >= 0 && !obj.updated_at) obj.updated_at = now;

  var newRow = sh.getLastRow() + 1;
  var range = sh.getRange(newRow, 1, 1, cols.length);
  _textColIdx_(name).forEach(function (i) { sh.getRange(newRow, i + 1).setNumberFormat('@'); });
  range.setValues([_rowFromObj_(name, obj)]);
  _flush_();
  _bumpVer_('sheet:' + name);
  return obj;
}
function DB_bulkInsert(name, list) {
  if (!list || !list.length) return 0;
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name], now = cfg_now_();
  var start = sh.getLastRow() + 1;
  var matrix = list.map(function (data) {
    var obj = {};
    cols.forEach(function (c) { obj[c] = (data[c] !== undefined && data[c] !== null) ? data[c] : ''; });
    if (cols.indexOf('id') >= 0 && !obj.id) obj.id = cfg_uuid_();
    if (cols.indexOf('created_at') >= 0 && !obj.created_at) obj.created_at = now;
    if (cols.indexOf('updated_at') >= 0 && !obj.updated_at) obj.updated_at = now;
    return _rowFromObj_(name, obj);
  });
  _textColIdx_(name).forEach(function (i) { sh.getRange(start, i + 1, matrix.length, 1).setNumberFormat('@'); });
  sh.getRange(start, 1, matrix.length, cols.length).setValues(matrix);
  _flush_();
  _bumpVer_('sheet:' + name);
  return matrix.length;
}
function DB_update(name, id, patch) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var keyVals = sh.getRange(2, keyIdx + 1, last - 1, 1).getValues();
  var idS = String(id), rowNum = -1;
  for (var i = 0; i < keyVals.length; i++) { if (String(keyVals[i][0]) === idS) { rowNum = i + 2; break; } }
  if (rowNum < 0) return null;

  var range = sh.getRange(rowNum, 1, 1, cols.length);
  var cur = range.getValues()[0];
  var obj = {};
  cols.forEach(function (c, i) {
    var v = cur[i];
    if (v instanceof Date) v = cfg_iso_(v);
    obj[c] = v == null ? '' : v;
  });
  Object.keys(patch).forEach(function (k) { if (cols.indexOf(k) >= 0 && patch[k] !== undefined) obj[k] = patch[k]; });
  if (cols.indexOf('updated_at') >= 0) obj.updated_at = cfg_now_();
  _textColIdx_(name).forEach(function (i) { sh.getRange(rowNum, i + 1).setNumberFormat('@'); });
  range.setValues([_rowFromObj_(name, obj)]);
  _flush_();
  _bumpVer_('sheet:' + name);
  return obj;
}
function DB_delete(name, id) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var last = sh.getLastRow();
  if (last < 2) return false;
  var keyVals = sh.getRange(2, keyIdx + 1, last - 1, 1).getValues();
  var idS = String(id);
  for (var i = 0; i < keyVals.length; i++) {
    if (String(keyVals[i][0]) === idS) { sh.deleteRow(i + 2); _flush_(); _bumpVer_('sheet:' + name); return true; }
  }
  return false;
}
function DB_deleteWhere(name, pred) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name], last = sh.getLastRow();
  if (last < 2) return 0;
  var rows = DB_readAll(name), del = [];
  rows.forEach(function (r, idx) { if (pred(r)) del.push(idx + 2); });
  // ลบจากล่างขึ้นบน กัน index เลื่อน
  del.sort(function (a, b) { return b - a; }).forEach(function (rn) { sh.deleteRow(rn); });
  if (del.length) { _flush_(); _bumpVer_('sheet:' + name); }
  return del.length;
}

/* ─── repair: ฟื้นฟู TEXT format ของข้อมูลเก่าที่ coerce ───*/
function DB_repairTextColumns(name) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name], last = sh.getLastRow();
  cols.forEach(function (col, i) {
    if (TEXT_COLUMNS.indexOf(col) >= 0) {
      try { sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch (e) {}
    }
  });
  if (last >= 2) {
    var range = sh.getRange(2, 1, last - 1, cols.length);
    var vals = range.getValues();
    var fixed = vals.map(function (row) {
      return row.map(function (v, i) {
        var col = cols[i];
        if (v instanceof Date && !isNaN(v.getTime())) {
          if (TIME_COLUMNS.indexOf(col) >= 0) return Utilities.formatDate(v, APP.TIMEZONE, 'HH:mm');
          if (DATE_COLUMNS.indexOf(col) >= 0) return Utilities.formatDate(v, APP.TIMEZONE, 'yyyy-MM-dd');
        }
        return v == null ? '' : v;
      });
    });
    range.setValues(fixed);
  }
  _bumpVer_('sheet:' + name);
}
function DB_repairAll() { Object.keys(SCHEMAS).forEach(function (n) { DB_repairTextColumns(n); }); }
