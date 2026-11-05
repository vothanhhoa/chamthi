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
  function docDapAn(txt, mau, n) {
    const p2n = mau === "VT" ? 0 : 16, out = {}, loi = [];
    String(txt || "").split(/\r?\n/).forEach((line, li) => {
      line = line.trim(); if (!line) return;
      const m = line.match(/^([0-9A-Za-z]{1,6})[\s:;,.|\t-]+(.*)$/);
      if (!m || /^(mã|ma|made|câu|cau)/i.test(line)) return;
      const made = m[1], rest = m[2].toUpperCase().replace(/ĐÚNG/g, "Đ").replace(/SAI/g, "S");
      let cells = rest.split(/[\t;,| ]+/).filter((s) => s !== "");
      if (cells.length < n) cells = rest.replace(/[^ABCDĐSTF]/g, "").split("");   // dạng gọn
      const p1 = cells.slice(0, n), p2 = cells.slice(n, n + p2n).map((s) => (/^(Đ|D|T|TRUE)$/.test(s) ? "Đ" : "S"));
      if (p1.length === n && p1.every((s) => /^[ABCD]$/.test(s)) && p2.length === p2n) out[made] = { p1, p2 };
      else loi.push(`Dòng ${li + 1} (mã ${made}): cần ${n} đáp án A–D${p2n ? " và 16 ý Đ/S" : ""}, đọc được ${p1.length}${p2n ? " + " + p2.length : ""}`);
    });
    return { dapAn: out, loi };
  }
  window.CT = { LS, apiUrl, ready, get, post, loadLayouts, toast, fmt, num, esc, toi, daDangNhap, canDangNhap, luuPhien, dangXuat, thanhTK, docDapAn };
  document.addEventListener("DOMContentLoaded", thanhTK);
})();
