/**
 * CHẤM THI – máy chủ Google Apps Script (gắn với 1 Google Sheet).
 * Triển khai: Tiện ích mở rộng → Apps Script → dán mã này → Triển khai → Ứng dụng web
 *   (Thực thi với tư cách: Tôi; Người có quyền truy cập: Bất kỳ ai) → chép URL /exec vào config.js.
 * Lần đầu chạy hàm caiDat() để tạo các trang tính và thư mục ảnh.
 */

const TEN_THU_MUC = "ChamThi_AnhPhieu";
const SHEETS = {
  CaiDat: ["Khoa", "GiaTri", "GhiChu"],
  KiThi: ["Id", "Ten", "Khoi", "Mon", "MauPhieu", "DiemP1", "DiemP2", "CoTuLuan", "DiemTL", "NgayTao", "DangMo"],
  DapAn: ["KiThiId", "MaDe", "P1", "P2"],
  KetQua: ["Id", "ThoiGian", "KiThiId", "Lop", "SBD", "MaDe", "P1Chon", "P2Chon", "DiemTN", "DiemTL", "Tong", "Co", "AnhTN", "AnhTL", "NhanXetTL", "GiaoVien"],
};

function caiDat() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach((n) => {
    let sh = ss.getSheetByName(n);
    if (!sh) { sh = ss.insertSheet(n); sh.appendRow(SHEETS[n]); sh.setFrozenRows(1); }
  });
  const cd = ss.getSheetByName("CaiDat");
  if (cd.getLastRow() < 2) {
    let folder = DriveApp.getFoldersByName(TEN_THU_MUC);
    folder = folder.hasNext() ? folder.next() : DriveApp.createFolder(TEN_THU_MUC);
    cd.appendRow(["PIN_GV", "1234", "Mã PIN để giáo viên quét/chấm – hãy đổi"]);
    cd.appendRow(["PIN_QUANTRI", "9999", "Mã PIN quản trị (tạo kì thi, nhập đáp án) – hãy đổi"]);
    cd.appendRow(["THU_MUC_ANH", folder.getId(), "Thư mục Drive lưu ảnh phiếu"]);
  }
  return "Đã cài đặt";
}

/* ---------------------------------------------------------------- tiện ích */
function sh_(n) { return SpreadsheetApp.getActive().getSheetByName(n); }
function rows_(n) {
  const v = sh_(n).getDataRange().getValues(), h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => (o[k] = r[j])); return o; });
}
function cfg_(k) { const r = rows_("CaiDat").find((x) => x.Khoa === k); return r ? String(r.GiaTri) : ""; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function needPin_(p, admin) {
  const ok = String(p) === cfg_("PIN_QUANTRI") || (!admin && String(p) === cfg_("PIN_GV"));
  if (!ok) throw new Error("Sai mã PIN");
}
function folder_(kiThiId, lop) {
  let f = DriveApp.getFolderById(cfg_("THU_MUC_ANH"));
  [String(kiThiId), String(lop || "KhongLop")].forEach((n) => {
    const it = f.getFoldersByName(n); f = it.hasNext() ? it.next() : f.createFolder(n);
  });
  return f;
}
function saveImg_(b64, name, kiThiId, lop) {
  if (!b64) return "";
  const blob = Utilities.newBlob(Utilities.base64Decode(b64.replace(/^data:image\/\w+;base64,/, "")), "image/jpeg", name);
  return folder_(kiThiId, lop).createFile(blob).getId();
}

/* ---------------------------------------------------------------- API */
function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.api === "dsKiThi") return out_({ ok: true, data: dsKiThi_() });
    if (p.api === "tv") return out_({ ok: true, data: tvGet_(p.phien, Number(p.sau || 0)) });
    return out_({ ok: true, ten: "ChamThi API", thoiGian: new Date() });
  } catch (err) { return out_({ ok: false, loi: String(err.message || err) }); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const A = {
      layKiThi: () => { needPin_(b.pin); return layKiThi_(b.id); },
      luuKiThi: () => { needPin_(b.pin, true); return luuKiThi_(b.kiThi, b.dapAn); },
      luuKetQua: () => { needPin_(b.pin); return luuKetQua_(b); },
      dsKetQua: () => { needPin_(b.pin); return dsKetQua_(b.kiThiId, b.lop); },
      luuTL: () => { needPin_(b.pin); return luuTL_(b); },
      kiemPin: () => { needPin_(b.pin, b.admin); return true; },
    };
    if (!A[b.action]) throw new Error("Không có chức năng " + b.action);
    return out_({ ok: true, data: A[b.action]() });
  } catch (err) { return out_({ ok: false, loi: String(err.message || err) }); }
}

