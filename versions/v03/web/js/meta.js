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
 * 양자 특징과의 관계 : 입력 3개 중 하나가 2큐비트 회로의 겹침 점수 ⟨Z⟩(심박 부담×피로)임.
 *            즉 양자 특징 AI가 만든 "겹침 신호"를 메타러너가 받아, 사람마다 그
 *            신호를 얼마나 무겁게 볼지를 빠르게 조정함.
 * 근거 : Finn, Abbeel & Levine, ICML 2017(MAML) / Nichol et al., arXiv:1803.02999(1차 근사)
 *        Tanaka 2001, Gulati 2010(최대심박), Karvonen(%HRR)
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 메타학습 기능을 붙임 / attaches meta-learning to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const H = 6;                                      // 은닉 뉴런 수임 / number of hidden neurons
  const clip = function (v) { return Math.max(0, Math.min(1, v)); }; // 0~1로 자름 / clip to 0~1
  function newPerson(r) {                           // 무작위 산행자(과제) 하나를 만듦 / makes one random hiker (task)
    const sex = r() < .5 ? "F" : "M", age = 25 + Math.floor(r() * 55), rest = 52 + Math.floor(r() * 30); // 성별, 나이, 안정시 심박임 / sex, age, resting HR
    return { sex: sex, age: age, rest: rest, max: sex === "F" ? 206 - .88 * age : 208 - .7 * age }; // 개인 최대심박(Gulati, Tanaka)임 / personal max HR (Gulati, Tanaka)
  }
  function sample(p, n, r) {                        // 그 사람의 산행 기록 n개(입력, 정답)를 만듦 / makes n hiking records (input, label) for that person
    const out = [];                                 // 결과 목록임 / result list
    for (let k = 0; k < n; k++) {                   // n번 반복함 / repeat n times
      const hr = 85 + r() * 100, slope = r() * .45, fat = r(); // 심박(bpm), 경사, 피로임 / heart rate (bpm), slope, fatigue
      const hrr = (hr - p.rest) / (p.max - p.rest); // 개인 심박예비율(정답 계산에만 씀, 입력에는 없음)임 / personal HR reserve (used only for the label, not an input)
      const load = clip((hr - 90) / 90);            // 모두에게 같은 기준으로 잰 심박 부담(개인차 반영 안 됨)임 / heart-rate load on a common scale for everyone (no personal difference)
      const z = QP.Models.pairExact(load, fat);     // 2큐비트 회로 겹침 점수(심박 부담 × 피로)임 / 2-qubit circuit overlap score (heart-rate load × fatigue)
      const y = hrr > .85 || (hrr > .65 && slope > .3) || (hrr > .55 && fat > .8) ? 1 : 0; // 개인 기준의 위험 정답(사람마다 경계가 다름)임 / risk label by the personal standard (boundary differs per person)
      out.push({ f: [hr / 200, slope / .45, z], y: y }); // 입력 3개(심박, 경사, 양자 겹침 점수)와 정답임 / three inputs (heart rate, slope, quantum overlap score) and the label
    }
    return out;                                     // 기록을 돌려줌 / return the records
  }
  function init(r) {                                // 무작위 시작 가중치임 / random starting weights
    const g = function () { return (r() - .5) * 1.2; }; // 작은 무작위 값임 / small random value
    return { W1: Array.from({ length: H }, function () { return [g(), g(), g()]; }), b1: new Array(H).fill(0), W2: Array.from({ length: H }, g), b2: 0 }; // 3→6→1 신경망임 / 3→6→1 network
  }
  const copy = function (t) { return { W1: t.W1.map(function (r) { return r.slice(); }), b1: t.b1.slice(), W2: t.W2.slice(), b2: t.b2 }; }; // 가중치 복사임 / copy the weights
  function fwd(t, f) {                              // 순전파임 / forward pass
    const h = t.W1.map(function (w, j) { return Math.tanh(w[0] * f[0] + w[1] * f[1] + w[2] * f[2] + t.b1[j]); }); // 은닉값임 / hidden values
    let z = t.b2; for (let j = 0; j < H; j++) z += t.W2[j] * h[j]; // 출력 합임 / output sum
    return { h: h, o: 1 / (1 + Math.exp(-z)) };     // 은닉값과 위험 점수임 / hidden values and risk score
  }
  function grad(t, data) {                          // 평균 기울기와 손실을 구함(역전파) / mean gradient and loss (backpropagation)
    const g = { W1: t.W1.map(function () { return [0, 0, 0]; }), b1: new Array(H).fill(0), W2: new Array(H).fill(0), b2: 0 }; let L = 0; // 누적 변수임 / accumulator
    data.forEach(function (d) { const r = fwd(t, d.f), e = r.o - d.y; L -= d.y ? Math.log(r.o + 1e-9) : Math.log(1 - r.o + 1e-9); g.b2 += e; for (let j = 0; j < H; j++) { g.W2[j] += e * r.h[j]; const dh = e * t.W2[j] * (1 - r.h[j] * r.h[j]); g.b1[j] += dh; for (let i = 0; i < 3; i++) g.W1[j][i] += dh * d.f[i]; } }); // 표본마다 기울기를 더함 / add the gradient per sample
    const n = data.length; g.b2 /= n; g.W2 = g.W2.map(function (v) { return v / n; }); g.b1 = g.b1.map(function (v) { return v / n; }); g.W1 = g.W1.map(function (r) { return r.map(function (v) { return v / n; }); }); // 평균을 냄 / take the average
    return { g: g, L: L / n };                      // 기울기와 손실임 / gradient and loss
  }
  function step(t, g, lr) {                         // 기울기 방향으로 가중치를 고침 / updates the weights along the gradient
    t.b2 -= lr * g.b2; for (let j = 0; j < H; j++) { t.W2[j] -= lr * g.W2[j]; t.b1[j] -= lr * g.b1[j]; for (let i = 0; i < 3; i++) t.W1[j][i] -= lr * g.W1[j][i]; } // 모든 가중치를 고침 / update every weight
    return t;                                       // 고친 가중치임 / updated weights
  }
  function adapt(t, support, k, lr) {               // 안쪽 루프: 그 사람 기록으로 k걸음 적응함 / inner loop: adapt k steps with that person's records
    const a = copy(t), path = [copy(a)];            // 시작점 복사와 경로 기록임 / copy of the start and path record
    for (let s = 0; s < k; s++) { step(a, grad(a, support).g, lr); path.push(copy(a)); } // k번 고침 / update k times
    return { a: a, path: path };                    // 적응한 가중치와 경로임 / adapted weights and path
  }
  function acc(t, data) { let ok = 0; data.forEach(function (d) { if ((fwd(t, d.f).o >= .5 ? 1 : 0) === d.y) ok++; }); return ok / data.length; } // 정확도임 / accuracy
  function create(seed) {                           // 메타학습기 하나를 만듦 / creates one meta-learner
    const r = QP.Sim.rng(seed || 77);               // 고정 난수임 / fixed random generator
    return { r: r, theta: init(r), it: 0, loss: [], last: [], inner: 5, lrIn: .8, lrOut: .25 }; // 메타 가중치 θ와 기록임 / meta weights θ and records
  }
  function metaStep(m, nTasks) {                    // 바깥 루프 한 번: 사람 nTasks명에서 θ를 고침(FOMAML) / one outer loop: update θ from nTasks people (FOMAML)
    const gs = [], tasks = []; let L = 0;           // 기울기 목록, 과제 기록, 손실임 / gradient list, task records, loss
    for (let k = 0; k < (nTasks || 4); k++) {       // 사람마다 / for each person
      const p = newPerson(m.r), sup = sample(p, 10, m.r), qry = sample(p, 30, m.r); // 적응용 10개, 평가용 30개 기록임 / 10 records for adaptation, 30 for evaluation
      const ad = adapt(m.theta, sup, m.inner, m.lrIn); // 안쪽 루프 적응임 / inner-loop adaptation
      const q = grad(ad.a, qry); gs.push(q.g); L += q.L; // 적응한 가중치로 평가 기울기(1차 근사)를 구함 / evaluation gradient at the adapted weights (first-order approximation)
      tasks.push({ p: p, path: ad.path, before: acc(m.theta, qry), after: acc(ad.a, qry) }); // 그림용 기록임 / record for drawing
    }
    const avg = gs.reduce(function (s, g) { s.b2 += g.b2 / gs.length; for (let j = 0; j < H; j++) { s.W2[j] += g.W2[j] / gs.length; s.b1[j] += g.b1[j] / gs.length; for (let i = 0; i < 3; i++) s.W1[j][i] += g.W1[j][i] / gs.length; } return s; }, { W1: m.theta.W1.map(function () { return [0, 0, 0]; }), b1: new Array(H).fill(0), W2: new Array(H).fill(0), b2: 0 }); // 사람들 기울기의 평균임 / average of the people's gradients
    m.prev = copy(m.theta); step(m.theta, avg, m.lrOut); m.it++; m.loss.push(L / gs.length); m.last = tasks; // θ를 평균 방향으로 고침(바깥 루프) / move θ along the average (outer loop)
    return m;                                       // 메타학습기임 / the meta-learner
  }
  function evaluate(m, seed) {                      // 처음 보는 사람에서 "메타 시작점 vs 무작위 시작점" 적응 곡선을 비교함 / compares "meta start vs random start" adaptation curves on new people
    const r = QP.Sim.rng(seed || 999), curveM = new Array(11).fill(0), curveR = new Array(11).fill(0), N = 12; // 비교용 사람 12명임 / 12 people for comparison
    for (let k = 0; k < N; k++) { const p = newPerson(r), sup = sample(p, 10, r), qry = sample(p, 60, r); const am = adapt(m.theta, sup, 10, m.lrIn).path, ar = adapt(init(r), sup, 10, m.lrIn).path; for (let s = 0; s <= 10; s++) { curveM[s] += acc(am[s], qry) / N; curveR[s] += acc(ar[s], qry) / N; } } // 걸음 수별 정확도를 평균함 / average accuracy per step count
    return { meta: curveM, rand: curveR };          // 두 곡선임 / the two curves
  }
  QP.Meta = { create: create, metaStep: metaStep, evaluate: evaluate, fwd: fwd, H: H }; // 공개함 / make public
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
