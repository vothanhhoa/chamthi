/* PHIẾU VIẾT TAY (dành cho tiểu học, THCS): học sinh viết chữ A, B, C, D vào ô.
   Dùng chung cho trang in phiếu (phieu.html) và trang quét (quet.html). Chạy được cả trên Node để thử.
   Toạ độ tính theo milimét trong khung giữa tâm 4 ô vuông đen ở góc phiếu. */
(function (root) {
  "use strict";
  const FW = 186, FH = 128, SQ = 7, CHK = 5;       // khung 186 x 128 mm (vừa nửa tờ A4)
  const CHECKS = [[FW * 0.3, 0], [0, FH * 0.35]];   // 2 ô kiểm tra hướng phiếu
  const Y0 = 37, PITCH = 8.7, BW = 12, BH = 7.4;    // lưới ô trả lời

  function layout(n) {
    n = Math.max(1, Math.min(40, n | 0));
    const cols = Math.ceil(n / 10), colW = (FW - 16) / cols, boxes = [];
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i / 10), r = i % 10, xs = 8 + c * colW + Math.max(0, (colW - 40) / 2);
      boxes.push({ cau: i + 1, lx: xs, x: xs + 11, y: Y0 + r * PITCH, w: BW, h: BH });
    }
    return {
      n, FW, FH, SQ, CHK, CHECKS, boxes,
      ten: { x: 4, y: 17, w: 118, h: 15 },           // vùng họ tên + lớp (hiện cho GV xem)
      made: { x: 128, y: 17, w: 56, h: 15 },         // vùng mã đề + STT
    };
  }

  const U = (L, x, y) => [x / L.FW, y / L.FH];
  const TPL = [[0, 0], [1, 0], [1, 1], [0, 1]];

  function bilinear(g, w, h, x, y) {
    if (x < 0) x = 0; if (y < 0) y = 0; if (x > w - 1.001) x = w - 1.001; if (y > h - 1.001) y = h - 1.001;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }

  /* Cắt một vùng (mm) của khung thành ảnh xám S x S' bằng phép biến đổi phối cảnh. */
  function crop(g, w, h, H, L, x, y, cw, ch, S, S2) {
    const out = new Uint8Array(S * S2);
    for (let j = 0; j < S2; j++) for (let i = 0; i < S; i++) {
      const [u, v] = U(L, x + (i + 0.5) * cw / S, y + (j + 0.5) * ch / S2);
      const [px, py] = OMRref().apply(H, u, v);
      out[j * S + i] = bilinear(g, w, h, px, py);
    }
    return out;
  }
  function OMRref() { return root.OMR || (typeof require !== "undefined" ? require("./omr.js") : null); }

  /* Đọc phiếu: tìm 4 góc, xác định hướng, cắt từng ô, đoán chữ. */
  function read(g, w, h, n) {
    const O = OMRref(), L = layout(n);
    const sq = O.findSquares(g, w, h);
    if (sq.length < 4) return { ok: false, error: "Không thấy đủ 4 ô vuông đen ở góc phiếu" };
    const by = (f) => sq.reduce((a, b) => (f(b) > f(a) ? b : a));
    const q = [by((p) => -(p.x + p.y)), by((p) => p.x - p.y), by((p) => p.x + p.y), by((p) => p.y - p.x)];
    if (new Set(q).size < 4) return { ok: false, error: "Không xác định được 4 góc phiếu" };
    let best = null;
    for (let k = 0; k < 4; k++) {
      const H = O.homography(TPL, [0, 1, 2, 3].map((i) => [q[(i + k) % 4].x, q[(i + k) % 4].y]));
      let sc = 0;
      for (const [x, y] of L.CHECKS) {
        const c = crop(g, w, h, H, L, x - CHK * 0.3, y - CHK * 0.3, CHK * 0.6, CHK * 0.6, 6, 6);
        let m = 0; for (const v of c) m += v; sc += 255 - m / c.length;
      }
      // hướng đúng thì cạnh dài của khung phải nằm theo chiều ngang của phiếu
      const [ax, ay] = O.apply(H, 1, 0), [bx, by2] = O.apply(H, 0, 1), [ox, oy] = O.apply(H, 0, 0);
      const ratio = Math.hypot(ax - ox, ay - oy) / Math.max(1, Math.hypot(bx - ox, by2 - oy));
      if (ratio < 1.1) sc -= 400;
      if (!best || sc > best.sc) best = { k, H, sc };
    }
    const H = best.H, S = 40;
    const cells = L.boxes.map((b) => {
      // viền ô in xám nhạt nên lấy rộng hơn ô 0,5 mm để chữ không bị cắt khi giấy cong/chụp lệch
      const c = normBox(crop(g, w, h, H, L, b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1, Math.round((b.w + 1) * 7), Math.round((b.h + 1) * 7)),
        Math.round((b.w + 1) * 7), Math.round((b.h + 1) * 7), S);
      return Object.assign({ cau: b.cau }, recog(c, S));
    });
    const flags = cells.filter((c) => c.conf < 0.6 && c.ch !== "").map((c) => c.cau);
    const blank = cells.filter((c) => c.ch === "").map((c) => c.cau);
    return { ok: true, H, L, cells, chon: cells.map((c) => c.ch), canXem: flags, trong: blank, orient: best.k };
  }

  /* Cắt vuông quanh chữ (giữ tỉ lệ) rồi đưa về S x S để nhận dạng không phụ thuộc cỡ chữ. */
  function normBox(c, W, Hh, S) {
    const v = Array.from(c).sort((a, z) => a - z), paper = v[Math.floor(v.length * 0.85)], thr = Math.min(paper * 0.66, paper - 40);
    const colN = new Int32Array(W), rowN = new Int32Array(Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (c[y * W + x] < thr) { colN[x]++; rowN[y]++; }
    let x0 = 0, x1 = W - 1, y0 = 0, y1 = Hh - 1;
    while (x0 < W && colN[x0] < 2) x0++; while (x1 > x0 && colN[x1] < 2) x1--;
    while (y0 < Hh && rowN[y0] < 2) y0++; while (y1 > y0 && rowN[y1] < 2) y1--;
    const out = new Uint8Array(S * S);
    if (x0 >= x1 || y0 >= y1 || (x1 - x0) * (y1 - y0) < 12) { out.fill(paper); return out; }
    const side = Math.max(x1 - x0, y1 - y0) * 1.18 + 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const X = cx - side / 2 + (i + 0.5) * side / S, Y = cy - side / 2 + (j + 0.5) * side / S;
      out[j * S + i] = X < 0 || Y < 0 || X > W - 1 || Y > Hh - 1 ? paper : bilinear(c, W, Hh, X, Y);
    }
    return out;
  }

  /* Dò lại viền ô thật (bù cho giấy cong, chụp nghiêng): tìm 4 đường viền đậm gần vị trí dự kiến. */
  function refine(g, w, h, H, L, b) {
    const m = 2.6, k = 8, X0 = b.x - m, Y0 = b.y - m, CW = b.w + 2 * m, CH = b.h + 2 * m;
    const SW = Math.round(CW * k), SH = Math.round(CH * k);
    const c = crop(g, w, h, H, L, X0, Y0, CW, CH, SW, SH);
    const v = Array.from(c).sort((a, z) => a - z), paper = v[Math.floor(v.length * 0.8)], thr = paper * 0.62;
    const col = new Float32Array(SW), row = new Float32Array(SH);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (c[y * SW + x] < thr) { col[x]++; row[y]++; }
    const best = (arr, lo, hi, need) => {
      let bi = -1, bv = need;
      for (let i = Math.max(0, Math.round(lo * k)); i <= Math.min(arr.length - 1, Math.round(hi * k)); i++) if (arr[i] > bv) { bv = arr[i]; bi = i; }
      return bi < 0 ? null : bi / k;
    };
    const needV = b.h * k * 0.45, needH = b.w * k * 0.45;
    const l = best(col, m - 2.2, m + 1.3, needV), r = best(col, m + b.w - 1.3, m + b.w + 2.2, needV);
    const t = best(row, m - 2.2, m + 1.3, needH), bo = best(row, m + b.h - 1.3, m + b.h + 2.2, needH);
    const ok = (a, z, len) => a !== null && z !== null && Math.abs(z - a - len) < len * 0.25;
    const R = { x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h };
    if (ok(l, r, b.w)) { R.x0 = X0 + l; R.x1 = X0 + r; }
    else if (l !== null && Math.abs(l - m) < 2) { R.x0 = X0 + l; R.x1 = R.x0 + b.w; }
    else if (r !== null && Math.abs(r - m - b.w) < 2) { R.x1 = X0 + r; R.x0 = R.x1 - b.w; }
    if (ok(t, bo, b.h)) { R.y0 = Y0 + t; R.y1 = Y0 + bo; }
    else if (t !== null && Math.abs(t - m) < 2) { R.y0 = Y0 + t; R.y1 = R.y0 + b.h; }
    else if (bo !== null && Math.abs(bo - m - b.h) < 2) { R.y1 = Y0 + bo; R.y0 = R.y1 - b.h; }
    return R;
  }

  /* ---------------------------------------------------------------- nhận dạng chữ A/B/C/D (theo hình dạng) */
  function comps(bin, S, val) {
    const lab = new Int32Array(S * S).fill(-1), list = [], st = [];
    for (let s = 0; s < S * S; s++) {
      if (bin[s] !== val || lab[s] >= 0) continue;
      const id = list.length, c = { n: 0, x0: S, y0: S, x1: 0, y1: 0, sx: 0, sy: 0, edge: false };
      lab[s] = id; st.push(s);
      while (st.length) {
        const p = st.pop(), x = p % S, y = (p - x) / S;
        c.n++; c.sx += x; c.sy += y;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        if (x === 0 || y === 0 || x === S - 1 || y === S - 1) c.edge = true;
        const nb = val ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of nb) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= S || Y >= S) continue;
          const t = Y * S + X;
          if (bin[t] === val && lab[t] < 0) { lab[t] = id; st.push(t); }
        }
      }
      list.push(c);
    }
    return { lab, list };
  }

  function recog(c, S) {
    const v = Array.from(c).sort((a, b) => a - b), paper = v[Math.floor(v.length * 0.85)];
    const thr = Math.min(paper * 0.66, paper - 40);
    let bin = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) bin[i] = c[i] < thr ? 1 : 0;
    // bỏ vệt viền ô lọt vào và chấm nhiễu
    let { lab, list } = comps(bin, S, 1);
    list.forEach((k, id) => {
      const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1;
      const line = k.edge && ((bw >= S * 0.7 && bh <= S * 0.18) || (bh >= S * 0.7 && bw <= S * 0.18));
      if (line || k.n < S * S * 0.005) for (let i = 0; i < S * S; i++) if (lab[i] === id) bin[i] = 0;
    });
    let ink = 0; for (let i = 0; i < S * S; i++) ink += bin[i];
    if (ink < S * S * 0.025) return { ch: "", conf: 1, ly: "trống" };
    if (ink > S * S * 0.62) return { ch: "", conf: 0.3, ly: "bôi đen/gạch xoá" };
    // khung bao chữ
    let x0 = S, y0 = S, x1 = 0, y1 = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (bin[y * S + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, area = bw * bh;
    // làm dày nét 1 điểm ảnh để nối chỗ hở nhỏ
    const d = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < S && Y < S && bin[Y * S + X]) { on = 1; break; }
      }
      d[y * S + x] = on;
    }
    const bg = comps(d, S, 0).list.filter((k) => !k.edge && k.n >= Math.max(3, area * 0.01));
    const holes = bg.map((k) => ({ n: k.n, hx: (k.sx / k.n - x0) / bw, hy: (k.sy / k.n - y0) / bh, ha: k.n / area }));
    // số đoạn nét ở phần đáy (chữ A có 2 chân)
    let runsBot = 0;
    for (let y = y1 - Math.max(1, Math.round(bh * 0.18)); y <= y1; y++) {
      let r = 0, prev = 0, gap = 9;
      for (let x = x0; x <= x1; x++) {
        const o = bin[y * S + x];
        if (o && !prev && gap > 1) r++;
        gap = o ? 0 : gap + 1; prev = o;
      }
      runsBot = Math.max(runsBot, r);
    }
    // tỉ lệ mực ở các vùng
    const frac = (fx0, fx1, fy0, fy1) => {
      let s = 0, n = 0;
      for (let y = Math.round(y0 + fy0 * bh); y < Math.round(y0 + fy1 * bh); y++)
        for (let x = Math.round(x0 + fx0 * bw); x < Math.round(x0 + fx1 * bw); x++) { s += bin[y * S + x]; n++; }
      return n ? s / n : 0;
    };
    const rightMid = frac(0.62, 1, 0.3, 0.7), leftCol = frac(0, 0.22, 0.1, 0.9);
    const tl = frac(0, 0.28, 0, 0.2), tr = frac(0.72, 1, 0, 0.2), bl = frac(0, 0.28, 0.8, 1), br = frac(0.72, 1, 0.8, 1);
    const f = { holes: holes.length, runsBot, rightMid: +rightMid.toFixed(2), leftCol: +leftCol.toFixed(2), tl: +tl.toFixed(2), tr: +tr.toFixed(2), bl: +bl.toFixed(2), br: +br.toFixed(2), hy: holes[0] ? +holes[0].hy.toFixed(2) : null, ha: holes[0] ? +holes[0].ha.toFixed(2) : null };
    const R = (ch, conf, ly) => ({ ch, conf, ly, f });
    const botC = frac(0.32, 0.68, 0.84, 1);        // giữa đáy: chữ A trống (giữa 2 chân), B/C/D có nét
    const edgeR = frac(0.8, 1, 0.38, 0.62);        // mép phải ở giữa: chữ C hở
    f.botC = +botC.toFixed(2); f.edgeR = +edgeR.toFixed(2);
    if (holes.length >= 2) {
      const st = holes.sort((a, b) => b.n - a.n).slice(0, 2);
      return R("B", Math.abs(st[0].hy - st[1].hy) > 0.2 ? 0.9 : 0.6, "2 vòng kín");
    }
    if (holes.length === 1) {
      const o = holes[0];
      if (botC < 0.06 && o.ha < 0.15) return R("A", 0.9, "vòng nhỏ phía trên, 2 chân");
      if (o.ha >= 0.12) return R("D", botC < 0.06 ? 0.5 : 0.88, "1 vòng lớn");
      if (botC < 0.06) return R("A", 0.6, "2 chân");
      if (o.hy > 0.38 && o.hy < 0.62) return R("D", 0.5, "1 vòng ở giữa – có thể là D");
      return R("B", 0.45, "1 vòng nhỏ – có thể là B");
    }
    if (botC < 0.06) return R("A", 0.75, "2 chân (chưa khép vòng)");
    if (edgeR < 0.08) return R("C", 0.85, "hở bên phải");
    if (edgeR < 0.2 && rightMid < 0.2) return R("C", 0.55, "gần như hở bên phải");
    if (tl < 0.45 && bl < 0.45) return R("C", 0.55, "góc trái tròn, không vòng kín");
    if (leftCol > 0.45) return R("D", 0.45, "nét đứng, vòng hở – có thể là D/B");
    return R("?", 0.1, "không rõ");
  }

  /* Ảnh khung đã nắn thẳng để hiển thị (RGBA). */
  function warp(src, sw, sh, H, sc, W, L) {
    const Hh = Math.round(W * L.FH / L.FW), out = new Uint8ClampedArray(W * Hh * 4), O = OMRref();
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const [px, py] = O.apply(H, x / (W - 1), y / (Hh - 1));
      const X = Math.min(sw - 1, Math.max(0, Math.round(px * sc))), Y = Math.min(sh - 1, Math.max(0, Math.round(py * sc)));
      const i = (Y * sw + X) * 4, o = (y * W + x) * 4;
      out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = 255;
    }
    return { data: out, w: W, h: Hh };
  }

  const api = { layout, read, recog, warp, crop, refine, normBox };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VT = api;
})(typeof self !== "undefined" ? self : this);
