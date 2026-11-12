/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* =====================================================================
 * models.js : 특징 만들기, AI 학습(로지스틱 회귀), 성능 시험, VQC
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : "양자 회로를 쓴 AI"와 "일반 AI"를 같은 데이터, 같은
 *            학습 방법, 같은 오경보 예산으로 공정하게 비교하기 위함임.
 * 하는 일   :
 *  (1) 특징 변환 : 일반(원래 값) / 양자 회로(정확 판독) / 양자 회로
 *      (샷 측정, 실제 장비 흉내) / 일반 수식 대조군(cos 곱)
 *  (2) 학습     : 세 방식 모두 같은 로지스틱 회귀 가중치를 학습함
 *      → 회로는 "고정된 특징 변환기", 학습은 AI 분류기가 담당함
 *  (3) VQC     : 회로의 회전 각도 자체를 학습하는 "변분 양자 회로"
 *      → 양자 회로도 학습할 수 있다는 것을 보여 주는 실험임
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 모델 기능을 붙임
  "use strict";                                     // 엄격 모드를 켬
  const S = QP.Sim, D = QP.Data;                    // 에뮬레이터와 데이터 모듈을 짧은 이름으로 씀

  /* ---------- 1. 2큐비트 "겹침 감지" 회로 ---------- */
  // 두 신호 a, b(0~1)를 받아 RY 회전 → CNOT → 둘째 큐비트 판독을 수행함
  function pairCircuit(a, b) {
    const s = S.createState(2);                     // 2큐비트(진폭 4개) 상태를 |00>으로 만듦
    S.ry(s, 0, Math.PI * a);                        // 첫 신호를 첫 큐비트의 회전 각도로 넣음(값이 클수록 1에 가까워짐)
    S.ry(s, 1, Math.PI * b);                        // 둘째 신호를 둘째 큐비트의 회전 각도로 넣음
    S.cx(s, 0, 1);                                  // 첫 큐비트가 1이면 둘째 큐비트를 뒤집어 두 신호를 "얽음"
    return s;                                       // 판독 전 상태를 돌려줌
  }
  function pairExact(a, b) {                        // 샷 없이 정확히 읽은 결합 특징 <Z1>임
    return S.expectZ(pairCircuit(a, b), 1);         // 둘째 큐비트의 P(0)-P(1)을 특징값으로 씀
  }
  function pairAnalytic(a, b) {                     // 같은 값을 일반 수식으로 계산한 대조군임
    return Math.cos(Math.PI * a) * Math.cos(Math.PI * b); // 이 작은 회로는 cos 곱과 수학적으로 같음
  }

  /* ---------- 2. 방식별 특징 만들기 ---------- */
  // method: "linear" | "quantum" | "analytic" | "shots"
  function features(x, method, ctx) {
    const base = x.filter(function (_, i) { return !D.exclusions.has(i); }); // 즉시 규칙 신호 4개를 뺀 16개를 기본 입력으로 씀
    if (method === "linear") return base;           // 일반 AI는 원래 값 16개만 받음
    const extra = D.pairs.map(function (p) {        // 6개 신호 쌍마다 결합 특징을 하나씩 만듦
      const a = x[p[0]], b = x[p[1]];               // 쌍의 두 신호 값을 꺼냄
      if (method === "analytic") return pairAnalytic(a, b); // 대조군은 수식으로 계산함
      const z = pairExact(a, b);                    // 양자 회로를 에뮬레이터로 실행함
      if (method === "shots" && ctx && ctx.shots) { // 샷 모드면 실제 장비처럼 유한 번 측정함
        const p1 = (1 - z) / 2;                     // <Z>를 P(1)로 되돌림
        let est = S.sampleProb(p1, ctx.shots, ctx.rand); // shots번 측정한 추정 확률을 얻음
        if (ctx.noise) est = est * (1 - ctx.noise) + ctx.noise * 0.5; // 장비 잡음(탈분극)이 있으면 0.5쪽으로 흐려짐
        return 1 - 2 * est;                         // 다시 <Z> 형태로 바꿔 특징값으로 씀
      }
      return z;                                     // 정확 판독값을 그대로 씀
    });
    return base.concat(extra);                      // 원래 16개 + 결합 6개 = 22개 특징을 돌려줌
  }

  /* ---------- 3. 로지스틱 회귀 (모든 방식이 공통으로 쓰는 AI) ---------- */
  const sigmoid = function (z) { return 1 / (1 + Math.exp(-z)); }; // 아무 숫자를 0~1 확률로 바꾸는 함수임
  function scoreW(w, f) {                           // 가중치 w와 특징 f로 위험 점수를 계산함
    let z = w[0];                                   // 절편(기본값)에서 시작함
    for (let i = 0; i < f.length; i++) z += w[i + 1] * f[i]; // 특징마다 가중치를 곱해 더함
    return sigmoid(z);                              // 0~1 위험 점수로 바꿔 돌려줌
  }
  function fitRows(rows, epochs, lr, l2) {          // 특징 행렬로 가중치를 학습함(경사하강법)
    const w = new Array(rows[0].f.length + 1).fill(0); // 모든 가중치를 0에서 시작함(공정 비교)
    const loss = [];                                // 학습 곡선을 기록할 배열임
    for (let e = 0; e < epochs; e++) {              // 정해진 횟수만큼 반복 학습함
      const g = new Array(w.length).fill(0); let L = 0; // 기울기 누적과 손실 누적을 준비함
      for (let r = 0; r < rows.length; r++) {       // 모든 학습 표본을 봄
        const p = scoreW(w, rows[r].f), y = rows[r].label; // 현재 예측과 정답임
        const err = p - y;                          // 예측 오차(교차엔트로피의 미분)임
        L -= y ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12); // 손실을 누적함
        g[0] += err;                                // 절편의 기울기를 더함
        for (let i = 0; i < rows[r].f.length; i++) g[i + 1] += err * rows[r].f[i]; // 특징별 기울기를 더함
      }
      for (let i = 0; i < w.length; i++) w[i] -= lr * (g[i] / rows.length + (i ? l2 * w[i] : 0)); // 오차가 줄어드는 쪽으로 가중치를 고침
      loss.push(L / rows.length);                   // 평균 손실을 기록함
    }
    return { w: w, loss: loss };                    // 학습된 가중치와 학습 곡선을 돌려줌
  }
  function fit(samples, method, ctx) {              // 원시 표본으로 방식별 모델을 학습함
    const rows = samples.map(function (s) { return { f: features(s.x, method, ctx), label: s.label }; }); // 특징을 미리 계산함
    const r = fitRows(rows, 160, .65, .004);        // 세 방식에 같은 학습 횟수, 학습률, 규제를 씀
    const predict = function (x, c) { return scoreW(r.w, features(x, method, c || ctx)); }; // 새 입력의 점수를 내는 함수임
    return { predict: predict, w: r.w, loss: r.loss }; // 예측 함수, 가중치, 학습 곡선을 돌려줌
  }

  /* ---------- 4. 공정한 경보 기준과 성적 ---------- */
  function cutoff(valid, predict) {                 // 검증 정상 표본의 약 10%만 경보가 나도록 기준을 정함
    const neg = valid.filter(function (r) { return !r.label; }).map(function (r) { return predict(r.x); }).sort(function (a, b) { return a - b; }); // 정상 점수를 정렬함
    return neg[Math.ceil(neg.length * .90) - 1] + 1e-9; // 상위 10% 경계값을 기준으로 씀(같은 오경보 예산)
  }
  function auc(scores, labels) {                    // ROC-AUC: 위험을 정상보다 높게 점수 매긴 비율임
    const pos = [], neg = [];                       // 위험, 정상 점수를 나눠 담음
    scores.forEach(function (s, i) { (labels[i] ? pos : neg).push(s); }); // 정답에 따라 분류함
    let win = 0;                                    // 위험 점수가 더 높은 쌍의 수임
    const sn = neg.slice().sort(function (a, b) { return a - b; }); // 정상 점수를 정렬해 빠르게 셈
    pos.forEach(function (p) {                      // 위험 표본 하나씩 봄
      let lo = 0, hi = sn.length;                   // 이분 탐색 범위임
      while (lo < hi) { const m = (lo + hi) >> 1; if (sn[m] < p) lo = m + 1; else hi = m; } // p보다 작은 정상 점수 개수를 찾음
      win += lo;                                    // 그만큼 이긴 것으로 셈
    });
    return win / (pos.length * neg.length || 1);    // 전체 쌍 중 이긴 비율임(0.5=무작위, 1=완벽)
  }
  function measure(test, predict, thr) {            // 시험 표본으로 탐지율, 오경보율, AUC를 셈
    const sc = test.map(function (r) { return predict(r.x); }); // 모든 시험 점수를 계산함
    let tp = 0, P = 0, fp = 0, N = 0;               // 맞힌 위험, 전체 위험, 잘못 울린 정상, 전체 정상 수임
    test.forEach(function (r, i) { if (r.label) { P++; if (sc[i] >= thr) tp++; } else { N++; if (sc[i] >= thr) fp++; } }); // 하나씩 집계함
    return { recall: tp / (P || 1), falseAlarm: fp / (N || 1), auc: auc(sc, test.map(function (r) { return r.label; })), P: P, N: N }; // 결과 묶음임
  }

  /* ---------- 5. 전체 비교 실험 ---------- */
  // opts: {data:{train,valid,test}, shots, noise, seed}
  function experiment(opts) {
    const o = opts || {};                           // 옵션 기본값 처리임
    const data = o.data || {                        // 데이터가 없으면 기본 합성 표본을 만듦
      train: D.sampleSet(901, 1400), valid: D.sampleSet(902, 550), test: D.sampleSet(903, 800) }; // 학습, 기준, 시험을 서로 다른 씨앗으로 분리함
    const methods = ["linear", "quantum", "analytic"]; // 기본 세 방식임
    if (o.shots) methods.push("shots");             // 샷 수가 정해지면 "실제 장비 흉내" 방식을 추가함
    return methods.map(function (m) {               // 방식마다 같은 절차를 반복함
      const ctx = m === "shots" ? { shots: o.shots, noise: o.noise || 0, rand: S.rng(o.seed || 7) } : null; // 샷 모드 전용 설정임
      const t0 = performance.now();                 // 학습 시작 시각을 기록함
      const model = fit(data.train, m, ctx);        // 모델을 학습함
      const thr = cutoff(data.valid, model.predict); // 검증 표본으로 경보 기준을 정함
      const res = measure(data.test, model.predict, thr); // 별도의 시험 표본으로 성적을 매김
      const ms = performance.now() - t0;            // 걸린 시간(밀리초)을 계산함
      return Object.assign({ key: m, predict: model.predict, threshold: thr, loss: model.loss, w: model.w, ms: ms }, res); // 결과를 묶어 돌려줌
    });
  }

  /* ---------- 6. 결정 지도 (비 × 경사 2차원) ---------- */
  // 다른 신호는 고정하고, 두 신호만 0~1로 바꿔 가며 점수를 칠해 보는 지도임
  function decisionMap(predict, i, j, base, n) {
    const g = n || 36;                              // 한 변의 칸 수임
    const grid = [];                                // 점수를 담을 2차원 배열임
    for (let r = 0; r < g; r++) {                   // 세로(j 신호) 방향 반복임
      const row = [];                               // 한 줄 점수임
      for (let c = 0; c < g; c++) {                 // 가로(i 신호) 방향 반복임
        const x = base.slice();                     // 기준 입력을 복사함
        x[i] = c / (g - 1); x[j] = 1 - r / (g - 1); // 가로는 i 신호, 세로는 j 신호(위가 높음)로 값을 바꿈
        row.push(predict(x));                       // 그 칸의 점수를 계산해 넣음
      }
      grid.push(row);                               // 한 줄을 지도에 추가함
    }
    return grid;                                    // 완성된 지도를 돌려줌
  }

  /* ---------- 7. VQC: 회로 각도를 직접 학습하는 양자 분류기 ---------- */
  // 입력(a,b) 부호화 → [학습 회전 RY(θ) 두 개 + CNOT] × 층 수 → 둘째 큐비트 <Z> → sigmoid(k·z + c)
  function vqcZ(theta, a, b, layers) {
    const s = S.createState(2);                     // 2큐비트 상태를 만듦
    S.ry(s, 0, Math.PI * a); S.ry(s, 1, Math.PI * b); // 데이터(비, 경사)를 각도로 넣음
    S.cx(s, 0, 1);                                  // 두 신호를 얽음
    for (let l = 0; l < layers; l++) {              // 학습 가능한 층을 차례로 쌓음
      S.ry(s, 0, theta[2 * l]); S.ry(s, 1, theta[2 * l + 1]); // 학습되는 회전 각도 두 개를 적용함
      S.cx(s, 0, 1);                                // 다시 얽어서 두 큐비트 정보를 섞음
      S.ry(s, 0, Math.PI * a * (l + 2) / 2);        // 데이터를 한 번 더 넣는 "재업로딩"으로 표현력을 키움
    }
    return S.expectZ(s, 1);                         // 둘째 큐비트의 기댓값(-1~1)을 출력으로 씀
  }
  function vqcCreate(layers, seed) {                // VQC 학습기 하나를 만듦
    const r = S.rng(seed || 3);                     // 초기 각도를 정할 난수임
    return { layers: layers, theta: Array.from({ length: 2 * layers }, function () { return (r() - .5) * .4; }), k: 1, c: 0, epoch: 0, loss: [] }; // 작은 무작위 각도에서 시작함
  }
  function vqcPredict(m, a, b) {                    // 학습 중인 VQC의 위험 점수임
    return sigmoid(m.k * vqcZ(m.theta, a, b, m.layers) + m.c); // 회로 출력을 0~1 점수로 바꿈
  }
  // 한 번의 학습 단계: 매개변수 이동 규칙(parameter-shift)으로 각도 기울기를 정확히 구함
  function vqcStep(m, data, lr) {
    const gT = new Array(m.theta.length).fill(0); let gk = 0, gc = 0, L = 0; // 각 기울기와 손실 누적임
    data.forEach(function (d) {                     // 학습 표본을 하나씩 봄
      const z = vqcZ(m.theta, d.a, d.b, m.layers);  // 현재 회로 출력임
      const p = sigmoid(m.k * z + m.c);             // 현재 위험 점수임
      const err = p - d.y;                          // 오차임
      L -= d.y ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12); // 손실을 누적함
      gk += err * z; gc += err;                     // 고전 후처리(k, c)의 기울기임
      for (let t = 0; t < m.theta.length; t++) {    // 각 회전 각도마다
        const plus = m.theta.slice(), minus = m.theta.slice(); // 각도를 ±90도 옮긴 복사본을 만듦
        plus[t] += Math.PI / 2; minus[t] -= Math.PI / 2; // 매개변수 이동 규칙의 두 지점임
        const dz = (vqcZ(plus, d.a, d.b, m.layers) - vqcZ(minus, d.a, d.b, m.layers)) / 2; // 실제 양자 장비에서도 쓰는 정확한 미분 공식임
        gT[t] += err * m.k * dz;                    // 연쇄 법칙으로 손실 기울기를 누적함
      }
    });
    const n = data.length;                          // 표본 수임
    for (let t = 0; t < m.theta.length; t++) m.theta[t] -= lr * gT[t] / n; // 각도를 오차가 줄어드는 쪽으로 돌림
    m.k -= lr * gk / n; m.c -= lr * gc / n;         // 후처리 값도 고침
    m.epoch++; m.loss.push(L / n);                  // 학습 횟수와 손실을 기록함
    return L / n;                                   // 이번 평균 손실을 돌려줌
  }
  function vqcData(seed, n) {                       // VQC용 2차원(비, 경사) 합성 표본을 만듦
    const r = S.rng(seed);                          // 고정 씨앗 난수임
    return Array.from({ length: n }, function () { const a = r(), b = r(); return { a: a, b: b, y: a * b > .42 ? 1 : 0 }; }); // "둘 다 높으면 위험" 규칙임
  }
  function vqcAccuracy(m, data) {                   // 정확도(0.5 기준으로 맞힌 비율)를 계산함
    let ok = 0;                                     // 맞힌 수임
    data.forEach(function (d) { if ((vqcPredict(m, d.a, d.b) >= .5 ? 1 : 0) === d.y) ok++; }); // 하나씩 채점함
    return ok / data.length;                        // 비율을 돌려줌
  }

  /* ---------- 8. 위험구역 4큐비트 회로 (세미나 자료 부록 그대로) ---------- */
  function zoneEncode(dist, quality) {              // 거리(m) 세 개와 위치 신뢰도를 0~1 입력으로 바꿈
    const scales = [120, 180, 100];                 // 위험구역, 야생동물, 낙석의 기준 거리(m)임
    if (quality < .6 || dist.some(function (d) { return d == null; })) return null; // 신뢰도가 낮거나 자료가 없으면 판독을 보류함
    return dist.map(function (d, i) { return Math.max(0, Math.min(1, 1 - d / scales[i])); }).concat([quality]); // 가까울수록 1에 가까운 값임
  }
  function zoneCircuit(x) {                         // 4큐비트(진폭 16개) 회로를 실행함
    const s = S.createState(4);                     // |0000> 상태를 만듦
    for (let q = 0; q < 4; q++) S.ry(s, q, Math.PI * x[q]); // 네 입력을 네 큐비트의 회전 각도로 넣음
    [[0, 3], [1, 3], [2, 3]].forEach(function (p) { S.cx(s, p[0], p[1]); }); // 세 위험 큐비트를 보조 큐비트 q3에 연결함
    for (let q = 0; q < 3; q++) S.ry(s, q, Math.PI * x[3] / 12); // 신뢰도만큼 약간 더 돌려 보정함
    return { state: s, p: [0, 1, 2, 3].map(function (q) { return S.probOne(s, q); }) }; // 상태와 큐비트별 P(1)을 돌려줌
  }
  function zoneAssess(dist, quality, closed) {      // 정책 우선 → 부호화 → 회로 순서로 판단함
    if (closed) return { action: "block_route" };   // 공식 통제면 회로를 돌리지 않고 바로 제외함
    const x = zoneEncode(dist, quality);            // 입력을 부호화함
    if (!x) return { action: "check_sources" };     // 자료가 부족하면 출처 확인을 요청함
    const r = zoneCircuit(x);                       // 회로를 실행함
    return { action: "score_only", classical: x.slice(0, 3), quantum: r.p.slice(0, 3), ancilla: r.p[3], state: r.state, x: x }; // 고전, 양자 값을 함께 돌려줌
  }

  // 위 기능을 QP.Models로 공개함
  QP.Models = { pairCircuit, pairExact, pairAnalytic, features, fit, fitRows, cutoff, measure, auc, experiment, decisionMap,
                vqcCreate, vqcPredict, vqcStep, vqcData, vqcAccuracy, vqcZ, zoneEncode, zoneCircuit, zoneAssess, sigmoid };
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김
