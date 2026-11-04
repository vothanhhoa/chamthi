/* Bộ đọc phiếu trắc nghiệm (mẫu TNMaker 24-4, 12-4) – JavaScript thuần, chạy trên trình duyệt và Node.
   Đầu vào: ảnh xám (Uint8Array), rộng w, cao h. Không cần thư viện ngoài. */
(function (root) {
  "use strict";

  function toGray(rgba, w, h) {
    const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    return g;
  }

  function integral(g, w, h) {
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) {
        row += g[(y - 1) * w + x - 1];
        I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x] + row;
      }
    }
    return I;
  }

  function boxMean(I, w, h, x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
    const W = w + 1, a = (x1 - x0) * (y1 - y0);
    if (a <= 0) return 255;
    return (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / a;
  }

  /* Tìm các ô vuông đen đặc (ô định vị). */
  function findSquares(g, w, h) {
    const I = integral(g, w, h), win = Math.max(15, Math.round(Math.min(w, h) / 12));
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const m = boxMean(I, w, h, x - win, y - win, x + win, y + win);
        bin[y * w + x] = g[y * w + x] < m * 0.6 && g[y * w + x] < 140 ? 1 : 0;
      }
    const seen = new Uint8Array(w * h), out = [], stack = new Int32Array(w * h);
    const md = Math.min(w, h), amin = Math.pow(md * 0.008, 2), amax = Math.pow(md * 0.07, 2);
    for (let s = 0; s < w * h; s++) {
      if (!bin[s] || seen[s]) continue;
      let sp = 0, area = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      stack[sp++] = s; seen[s] = 1;
      while (sp) {
        const p = stack[--sp], px = p % w, py = (p - px) / w;
        area++; sx += px; sy += py;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        const nb = [p - 1, p + 1, p - w, p + w];
        for (let k = 0; k < 4; k++) {
          const q = nb[k];
          if (q < 0 || q >= w * h) continue;
          if (k === 0 && px === 0) continue; if (k === 1 && px === w - 1) continue;
          if (bin[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = area / (bw * bh), asp = bw / bh;
      if (area >= amin && area <= amax && asp > 0.6 && asp < 1.65 && fill > 0.7)
        out.push({ x: sx / area, y: sy / area, s: Math.sqrt(area), fill });
    }
    return out;
  }

  /* Ma trận đồng nhất (homography) từ 4 cặp điểm. */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const n = 8;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const hh = b.map((v, i) => v / A[i][i]);
    return [hh[0], hh[1], hh[2], hh[3], hh[4], hh[5], hh[6], hh[7], 1];
  }

  function apply(H, u, v) {
    const d = H[6] * u + H[7] * v + H[8];
    return [(H[0] * u + H[1] * v + H[2]) / d, (H[3] * u + H[4] * v + H[5]) / d];
  }

  function diskMean(g, w, h, cx, cy, r) {
    let s = 0, n = 0;
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) { s += g[y * w + x]; n++; }
      }
    return n ? s / n : 255;
  }

  /* Chọn 4 ô định vị góc trang: các điểm cực trị theo hai đường chéo. */
  function pickCorners(sq) {
    if (sq.length < 4) return null;
    const by = (f) => sq.reduce((a, b) => (f(b) > f(a) ? b : a));
    const tl = by((p) => -(p.x + p.y)), br = by((p) => p.x + p.y), tr = by((p) => p.x - p.y), bl = by((p) => p.y - p.x);
    const set = new Set([tl, tr, br, bl]);
    if (set.size < 4) return null;
    return [tl, tr, br, bl];
  }

  const TPL = [[0, 0], [1, 0], [1, 1], [0, 1]];

  function read(g, w, h, L, opts) {
    opts = opts || {};
    const sq = findSquares(g, w, h);
    const q = pickCorners(sq);
    if (!q) return { ok: false, error: "Không thấy đủ 4 ô định vị ở góc phiếu", squares: sq.length };
    // Thử 4 hướng xoay, chọn hướng mà các ô vuông kiểm tra (giữa phiếu) đều đen.
    let best = null;
    for (let k = 0; k < 4; k++) {
      const dst = [0, 1, 2, 3].map((i) => [q[(i + k) % 4].x, q[(i + k) % 4].y]);
      const H = homography(TPL, dst);
      const rpx = Math.hypot(...[0, 1].map((i) => apply(H, 0.5 + L.r, 0.5)[i] - apply(H, 0.5, 0.5)[i]));
      let sc = 0;
      for (const [u, v] of L.check) {
        const [x, y] = apply(H, u, v);
        sc += 255 - diskMean(g, w, h, x, y, rpx * 0.9);
      }
      if (!best || sc > best.sc) best = { k, H, rpx, sc };
    }
    const { H, rpx } = best;
    const meas = (u, v) => {
      const [x, y] = apply(H, u, v);
      return { x, y, m: diskMean(g, w, h, x, y, Math.max(1.5, rpx * 0.55)) };
    };
    // Đo tất cả các ô
    const groups = { sbd: L.sbd.map((c) => c.map((p) => meas(...p))), made: L.made.map((c) => c.map((p) => meas(...p))),
      p1: L.p1.map((qq) => qq.map((p) => meas(...p))), p2: L.p2.map((c) => c.map((row) => row.map((p) => meas(...p)))) };
    const all = [].concat(...groups.sbd, ...groups.made, ...groups.p1, ...[].concat(...groups.p2));
    const ms = all.map((o) => o.m).sort((a, b) => a - b);
    const paper = ms[Math.floor(ms.length * 0.9)];
    const T = opts.thr || 0.35;
    for (const o of all) o.d = Math.max(0, (paper - o.m) / paper);
    const pick = (arr) => {
      const ds = arr.map((o) => o.d), mx = Math.max(...ds);
      const on = ds.map((d, i) => (d > T && d > mx * 0.6 ? i : -1)).filter((i) => i >= 0);
      return { on, mx };
    };
    const flags = [];
    const digits = (cols, name) => {
      const trong = [], nhieu = [];
      const s = cols.map((c, ci) => {
        const r = pick(c);
        if (r.on.length !== 1) { (r.on.length ? nhieu : trong).push(ci + 1); return "?"; }
        return String(r.on[0]);
      }).join("");
      if (trong.length === cols.length) flags.push(`${name}: chưa tô`);
      else if (trong.length) flags.push(`${name}: bỏ trống cột ${trong.join(", ")}`);
      if (nhieu.length) flags.push(`${name}: tô nhiều ô ở cột ${nhieu.join(", ")}`);
      return s;
    };
    const sbd = digits(groups.sbd, "Số báo danh"), made = digits(groups.made, "Mã đề");
    const weak = (arr, name) => {
      const mx = Math.max(...arr.map((o) => o.d));
      if (mx > 0.2 && mx <= T) flags.push(`${name}: tô mờ – cần xem lại`);
    };
    const p1 = groups.p1.map((qq, i) => {
      const r = pick(qq);
      if (!r.on.length) weak(qq, `Phần I câu ${i + 1}`);
      if (r.on.length > 1) { flags.push(`Phần I câu ${i + 1}: tô nhiều ô`); return "*"; }
      return r.on.length ? "ABCD"[r.on[0]] : "";
    });
    const p2 = groups.p2.map((c, ci) => c.map((row, ri) => {
      const r = pick(row);
      if (!r.on.length) weak(row, `Phần II câu ${ci + 1} ý ${"abcd"[ri]}`);
      if (r.on.length > 1) { flags.push(`Phần II câu ${ci + 1} ý ${"abcd"[ri]}: tô cả Đúng và Sai`); return "*"; }
      return r.on.length ? (r.on[0] === 0 ? "Đ" : "S") : "";
    }));
    return { ok: true, orient: best.k, H: best.H, corners: q.map((p) => [p.x, p.y]), sbd, made, p1, p2, flags, groups, paper };
  }

  /* Chấm điểm: Phần I 0,25 điểm/câu; Phần II 0,25 điểm/ý (theo quy định của trường). */
  function grade(res, key, pts) {
    pts = pts || { p1: 0.25, p2: 0.25 };
    const r1 = res.p1.map((a, i) => ({ cau: i + 1, chon: a, dung: key.p1[i], ok: a === key.p1[i] }));
    const r2 = [];
    res.p2.forEach((c, ci) => c.forEach((a, ri) => {
      const k = key.p2[ci * 4 + ri];
      r2.push({ cau: ci + 1, y: "abcd"[ri], chon: a, dung: k, ok: a === k });
    }));
    const diem = r1.filter((x) => x.ok).length * pts.p1 + r2.filter((x) => x.ok).length * pts.p2;
    return { diem: Math.round(diem * 100) / 100, p1: r1, p2: r2 };
  }

  /* Thu nhỏ ảnh xám (giữ tỉ lệ) để xử lí nhanh trên điện thoại. */
  function shrink(g, w, h, maxSide) {
    const k = Math.min(1, maxSide / Math.max(w, h));
    if (k >= 1) return { g, w, h, k: 1 };
    const W = Math.round(w * k), Hh = Math.round(h * k), o = new Uint8Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) o[y * W + x] = g[Math.floor(y / k) * w + Math.floor(x / k)];
    return { g: o, w: W, h: Hh, k };
  }

  /* Nắn thẳng phiếu: trả về ảnh RGBA đứng thẳng (W x Hh) cắt theo 4 ô định vị góc.
     src: dữ liệu RGBA gốc (sw x sh); H: ma trận của read(); sc: hệ số đổi từ ảnh đọc sang ảnh gốc. */
  function warp(src, sw, sh, H, sc, W) {
    const Hh = Math.round(W * 2135 / 1447), out = new Uint8ClampedArray(W * Hh * 4);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const [px, py] = apply(H, x / (W - 1), y / (Hh - 1));
      const X = Math.min(sw - 1, Math.max(0, Math.round(px * sc))), Y = Math.min(sh - 1, Math.max(0, Math.round(py * sc)));
      const i = (Y * sw + X) * 4, o = (y * W + x) * 4;
      out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = 255;
    }
    return { data: out, w: W, h: Hh };
  }

  const api = { toGray, read, grade, shrink, warp, findSquares, homography, apply };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OMR = api;
})(typeof self !== "undefined" ? self : this);
