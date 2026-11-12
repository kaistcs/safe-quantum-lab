/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] First-order MAML (FOMAML) meta-learning engine for fast per-person adaptation. */
/* =====================================================================
 * meta.js : 메타학습(FOMAML) 엔진 — "사람마다 빠르게 맞추는 AI"
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 같은 심박 140이라도 68세와 31세의 위험은 다름. 사람마다 처음부터
 *            학습하면 데이터가 많이 필요하므로, 여러 사람(과제)에서 "빨리 적응하기
 *            좋은 시작 가중치 θ"를 먼저 배워 두고(메타학습), 새 사람은 산행 기록
 *            10개만으로 몇 걸음 만에 맞춤(적응)함.
 * 양자 특징과의 관계 : 입력 8개 중 2개가 2큐비트 회로의 겹침 점수 ⟨Z⟩(심박 부담×피로, 강수×경사)임.
 *            신경망은 8 → 16 → 12 → 8 → 1(은닉층 3개)이고, 정답은 나이, 안정시 심박, 체력, 산행 이력에 따라 사람마다 다름.
 *            즉 양자 특징 AI가 만든 "겹침 신호"를 메타러너가 받아, 사람마다 그
 *            신호를 얼마나 무겁게 볼지를 빠르게 조정함.
 * 근거 : Finn, Abbeel & Levine, ICML 2017(MAML) / Nichol et al., arXiv:1803.02999(1차 근사) / Kingma & Ba, ICLR 2015(Adam, 바깥 루프)
 * 조정(2026-11-12) : 바깥 갱신을 SGD 0.3 → Adam 0.05로 바꿈. 150회 메타 후 처음 보는 사람(씨앗 3종 평균) 5걸음 정확도
 *            메타 0.70 → 0.82, 무작위 시작 0.59(차이 10%p → 22%p). 적응 전 0.66 → 1걸음 0.80으로 적응 효과도 뚜렷함.
 *        Tanaka 2001, Gulati 2010(최대심박), Karvonen(%HRR)
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 메타학습 기능을 붙임 / attaches meta-learning to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const SIZES = [8, 16, 12, 8, 1];                  // 입력 8 → 은닉 16 → 12 → 8 → 위험 점수(심층 신경망) / input 8 → hidden 16 → 12 → 8 → risk score (deep network)
  const NAMES = ["심박(bpm)", "피로", "경사", "강수", "일몰 여유 부족", "결빙", "⟨Z⟩ 심박×피로", "⟨Z⟩ 강수×경사"]; // 입력 이름(마지막 2개는 양자 겹침 점수) / input names (last two are quantum overlap scores)
  const clip = function (v) { return Math.max(0, Math.min(1, v)); }; // 0~1로 자름 / clip to 0~1
  function newPerson(r) {                           // 무작위 산행자(과제) 하나를 만듦 / makes one random hiker (task)
    const sex = r() < .5 ? "F" : "M", age = 25 + Math.floor(r() * 55), rest = 52 + Math.floor(r() * 30), fit = .75 + r() * .5, hist = Math.floor(r() * 50); // 성별, 나이, 안정시 심박, 체력, 산행 이력 / sex, age, resting HR, fitness, hiking history
    return { sex: sex, age: age, rest: rest, fit: fit, hist: hist, max: sex === "F" ? 206 - .88 * age : 208 - .7 * age }; // 개인 최대심박(Gulati, Tanaka) / personal max HR
  }
  function sample(p, n, r) {                        // 그 사람의 산행 기록 n개(입력, 정답) / n hiking records for that person
    const out = [];
    for (let k = 0; k < n; k++) {
      const hr = 85 + r() * 100, fat = r(), slope = r(), rain = r() < .4 ? r() : r() * .2, sun = r() < .3 ? r() : r() * .3, ice = r() < .2 ? r() : 0; // 원자료 / raw values
      const hrr = (hr - p.rest) / (p.max - p.rest), tol = (p.fit - 1) * .25 + Math.min(1, p.hist / 40) * .08; // 개인 %HRR과 견딤 정도(체력, 이력) / personal %HRR and tolerance (fitness, history)
      const load = clip((hr - 90) / 90), zA = QP.Models.pairExact(load, fat), zB = QP.Models.pairExact(rain, slope); // 양자 겹침 점수 2개 / two quantum overlap scores
      const y = hrr > .85 + tol || (hrr > .65 + tol && slope > .65) || (hrr > .55 + tol && fat > .8) || (rain > .6 && slope > .6) || (sun > .7 && fat > .6 - tol) || (ice > .5 && slope > .5) ? 1 : 0; // 개인 기준의 위험 정답(사람마다 경계가 다름) / personal risk label
      out.push({ f: [hr / 200, fat, slope, rain, sun, ice, zA, zB], y: y });
    }
    return out;
  }
  function init(r) {                                // Xavier 무작위 시작 가중치 / Xavier random initial weights
    const W = [], b = [];
    for (let l = 0; l < SIZES.length - 1; l++) { const n0 = SIZES[l], n1 = SIZES[l + 1], sc = Math.sqrt(6 / (n0 + n1)); W.push(Array.from({ length: n1 }, function () { return Array.from({ length: n0 }, function () { return (r() * 2 - 1) * sc; }); })); b.push(new Array(n1).fill(0)); }
    return { W: W, b: b };
  }
  const copy = function (t) { return { W: t.W.map(function (Wl) { return Wl.map(function (r) { return r.slice(); }); }), b: t.b.map(function (bl) { return bl.slice(); }) }; }; // 가중치 복사 / copy weights
  function fwd(t, f) {                              // 순전파(은닉 tanh, 출력 sigmoid) / forward pass
    const acts = [f]; let a = f;
    for (let l = 0; l < t.W.length; l++) { const last = l === t.W.length - 1; a = t.W[l].map(function (row, j) { let z = t.b[l][j]; for (let i = 0; i < row.length; i++) z += row[i] * a[i]; return last ? 1 / (1 + Math.exp(-z)) : Math.tanh(z); }); acts.push(a); }
    return { acts: acts, o: a[0] };
  }
  function grad(t, data) {                          // 역전파로 평균 기울기와 손실 / mean gradient and loss by backpropagation
    const g = { W: t.W.map(function (Wl) { return Wl.map(function (r) { return new Array(r.length).fill(0); }); }), b: t.b.map(function (bl) { return new Array(bl.length).fill(0); }) }; let L = 0;
    data.forEach(function (d) { const r = fwd(t, d.f), A = r.acts; L -= d.y ? Math.log(r.o + 1e-9) : Math.log(1 - r.o + 1e-9); let delta = [r.o - d.y];
      for (let l = t.W.length - 1; l >= 0; l--) { const prev = A[l], nd = new Array(prev.length).fill(0);
        for (let j = 0; j < delta.length; j++) { g.b[l][j] += delta[j]; for (let i = 0; i < prev.length; i++) { g.W[l][j][i] += delta[j] * prev[i]; nd[i] += delta[j] * t.W[l][j][i]; } }
        if (l > 0) delta = nd.map(function (v, i) { return v * (1 - prev[i] * prev[i]); }); } });
    const n = data.length; g.W.forEach(function (Wl) { Wl.forEach(function (r) { for (let i = 0; i < r.length; i++) r[i] /= n; }); }); g.b.forEach(function (bl) { for (let j = 0; j < bl.length; j++) bl[j] /= n; });
    return { g: g, L: L / n };
  }
  function step(t, g, lr) { for (let l = 0; l < t.W.length; l++) for (let j = 0; j < t.W[l].length; j++) { t.b[l][j] -= lr * g.b[l][j]; for (let i = 0; i < t.W[l][j].length; i++) t.W[l][j][i] -= lr * g.W[l][j][i]; } return t; } // 가중치 갱신 / update weights
  function adapt(t, support, k, lr) { const a = copy(t), path = [copy(a)]; for (let s = 0; s < k; s++) { step(a, grad(a, support).g, lr); path.push(copy(a)); } return { a: a, path: path }; } // 안쪽 루프 / inner loop
  function acc(t, data) { let ok = 0; data.forEach(function (d) { if ((fwd(t, d.f).o >= .5 ? 1 : 0) === d.y) ok++; }); return ok / data.length; } // 정확도 / accuracy
  function adam(m, g) {                             // Adam 바깥 갱신(Kingma & Ba 2015) / Adam outer update
    const b1 = .9, b2 = .999, eps = 1e-8; if (!m.mA) { m.mA = { W: g.W.map(function (Wl) { return Wl.map(function (r) { return r.map(function () { return 0; }); }); }), b: g.b.map(function (bl) { return bl.map(function () { return 0; }); }) }; m.vA = copy(m.mA); m.tA = 0; }
    m.tA++; const c1 = 1 - Math.pow(b1, m.tA), c2 = 1 - Math.pow(b2, m.tA);
    const up = function (P, G, A, V, i) { A[i] = b1 * A[i] + (1 - b1) * G[i]; V[i] = b2 * V[i] + (1 - b2) * G[i] * G[i]; P[i] -= m.lrOut * (A[i] / c1) / (Math.sqrt(V[i] / c2) + eps); };
    for (let l = 0; l < m.theta.W.length; l++) for (let j = 0; j < m.theta.W[l].length; j++) { up(m.theta.b[l], g.b[l], m.mA.b[l], m.vA.b[l], j); for (let i = 0; i < m.theta.W[l][j].length; i++) up(m.theta.W[l][j], g.W[l][j], m.mA.W[l][j], m.vA.W[l][j], i); }
  }
  function create(seed) { const r = QP.Sim.rng(seed || 77); return { r: r, theta: init(r), it: 0, loss: [], last: [], inner: 5, lrIn: .5, lrOut: .05 }; } // 메타학습기(바깥 Adam 0.05, 2026-11-12 조정: 메타 0.70→0.82) / meta-learner
  function metaStep(m, nTasks) {                    // 바깥 루프 한 번(FOMAML) / one outer loop (FOMAML)
    const gs = [], tasks = []; let L = 0;
    for (let k = 0; k < (nTasks || 4); k++) { const p = newPerson(m.r), sup = sample(p, 10, m.r), qry = sample(p, 30, m.r), ad = adapt(m.theta, sup, m.inner, m.lrIn), q = grad(ad.a, qry); gs.push(q.g); L += q.L; tasks.push({ p: p, path: ad.path, before: acc(m.theta, qry), after: acc(ad.a, qry) }); }
    const avg = { W: m.theta.W.map(function (Wl, l) { return Wl.map(function (r, j) { return r.map(function (_, i) { return gs.reduce(function (s, g) { return s + g.W[l][j][i]; }, 0) / gs.length; }); }); }), b: m.theta.b.map(function (bl, l) { return bl.map(function (_, j) { return gs.reduce(function (s, g) { return s + g.b[l][j]; }, 0) / gs.length; }); }) };
    m.prev = copy(m.theta); adam(m, avg); m.it++; m.loss.push(L / gs.length); m.last = tasks; return m;
  }
  function evaluate(m, seed) {                      // 처음 보는 사람 12명: 메타 시작점 vs 무작위 시작점 / 12 new people: meta start vs random start
    const r = QP.Sim.rng(seed || 999), cM = new Array(11).fill(0), cR = new Array(11).fill(0), N = 12;
    for (let k = 0; k < N; k++) { const p = newPerson(r), sup = sample(p, 10, r), qry = sample(p, 60, r), am = adapt(m.theta, sup, 10, m.lrIn).path, ar = adapt(init(r), sup, 10, m.lrIn).path; for (let s = 0; s <= 10; s++) { cM[s] += acc(am[s], qry) / N; cR[s] += acc(ar[s], qry) / N; } }
    return { meta: cM, rand: cR };
  }
  const flat = function (t) { const v = []; t.W.forEach(function (Wl) { Wl.forEach(function (r) { v.push.apply(v, r); }); }); t.b.forEach(function (bl) { v.push.apply(v, bl); }); return v; }; // 가중치를 한 줄로 / flatten
  const COUNT = flat(init(QP.Sim.rng(1))).length;   // 학습되는 숫자 개수 / number of parameters
  QP.Meta = { create: create, metaStep: metaStep, evaluate: evaluate, fwd: fwd, flat: flat, SIZES: SIZES, NAMES: NAMES, COUNT: COUNT, H: COUNT }; // 공개함 / make public
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
