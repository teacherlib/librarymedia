/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        12_Menu.gs — onOpen menu · init · permissions · about · guides
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📚 ' + APP.SHORT + ' · คลังสื่อ')
      .addItem('🚀 เริ่มใช้งานระบบ (Initialize)', 'menu_initSystem')
      .addItem('🔐 ขออนุญาตสิทธิ์', 'menu_grantPermissions')
      .addItem('🔍 ตรวจสถานะสิทธิ์', 'menu_authorize')
      .addSeparator()
      .addItem('🌱 เพิ่มข้อมูลตัวอย่าง', 'menu_seedDemo')
      .addItem('🧹 ล้างข้อมูลตัวอย่าง', 'menu_clearDemo')
      .addItem('🔑 รีเซ็ตรหัสผ่านบัญชีทดลอง', 'menu_resetDemoPw')
      .addSeparator()
      .addItem('⚡ ติดตั้ง Warm/GC Trigger', 'menu_installTriggers')
      .addItem('🔧 ซ่อมข้อมูลที่เพี้ยน (Repair)', 'menu_repairAll')
      .addSeparator()
      .addItem('🔗 เปิด Web App', 'menu_openWebApp')
      .addItem('📋 คัดลอก Web App URL', 'menu_copyUrl')
      .addSeparator()
      .addItem('📘 คู่มือการติดตั้งระบบ', 'menu_installGuide')
      .addItem('📖 คู่มือการใช้งาน', 'menu_userManual')
      .addItem('ℹ️ เกี่ยวกับระบบ (About)', 'menu_about')
      .addToUi();
  } catch (e) {}
}

function menu_initSystem() {
  var ui = SpreadsheetApp.getUi();
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Master_ensureAll_();
  Seed_ensureUsers_();
  ui.alert('✅ เริ่มใช้งานระบบสำเร็จ',
    'สร้างชีต + ข้อมูลพื้นฐาน + บัญชีผู้ใช้เรียบร้อย\n\nบัญชีทดลอง (รหัสผ่าน: ' + DEMO_PASSWORD + '):\n• admin — ผู้ดูแลระบบ\n• academic — ครูวิชาการ\n• teacher — ครูผู้สอน\n\nขั้นต่อไป: กด "ขออนุญาตสิทธิ์" แล้ว Deploy เป็น Web App',
    ui.ButtonSet.OK);
}

function menu_grantPermissions() {
  // ไม่มี try/catch — ให้ Apps Script แสดง consent dialog เอง
  SpreadsheetApp.getActive().getName();
  DriveApp.getRootFolder().getName();
  Session.getActiveUser().getEmail();
  ScriptApp.getService().getUrl();
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  SpreadsheetApp.getUi().alert('✅ พร้อมใช้งาน', 'ระบบได้รับสิทธิ์ครบทุกตัว — ใช้งานอัปโหลด/Telegram ได้แล้ว', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menu_authorize() {
  var ui = SpreadsheetApp.getUi(), out = [];
  function chk(label, fn) { try { fn(); out.push('✓ ' + label); } catch (e) { out.push('✗ ' + label + ': ' + e.message); } }
  chk('Spreadsheet', function () { SpreadsheetApp.getActive().getName(); });
  chk('Drive', function () { DriveApp.getRootFolder().getName(); });
  chk('User Info', function () { Session.getActiveUser().getEmail(); });
  chk('Script Service', function () { ScriptApp.getService().getUrl(); });
  chk('External Request', function () { UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true }); });
  ui.alert('🔍 สถานะสิทธิ์', out.join('\n') + '\n\nหากมี ✗ ให้กด "ขออนุญาตสิทธิ์"', ui.ButtonSet.OK);
}

