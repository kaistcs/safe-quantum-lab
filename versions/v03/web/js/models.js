/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Feature builders (quantum overlap, analytic, product, ZZ), logistic regression, fair thresholds, metrics, DNN and VQC. */
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
(function (QP) {                                    // QP 이름공간에 모델 기능을 붙임 / attaches model functions to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const S = QP.Sim, D = QP.Data;                    // 에뮬레이터와 데이터 모듈을 짧은 이름으로 씀 / short names for the emulator and data modules

  /* ---------- 1. 2큐비트 "겹침 감지" 회로 / 1. 2-qubit "overlap detection" circuit  ---------- */
  // 두 신호 a, b(0~1)를 받아 RY 회전 → CNOT → 둘째 큐비트 판독을 수행함 / takes two signals a, b (0~1) and runs RY rotation → CNOT → readout of the second qubit
  function pairCircuit(a, b) {
    const s = S.createState(2);                     // 2큐비트(진폭 4개) 상태를 |00>으로 만듦 / make a 2-qubit (4 amplitudes) state |00>
    S.ry(s, 0, Math.PI * a);                        // 첫 신호를 첫 큐비트의 회전 각도로 넣음(값이 클수록 1에 가까워짐) / put the first signal in as the first qubit's angle (bigger → closer to 1)
    S.ry(s, 1, Math.PI * b);                        // 둘째 신호를 둘째 큐비트의 회전 각도로 넣음 / put the second signal in as the second qubit's angle
    S.cx(s, 0, 1);                                  // 첫 큐비트가 1이면 둘째 큐비트를 뒤집어 두 신호를 "얽음" / if the first qubit is 1, flip the second to "entangle" the two signals
    return s;                                       // 판독 전 상태를 돌려줌 / return the state before readout
  }
  function pairExact(a, b) {                        // 샷 없이 정확히 읽은 결합 특징 <Z1>임 / combined feature <Z1> read exactly without shots
    return S.expectZ(pairCircuit(a, b), 1);         // 둘째 큐비트의 P(0)-P(1)을 특징값으로 씀 / use P(0)-P(1) of the second qubit as the feature
  }
  function pairAnalytic(a, b) {                     // 같은 값을 일반 수식으로 계산한 대조군임 / control computing the same value with an ordinary formula
    return Math.cos(Math.PI * a) * Math.cos(Math.PI * b); // 이 작은 회로는 cos 곱과 수학적으로 같음 / this small circuit is mathematically equal to the cos product
  }

  function pairProduct(a, b) {                      // 고전 곱 대조군: 두 신호를 그냥 곱한 값임 / classical product control: simply the product of the two signals
    return a * b;                                   // 회로와 다른 "다른 고전 특징"의 예시임 / an example of a "different classical feature" from the circuit
  }
  // Havlíček et al.(Nature 2019) ZZ 특징 맵(2층): H → RZ(2x) → CNOT-RZ(2(π-x0)(π-x1))-CNOT 을 두 번 반복함 / Havlíček et al. (Nature 2019) ZZ feature map (2 layers): H → RZ(2x) → CNOT-RZ(2(π-x0)(π-x1))-CNOT, repeated twice
  function pairZZ(a, b) {
    const s = S.createState(2);                     // 2큐비트 상태를 |00>으로 만듦 / make the 2-qubit state |00>
    const x0 = Math.PI * a, x1 = Math.PI * b;       // 0~1 신호를 0~π 각도로 바꿈 / convert 0~1 signals to 0~π angles
    for (let r = 0; r < 2; r++) {                   // 같은 블록을 두 번 반복함(깊이 2) / repeat the same block twice (depth 2)
      S.h(s, 0); S.h(s, 1);                         // 두 큐비트를 반반 섞인 상태로 만듦 / put both qubits in a half-and-half state
      S.rz(s, 0, 2 * x0); S.rz(s, 1, 2 * x1);       // 각 신호를 위상(z축 회전)으로 넣음 / put each signal in as a phase (z rotation)
      S.cx(s, 0, 1);                                // 두 큐비트를 얽음 / entangle the two qubits
      S.rz(s, 1, 2 * (Math.PI - x0) * (Math.PI - x1)); // 두 신호의 곱에 해당하는 위상을 넣음 / put in the phase of the product of the two signals
      S.cx(s, 0, 1);                                // 얽힘을 되돌려 ZZ 위상만 남김 / undo the entanglement leaving only the ZZ phase
    }
    return S.expectZZ(s, 0, 1);                     // Z⊗Z 기댓값을 특징으로 씀 / use the Z⊗Z expectation as the feature
  }

  /* ---------- 2. 방식별 특징 만들기 / 2. Building features per method  ---------- */
  // method: "linear" | "quantum" | "analytic" | "shots"
  function features(x, method, ctx) {
    const base = x.filter(function (_, i) { return !D.exclusions.has(i); }); // 즉시 규칙 신호 4개를 뺀 16개를 기본 입력으로 씀 / use 16 signals (without the 4 immediate-rule signals) as base inputs
    if (method === "linear") return base;           // 일반 AI는 원래 값 16개만 받음 / the classical AI receives only the 16 original values
    const extra = D.pairs.map(function (p) {        // 6개 신호 쌍마다 결합 특징을 하나씩 만듦 / make one combined feature per signal pair (6 pairs)
      const a = x[p[0]], b = x[p[1]];               // 쌍의 두 신호 값을 꺼냄 / take the two values of the pair
      if (method === "analytic") return pairAnalytic(a, b); // 대조군은 수식으로 계산함 / the control computes by formula
      if (method === "product") return pairProduct(a, b); // 고전 곱 대조군임 / classical product control
      if (method === "zz") return pairZZ(a, b);     // 다른 양자 회로(ZZ 특징 맵)임 / another quantum circuit (ZZ feature map)
      const z = pairExact(a, b);                    // 양자 회로를 에뮬레이터로 실행함 / run the quantum circuit on the emulator
      if (method === "shots" && ctx && ctx.shots) { // 샷 모드면 실제 장비처럼 유한 번 측정함 / in shot mode, measure finitely like real hardware
        const p1 = (1 - z) / 2;                     // <Z>를 P(1)로 되돌림 / convert <Z> back to P(1)
        let est = S.sampleProb(p1, ctx.shots, ctx.rand); // shots번 측정한 추정 확률을 얻음 / get the probability estimated from shots measurements
        if (ctx.noise) est = est * (1 - ctx.noise) + ctx.noise * 0.5; // 장비 잡음(탈분극)이 있으면 0.5쪽으로 흐려짐 / with hardware noise (depolarizing) it blurs toward 0.5
        return 1 - 2 * est;                         // 다시 <Z> 형태로 바꿔 특징값으로 씀 / convert back to <Z> as the feature
      }
      return z;                                     // 정확 판독값을 그대로 씀 / use the exact readout as is
    });
    return base.concat(extra);                      // 원래 16개 + 결합 6개 = 22개 특징을 돌려줌 / return 16 original + 6 combined = 22 features
  }

  /* ---------- 3. 로지스틱 회귀 (모든 방식이 공통으로 쓰는 AI) / 3. Logistic regression (AI shared by all methods)  ---------- */
  const sigmoid = function (z) { return 1 / (1 + Math.exp(-z)); }; // 아무 숫자를 0~1 확률로 바꾸는 함수임 / turns any number into a 0~1 probability
  function scoreW(w, f) {                           // 가중치 w와 특징 f로 위험 점수를 계산함 / computes the risk score from weights w and features f
    let z = w[0];                                   // 절편(기본값)에서 시작함 / start from the bias
    for (let i = 0; i < f.length; i++) z += w[i + 1] * f[i]; // 특징마다 가중치를 곱해 더함 / add weight times feature for each feature
    return sigmoid(z);                              // 0~1 위험 점수로 바꿔 돌려줌 / return a 0~1 risk score
  }
  function fitRows(rows, epochs, lr, l2) {          // 특징 행렬로 가중치를 학습함(경사하강법) / learns weights from the feature matrix (gradient descent)
    const w = new Array(rows[0].f.length + 1).fill(0); // 모든 가중치를 0에서 시작함(공정 비교) / start every weight at 0 (fair comparison)
    const loss = [];                                // 학습 곡선을 기록할 배열임 / array recording the learning curve
    for (let e = 0; e < epochs; e++) {              // 정해진 횟수만큼 반복 학습함 / repeat training a fixed number of times
      const g = new Array(w.length).fill(0); let L = 0; // 기울기 누적과 손실 누적을 준비함 / prepare gradient and loss accumulators
      for (let r = 0; r < rows.length; r++) {       // 모든 학습 표본을 봄 / visit every training sample
        const p = scoreW(w, rows[r].f), y = rows[r].label; // 현재 예측과 정답임 / current prediction and label
        const err = p - y;                          // 예측 오차(교차엔트로피의 미분)임 / prediction error (derivative of cross-entropy)
        L -= y ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12); // 손실을 누적함 / accumulate the loss
        g[0] += err;                                // 절편의 기울기를 더함 / add the bias gradient
        for (let i = 0; i < rows[r].f.length; i++) g[i + 1] += err * rows[r].f[i]; // 특징별 기울기를 더함 / add the gradient per feature
      }
      for (let i = 0; i < w.length; i++) w[i] -= lr * (g[i] / rows.length + (i ? l2 * w[i] : 0)); // 오차가 줄어드는 쪽으로 가중치를 고침 / update weights in the direction that reduces error
      loss.push(L / rows.length);                   // 평균 손실을 기록함 / record the mean loss
    }
    return { w: w, loss: loss };                    // 학습된 가중치와 학습 곡선을 돌려줌 / return the learned weights and learning curve
  }
  function fit(samples, method, ctx) {              // 원시 표본으로 방식별 모델을 학습함 / trains a model per method from raw samples
    const rows = samples.map(function (s) { return { f: features(s.x, method, ctx), label: s.label }; }); // 특징을 미리 계산함 / precompute the features
    const r = fitRows(rows, 160, .65, .004);        // 세 방식에 같은 학습 횟수, 학습률, 규제를 씀 / same iterations, learning rate and regularization for all methods
    const predict = function (x, c) { return scoreW(r.w, features(x, method, c || ctx)); }; // 새 입력의 점수를 내는 함수임 / function scoring a new input
    return { predict: predict, w: r.w, loss: r.loss }; // 예측 함수, 가중치, 학습 곡선을 돌려줌 / return predict function, weights and learning curve
  }

  /* ---------- 4. 공정한 경보 기준과 성적 / 4. Fair alarm threshold and scores  ---------- */
  function cutoff(valid, predict) {                 // 검증 정상 표본의 약 10%만 경보가 나도록 기준을 정함 / sets the threshold so only about 10% of normal validation samples alarm
    const neg = valid.filter(function (r) { return !r.label; }).map(function (r) { return predict(r.x); }).sort(function (a, b) { return a - b; }); // 정상 점수를 정렬함 / sort the normal scores
    return neg[Math.ceil(neg.length * .90) - 1] + 1e-9; // 상위 10% 경계값을 기준으로 씀(같은 오경보 예산) / use the top 10% boundary as the threshold (same false-alarm budget)
  }
  function auc(scores, labels) {                    // ROC-AUC: 위험을 정상보다 높게 점수 매긴 비율임 / ROC-AUC: share of pairs where risk scores above normal
    const pos = [], neg = [];                       // 위험, 정상 점수를 나눠 담음 / split risk and normal scores
    scores.forEach(function (s, i) { (labels[i] ? pos : neg).push(s); }); // 정답에 따라 분류함 / sort by label
    let win = 0;                                    // 위험 점수가 더 높은 쌍의 수임 / number of pairs where the risk score is higher
    const sn = neg.slice().sort(function (a, b) { return a - b; }); // 정상 점수를 정렬해 빠르게 셈 / sort normal scores to count quickly
    pos.forEach(function (p) {                      // 위험 표본 하나씩 봄 / visit each risk sample
      let lo = 0, hi = sn.length;                   // 이분 탐색 범위임 / binary search range
      while (lo < hi) { const m = (lo + hi) >> 1; if (sn[m] < p) lo = m + 1; else hi = m; } // p보다 작은 정상 점수 개수를 찾음 / find the number of normal scores below p
      win += lo;                                    // 그만큼 이긴 것으로 셈 / count those as wins
    });
    return win / (pos.length * neg.length || 1);    // 전체 쌍 중 이긴 비율임(0.5=무작위, 1=완벽) / share of wins among all pairs (0.5 = random, 1 = perfect)
  }
  function measure(test, predict, thr) {            // 시험 표본으로 탐지율, 오경보율, AUC를 셈 / computes detection rate, false-alarm rate and AUC on test samples
    const sc = test.map(function (r) { return predict(r.x); }); // 모든 시험 점수를 계산함 / compute every test score
    let tp = 0, P = 0, fp = 0, N = 0;               // 맞힌 위험, 전체 위험, 잘못 울린 정상, 전체 정상 수임 / caught risks, all risks, wrongly rung normals, all normals
    test.forEach(function (r, i) { if (r.label) { P++; if (sc[i] >= thr) tp++; } else { N++; if (sc[i] >= thr) fp++; } }); // 하나씩 집계함 / tally one by one
    const prec = tp / Math.max(1, tp + fp), rec = tp / (P || 1); // 정밀도(경보 중 진짜 위험 비율)와 재현율임 / precision (share of alarms that are real risks) and recall
    return { recall: rec, falseAlarm: fp / (N || 1), precision: prec, f1: 2 * prec * rec / Math.max(1e-9, prec + rec), auc: auc(sc, test.map(function (r) { return r.label; })), P: P, N: N, tp: tp, fp: fp }; // 결과 묶음임(F1 = 정밀도와 재현율의 조화평균) / result bundle (F1 = harmonic mean of precision and recall)
  }

  /* ---------- 5. 전체 비교 실험 / 5. Full comparison experiment  ---------- */
  // opts: {data:{train,valid,test}, shots, noise, seed}
  function experiment(opts) {
    const o = opts || {};                           // 옵션 기본값 처리임 / default options
    const data = o.data || {                        // 데이터가 없으면 기본 합성 표본을 만듦 / make default synthetic samples if no data
      train: D.sampleSet(901, 1400), valid: D.sampleSet(902, 550), test: D.sampleSet(903, 800) }; // 학습, 기준, 시험을 서로 다른 씨앗으로 분리함 / separate train, threshold and test with different seeds
    const methods = o.methods || ["linear", "quantum", "analytic", "product", "zz"]; // 기본 다섯 방식임 / the default five methods
    if (o.shots) methods.push("shots");             // 샷 수가 정해지면 "실제 장비 흉내" 방식을 추가함 / add the "real hardware imitation" method if shots are set
    return methods.map(function (m) {               // 방식마다 같은 절차를 반복함 / repeat the same procedure for each method
      const ctx = m === "shots" ? { shots: o.shots, noise: o.noise || 0, rand: S.rng(o.seed || 7) } : null; // 샷 모드 전용 설정임 / settings for shot mode only
      const t0 = performance.now();                 // 학습 시작 시각을 기록함 / record the training start time
      const model = fit(data.train, m, ctx);        // 모델을 학습함 / train the model
      const thr = cutoff(data.valid, model.predict); // 검증 표본으로 경보 기준을 정함 / set the alarm threshold on validation samples
      const res = measure(data.test, model.predict, thr); // 별도의 시험 표본으로 성적을 매김 / score on a separate test set
      const ms = performance.now() - t0;            // 걸린 시간(밀리초)을 계산함 / elapsed time (ms)
      return Object.assign({ key: m, predict: model.predict, threshold: thr, loss: model.loss, w: model.w, ms: ms }, res); // 결과를 묶어 돌려줌 / bundle and return the results
    });
  }

  /* ---------- 6. 결정 지도 (비 × 경사 2차원) / 6. Decision map (rain × slope, 2-D)  ---------- */
  // 다른 신호는 고정하고, 두 신호만 0~1로 바꿔 가며 점수를 칠해 보는 지도임 / a map painting scores while varying only two signals 0~1 and fixing the others
  function decisionMap(predict, i, j, base, n) {
    const g = n || 36;                              // 한 변의 칸 수임 / cells per side
    const grid = [];                                // 점수를 담을 2차원 배열임 / 2-D array of scores
    for (let r = 0; r < g; r++) {                   // 세로(j 신호) 방향 반복임 / loop in the vertical (signal j) direction
      const row = [];                               // 한 줄 점수임 / scores of one row
      for (let c = 0; c < g; c++) {                 // 가로(i 신호) 방향 반복임 / loop in the horizontal (signal i) direction
        const x = base.slice();                     // 기준 입력을 복사함 / copy the base input
        x[i] = c / (g - 1); x[j] = 1 - r / (g - 1); // 가로는 i 신호, 세로는 j 신호(위가 높음)로 값을 바꿈 / horizontal = signal i, vertical = signal j (high at the top)
        row.push(predict(x));                       // 그 칸의 점수를 계산해 넣음 / compute the score of that cell
      }
      grid.push(row);                               // 한 줄을 지도에 추가함 / add the row to the map
    }
    return grid;                                    // 완성된 지도를 돌려줌 / return the finished map
  }

  /* ---------- 7. VQC: 회로 각도를 직접 학습하는 양자 분류기 / 7. VQC: quantum classifier that learns its circuit angles  ---------- */
  // 입력(a,b) 부호화 → [학습 회전 RY(θ) 두 개 + CNOT] × 층 수 → 둘째 큐비트 <Z> → sigmoid(k, z + c) / encode inputs (a,b) → [two trainable RY(θ) + CNOT] × layers → second qubit <Z> → sigmoid(k, z + c)
  function vqcZ(theta, a, b, layers) {
    const s = S.createState(2);                     // 2큐비트 상태를 만듦 / make the 2-qubit state
    S.ry(s, 0, Math.PI * a); S.ry(s, 1, Math.PI * b); // 데이터(비, 경사)를 각도로 넣음 / put the data (rain, slope) in as angles
    S.cx(s, 0, 1);                                  // 두 신호를 얽음 / entangle the two signals
    for (let l = 0; l < layers; l++) {              // 학습 가능한 층을 차례로 쌓음 / stack the trainable layers in order
      S.ry(s, 0, theta[2 * l]); S.ry(s, 1, theta[2 * l + 1]); // 학습되는 회전 각도 두 개를 적용함 / apply the two trainable rotation angles
      S.cx(s, 0, 1);                                // 다시 얽어서 두 큐비트 정보를 섞음 / entangle again to mix the two qubits' information
      S.ry(s, 0, Math.PI * a * (l + 2) / 2);        // 데이터를 한 번 더 넣는 "재업로딩"으로 표현력을 키움 / "re-upload" the data once more for expressiveness
    }
    return S.expectZ(s, 1);                         // 둘째 큐비트의 기댓값(-1~1)을 출력으로 씀 / use the second qubit's expectation (-1~1) as the output
  }
  function vqcCreate(layers, seed) {                // VQC 학습기 하나를 만듦 / creates one VQC learner
    const r = S.rng(seed || 3);                     // 초기 각도를 정할 난수임 / random generator for initial angles
    return { layers: layers, theta: Array.from({ length: 2 * layers }, function () { return (r() - .5) * .4; }), k: 1, c: 0, epoch: 0, loss: [] }; // 작은 무작위 각도에서 시작함 / start from small random angles
  }
  function vqcPredict(m, a, b) {                    // 학습 중인 VQC의 위험 점수임 / risk score of the VQC in training
    return sigmoid(m.k * vqcZ(m.theta, a, b, m.layers) + m.c); // 회로 출력을 0~1 점수로 바꿈 / convert the circuit output to a 0~1 score
  }
  // 한 번의 학습 단계: 매개변수 이동 규칙(parameter-shift)으로 각도 기울기를 정확히 구함 / one training step: exact angle gradients by the parameter-shift rule
  function vqcStep(m, data, lr) {
    const gT = new Array(m.theta.length).fill(0); let gk = 0, gc = 0, L = 0; // 각 기울기와 손실 누적임 / gradient and loss accumulators
    data.forEach(function (d) {                     // 학습 표본을 하나씩 봄 / visit each training sample
      const z = vqcZ(m.theta, d.a, d.b, m.layers);  // 현재 회로 출력임 / current circuit output
      const p = sigmoid(m.k * z + m.c);             // 현재 위험 점수임 / current risk score
      const err = p - d.y;                          // 오차임 / error
      L -= d.y ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12); // 손실을 누적함 / accumulate the loss
      gk += err * z; gc += err;                     // 고전 후처리(k, c)의 기울기임 / gradient of the classical post-processing (k, c)
      for (let t = 0; t < m.theta.length; t++) {    // 각 회전 각도마다 / for each rotation angle
        const plus = m.theta.slice(), minus = m.theta.slice(); // 각도를 ±90도 옮긴 복사본을 만듦 / copies with the angle shifted by ±90°
        plus[t] += Math.PI / 2; minus[t] -= Math.PI / 2; // 매개변수 이동 규칙의 두 지점임 / the two points of the parameter-shift rule
        const dz = (vqcZ(plus, d.a, d.b, m.layers) - vqcZ(minus, d.a, d.b, m.layers)) / 2; // 실제 양자 장비에서도 쓰는 정확한 미분 공식임 / exact derivative formula also used on real quantum hardware
        gT[t] += err * m.k * dz;                    // 연쇄 법칙으로 손실 기울기를 누적함 / accumulate the loss gradient by the chain rule
      }
    });
    const n = data.length;                          // 표본 수임 / number of samples
    for (let t = 0; t < m.theta.length; t++) m.theta[t] -= lr * gT[t] / n; // 각도를 오차가 줄어드는 쪽으로 돌림 / turn the angle in the direction that reduces error
    m.k -= lr * gk / n; m.c -= lr * gc / n;         // 후처리 값도 고침 / update the post-processing values too
    m.epoch++; m.loss.push(L / n);                  // 학습 횟수와 손실을 기록함 / record the iteration count and loss
    return L / n;                                   // 이번 평균 손실을 돌려줌 / return this round's mean loss
  }
  function vqcData(seed, n) {                       // VQC용 2차원(비, 경사) 합성 표본을 만듦 / makes 2-D (rain, slope) synthetic samples for the VQC
    const r = S.rng(seed);                          // 고정 씨앗 난수임 / fixed-seed random generator
    return Array.from({ length: n }, function () { const a = r(), b = r(); return { a: a, b: b, y: a * b > .42 ? 1 : 0 }; }); // "둘 다 높으면 위험" 규칙임 / "risk if both are high" rule
  }
  function vqcAccuracy(m, data) {                   // 정확도(0.5 기준으로 맞힌 비율)를 계산함 / computes accuracy (share correct at 0.5)
    let ok = 0;                                     // 맞힌 수임 / number correct
    data.forEach(function (d) { if ((vqcPredict(m, d.a, d.b) >= .5 ? 1 : 0) === d.y) ok++; }); // 하나씩 채점함 / score one by one
    return ok / data.length;                        // 비율을 돌려줌 / return the share
  }

  /* ---------- 7-2. 심층 신경망(DNN, 은닉층 3개: 입력 → 12 → 8 → 6 → 위험 점수) / 7-2. Deep neural network (DNN, 3 hidden layers: input → 12 → 8 → 6 → risk score)  ---------- */
  // 은닉층(tanh)을 여러 겹 쌓은 진짜 심층 신경망임. 층 수를 바꾸려면 HIDDEN 배열만 고치면 됨. / a real deep network stacking several hidden (tanh) layers; change the HIDDEN array to change depth
  // 학습 과정과 층마다 가중치 변화를 화면에 그리기 위해 라이브러리 없이 직접 구현함 / implemented without libraries to draw the training process and per-layer weight changes
  const HIDDEN = [12, 8, 6];                        // 은닉층 크기(층 3개)임 / hidden layer sizes (3 layers)
  function mlpCreate(nIn, nH, seed) {
    const r = S.rng(seed || 5), sizes = [nIn].concat(HIDDEN, [1]); // 고정 씨앗 난수와 층 크기 목록임 / fixed-seed random generator and layer sizes
    const W = [], b = [];                           // 층별 가중치 행렬과 절편임 / weight matrices and biases per layer
    for (let l = 0; l < sizes.length - 1; l++) { const n0 = sizes[l], n1 = sizes[l + 1], sc = Math.sqrt(6 / (n0 + n1)); W.push(Array.from({ length: n1 }, function () { return Array.from({ length: n0 }, function () { return (r() * 2 - 1) * sc; }); })); b.push(new Array(n1).fill(0)); } // Xavier 초기값(층이 깊어도 신호가 사라지지 않게)임 / Xavier initialization (signals do not vanish in deep layers)
    return { nIn: nIn, sizes: sizes, W: W, b: b, nH: HIDDEN[0], W1: W[0], epoch: 0, loss: [], acc: [], delta: null }; // 신경망과 학습 기록임(W1은 첫 층을 가리키는 별칭) / network and training log (W1 is an alias for the first layer)
  }
  function mlpForward(m, f) {                       // 한 입력의 순전파(앞으로 계산)임 / forward pass of one input
    const acts = [f];                               // 층별 출력값(0번은 입력)임 / outputs per layer (index 0 is the input)
    for (let l = 0; l < m.W.length; l++) {          // 층마다 / for each layer
      const prev = acts[l], last = l === m.W.length - 1; // 앞 층 값과 마지막 층 여부임 / previous layer values and whether this is the last layer
      acts.push(m.W[l].map(function (row, j) { let z = m.b[l][j]; for (let i = 0; i < prev.length; i++) z += row[i] * prev[i]; return last ? sigmoid(z) : Math.tanh(z); })); // 은닉은 tanh, 출력은 sigmoid임 / tanh for hidden, sigmoid for output
    }
    return { acts: acts, h: acts[1], o: acts[acts.length - 1][0] }; // 층별 값, 첫 은닉값, 위험 점수임 / values per layer, first hidden values, risk score
  }
  function mlpEpoch(m, rows, lr) {                  // 한 번의 학습 반복(역전파, 미니배치 32개)임 / one training epoch (backprop, mini-batch 32)
    let L = 0, ok = 0;                              // 손실과 맞힌 수임 / loss and number correct
    const before = m.W.map(function (Wl) { return Wl.map(function (r) { return r.slice(); }); }); // 변화량을 보이려고 학습 전 가중치를 복사함 / copy weights before training to show the changes
    for (let k = 0; k < rows.length; k += 32) {     // 32개씩 묶어 처리함 / process in batches of 32
      const batch = rows.slice(k, k + 32), gW = m.W.map(function (Wl) { return Wl.map(function (r) { return new Array(r.length).fill(0); }); }), gb = m.b.map(function (bl) { return new Array(bl.length).fill(0); }); // 기울기 누적임 / gradient accumulators
      batch.forEach(function (row) {                // 묶음의 표본마다 / for each sample in the batch
        const fw = mlpForward(m, row.f), A = fw.acts; // 층별 값임 / values per layer
        L -= row.label ? Math.log(fw.o + 1e-12) : Math.log(1 - fw.o + 1e-12); if ((fw.o >= .5 ? 1 : 0) === row.label) ok++; // 손실과 정확도임 / loss and accuracy
        let d = [fw.o - row.label];                 // 출력층 오차(sigmoid+교차엔트로피)임 / output error (sigmoid + cross-entropy)
        for (let l = m.W.length - 1; l >= 0; l--) { // 뒤 층부터 앞 층으로 오차를 전달함(역전파) / send the error from later to earlier layers (backpropagation)
          const prev = A[l], nd = new Array(prev.length).fill(0); // 앞 층 값과 앞 층으로 보낼 오차임 / previous layer values and the error to send back
          for (let j = 0; j < d.length; j++) { gb[l][j] += d[j]; for (let i = 0; i < prev.length; i++) { gW[l][j][i] += d[j] * prev[i]; nd[i] += d[j] * m.W[l][j][i]; } } // 기울기를 쌓고 오차를 뒤로 보냄 / accumulate gradients and send the error back
          if (l > 0) d = nd.map(function (v, i) { return v * (1 - prev[i] * prev[i]); }); // tanh 미분을 곱함 / multiply by the tanh derivative
        }
      });
      const n = batch.length;                       // 묶음 크기임 / batch size
      for (let l = 0; l < m.W.length; l++) for (let j = 0; j < m.W[l].length; j++) { m.b[l][j] -= lr * gb[l][j] / n; for (let i = 0; i < m.W[l][j].length; i++) m.W[l][j][i] -= lr * gW[l][j][i] / n; } // 모든 층의 가중치를 고침 / update the weights of every layer
    }
    m.deltas = m.W.map(function (Wl, l) { return Wl.map(function (r, j) { return r.map(function (w, i) { return Math.abs(w - before[l][j][i]); }); }); }); m.delta = m.deltas[0]; // 층별 이번 반복의 가중치 변화량임 / weight change per layer in this epoch
    m.epoch++; m.loss.push(L / rows.length); m.acc.push(ok / rows.length); // 기록을 남김 / keep the log
    return L / rows.length;                         // 평균 손실을 돌려줌 / return the mean loss
  }
  function mlpCount(m) { return m.W.reduce(function (s, Wl, l) { return s + Wl.length * Wl[0].length + m.b[l].length; }, 0); } // 학습되는 숫자 개수임 / number of learned parameters
  function mlpRows(samples, method) {               // 표본을 DNN 입력 행으로 바꿈 / turns samples into DNN input rows
    return samples.map(function (s) { return { f: features(s.x, method || "quantum"), label: s.label }; }); // 기본은 양자 특징 22개임 / default: 22 quantum features
  }

  /* ---------- 8. 위험구역 4큐비트 회로 (세미나 자료 부록 그대로) / 8. Risk-zone 4-qubit circuit (as in the seminar appendix)  ---------- */
  function zoneEncode(dist, quality) {              // 거리(m) 세 개와 위치 신뢰도를 0~1 입력으로 바꿈 / turns three distances (m) and location reliability into 0~1 inputs
    const scales = [120, 180, 100];                 // 위험구역, 야생동물, 낙석의 기준 거리(m)임 / reference distances (m) for risk zone, wildlife, rockfall
    if (quality < .6 || dist.some(function (d) { return d == null; })) return null; // 신뢰도가 낮거나 자료가 없으면 판독을 보류함 / withhold the readout if reliability is low or data is missing
    return dist.map(function (d, i) { return Math.max(0, Math.min(1, 1 - d / scales[i])); }).concat([quality]); // 가까울수록 1에 가까운 값임 / closer gives a value near 1
  }
  function zoneCircuit(x) {                         // 4큐비트(진폭 16개) 회로를 실행함 / runs the 4-qubit (16 amplitudes) circuit
    const s = S.createState(4);                     // |0000> 상태를 만듦 / make the |0000> state
    for (let q = 0; q < 4; q++) S.ry(s, q, Math.PI * x[q]); // 네 입력을 네 큐비트의 회전 각도로 넣음 / put the four inputs in as the four qubits' angles
    [[0, 3], [1, 3], [2, 3]].forEach(function (p) { S.cx(s, p[0], p[1]); }); // 세 위험 큐비트를 보조 큐비트 q3에 연결함 / connect the three risk qubits to ancilla qubit q3
    for (let q = 0; q < 3; q++) S.ry(s, q, Math.PI * x[3] / 12); // 신뢰도만큼 약간 더 돌려 보정함 / rotate a little more by reliability as a correction
    return { state: s, p: [0, 1, 2, 3].map(function (q) { return S.probOne(s, q); }) }; // 상태와 큐비트별 P(1)을 돌려줌 / return the state and P(1) per qubit
  }
  function zoneAssess(dist, quality, closed) {      // 정책 우선 → 부호화 → 회로 순서로 판단함 / decides in the order policy first → encoding → circuit
    if (closed) return { action: "block_route" };   // 공식 통제면 회로를 돌리지 않고 바로 제외함 / if officially closed, exclude immediately without running the circuit
    const x = zoneEncode(dist, quality);            // 입력을 부호화함 / encode the inputs
    if (!x) return { action: "check_sources" };     // 자료가 부족하면 출처 확인을 요청함 / request source confirmation if data is insufficient
    const r = zoneCircuit(x);                       // 회로를 실행함 / run the circuit
    return { action: "score_only", classical: x.slice(0, 3), quantum: r.p.slice(0, 3), ancilla: r.p[3], state: r.state, x: x }; // 고전, 양자 값을 함께 돌려줌 / return classical and quantum values together
  }

  // 위 기능을 QP.Models로 공개함 / publish the above as QP.Models
  QP.Models = { pairProduct, pairZZ, mlpCreate, mlpForward, mlpEpoch, mlpCount, mlpRows, pairCircuit, pairExact, pairAnalytic, features, fit, fitRows, cutoff, measure, auc, experiment, decisionMap,
                vqcCreate, vqcPredict, vqcStep, vqcData, vqcAccuracy, vqcZ, zoneEncode, zoneCircuit, zoneAssess, sigmoid };
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
