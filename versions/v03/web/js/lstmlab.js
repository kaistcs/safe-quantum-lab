/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Real LSTM training experiment (BPTT + Adam) on synthetic hike time series: moment model vs LSTM vs LSTM + quantum overlap inputs. */
/* =====================================================================
 * lstmlab.js (2026-11-17) : LSTM을 실제로 학습시키는 실험 엔진(레고 부품, 화면 없이 계산만 함)
 * ---------------------------------------------------------------------
 * 자료 : 가상 산행 시계열. 한 산행 = 10분 × 20단계, 워치가 재는 신호 4개 [심박 부담, 배터리 부족, 비, 경사]
 *        보이지 않는 피로는 경사에서 쌓이고 쉼터에서 줄어들며, 심박 부담은 경사와 피로에 잡음이 섞여 나타남(피로를 직접 재지 못함)
 *        배터리 부족은 꾸준히 늘어나고, 비는 한번 오면 이어짐
 * 정답 : "쌓인 부담" S_t = 0.82 × S_(t−1) + 피로×경사 + 0.8 × 비×경사 + 0.25 × 배터리 부족×피로 가 기준(1.9)을 넘으면 위험
 *        즉 지금 순간 값만으로는 알 수 없고, 지난 시간이 쌓여야 위험이 됨(시간 누적형)
 * 비교 모델(같은 자료, 같은 학습 횟수, 같은 Adam 0.03)
 *   ① 순간 모델 : 지금 10분 값 4개만 보는 로지스틱 회귀
 *   ② LSTM(일반 입력 4개)
 *   ③ LSTM + 양자 겹침 입력 : 4개 + 2큐비트 회로의 ⟨Z⟩ 2개(비×경사, 심박 부담×경사), ⟨Z⟩ = cos(πa)cos(πb)
 * 채점 : 시험 산행 80개. 단계별 AUC, 정상 구간 오경보 10% 문턱에서 위험 구간 탐지율, 사건 탐지율(사건 30분 전~끝 사이 경보), 사건 시작 대비 첫 경보 시각(분, +는 미리)
 * 근거 : Hochreiter & Schmidhuber 1997(LSTM), Werbos 1990(BPTT), Kingma & Ba 2015(Adam), Fawcett 2006(ROC, AUC)
 * ===================================================================== */