function menu_seedDemo() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('เพิ่มข้อมูลตัวอย่าง', 'จะสร้างสื่อตัวอย่าง ~54 รายการ + คะแนน + ประวัติดาวน์โหลด ต่อจากข้อมูลเดิม\nดำเนินการต่อ?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  var res = Seed_demoData_();
  ui.alert('✅ เสร็จสิ้น', 'สร้างผู้ใช้ใหม่ ' + res.users + ' · สื่อ ' + res.resources + ' · คะแนน ' + res.ratings + ' · ดาวน์โหลด ' + res.downloads, ui.ButtonSet.OK);
}
function menu_clearDemo() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('ล้างข้อมูลตัวอย่าง', 'จะลบ: สื่อ · คะแนน · ดาวน์โหลด · รายการโปรด · audit · sessions ทั้งหมด\n(ผู้ใช้และข้อมูลหลักไม่ถูกลบ)\nยืนยัน?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  Seed_clear_();
  ui.alert('🧹 ล้างข้อมูลเรียบร้อย', '', ui.ButtonSet.OK);
}
function menu_resetDemoPw() {
  var n = Seed_resetDemoPasswords_();
  SpreadsheetApp.getUi().alert('🔑 รีเซ็ตรหัสผ่านแล้ว', n + ' บัญชีทดลอง รหัสผ่านเป็น ' + DEMO_PASSWORD, SpreadsheetApp.getUi().ButtonSet.OK);
}
function menu_installTriggers() { SpreadsheetApp.getUi().alert('⚡', installTriggers(), SpreadsheetApp.getUi().ButtonSet.OK); }
function menu_repairAll() { DB_repairAll(); Settings_repair(); SpreadsheetApp.getUi().alert('🔧 ซ่อมข้อมูลเรียบร้อย', 'บังคับ TEXT format + แปลงค่าที่เพี้ยนแล้ว', SpreadsheetApp.getUi().ButtonSet.OK); }

