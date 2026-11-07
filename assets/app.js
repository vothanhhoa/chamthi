/* Tiện ích dùng chung: gọi API Apps Script, đăng nhập, định dạng. */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("ct_" + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ct_" + k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem("ct_" + k); } catch (e) {} },
  };
  function apiUrl() { return LS.get("api", "") || window.API_URL || ""; }
  function ready() { return /^https:\/\/script\.google\.com\//.test(apiUrl()) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(apiUrl()); }
  async function get(params) {
    const r = await fetch(apiUrl() + "?" + new URLSearchParams(params));
    const j = await r.json(); if (!j.ok) throw new Error(j.loi || "Lỗi máy chủ"); return j.data;
  }
  /* Gửi lệnh tới máy chủ; tự gắn mã phiên đăng nhập. text/plain để tránh preflight CORS với Apps Script. */
  async function post(body, lan) {
    body = Object.assign({ token: LS.get("token", "") }, body);
    let r;
    try { r = await fetch(apiUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }); }
    catch (e) {
      if ((lan || 0) < 2) { await new Promise((ok) => setTimeout(ok, 1500)); return post(body, (lan || 0) + 1); }
      throw new Error("Mất kết nối mạng – thử lại");
    }
    const j = await r.json();
    if (!j.ok) {
      if (/đăng nhập lại/.test(j.loi || "")) { LS.del("token"); LS.del("toi"); if (!/taikhoan\.html/.test(location.pathname)) dangNhapLai(); }
      throw new Error(j.loi || "Lỗi máy chủ");
    }
    return j.data;
  }
  function dangNhapLai() { location.href = "taikhoan.html?ve=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); }
  function toi() { try { return JSON.parse(LS.get("toi", "null")); } catch (e) { return null; } }
  function daDangNhap() { return !!LS.get("token", "") && !!toi(); }
  function canDangNhap() { if (!daDangNhap()) { dangNhapLai(); return false; } return true; }
  function luuPhien(d) { LS.set("token", d.token); LS.set("toi", JSON.stringify(d.toi)); }
  function dangXuat() { LS.del("token"); LS.del("toi"); location.href = "index.html"; }
  /* Thanh tài khoản trên đầu trang */
  function thanhTK() {
    const nav = document.querySelector("header.top nav"); if (!nav) return;
    const u = toi(), a = document.createElement("span");
    a.style.cssText = "display:flex;gap:6px;align-items:center";
    a.innerHTML = u ? `<a href="taikhoan.html" title="Tài khoản">👤 ${esc(u.hoTen)}</a>${u.vaiTro === "admin" ? '<a href="quantri.html">Quản trị</a>' : ""}`
      : `<a href="taikhoan.html">Đăng nhập</a>`;
    nav.appendChild(a);
  }
  let layouts = null;
  async function loadLayouts() {
    if (!layouts) layouts = await (await fetch("assets/layouts.json")).json();
    return layouts;
  }
  function toast(msg, kind) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "show " + (kind || "");
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = ""), 3600);
  }
  function fmt(n) { if (n === "" || n === null || n === undefined || isNaN(Number(n))) return ""; return (Math.round(Number(n) * 100) / 100).toString().replace(".", ","); }
  function num(s) { return Number(String(s).replace(",", ".")); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  /* Đọc đáp án dán vào: bảng TNMaker (mỗi ô một đáp án) hoặc gọn "101 ABCDAB… ĐSĐS…".
     mau: "24-4" | "12-4" | "VT"; n: số câu Phần I (VT: số câu). */
  function docDapAn(txt, mau, n, soY2) {
    const p2n = soY2 !== undefined ? soY2 : mau === "VT" ? 0 : 16, out = {}, loi = [];
    String(txt || "").split(/\r?\n/).forEach((line, li) => {
      line = line.trim(); if (!line) return;
      const m = line.match(/^([0-9A-Za-z]{1,6})[\s:;,.|\t-]+(.*)$/);
      if (!m || /^(mã|ma|made|câu|cau)/i.test(line)) return;
      const made = m[1], rest = m[2].toUpperCase().replace(/ĐÚNG/g, "Đ").replace(/SAI/g, "S");
      let cells = rest.split(/[\t;,| ]+/).filter((s) => s !== "");
      if (cells.length < n) cells = rest.replace(/[^ABCDĐSTF]/g, "").split("");   // dạng gọn
      const p1 = cells.slice(0, n), p2 = cells.slice(n, n + p2n).map((s) => (/^(Đ|D|T|TRUE)$/.test(s) ? "Đ" : "S"));
      if (p1.length === n && p1.every((s) => /^[ABCD]$/.test(s)) && p2.length === p2n) out[made] = { p1, p2 };
      else loi.push(`Dòng ${li + 1} (mã ${made}): cần ${n} đáp án A–D${p2n ? ` và ${p2n} ý Đ/S` : ""}, đọc được ${p1.length}${p2n ? " + " + p2.length : ""}`);
    });
    return { dapAn: out, loi };
  }
  /* Dải chữ chạy đầu trang + chân trang + thống kê truy cập (mọi trang, trừ màn hình tivi) */
  const PHIEN_BAN = "07/11 – 5.0";
  function trangTri() {
    if (document.body.classList.contains("tv") || document.body.dataset.tron === "khong") return;
    const bang = document.createElement("div");
    bang.className = "bang";
    bang.innerHTML = `<div class="ray"><span class="chay"><img src="assets/logo.png" alt="Logo THPT Bình Mỹ"><b>CHẤM THI TRẮC NGHIỆM BẰNG ĐIỆN THOẠI – THPT BÌNH MỸ – GV: VÕ THANH HÒA ✿</b></span></div>
      <span class="dem">👁 Lượt truy cập: <span data-tk="tong">…</span></span>`;
    document.body.insertBefore(bang, document.body.firstChild);
    const ft = document.createElement("footer");
    ft.className = "chantrang";
    ft.innerHTML = `<div class="cot">
      <div><div class="tg"><img src="assets/logo.png" alt=""><div><h3>📝 Chấm thi bằng điện thoại</h3><p>Quét phiếu bằng camera điện thoại, có điểm ngay – miễn phí cho mọi giáo viên</p></div></div>
        <p>Tác giả: <b>Thầy Võ Thanh Hòa</b><br>Trường THPT Bình Mỹ, Bình Mỹ, An Giang</p>
        <p>✉️ <a href="mailto:vothanhhoa3004@gmail.com">vothanhhoa3004@gmail.com</a></p></div>
      <div><h3>👩‍🏫 Dành cho giáo viên</h3><p>Tiểu học, THCS, THPT – <b>phiếu tô TNMaker 24-4, 12-4</b> và <b>phiếu viết chữ A, B, C, D</b></p>
        <p>Chiếu kết quả lên tivi lớp, thống kê câu sai, xuất Excel nhập vnEdu</p><p>Chương trình GDPT 2018</p></div>
      <div><h3>🔗 Liên kết</h3><ul>
        <li>📷 <a href="quet.html">Quét chấm bài</a></li><li>📝 <a href="kithi.html">Bài kiểm tra của tôi</a></li>
        <li>🖨 <a href="phieu.html">In phiếu viết chữ</a></li><li>📖 <a href="huong-dan.html">Hướng dẫn sử dụng</a></li>
        <li>🛠 <a href="https://vothanhhoa.github.io/thuchanh/" target="_blank" rel="noopener">Làm bài thực hành (HS)</a></li></ul></div>
      <div><h3>📊 Thống kê truy cập</h3><div class="so">
        <span>Hôm nay: <b data-tk="homNay">…</b></span><span>Tổng lượt: <b data-tk="tong">…</b></span>
        <span>Người truy cập: <b data-tk="nguoi">…</b></span><span>Giáo viên tham gia: <b data-tk="soGV">…</b></span>
        <span>Bài đã chấm: <b data-tk="soBai">…</b></span></div></div></div>
      <div class="duoi">© 2026 Chấm thi bằng điện thoại – Thầy Võ Thanh Hòa, Trường THPT Bình Mỹ. Sản phẩm ứng dụng AI trong dạy học. · <b>Phiên bản ${PHIEN_BAN}</b></div>`;
    document.body.appendChild(ft);
    thongKe();
  }
  /* Đếm lượt: mỗi phiên trình duyệt tính 1 lượt; mỗi máy tính 1 người */
  async function thongKe() {
    if (!ready()) return;
    let moi = "0", dem = "0";
    try { if (!localStorage.getItem("ct_khach")) { localStorage.setItem("ct_khach", "1"); moi = "1"; } } catch (e) {}
    try { if (!sessionStorage.getItem("ct_daDem")) { sessionStorage.setItem("ct_daDem", "1"); dem = "1"; } } catch (e) {}
    try {
      const d = await get({ api: "thongKe", dem, moi });
      document.querySelectorAll("[data-tk]").forEach((el) => { const v = d[el.dataset.tk]; if (v !== undefined) el.textContent = Number(v).toLocaleString("vi-VN"); });
    } catch (e) {}
  }
  window.CT = { LS, apiUrl, ready, get, post, loadLayouts, toast, fmt, num, esc, toi, daDangNhap, canDangNhap, luuPhien, dangXuat, thanhTK, docDapAn };
  document.addEventListener("DOMContentLoaded", () => { thanhTK(); trangTri(); });
})();
