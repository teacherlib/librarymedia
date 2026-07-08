/**
 * ═══════════════════════════════════════════════════════════════
 *  TRL · ระบบคลังสื่อการสอนสำหรับโรงเรียน
 *  File:        10_Seed.gs — Demo accounts + sample data (batch mode)
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Seed_ensureUsers_() {
  var created = 0, map = {};
  var extra = [
    { username: 'somchai', role: 'teacher', full_name: 'สมชาย ใจดี', subject_group: 'math', position: 'ครูประจำชั้น' },
    { username: 'malee', role: 'teacher', full_name: 'มาลี รักเรียน', subject_group: 'thai', position: 'ครูประจำชั้น' },
    { username: 'wichai', role: 'teacher', full_name: 'วิชัย เก่งกาจ', subject_group: 'science', position: 'ครูประจำชั้น' },
    { username: 'pranee', role: 'teacher', full_name: 'ปราณี งามดี', subject_group: 'english', position: 'ครูประจำชั้น' },
    { username: 'suda', role: 'teacher', full_name: 'สุดา ขยันยิ่ง', subject_group: 'social', position: 'ครูประจำชั้น' }
  ];
  var all = DEMO_USERS.concat(extra);
  all.forEach(function (d) {
    var ex = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === d.username; });
    if (ex) { map[d.username] = ex.id; return; }
    var salt = cfg_salt_();
    var ins = DB_insert(SHEETS.USERS, {
      username: d.username, password_hash: Sec_hash_(DEMO_PASSWORD, salt), salt: salt,
      full_name: d.full_name, role: d.role, email: d.username + '@school.ac.th', phone: '08' + ('00000000' + (created + 11111111)).slice(-8),
      school: 'โรงเรียนตัวอย่างวิทยา', position: d.position, subject_group: d.subject_group, is_active: 'yes'
    });
    map[d.username] = ins.id; created++;
  });
  return { created: created, map: map };
}

function Seed_resetDemoPasswords_() {
  var reset = 0;
  DEMO_USERS.forEach(function (d) {
    var u = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === d.username; });
    if (!u) return;
    var salt = cfg_salt_();
    DB_update(SHEETS.USERS, u.id, { salt: salt, password_hash: Sec_hash_(DEMO_PASSWORD, salt), is_active: 'yes' });
    reset++;
  });
  return reset;
}

var SEED_TITLES = {
  thai: ['ใบงานมาตราตัวสะกด', 'แผนการสอนวรรณคดีไทย', 'เกมจับคู่คำพ้อง', 'สื่อ PPT การอ่านจับใจความ', 'แบบฝึกอ่านออกเสียง', 'ข้อสอบภาษาไทยกลางภาค'],
  math: ['ใบงานบวกลบจำนวนนับ', 'สื่อสอนเศษส่วน', 'เกมคณิตคิดเร็ว', 'แผนการสอนเรขาคณิต', 'แบบฝึกการคูณ', 'ข้อสอบคณิตศาสตร์'],
  science: ['สื่อระบบสุริยะ 3 มิติ', 'ใบงานวงจรไฟฟ้า', 'แผนการสอนระบบนิเวศ', 'วิดีโอการทดลองสารละลาย', 'อินโฟกราฟิกห่วงโซ่อาหาร', 'ข้อสอบวิทยาศาสตร์'],
  social: ['สื่อแผนที่ประเทศไทย', 'ใบงานประวัติศาสตร์สุโขทัย', 'แผนการสอนเศรษฐกิจพอเพียง', 'วิดีโอวัฒนธรรมไทย', 'เกมตอบคำถามอาเซียน', 'ข้อสอบสังคมศึกษา'],
  health: ['สื่อโภชนาการ 5 หมู่', 'ใบงานการปฐมพยาบาล', 'แผนการสอนกีฬาพื้นฐาน', 'วิดีโอท่ากายบริหาร', 'อินโฟกราฟิกสุขบัญญัติ', 'แบบทดสอบสุขศึกษา'],
  art: ['ใบงานทฤษฎีสี', 'สื่อการวาดเส้น', 'แผนการสอนดนตรีไทย', 'วิดีโอการพับกระดาษ', 'เกมทายเสียงเครื่องดนตรี', 'แบบประเมินงานศิลปะ'],
  career: ['ใบงานการปลูกผัก', 'สื่อการทำอาหารง่าย ๆ', 'แผนการสอนงานประดิษฐ์', 'วิดีโองานช่างเบื้องต้น', 'เกมอาชีพในฝัน', 'แบบประเมินทักษะอาชีพ'],
  english: ['ใบงาน Vocabulary Animals', 'สื่อ Phonics Sounds', 'แผนการสอน Present Simple', 'วิดีโอ English Conversation', 'เกม Spelling Bee', 'ข้อสอบภาษาอังกฤษ'],
  guidance: ['ใบงานรู้จักตนเอง', 'สื่อการวางแผนอนาคต', 'แผนกิจกรรมโฮมรูม', 'วิดีโอการจัดการอารมณ์', 'เกมสร้างทีม', 'แบบสำรวจความถนัด']
};
var SEED_TAGS = ['สื่อการสอน', 'ใบงาน', 'แผนการสอน', 'กิจกรรม', 'พร้อมใช้', 'นวัตกรรม', 'Active Learning'];

function Seed_demoData_() {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Master_ensureAll_();
  var u = Seed_ensureUsers_();
  var teachers = Object.keys(u.map).map(function (k) { return u.map[k]; });

  DB_beginBatch();
  var resources = [], ratings = [], downloads = [];
  var cats = Object.keys(SEED_TITLES);
  var typeKeys = RESTYPE_DEFAULTS.map(function (t) { return t.key; });
  var levelKeys = LEVEL_DEFAULTS.map(function (l) { return l.key; });
  var seq = 0;
  var now = (new Date()).getTime();

  try {
    cats.forEach(function (cat) {
      SEED_TITLES[cat].forEach(function (title, ti) {
        seq++;
        var type = title.indexOf('วิดีโอ') >= 0 ? 'video' : title.indexOf('PPT') >= 0 || title.indexOf('สื่อ') >= 0 ? 'slide' :
          title.indexOf('ข้อสอบ') >= 0 || title.indexOf('แบบทดสอบ') >= 0 ? 'exam' :
          title.indexOf('เกม') >= 0 ? 'game' : title.indexOf('แผน') >= 0 ? 'plan' :
          title.indexOf('อินโฟ') >= 0 ? 'image' : title.indexOf('แบบฝึก') >= 0 || title.indexOf('แบบประเมิน') >= 0 || title.indexOf('แบบสำรวจ') >= 0 ? 'worksheet' : 'doc';
        var lvl = levelKeys[(seq * 3) % (levelKeys.length - 1)];
        var owner = teachers[seq % teachers.length];
        var dl = (seq * 7) % 240 + 3;
        var vw = dl * 3 + (seq % 50);
        var daysAgo = (seq * 2) % 60;
        var created = cfg_iso_(new Date(now - daysAgo * 86400000));
        var rid = cfg_uuid_();
        var rcount = (seq % 6);
        var rsum = rcount * (3 + (seq % 3));
        resources.push({
          id: rid, code: 'RES' + ('00000' + seq).slice(-5), title: title,
          description: 'สื่อการเรียนการสอนกลุ่มสาระ ' + cat + ' พร้อมใช้งานในห้องเรียน เหมาะสำหรับการจัดการเรียนรู้แบบ Active Learning ' + SEED_TAGS[seq % SEED_TAGS.length],
          category: cat, level: lvl, type: type, subject: title.split(' ')[0],
          tags: SEED_TAGS[seq % SEED_TAGS.length] + ',' + SEED_TAGS[(seq + 2) % SEED_TAGS.length],
          file_url: '', file_id: '', file_name: title + '.pdf', file_type: 'application/pdf', file_size: 1024 * (200 + seq * 13),
          thumbnail: '', external_url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(title),
          downloads: dl, views: vw, rating_sum: rsum, rating_count: rcount,
          status: (seq % 11 === 0) ? STATUS.PENDING : (seq % 17 === 0) ? STATUS.REJECTED : STATUS.APPROVED,
          reject_reason: (seq % 17 === 0) ? 'กรุณาปรับรูปแบบไฟล์ให้ชัดเจนขึ้น' : '',
          featured: (seq % 5 === 0) ? 'yes' : 'no',
          uploaded_by: owner, reviewed_by: u.map.academic || '', reviewed_at: created,
          created_at: created, updated_at: created
        });
        // some downloads + ratings rows
        for (var k = 0; k < Math.min(rcount, 3); k++) {
          ratings.push({ resource_id: rid, user_id: teachers[(seq + k) % teachers.length], score: 3 + ((seq + k) % 3), comment: (k === 0 ? 'สื่อดีมากครับ นำไปใช้ได้จริง' : ''), created_at: created });
        }
        for (var d = 0; d < Math.min(dl, 4); d++) {
          downloads.push({ resource_id: rid, user_id: teachers[(seq + d) % teachers.length], created_at: cfg_iso_(new Date(now - ((daysAgo + d) % 14) * 86400000)) });
        }
      });
    });
    DB_bulkInsert(SHEETS.RESOURCES, resources);
    DB_bulkInsert(SHEETS.RATINGS, ratings);
    DB_bulkInsert(SHEETS.DOWNLOADS, downloads);
  } finally {
    DB_endBatch();
  }
  return { users: u.created, resources: resources.length, ratings: ratings.length, downloads: downloads.length };
}

function Seed_clear_() {
  [SHEETS.RESOURCES, SHEETS.RATINGS, SHEETS.DOWNLOADS, SHEETS.FAVORITES, SHEETS.AUDIT, SHEETS.SESSIONS].forEach(function (name) {
    var sh = DB_sheet_(name), last = sh.getLastRow();
    if (last > 1) sh.deleteRows(2, last - 1);
    _bumpVer_('sheet:' + name);
  });
  return { ok: true };
}