function dsKiThi_() {
  return rows_("KiThi").filter((k) => String(k.DangMo) !== "FALSE").map((k) => ({
    id: k.Id, ten: k.Ten, khoi: k.Khoi, mon: k.Mon, mau: k.MauPhieu, coTL: k.CoTuLuan === true || k.CoTuLuan === "TRUE" }));
}

function layKiThi_(id) {
  const k = rows_("KiThi").find((x) => String(x.Id) === String(id));
  if (!k) throw new Error("Không tìm thấy kì thi");
  const dapAn = {};
  rows_("DapAn").filter((d) => String(d.KiThiId) === String(id)).forEach((d) => {
    dapAn[String(d.MaDe)] = { p1: String(d.P1).split(""), p2: String(d.P2).split("") };
  });
  return { id: k.Id, ten: k.Ten, khoi: k.Khoi, mon: k.Mon, mau: k.MauPhieu, diemP1: Number(k.DiemP1), diemP2: Number(k.DiemP2),
    coTL: k.CoTuLuan === true || k.CoTuLuan === "TRUE", diemTL: Number(k.DiemTL || 0), dapAn };
}

function luuKiThi_(k, dapAn) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const id = k.id || "KT" + Utilities.formatDate(new Date(), "GMT+7", "yyMMddHHmmss");
    const sk = sh_("KiThi"), old = rows_("KiThi").find((x) => String(x.Id) === String(id));
    const row = [id, k.ten, k.khoi, k.mon, k.mau, k.diemP1, k.diemP2, !!k.coTL, k.diemTL || 0, new Date(), true];
    if (old) sk.getRange(old._row, 1, 1, row.length).setValues([row]); else sk.appendRow(row);
    const sd = sh_("DapAn");
    rows_("DapAn").filter((d) => String(d.KiThiId) === String(id)).reverse().forEach((d) => sd.deleteRow(d._row));
    Object.keys(dapAn || {}).forEach((m) => sd.appendRow([id, m, dapAn[m].p1.join(""), dapAn[m].p2.join("")]));
    return { id };
  } finally { lock.releaseLock(); }
}

function luuKetQua_(b) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const id = "KQ" + new Date().getTime() + Math.floor(Math.random() * 1000);
    const anh = saveImg_(b.anh, `${b.sbd}_${b.made}_TN.jpg`, b.kiThiId, b.lop);
    sh_("KetQua").appendRow([id, new Date(), b.kiThiId, b.lop, "'" + b.sbd, "'" + b.made, b.p1.join(","), b.p2.join(","),
      b.diem, "", b.diem, (b.co || []).join("; "), anh, "", "", b.gv || ""]);
    if (b.phien) tvPush_(b.phien, { id, sbd: b.sbd, made: b.made, diem: b.diem, sai: b.sai, co: b.co, anhNho: b.anhNho, lop: b.lop });
    return { id, anh };
  } finally { lock.releaseLock(); }
}

function dsKetQua_(kiThiId, lop) {
  return rows_("KetQua").filter((r) => String(r.KiThiId) === String(kiThiId) && (!lop || String(r.Lop) === String(lop)))
    .map((r) => ({ id: r.Id, thoiGian: r.ThoiGian, lop: r.Lop, sbd: String(r.SBD), made: String(r.MaDe), diemTN: r.DiemTN,
      diemTL: r.DiemTL, tong: r.Tong, co: r.Co, anhTN: r.AnhTN, anhTL: r.AnhTL, nhanXet: r.NhanXetTL }));
}

function luuTL_(b) {
  const r = rows_("KetQua").find((x) => String(x.Id) === String(b.id));
  if (!r) throw new Error("Không thấy bài");
  const sh = sh_("KetQua"), h = SHEETS.KetQua;
  const anhTL = b.anhTL ? saveImg_(b.anhTL, `${r.SBD}_${r.MaDe}_TL.jpg`, r.KiThiId, r.Lop) : r.AnhTL;
  const tl = Number(b.diemTL), tong = Math.round((Number(r.DiemTN) + tl) * 100) / 100;
  sh.getRange(r._row, h.indexOf("DiemTL") + 1, 1, 2).setValues([[tl, tong]]);
  sh.getRange(r._row, h.indexOf("AnhTL") + 1, 1, 2).setValues([[anhTL, b.nhanXet || ""]]);
  return { tong };
}

/* ---------------------------------------------------------------- phiên tivi (bộ nhớ đệm, giữ 6 giờ) */
function tvPush_(phien, item) {
  const c = CacheService.getScriptCache(), key = "tv_" + phien;
  const list = JSON.parse(c.get(key) || "[]");
  item.t = new Date().getTime();
  list.push(item);
  while (JSON.stringify(list).length > 90000 && list.length > 1) list.shift();
  c.put(key, JSON.stringify(list), 21600);
}
function tvGet_(phien, sau) {
  const list = JSON.parse(CacheService.getScriptCache().get("tv_" + phien) || "[]");
  return list.filter((x) => x.t > sau);
}