function menu_openWebApp() {
  var url = getWebAppUrl_();
  if (!url) { SpreadsheetApp.getUi().alert('ยังไม่ได้ Deploy เป็น Web App'); return; }
  var html = HtmlService.createHtmlOutput('<script>window.open("' + url + '","_blank");google.script.host.close();</script>').setWidth(100).setHeight(50);
  SpreadsheetApp.getUi().showModalDialog(html, 'กำลังเปิด...');
}
function menu_copyUrl() {
  var url = getWebAppUrl_() || '(ยังไม่ได้ Deploy)';
  SpreadsheetApp.getUi().alert('Web App URL', url, SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ════════════ ABOUT ════════════ */
function menu_about() {
  var url = getWebAppUrl_();
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;800&family=Sarabun:wght@400;500&display=swap" rel="stylesheet">'
    + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">'
    + '<style>'
    + 'body{margin:0;font-family:Kanit,Sarabun,system-ui,sans-serif;color:#1e293b;background:#f8fafc}'
    + '.ab{padding:24px}.h{display:flex;align-items:center;gap:14px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;margin-bottom:16px}'
    + '.lg{width:62px;height:62px;border-radius:18px;background:linear-gradient(135deg,#0a84ff,#5e5ce6,#bf5af2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;box-shadow:0 10px 28px rgba(10,132,255,.35)}'
    + '.t{font-size:20px;font-weight:800}.v{display:inline-block;padding:2px 10px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;border-radius:99px;font-size:11px;font-weight:700;margin-top:4px}'
    + '.d{font-size:13px;line-height:1.6;color:#475569;margin-bottom:14px}.m{font-size:12px;color:#64748b;margin-bottom:14px;line-height:1.9}'
    + '.dev{display:flex;align-items:center;gap:14px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;text-decoration:none;color:inherit;margin-bottom:12px}'
    + '.dev:hover{border-color:#93c5fd;box-shadow:0 8px 20px rgba(10,132,255,.12)}'
    + '.dev img{width:56px;height:56px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(10,132,255,.3);object-fit:cover}'
    + '.dn{font-size:15px;font-weight:700}.dl{font-size:12px;color:#0a84ff;font-weight:600;margin-top:3px}'
    + '.tech{font-size:11px;color:#64748b;background:#fff;padding:10px 12px;border-radius:10px;border-left:3px solid #0a84ff}'
    + '.btn{margin-top:16px;padding:10px 18px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;border:0;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;float:right}'
    + '</style></head><body><div class="ab">'
    + '<div class="h"><div class="lg"><i class="bi bi-collection-play-fill"></i></div><div><div class="t">' + APP.NAME + '</div><span class="v">v' + APP.VERSION + '</span></div></div>'
    + '<div class="d">' + APP.DESCRIPTION + '</div>'
    + '<div class="m">📅 อัปเดต: ' + APP.LAST_UPDATED + '<br>🏢 ' + APP.ORG + '<br>🔗 ' + (url || 'ยังไม่ได้ Deploy') + '</div>'
    + '<a class="dev" href="' + APP.DEV.URL + '" target="_blank" rel="noopener noreferrer">'
    + '<img src="' + APP.DEV.LOGO + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
    + '<div><div style="font-size:11px;color:#64748b">ผู้พัฒนาระบบ</div><div class="dn">' + APP.DEV.NAME + '</div><div class="dl"><i class="bi bi-globe"></i> ' + APP.DEV.URL.replace(/^https?:\/\//, '') + '</div></div></a>'
    + '<div class="tech">🔧 Google Apps Script · V8 · Sheets-as-DB · HTML/CSS/JS SPA</div>'
    + '<button class="btn" onclick="google.script.host.close()">ปิด</button>'
    + '</div></body></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(460).setHeight(560), 'เกี่ยวกับ ' + APP.SHORT);
}

/* ════════════ INSTALL GUIDE ════════════ */
function menu_installGuide() {
  var url = getWebAppUrl_();
  var installed = DB_readAll(SHEETS.USERS).length > 0;
  var steps = [
    ['1', 'bi-shield-lock', 'ขออนุญาตสิทธิ์', 'เมนู → 🔐 ขออนุญาตสิทธิ์ → Continue → Allow เพื่อให้ระบบเข้าถึง Sheet/Drive/อินเทอร์เน็ต'],
    ['2', 'bi-rocket-takeoff', 'เริ่มใช้งานระบบ', 'เมนู → 🚀 เริ่มใช้งานระบบ ระบบจะสร้างชีต ข้อมูลพื้นฐาน และบัญชีผู้ใช้ทดลอง'],
    ['3', 'bi-globe2', 'Deploy เป็น Web App', 'Deploy → New deployment → Web app → Execute as: Me, Access: Anyone → คัดลอก URL'],
    ['4', 'bi-lightning-charge', 'ติดตั้ง Warm Trigger', 'เมนู → ⚡ ติดตั้ง Warm/GC Trigger เพื่อให้ระบบโหลดเร็ว (กัน cold start)'],
    ['5', 'bi-gear', 'ตั้งค่าระบบ', 'เปิด Web App → เข้าสู่ระบบด้วย admin → เมนูตั้งค่า: ใส่ชื่อโรงเรียน โลโก้ ธีม และปิด "บัญชีทดลอง" ก่อนใช้จริง'],
    ['6', 'bi-people', 'เพิ่มผู้ใช้จริง', 'เพิ่มบัญชีครู/วิชาการ และจัดการกลุ่มสาระ/ระดับชั้น/ประเภทสื่อตามต้องการ'],
    ['7', 'bi-check2-circle', 'พร้อมใช้งาน', 'ทดลองอัปโหลดสื่อ → ส่งอนุมัติ → เผยแพร่ → ครูค้นหาและดาวน์โหลดได้ทันที']
  ];
  var stepHtml = steps.map(function (s) {
    return '<div class="st"><div class="n">' + s[0] + '</div><div class="b"><div class="tt"><i class="bi ' + s[1] + '"></i> ' + s[2] + '</div><div class="dd">' + s[3] + '</div></div></div>';
  }).join('');
  var checklist = ['เปลี่ยนรหัสผ่าน admin', 'ปิด "แสดงบัญชีทดลอง" ใน Settings', 'ตั้งชื่อโรงเรียน + โลโก้', 'เพิ่มผู้ใช้จริง', 'ติดตั้ง Warm Trigger', 'ทดสอบ flow: อัปโหลด → อนุมัติ → ดาวน์โหลด ครบทุกบทบาท', 'ตั้งค่า Telegram (ถ้าต้องการแจ้งเตือน)']
    .map(function (c) { return '<li><i class="bi bi-check-circle-fill"></i> ' + c + '</li>'; }).join('');
  var html = _guideHead('คู่มือการติดตั้ง')
    + '<div class="hero"><div class="hi"><i class="bi bi-tools"></i></div><div><h1>คู่มือการติดตั้งระบบ</h1><p>' + APP.NAME + ' v' + APP.VERSION + '</p></div>'
    + '<span class="badge ' + (installed ? 'ok' : 'warn') + '">' + (installed ? '✓ ติดตั้งแล้ว' : '⚠ ยังไม่ติดตั้ง') + '</span></div>'
    + '<div class="info"><b>Spreadsheet:</b> ' + esc_(DB_ss_().getName()) + '<br><b>Web App URL:</b> ' + (url || 'ยังไม่ได้ Deploy') + '</div>'
    + '<div class="steps">' + stepHtml + '</div>'
    + '<div class="check"><h3><i class="bi bi-clipboard-check"></i> ตรวจสอบก่อนใช้งานจริง (Production)</h3><ul>' + checklist + '</ul></div>'
    + _guideFoot();
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(820).setHeight(640), '📘 คู่มือการติดตั้ง');
}

/* ════════════ USER MANUAL ════════════ */
function menu_userManual() {
  var html = _guideHead('คู่มือการใช้งาน')
    + '<div class="hero"><div class="hi"><i class="bi bi-book-half"></i></div><div><h1>คู่มือการใช้งาน</h1><p>สำหรับครูและผู้ดูแลระบบ</p></div></div>'
    + '<div class="man">'
    + _manSec('bi-box-arrow-in-right', 'การเข้าสู่ระบบ', '<p>เปิด Web App → คลิก "เข้าสู่ระบบ" → กรอกชื่อผู้ใช้/รหัสผ่าน หรือคลิกการ์ดบัญชีทดลอง</p><table><tr><th>บทบาท</th><th>สิทธิ์</th></tr><tr><td>ผู้ดูแลระบบ</td><td>จัดการทุกอย่าง: ผู้ใช้ ข้อมูลหลัก ตั้งค่า อนุมัติ</td></tr><tr><td>ครูวิชาการ</td><td>อนุมัติ/ตีกลับสื่อ ตั้งสื่อแนะนำ ดูรายงานรวม</td></tr><tr><td>ครูผู้สอน</td><td>อัปโหลด ค้นหา ดาวน์โหลด ให้คะแนน บันทึกโปรด</td></tr></table>')
    + _manSec('bi-cloud-upload', 'อัปโหลดสื่อการสอน', '<ol><li>เมนู "เพิ่มสื่อ" → กรอกข้อมูลแบบ Wizard 4 ขั้น</li><li>ขั้น 1: ชื่อ คำอธิบาย · ขั้น 2: กลุ่มสาระ ระดับชั้น ประเภท · ขั้น 3: แนบไฟล์/ลิงก์ · ขั้น 4: ตรวจสอบ</li><li>เลือก "บันทึกร่าง" หรือ "ส่งเผยแพร่" (รออนุมัติ)</li></ol>')
    + _manSec('bi-search', 'ค้นหาและดาวน์โหลด', '<p>คลังสื่อมีตัวกรอง: กลุ่มสาระ · ระดับชั้น · ประเภท · เรียงตามล่าสุด/นิยม/คะแนน · ค้นหาด้วยคำสำคัญ คลิกการ์ดเพื่อดูรายละเอียด → ดาวน์โหลด · ให้คะแนน · บันทึกโปรด</p>')
    + _manSec('bi-check2-square', 'การอนุมัติสื่อ (วิชาการ/admin)', '<p>เมนู "รออนุมัติ" → ตรวจสอบสื่อ → "เผยแพร่" หรือ "ตีกลับ" (พร้อมเหตุผล) · ตั้งสื่อเด่นด้วยปุ่ม "แนะนำ"</p>')
    + _manSec('bi-bar-chart', 'รายงาน', '<p>รายงานภาพรวม (สถิติ กราฟ อันดับครู) และรายบุคคล · พิมพ์ PDF ได้ · ครูเห็นเฉพาะของตน</p>')
    + _manSec('bi-person-gear', 'โปรไฟล์', '<p>แก้ไขข้อมูลส่วนตัว อัปโหลดรูป และเปลี่ยนรหัสผ่านได้จากเมนูโปรไฟล์มุมขวาบน</p>')
    + _manSec('bi-question-circle', 'คำถามที่พบบ่อย', '<details open><summary>อัปโหลดไฟล์ใหญ่ได้แค่ไหน?</summary><p>สูงสุด 25MB ต่อไฟล์ — ไฟล์ใหญ่กว่านั้นแนะนำให้ใส่เป็นลิงก์ภายนอก (Google Drive/YouTube)</p></details><details><summary>ทำไมสื่อยังไม่แสดง?</summary><p>สื่อต้องผ่านการอนุมัติจากครูวิชาการก่อน (ถ้าเปิดโหมดอนุมัติ) — ดูสถานะได้ที่ "สื่อของฉัน"</p></details><details><summary>ลืมรหัสผ่าน?</summary><p>ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน</p></details>')
    + '</div>' + _guideFoot();
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(900).setHeight(680), '📖 คู่มือการใช้งาน');
}

function _manSec(icon, title, body) {
  return '<div class="ms"><div class="mh"><i class="bi ' + icon + '"></i> ' + title + '</div><div class="mb">' + body + '</div></div>';
}
function _guideHead(title) {
  return '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;800&family=Sarabun:wght@400;500&display=swap" rel="stylesheet">'
    + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">'
    + '<style>'
    + '*{box-sizing:border-box}body{margin:0;font-family:Sarabun,Kanit,system-ui,sans-serif;color:#1e293b;background:#f1f5f9;font-size:14px}'
    + 'h1{font-family:Kanit;font-size:20px;margin:0}h3{font-family:Kanit}'
    + '.hero{display:flex;align-items:center;gap:14px;padding:22px;background:linear-gradient(135deg,#0a84ff,#5e5ce6,#bf5af2);color:#fff;position:relative}'
    + '.hero p{margin:4px 0 0;opacity:.9;font-size:13px}.hi{width:54px;height:54px;border-radius:16px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:26px}'
    + '.badge{margin-left:auto;padding:6px 12px;border-radius:99px;font-size:12px;font-weight:700;font-family:Kanit}.badge.ok{background:#34c759;color:#fff}.badge.warn{background:#ff9f0a;color:#fff}'
    + '.info{margin:16px 20px;padding:12px 14px;background:#fff;border-radius:12px;border-left:4px solid #0a84ff;font-size:12.5px;line-height:1.8;color:#475569}'
    + '.steps{padding:0 20px}.st{display:flex;gap:14px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px}'
    + '.st .n{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;font-family:Kanit;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.st .tt{font-family:Kanit;font-weight:700;color:#0f172a}.st .dd{font-size:13px;color:#64748b;margin-top:4px;line-height:1.6}'
    + '.check{margin:18px 20px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px}.check ul{list-style:none;padding:0;margin:8px 0 0}.check li{padding:5px 0;font-size:13px}.check i{color:#16a34a;margin-right:6px}'
    + '.man{padding:8px 20px 20px}.ms{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:12px;overflow:hidden}'
    + '.mh{font-family:Kanit;font-weight:700;padding:13px 16px;background:linear-gradient(135deg,#eff6ff,#fff);border-bottom:1px solid #eef2f7;color:#0f172a}.mh i{color:#0a84ff;margin-right:6px}'
    + '.mb{padding:14px 16px;font-size:13.5px;line-height:1.7;color:#334155}.mb ol,.mb p{margin:0 0 8px}.mb ol{padding-left:18px}'
    + '.mb table{width:100%;border-collapse:collapse;margin-top:6px}.mb th,.mb td{border:1px solid #e2e8f0;padding:7px 10px;text-align:left;font-size:12.5px}.mb th{background:#f8fafc;font-family:Kanit}'
    + '.mb details{border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:6px}.mb summary{cursor:pointer;font-weight:600;font-family:Kanit}.mb details p{margin-top:6px;color:#64748b}'
    + '.gfoot{padding:14px 20px;text-align:center;color:#94a3b8;font-size:11.5px;border-top:1px solid #e2e8f0;margin-top:8px}.gfoot a{color:#0a84ff;text-decoration:none}'
    + '</style></head><body>';
}
function _guideFoot() {
  return '<div class="gfoot">© ' + (new Date()).getFullYear() + ' ' + esc_(APP.NAME) + ' · พัฒนาโดย <a href="' + APP.DEV.URL + '" target="_blank" rel="noopener noreferrer">' + esc_(APP.DEV.NAME) + '</a></div></body></html>';
}
