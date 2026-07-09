/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        Code.gs — doGet · API router · include · warm/GC
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function doGet(e) {
  _resetReq_();
  var t = HtmlService.createTemplateFromFile('Index');
  var bundle = {};
  try { bundle = App_publicBundle_(); } catch (err) { bundle = { app: { name: APP.NAME, version: APP.VERSION }, settings: SETTINGS_DEFAULTS, error: String(err) }; }
  t.bootData = bundle;
  return t.evaluate()
    .setTitle(APP.TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ─── API router ─── */
var PUBLIC_ACTIONS = ['app.bootstrap', 'auth.login', 'auth.register', 'auth.demo_login', 'public.home', 'public.browse'];

function api(req) {
  _resetReq_();
  req = req || {};
  var action = String(req.action || '');
  var payload = req.payload || {};
  var token = String(req.token || '');
  try {
    if (PUBLIC_ACTIONS.indexOf(action) >= 0) return { ok: true, data: _dispatchPublic_(action, payload, token) };
    var user = Auth_verify_(token);
    return { ok: true, data: _dispatch_(user, action, payload) };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function _dispatchPublic_(action, payload, token) {
  switch (action) {
    case 'app.bootstrap': return App_bootstrap(token);
    case 'auth.login': return Auth_login(payload);
    case 'auth.register': return Auth_register(payload);
    case 'auth.demo_login': return Auth_demoLogin(payload);
    case 'public.home': return Public_home();
    case 'public.browse': return Public_browse(payload);
  }
  throw new Error('ไม่พบ action: ' + action);
}

function _dispatch_(user, action, payload) {
  switch (action) {
    /* auth/profile */
    case 'auth.logout': return Auth_logout(payload && payload.token);
    case 'auth.change_password': return Auth_changePassword(user, payload);
    case 'profile.update': return Profile_update(user, payload);
    case 'profile.avatar': return Profile_setAvatar(user, payload);
    case 'file.upload': return Files_upload(user, payload);

    /* resources */
    case 'resource.list': return Resources_list(user, payload);
    case 'resource.get': return Resources_get(user, payload);
    case 'resource.save': return Resources_save(user, payload);
    case 'resource.submit': return Resources_submit(user, payload);
    case 'resource.approve': return Resources_approve(user, payload);
    case 'resource.reject': return Resources_reject(user, payload);
    case 'resource.feature': return Resources_feature(user, payload);
    case 'resource.delete': return Resources_delete(user, payload);
    case 'resource.download': return Resources_download(user, payload);
    case 'resource.stats': return Resources_stats(user, payload);
    case 'favorite.toggle': return Favorite_toggle(user, payload);
    case 'rating.save': return Rating_save(user, payload);

    /* reports */
    case 'report.overview': return Resources_reportOverview(user, payload);
    case 'report.teacher': return Resources_reportTeacher(user, payload);
    case 'report.teachers': return Resources_teachersList(user, payload);

    /* master */
    case 'master.list': return Master_list(user, payload);
    case 'master.upsert': return Master_upsert(user, payload);
    case 'master.toggle': return Master_toggle(user, payload);
    case 'master.delete': return Master_delete(user, payload);
    case 'master.reorder': return Master_reorder(user, payload);

    /* users */
    case 'user.list': return Users_list(user, payload);
    case 'user.get': return Users_get(user, payload);
    case 'user.save': return Users_save(user, payload);
    case 'user.reset_password': return Users_resetPassword(user, payload);
    case 'user.toggle': return Users_toggle(user, payload);
    case 'user.delete': return Users_delete(user, payload);

    /* settings */
    case 'setting.get': return Settings_get(user, payload);
    case 'setting.update': return Settings_update(user, payload);
    case 'tg.getMe': return Telegram_getMe(user, payload);
    case 'tg.getUpdates': return Telegram_getUpdates(user, payload);
    case 'tg.test': return Telegram_test(user, payload);

    /* audit */
    case 'audit.list': return Audit_list(user, payload);
  }
  throw new Error('ไม่พบ action: ' + action);
}

/* ─── warm + GC triggers ─── */
function _warm_() {
  _resetReq_();
  try {
    DB_readAll(SHEETS.SETTINGS);
    DB_readAll(SHEETS.USERS);
    Master_listPublic_(SHEETS.CATEGORIES);
    Master_listPublic_(SHEETS.RESTYPES);
    App_publicBundle_();
  } catch (e) {}
  return (new Date()).toISOString();
}
function _gc_() { _resetReq_(); try { return Auth_gc_(); } catch (e) { return 0; } }

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (/^(_warm_|_gc_)$/.test(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('_warm_').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('_gc_').timeBased().everyHours(6).create();
  return 'ติดตั้ง Warm + GC Trigger แล้ว';
}
function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (/^(_warm_|_gc_)$/.test(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  return 'ถอด Trigger แล้ว';
}

/* webapp url helper */
function getWebAppUrl_() { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } }
