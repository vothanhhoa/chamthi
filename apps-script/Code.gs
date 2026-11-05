/**
 * CHẤM THI – máy chủ Google Apps Script, bản 2 (tài khoản riêng cho từng giáo viên).
 * Gắn với Google Sheet "ChamThi". Ảnh phiếu lưu trong thư mục Drive ChamThi_AnhPhieu của chủ Sheet.
 *
 * Cập nhật từ bản 1: dán đè toàn bộ mã này → Lưu → chạy hàm caiDat (một lần)
 *   → Triển khai → Quản lý bản triển khai → ✏️ → Phiên bản: "Phiên bản mới" → Triển khai (giữ nguyên đường link).
 * Tài khoản quản trị: đăng kí như giáo viên trên trang web, rồi mở trang tính TaiKhoan,
 *   sửa cột VaiTro của tài khoản đó thành  admin
 */

const TEN_THU_MUC = "ChamThi_AnhPhieu";
const NGAY_HET_HAN = 30;            // phiên đăng nhập giữ 30 ngày
const SHEETS = {
  CaiDat: ["Khoa", "GiaTri", "GhiChu"],
  TaiKhoan: ["TenDN", "HoTen", "Truong", "Mon", "VaiTro", "TrangThai", "Muoi", "MatKhau", "NgayTao", "LanCuoi"],
  KiThi: ["Id", "ChuSo", "Ten", "Truong", "Lop", "Khoi", "Mon", "MauPhieu", "SoCau", "DiemP1", "DiemP2", "CoTuLuan", "DiemTL", "NgayTao", "DangMo"],
  DapAn: ["KiThiId", "MaDe", "P1", "P2"],
  KetQua: ["Id", "ThoiGian", "KiThiId", "ChuSo", "Lop", "SBD", "HoTenHS", "MaDe", "P1Chon", "P2Chon", "DiemTN", "DiemTL", "Tong",
    "Co", "AnhTN", "AnhTL", "NhanXetTL", "GiaoVien", "CachCham"],
};

function caiDat() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach((n) => {
    let sh = ss.getSheetByName(n);
    if (!sh) { sh = ss.insertSheet(n); sh.appendRow(SHEETS[n]); sh.setFrozenRows(1); return; }
    // bổ sung cột còn thiếu (nâng cấp từ bản 1)
    const last = Math.max(1, sh.getLastColumn()), have = sh.getRange(1, 1, 1, last).getValues()[0].map(String);
    SHEETS[n].filter((c) => have.indexOf(c) < 0).forEach((c) => sh.getRange(1, sh.getLastColumn() + 1).setValue(c));
    sh.setFrozenRows(1);
  });
  if (!cfg_("THU_MUC_ANH")) {
    let f = DriveApp.getFoldersByName(TEN_THU_MUC);
    f = f.hasNext() ? f.next() : DriveApp.createFolder(TEN_THU_MUC);
    sh_("CaiDat").appendRow(["THU_MUC_ANH", f.getId(), "Thư mục Drive lưu ảnh phiếu – không xoá dòng này"]);
  }
  secret_();
  ss.getSheetByName("TaiKhoan").getRange("G:H").setNumberFormat("@");
  return "Đã cài đặt bản 2";
}

/* ---------------------------------------------------------------- tiện ích bảng tính */
function sh_(n) { return SpreadsheetApp.getActive().getSheetByName(n); }
function head_(n) { const s = sh_(n); return s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String); }
function rows_(n) {
  const v = sh_(n).getDataRange().getValues(), h = v.shift().map(String);
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => (o[k] = r[j])); return o; });
}
function add_(n, obj) { const h = head_(n); sh_(n).appendRow(h.map((k) => (obj[k] === undefined ? "" : obj[k]))); }
function set_(n, row, obj) {
  const h = head_(n), s = sh_(n);
  Object.keys(obj).forEach((k) => { const c = h.indexOf(k); if (c >= 0) s.getRange(row, c + 1).setValue(obj[k]); });
}
function cfg_(k) { const s = sh_("CaiDat"); if (!s) return ""; const r = rows_("CaiDat").find((x) => x.Khoa === k); return r ? String(r.GiaTri) : ""; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function bool_(v) { return v === true || String(v).toUpperCase() === "TRUE"; }
function lock_(fn) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }

/* ---------------------------------------------------------------- mật khẩu & phiên đăng nhập */
function secret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty("SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("SECRET", s); }
  return s;
}
function hash_(pw, salt) {
  let h = salt + "|" + pw;
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function sign_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())).replace(/=+$/, ""); }
function token_(tenDN) { const exp = Date.now() + NGAY_HET_HAN * 864e5, p = tenDN + "~" + exp; return p + "~" + sign_(p); }
function user_(tenDN) { return rows_("TaiKhoan").find((x) => String(x.TenDN) === String(tenDN)); }
function pub_(u) { return { tenDN: String(u.TenDN), hoTen: u.HoTen, truong: u.Truong, mon: u.Mon, vaiTro: u.VaiTro || "gv" }; }
function auth_(b) {
  const t = String(b.token || ""), i = t.lastIndexOf("~"), p = t.slice(0, i), parts = p.split("~");
  if (i < 0 || parts.length !== 2 || sign_(p) !== t.slice(i + 1) || Number(parts[1]) < Date.now())
    throw new Error("Phiên đăng nhập đã hết hạn – vui lòng đăng nhập lại");
  const u = user_(parts[0]);
  if (!u) throw new Error("Tài khoản không tồn tại – vui lòng đăng nhập lại");
  if (String(u.TrangThai) === "khoa") throw new Error("Tài khoản đã bị khoá – liên hệ quản trị");
  return { tenDN: String(u.TenDN), hoTen: String(u.HoTen), admin: String(u.VaiTro) === "admin", row: u };
}
function needAdmin_(me) { if (!me.admin) throw new Error("Chỉ tài khoản quản trị mới dùng được chức năng này"); }

function dangKy_(b) {
  const tenDN = String(b.tenDN || "").trim().toLowerCase();
  if (!/^[a-z0-9_.@-]{3,40}$/.test(tenDN)) throw new Error("Tên đăng nhập 3–40 kí tự: chữ không dấu, số, dấu chấm, @, gạch dưới");
  if (String(b.matKhau || "").length < 6) throw new Error("Mật khẩu ít nhất 6 kí tự");
  if (!String(b.hoTen || "").trim()) throw new Error("Nhập họ tên giáo viên");
  return lock_(() => {
    if (user_(tenDN)) throw new Error("Tên đăng nhập đã có người dùng – chọn tên khác");
    const muoi = Utilities.getUuid();
    add_("TaiKhoan", { TenDN: tenDN, HoTen: String(b.hoTen).trim(), Truong: String(b.truong || "").trim(), Mon: String(b.mon || "").trim(),
      VaiTro: "gv", TrangThai: "hoatdong", Muoi: muoi, MatKhau: hash_(String(b.matKhau), muoi), NgayTao: new Date(), LanCuoi: new Date() });
    return { token: token_(tenDN), toi: pub_(user_(tenDN)) };
  });
}
function dangNhap_(b) {
  const tenDN = String(b.tenDN || "").trim().toLowerCase(), c = CacheService.getScriptCache(), key = "sai_" + tenDN;
  const sai = Number(c.get(key) || 0);
  if (sai >= 8) throw new Error("Nhập sai quá nhiều lần – thử lại sau 15 phút");
  const u = user_(tenDN);
  if (!u || hash_(String(b.matKhau || ""), String(u.Muoi)) !== String(u.MatKhau)) {
    c.put(key, String(sai + 1), 900); throw new Error("Sai tên đăng nhập hoặc mật khẩu");
  }
  if (String(u.TrangThai) === "khoa") throw new Error("Tài khoản đã bị khoá – liên hệ quản trị");
  c.remove(key); set_("TaiKhoan", u._row, { LanCuoi: new Date() });
  return { token: token_(tenDN), toi: pub_(u) };
}
function doiMatKhau_(me, b) {
  if (hash_(String(b.cu || ""), String(me.row.Muoi)) !== String(me.row.MatKhau)) throw new Error("Mật khẩu cũ không đúng");
  if (String(b.moi || "").length < 6) throw new Error("Mật khẩu mới ít nhất 6 kí tự");
  const muoi = Utilities.getUuid();
  set_("TaiKhoan", me.row._row, { Muoi: muoi, MatKhau: hash_(String(b.moi), muoi) });
  return true;
}

/* ---------------------------------------------------------------- ảnh trên Drive */
function folder_(chuSo, kiThiId, lop) {
  let f = DriveApp.getFolderById(cfg_("THU_MUC_ANH"));
  [String(chuSo), String(kiThiId), String(lop || "KhongLop")].forEach((n) => {
    const it = f.getFoldersByName(n); f = it.hasNext() ? it.next() : f.createFolder(n);
  });
  return f;
}
function saveImg_(b64, name, chuSo, kiThiId, lop) {
  if (!b64) return "";
  const blob = Utilities.newBlob(Utilities.base64Decode(String(b64).replace(/^data:image\/\w+;base64,/, "")), "image/jpeg", name);
  return folder_(chuSo, kiThiId, lop).createFile(blob).getId();
}

/* ---------------------------------------------------------------- API */
function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.api === "tv") return out_({ ok: true, data: tvGet_(p.phien, Number(p.sau || 0)) });
    return out_({ ok: true, ten: "ChamThi API", banMay: 2, thoiGian: new Date() });
  } catch (err) { return out_({ ok: false, loi: String(err.message || err) }); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const open = { dangKy: () => dangKy_(b), dangNhap: () => dangNhap_(b) };
    if (open[b.action]) return out_({ ok: true, data: open[b.action]() });
    const me = auth_(b);
    const A = {
      toi: () => pub_(me.row),
      capNhatHoSo: () => { set_("TaiKhoan", me.row._row, { HoTen: b.hoTen || me.hoTen, Truong: b.truong || "", Mon: b.mon || "" }); return pub_(user_(me.tenDN)); },
      doiMatKhau: () => doiMatKhau_(me, b),
      dsKiThi: () => dsKiThi_(me, b.tatCa),
      layKiThi: () => layKiThi_(me, b.id),
      luuKiThi: () => luuKiThi_(me, b.kiThi, b.dapAn),
      xoaKiThi: () => { const k = kiThi_(me, b.id); set_("KiThi", k._row, { DangMo: false }); return true; },
      luuKetQua: () => luuKetQua_(me, b),
      dsKetQua: () => dsKetQua_(me, b.kiThiId, b.lop),
      luuTL: () => luuTL_(me, b),
      xoaKetQua: () => xoaKetQua_(me, b.id),
      layAnh: () => layAnh_(me, b.id, b.loai),
      // quản trị
      dsTaiKhoan: () => { needAdmin_(me); return dsTaiKhoan_(); },
      capNhatTaiKhoan: () => { needAdmin_(me); return capNhatTaiKhoan_(me, b); },
      datLaiMatKhau: () => { needAdmin_(me); return datLaiMatKhau_(b.tenDN); },
    };
    if (!A[b.action]) throw new Error("Không có chức năng " + b.action);
    return out_({ ok: true, data: A[b.action]() });
  } catch (err) { return out_({ ok: false, loi: String(err.message || err) }); }
}

/* ---------------------------------------------------------------- kì thi */
function kiThi_(me, id) {
  const k = rows_("KiThi").find((x) => String(x.Id) === String(id));
  if (!k) throw new Error("Không tìm thấy bài kiểm tra");
  if (!me.admin && String(k.ChuSo) !== me.tenDN) throw new Error("Bài kiểm tra này không phải của Thầy/Cô");
  return k;
}
function ktObj_(k) {
  return { id: String(k.Id), chuSo: String(k.ChuSo), ten: k.Ten, truong: k.Truong, lop: k.Lop, khoi: k.Khoi, mon: k.Mon, mau: k.MauPhieu,
    soCau: Number(k.SoCau || 0), diemP1: Number(k.DiemP1), diemP2: Number(k.DiemP2), coTL: bool_(k.CoTuLuan), diemTL: Number(k.DiemTL || 0), ngayTao: k.NgayTao };
}
function dsKiThi_(me, tatCa) {
  const ten = {};
  if (me.admin) rows_("TaiKhoan").forEach((u) => (ten[u.TenDN] = u.HoTen));
  return rows_("KiThi").filter((k) => String(k.DangMo) !== "false" && k.DangMo !== false && (String(k.ChuSo) === me.tenDN || (me.admin && tatCa)))
    .map((k) => Object.assign(ktObj_(k), { tenGV: ten[k.ChuSo] || "" })).reverse();
}
function layKiThi_(me, id) {
  const k = kiThi_(me, id), dapAn = {};
  rows_("DapAn").filter((d) => String(d.KiThiId) === String(id)).forEach((d) => {
    dapAn[String(d.MaDe)] = { p1: String(d.P1).split(""), p2: String(d.P2 || "").split("") };
  });
  return Object.assign(ktObj_(k), { dapAn });
}
function luuKiThi_(me, k, dapAn) {
  if (!k || !String(k.ten || "").trim()) throw new Error("Nhập tên bài kiểm tra");
  if (["24-4", "12-4", "VT"].indexOf(k.mau) < 0) throw new Error("Loại phiếu không hợp lệ");
  if (!dapAn || !Object.keys(dapAn).length) throw new Error("Chưa có đáp án");
  return lock_(() => {
    let old = null;
    if (k.id) old = kiThi_(me, k.id);
    const id = old ? String(old.Id) : "KT" + Utilities.formatDate(new Date(), "GMT+7", "yyMMddHHmmss") + Math.floor(Math.random() * 90 + 10);
    const o = { Id: id, ChuSo: old ? old.ChuSo : me.tenDN, Ten: k.ten, Truong: k.truong || "", Lop: k.lop || "", Khoi: k.khoi || "", Mon: k.mon || "",
      MauPhieu: k.mau, SoCau: Number(k.soCau || 0), DiemP1: Number(k.diemP1), DiemP2: Number(k.diemP2 || 0), CoTuLuan: !!k.coTL,
      DiemTL: Number(k.diemTL || 0), NgayTao: old ? old.NgayTao : new Date(), DangMo: true };
    if (old) set_("KiThi", old._row, o); else add_("KiThi", o);
    const sd = sh_("DapAn");
    rows_("DapAn").filter((d) => String(d.KiThiId) === id).reverse().forEach((d) => sd.deleteRow(d._row));
    const rows = Object.keys(dapAn).map((m) => [id, "'" + m, (dapAn[m].p1 || []).join(""), (dapAn[m].p2 || []).join("")]);
    if (rows.length) sd.getRange(sd.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
    return { id };
  });
}

/* ---------------------------------------------------------------- kết quả */
function luuKetQua_(me, b) {
  const k = kiThi_(me, b.kiThiId);
  return lock_(() => {
    const id = "KQ" + Date.now() + Math.floor(Math.random() * 1000);
    const anh = saveImg_(b.anh, `${b.sbd}_${b.made}_TN.jpg`, k.ChuSo, k.Id, b.lop);
    add_("KetQua", { Id: id, ThoiGian: new Date(), KiThiId: String(k.Id), ChuSo: String(k.ChuSo), Lop: b.lop || "", SBD: "'" + (b.sbd || ""),
      HoTenHS: b.hoTenHS || "", MaDe: "'" + (b.made || ""), P1Chon: (b.p1 || []).join(","), P2Chon: (b.p2 || []).join(","),
      DiemTN: Number(b.diem), DiemTL: "", Tong: Number(b.diem), Co: (b.co || []).join("; "), AnhTN: anh, GiaoVien: me.hoTen, CachCham: b.cach || "" });
    if (b.phien) tvPush_(b.phien, { id, sbd: b.sbd, ten: b.hoTenHS || "", made: b.made, diem: b.diem, sai: b.sai, co: b.co, anhNho: b.anhNho, lop: b.lop });
    return { id, anh };
  });
}
function kq_(me, id) {
  const r = rows_("KetQua").find((x) => String(x.Id) === String(id));
  if (!r) throw new Error("Không thấy bài");
  if (!me.admin && String(r.ChuSo) !== me.tenDN) throw new Error("Bài này không phải của Thầy/Cô");
  return r;
}
function dsKetQua_(me, kiThiId, lop) {
  kiThi_(me, kiThiId);
  return rows_("KetQua").filter((r) => String(r.KiThiId) === String(kiThiId) && (!lop || String(r.Lop) === String(lop)))
    .map((r) => ({ id: r.Id, thoiGian: r.ThoiGian, lop: r.Lop, sbd: String(r.SBD), ten: r.HoTenHS, made: String(r.MaDe), diemTN: r.DiemTN,
      diemTL: r.DiemTL, tong: r.Tong, co: r.Co, coAnh: !!r.AnhTN, nhanXet: r.NhanXetTL, gv: r.GiaoVien, p1: String(r.P1Chon || "") }));
}
function luuTL_(me, b) {
  const r = kq_(me, b.id);
  const anhTL = b.anhTL ? saveImg_(b.anhTL, `${r.SBD}_${r.MaDe}_TL.jpg`, r.ChuSo, r.KiThiId, r.Lop) : r.AnhTL;
  const tl = b.diemTL === "" || b.diemTL === null ? "" : Number(b.diemTL);
  const tong = Math.round((Number(r.DiemTN) + (tl === "" ? 0 : tl)) * 100) / 100;
  set_("KetQua", r._row, { DiemTL: tl, Tong: tong, AnhTL: anhTL, NhanXetTL: b.nhanXet === undefined ? r.NhanXetTL : b.nhanXet });
  return { tong };
}
function xoaKetQua_(me, id) {
  const r = kq_(me, id);
  [r.AnhTN, r.AnhTL].filter(String).forEach((f) => { try { DriveApp.getFileById(f).setTrashed(true); } catch (e) {} });
  sh_("KetQua").deleteRow(r._row);
  return true;
}
function layAnh_(me, id, loai) {
  const r = kq_(me, id), f = loai === "TL" ? r.AnhTL : r.AnhTN;
  if (!f) throw new Error("Bài này chưa có ảnh");
  return "data:image/jpeg;base64," + Utilities.base64Encode(DriveApp.getFileById(f).getBlob().getBytes());
}

/* ---------------------------------------------------------------- quản trị */
function dsTaiKhoan_() {
  const kt = {}, kq = {};
  rows_("KiThi").forEach((k) => (kt[k.ChuSo] = (kt[k.ChuSo] || 0) + 1));
  rows_("KetQua").forEach((r) => (kq[r.ChuSo] = (kq[r.ChuSo] || 0) + 1));
  return rows_("TaiKhoan").map((u) => Object.assign(pub_(u), { trangThai: u.TrangThai, ngayTao: u.NgayTao, lanCuoi: u.LanCuoi,
    soKiThi: kt[u.TenDN] || 0, soBai: kq[u.TenDN] || 0 }));
}
function capNhatTaiKhoan_(me, b) {
  const u = user_(b.tenDN); if (!u) throw new Error("Không có tài khoản");
  if (String(u.TenDN) === me.tenDN && b.trangThai === "khoa") throw new Error("Không tự khoá tài khoản của mình");
  set_("TaiKhoan", u._row, { TrangThai: b.trangThai === "khoa" ? "khoa" : "hoatdong" });
  return true;
}
function datLaiMatKhau_(tenDN) {
  const u = user_(tenDN); if (!u) throw new Error("Không có tài khoản");
  const moi = Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000), muoi = Utilities.getUuid();
  set_("TaiKhoan", u._row, { Muoi: muoi, MatKhau: hash_(moi, muoi) });
  return { matKhau: moi };
}

/* ---------------------------------------------------------------- phiên tivi (bộ nhớ đệm, giữ 6 giờ) */
function tvPush_(phien, item) {
  // mỗi bài lưu một khoá riêng (bộ nhớ đệm giới hạn 100 KB mỗi khoá), kèm danh sách mốc thời gian
  const c = CacheService.getScriptCache(), key = "tv_" + phien;
  item.t = Date.now();
  c.put(key + "_" + item.t, JSON.stringify(item), 21600);
  const ds = JSON.parse(c.get(key) || "[]"); ds.push(item.t);
  c.put(key, JSON.stringify(ds.slice(-40)), 21600);
}
function tvGet_(phien, sau) {
  if (!/^[A-Z0-9]{6,12}$/.test(String(phien || ""))) return [];
  const c = CacheService.getScriptCache(), key = "tv_" + phien;
  const ts = JSON.parse(c.get(key) || "[]").filter((t) => t > sau).slice(0, 5);
  return ts.map((t) => JSON.parse(c.get(key + "_" + t) || "null")).filter(Boolean);
}
