
/* โฟลเดอร์ระดับเดียวกับสเปรดชีต ชื่อเดียวกับสเปรดชีต */
function Files_folder_() {
  var ss = DB_ss_();
  var file = DriveApp.getFileById(ss.getId());
  var parents = file.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var name = ss.getName();
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}
function Files_subFolder_(sub) {
  var root = Files_folder_();
  var it = root.getFoldersByName(sub);
  if (it.hasNext()) return it.next();
  return root.createFolder(sub);
}

/* upload base64 → Drive → public link (lh3 for images, drive uc for files) */
function Files_upload(user, p) {
  Auth_requireCap(user, 'file.upload');
  var b64 = String((p && p.data) || '');
  var mime = String((p && p.mime) || 'application/octet-stream');
  var name = String((p && p.name) || ('file_' + (new Date()).getTime())).substring(0, 120);
  var folder = String((p && p.folder) || 'resources');
  if (!b64) throw new Error('ไม่พบข้อมูลไฟล์');
  // strip data url prefix
  var comma = b64.indexOf(',');
  if (b64.indexOf('data:') === 0 && comma > 0) b64 = b64.substring(comma + 1);

  var bytes = Utilities.base64Decode(b64);
  var maxBytes = 25 * 1024 * 1024; // 25MB safety
  if (bytes.length > maxBytes) throw new Error('ไฟล์ใหญ่เกิน 25MB');

  var blob = Utilities.newBlob(bytes, mime, name);
  var dir = Files_subFolder_(folder);
  var f = dir.createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var id = f.getId();
  var isImage = /^image\//.test(mime);
  var url = isImage ? ('https://lh3.googleusercontent.com/d/' + id) : ('https://drive.google.com/uc?export=download&id=' + id);
  var thumb = isImage ? ('https://lh3.googleusercontent.com/d/' + id + '=w600') : ('https://drive.google.com/thumbnail?id=' + id + '&sz=w600');
  Audit_log_(user, 'file.upload', 'file', id, { name: name, size: bytes.length });
  return {
    ok: true, id: id, url: url, thumbnail: thumb,
    name: name, mime: mime, size: bytes.length,
    is_image: isImage,
    view_url: 'https://drive.google.com/file/d/' + id + '/view'
  };
}

/* upload avatar (image only, returns lh3) */
function Files_uploadAvatar(user, p) {
  var r = Files_upload(user, { data: p && p.data, mime: (p && p.mime) || 'image/jpeg', name: 'avatar_' + user.id + '_' + (new Date()).getTime(), folder: 'avatars' });
  return r;
}
