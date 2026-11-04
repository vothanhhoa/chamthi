/* Tiện ích dùng chung: gọi API Apps Script, lưu PIN, định dạng. */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("ct_" + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ct_" + k, v); } catch (e) {} },
  };
  function apiUrl() { return LS.get("api", "") || window.API_URL; }
  function ready() { return /^https:\/\/script\.google\.com\//.test(apiUrl()) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(apiUrl()); }
  async function get(params) {
    const r = await fetch(apiUrl() + "?" + new URLSearchParams(params));
    const j = await r.json(); if (!j.ok) throw new Error(j.loi || "Lỗi máy chủ"); return j.data;
  }
  async function post(body) {
    // text/plain để tránh preflight CORS với Apps Script (giống trang gia phả)
    const r = await fetch(apiUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!j.ok) throw new Error(j.loi || "Lỗi máy chủ"); return j.data;
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
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = ""), 3200);
  }
  function fmt(n) { return (Math.round(Number(n) * 100) / 100).toString().replace(".", ","); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  window.CT = { LS, apiUrl, ready, get, post, loadLayouts, toast, fmt, esc };
})();