(function (QP) {
  "use strict";
  const sg = function (z) { return 1 / (1 + Math.exp(-z)); }, th = Math.tanh, clip = function (v) { return Math.max(0, Math.min(1, v)); };
  const T = 20, NAMES = ["심박 부담", "배터리 부족", "비", "경사"], NAMES_EN = ["heart-rate load", "battery deficit", "rain", "slope"];
  const zq = function (a, b) { return QP.Models && QP.Models.pairExact ? QP.Models.pairExact(a, b) : Math.cos(Math.PI * a) * Math.cos(Math.PI * b); };
  function hike(r) {                                 // 산행 하나(20단계)와 정답 / one hike and its labels
    const xs = [], ys = [], S = [], F = []; let f = r() * .15, s = 0, rain = 0, sl = r() * .5; const b0 = r() * .25, br = .015 + r() * .03, rainAt = r() < .55 ? Math.floor(r() * 18) : 99, restAt = 6 + Math.floor(r() * 8);
    for (let t = 0; t < T; t++) {
      sl = clip(sl + (r() - .45) * .35); const rest = t === restAt || t === restAt + 1;
      if (t === rainAt) rain = .5 + r() * .5; else if (rain > 0) rain = clip(rain + (r() - .55) * .25);
      f = clip(f + .07 * sl + .02 - (rest ? .22 : 0) + (r() - .5) * .04); const bat = clip(b0 + br * t);
      s = .82 * s + f * sl + .8 * rain * sl + .25 * bat * f; S.push(s);
      const sl2 = rest ? sl * .2 : sl, hr = clip(.15 + .35 * sl2 + .4 * f + (r() - .5) * .25); xs.push([hr, bat, rain, sl2]); ys.push(s > 1.9 ? 1 : 0); F.push(f);
    }
    return { x: xs, y: ys, S: S, F: F };
  }
  function makeData(seed, n) { const r = QP.Sim.rng(seed); const out = []; for (let k = 0; k < n; k++) out.push(hike(r)); return out; }
  function feats(x, q) { return q ? x.concat([zq(x[2], x[3]), zq(x[0], x[3])]) : x.slice(); }   // 입력 만들기(q면 양자 겹침 2개 추가) / build inputs
  // ---- LSTM ----
  function lstmInit(D, H, r) { const sc = function (n) { return Math.sqrt(1 / n); }, mat = function (a, b) { return Array.from({ length: a }, function () { return Array.from({ length: b }, function () { return (r() * 2 - 1) * sc(b); }); }); };
    return { D: D, H: H, W: mat(4 * H, D + H), b: Array.from({ length: 4 * H }, function (_, k) { return k >= H && k < 2 * H ? 1 : 0; }), V: Array.from({ length: H }, function () { return (r() * 2 - 1) * sc(H); }), c: 0 }; } // 게이트 순서 i, f, g, o(망각 절편 1) / gates i, f, g, o
  function lstmFwd(m, X) {                            // 순전파(한 산행) / forward over one hike
    const H = m.H, st = []; let h = new Array(H).fill(0), c = new Array(H).fill(0);
    X.forEach(function (x) { const z = x.concat(h), a = m.W.map(function (row, j) { let s = m.b[j]; for (let k = 0; k < row.length; k++) s += row[k] * z[k]; return s; });
      const i = [], f = [], g = [], o = [], c2 = [], h2 = []; for (let j = 0; j < H; j++) { i[j] = sg(a[j]); f[j] = sg(a[H + j]); g[j] = th(a[2 * H + j]); o[j] = sg(a[3 * H + j]); c2[j] = f[j] * c[j] + i[j] * g[j]; h2[j] = o[j] * th(c2[j]); }
      let y = m.c; for (let j = 0; j < H; j++) y += m.V[j] * h2[j]; st.push({ z: z, i: i, f: f, g: g, o: o, cp: c, c: c2, h: h2, p: sg(y) }); h = h2; c = c2; });
    return st;
  }
  function lstmGrad(m, X, Y, G) {                     // 시간 역전파(BPTT) / backpropagation through time
    const H = m.H, st = lstmFwd(m, X); let dh = new Array(H).fill(0), dc = new Array(H).fill(0), L = 0;
    for (let t = st.length - 1; t >= 0; t--) { const s = st[t], y = Y[t], e = s.p - y; L -= y ? Math.log(s.p + 1e-9) : Math.log(1 - s.p + 1e-9);
      G.c += e; const dht = dh.slice(); for (let j = 0; j < H; j++) { G.V[j] += e * s.h[j]; dht[j] += e * m.V[j]; }
      const da = new Array(4 * H), dcn = new Array(H);
      for (let j = 0; j < H; j++) { const tc = th(s.c[j]), dct = dc[j] + dht[j] * s.o[j] * (1 - tc * tc);
        da[3 * H + j] = dht[j] * tc * s.o[j] * (1 - s.o[j]); da[j] = dct * s.g[j] * s.i[j] * (1 - s.i[j]); da[2 * H + j] = dct * s.i[j] * (1 - s.g[j] * s.g[j]); da[H + j] = dct * s.cp[j] * s.f[j] * (1 - s.f[j]); dcn[j] = dct * s.f[j]; }
      const dz = new Array(s.z.length).fill(0);
      for (let r = 0; r < 4 * H; r++) { G.b[r] += da[r]; const row = m.W[r], gr = G.W[r]; for (let k = 0; k < row.length; k++) { gr[k] += da[r] * s.z[k]; dz[k] += da[r] * row[k]; } }
      dh = dz.slice(m.D); dc = dcn; }
    return L / st.length;
  }
  function zeros(m) { return { W: m.W.map(function (r) { return r.map(function () { return 0; }); }), b: m.b.map(function () { return 0; }), V: m.V.map(function () { return 0; }), c: 0 }; }
  function adam(m, G, n, lr) {                        // Adam 갱신 / Adam update
    if (!m.opt) m.opt = { t: 0, m: zeros(m), v: zeros(m) }; const O = m.opt; O.t++; const b1 = .9, b2 = .999, c1 = 1 - Math.pow(b1, O.t), c2 = 1 - Math.pow(b2, O.t);
    const up = function (P, g, M, V, k) { const gg = Math.max(-5, Math.min(5, g / n)); M[k] = b1 * M[k] + (1 - b1) * gg; V[k] = b2 * V[k] + (1 - b2) * gg * gg; P[k] -= lr * (M[k] / c1) / (Math.sqrt(V[k] / c2) + 1e-8); };
    for (let r = 0; r < m.W.length; r++) for (let k = 0; k < m.W[r].length; k++) up(m.W[r], G.W[r][k], O.m.W[r], O.v.W[r], k);
    for (let k = 0; k < m.b.length; k++) up(m.b, G.b[k], O.m.b, O.v.b, k); for (let k = 0; k < m.V.length; k++) up(m.V, G.V[k], O.m.V, O.v.V, k);
    const cc = [m.c], gc = [G.c], mc = [O.m.c || 0], vc = [O.v.c || 0]; up(cc, gc[0], mc, vc, 0); m.c = cc[0]; O.m.c = mc[0]; O.v.c = vc[0];
  }
  // ---- 순간 모델(로지스틱) / moment model ----
  function logInit(D) { return { w: new Array(D).fill(0), b: 0 }; }
  function logStep(m, data, lr) { const g = new Array(m.w.length).fill(0); let gb = 0, n = 0, L = 0; data.forEach(function (h) { h.X.forEach(function (x, t) { let z = m.b; for (let k = 0; k < x.length; k++) z += m.w[k] * x[k]; const p = sg(z), e = p - h.y[t]; L -= h.y[t] ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9); for (let k = 0; k < x.length; k++) g[k] += e * x[k]; gb += e; n++; }); });
    if (!m.opt) m.opt = { t: 0, m: new Array(m.w.length + 1).fill(0), v: new Array(m.w.length + 1).fill(0) }; const O = m.opt; O.t++; const c1 = 1 - Math.pow(.9, O.t), c2 = 1 - Math.pow(.999, O.t);
    g.concat([gb]).forEach(function (gg, k) { gg /= n; O.m[k] = .9 * O.m[k] + .1 * gg; O.v[k] = .999 * O.v[k] + .001 * gg * gg; const d = lr * (O.m[k] / c1) / (Math.sqrt(O.v[k] / c2) + 1e-8); if (k < m.w.length) m.w[k] -= d; else m.b -= d; }); return L / n; }
  const logPred = function (m, X) { return X.map(function (x) { let z = m.b; for (let k = 0; k < x.length; k++) z += m.w[k] * x[k]; return sg(z); }); };
  // ---- 실험 / experiment ----
  function create(seed) {
    const s = seed || 7, tr = makeData(s, 160), te = makeData(s + 1000, 80), r = QP.Sim.rng(s + 5), H = 8;
    const pack = function (d, q) { return d.map(function (h) { return { X: h.x.map(function (x) { return feats(x, q); }), y: h.y, S: h.S, F: h.F, raw: h.x }; }); };
    const E = { seed: s, H: H, train: { c: pack(tr, false), q: pack(tr, true) }, test: { c: pack(te, false), q: pack(te, true) }, ep: 0, loss: { now: [], lc: [], lq: [] }, lr: .03, bs: 16, r: r };
    E.now = logInit(4); E.lc = lstmInit(4, H, QP.Sim.rng(s + 11)); E.lq = lstmInit(6, H, QP.Sim.rng(s + 11)); // ②③은 같은 씨앗으로 시작 / same seed for both LSTMs
    E.pos = tr.reduce(function (a, h) { return a + h.y.reduce(function (x, y) { return x + y; }, 0); }, 0) / (tr.length * T);
    return E;
  }
  function epoch(E) {                                 // 한 바퀴(미니배치 16개씩 10번) / one epoch
    const idx = E.train.c.map(function (_, k) { return k; }); for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(E.r() * (k + 1)); const t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
    let Lc = 0, Lq = 0, Ln = 0, nb = 0;
    for (let b = 0; b < idx.length; b += E.bs) { const B = idx.slice(b, b + E.bs);
      [["lc", "c"], ["lq", "q"]].forEach(function (p) { const m = E[p[0]], G = zeros(m); let L = 0; B.forEach(function (k) { const h = E.train[p[1]][k]; L += lstmGrad(m, h.X, h.y, G); }); adam(m, G, B.length, E.lr); if (p[0] === "lc") Lc += L / B.length; else Lq += L / B.length; });
      Ln += logStep(E.now, B.map(function (k) { return E.train.c[k]; }), E.lrNow || .1); nb++; }   // 순간 모델도 같은 미니배치, 같은 횟수로 갱신(공정) / same minibatches and number of updates
    Ln /= nb;
    E.ep++; E.loss.lc.push(Lc / nb); E.loss.lq.push(Lq / nb); E.loss.now.push(Ln); return E;
  }
  function auc(ps, ys) { const P = [], N = []; ps.forEach(function (p, k) { (ys[k] ? P : N).push(p); }); if (!P.length || !N.length) return .5; let s = 0; P.forEach(function (a) { N.forEach(function (b) { s += a > b ? 1 : a === b ? .5 : 0; }); }); return s / (P.length * N.length); }
  function predict(E, which, h) { return which === "now" ? logPred(E.now, E.test.c[h].X) : lstmFwd(E[which], E.test[which === "lq" ? "q" : "c"][h].X).map(function (s) { return s.p; }); }
  function evaluate(E, fpr) {                         // 시험 채점 / scoring on the test hikes
    fpr = fpr || .1; const out = {};
    ["now", "lc", "lq"].forEach(function (w) {
      const P = E.test.c.map(function (_, h) { return predict(E, w, h); }), ps = [], ys = [], neg = [];
      P.forEach(function (p, h) { p.forEach(function (v, t) { ps.push(v); ys.push(E.test.c[h].y[t]); if (!E.test.c[h].y[t]) neg.push(v); }); });
      neg.sort(function (a, b) { return b - a; }); const thr = neg[Math.max(0, Math.floor(neg.length * fpr) - 1)];   // 정상 구간의 10%만 경보가 울리는 문턱 / threshold at 10% false alarms on normal steps
      let ev = 0, hit = 0, lead = 0, fa = 0, nf = 0, tp = 0, np = 0;
      P.forEach(function (p, h) { const y = E.test.c[h].y; p.forEach(function (v, t) { if (y[t]) { np++; if (v > thr) tp++; } }); const on = y.indexOf(1);
        if (on < 0) { nf++; if (p.some(function (v) { return v > thr; })) fa++; return; } ev++; const off = y.lastIndexOf(1), from = Math.max(0, on - 3);   // 사건 30분 전부터 끝까지 사이의 첫 경보 / first alarm from 30 min before onset to the end
        let first = -1; for (let t = from; t <= off; t++) if (p[t] > thr) { first = t; break; } if (first >= 0) { hit++; lead += (on - first) * 10; } });
      out[w] = { auc: auc(ps, ys), thr: thr, stepRecall: np ? tp / np : 0, recall: ev ? hit / ev : 0, lead: hit ? lead / hit : 0, events: ev, hits: hit, faHikes: fa, calm: nf, P: P };
    });
    return out;
  }
  function memory(E, which, h) { return lstmFwd(E[which], E.test[which === "lq" ? "q" : "c"][h].X).map(function (s) { return s.c.reduce(function (a, v) { return a + Math.abs(v); }, 0) / s.c.length; }); } // 기억 띠(셀 상태) 크기 / size of the cell state
  QP.LSTMLab = { memory: memory, create: create, epoch: epoch, evaluate: evaluate, predict: predict, T: T, NAMES: NAMES, NAMES_EN: NAMES_EN };
})(window.QP = window.QP || {});
