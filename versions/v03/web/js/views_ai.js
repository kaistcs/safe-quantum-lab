/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] AI screens: hyper-personalization, DNN training, meta-learning, VQC, learning eco-cycle. */
/* =====================================================================
 * views_ai.js : DNN 학습 관제, VQC 학습, 학습 에코 사이클, 초개인화 실험실
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 화면을 추가함 / adds screens to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const S = QP.Sim, D = QP.Data, M = QP.Models, C = QP.Charts, A = QP.Anim, B = QP.Basis, G = QP.Mountain; // 모듈임 / modules
  const $ = function (s, r) { return (r || document).querySelector(s); }; // 요소 찾기임 / find an element
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; }; // 백분율임 / percentage

  /* ===== DNN 학습 관제 / DNN training control  ===== */
  function dnn(el) {
    const ds = QP.Datasets.get(QP.State.dataId) || QP.Datasets.list[0]; // 현재 데이터셋임 / current dataset
    let timer = null;                               // 학습 타이머임 / training timer
    el.innerHTML = '<div class="grid dnnv"><div class="card stack"><div class="row" style="justify-content:space-between"><h3>심층 신경망 내부: 입력 → 은닉 12 → 8 → 6 → 위험 점수 (청=+, 장밋빛=−, 굵기=크기, 노랑=이번 반복에 크게 바뀐 연결)</h3><div class="btns"><select id="dM"><option value="quantum">입력: 신호 16 + 양자 특징 6</option><option value="linear">입력: 신호 16만</option></select><button id="dGo" data-autoplay="1" class="primary">▶ 학습 시작</button><button id="dSt">멈춤</button><button id="dRe">초기화</button></div></div><canvas id="dNet"></canvas></div>' +
      '<div class="stack"><div class="card"><div class="dmet"><span>반복 <b id="dE">0</b></span><span><i class="mn" style="background:#a9482a">①</i> 손실 <b id="dL">-</b> <small>(틀린 정도, 낮을수록 좋음)</small></span><span><i class="mn" style="background:#003087">②</i> 학습 정확도 <b id="dA">-</b> <small>(공부한 문제를 맞힌 비율)</small></span><span><i class="mn" style="background:#6e4c82">③</i> 시험 탐지율 <b id="dR" class="c-plum">-</b> <small>(처음 보는 문제에서 실제 위험을 잡은 비율)</small></span></div><canvas id="dCur"></canvas></div><div class="card"><div class="row" style="justify-content:space-between"><h3>학습 = 산행 상황 문제 풀기 <span class="small" id="dQs"></span></h3><button id="dMapT">판단 지도로 보기</button></div><div id="dQuiz" class="dquiz"></div><div id="dMapBox" hidden><canvas id="dMap"></canvas><p class="small maplegend"><b>산 그림이 아닙니다.</b> 가로 = 비의 세기, 세로 = 경사. 칸마다 신경망이 매긴 위험 점수(진할수록 위험, 경보 기준 50%). 점선 = 실제 위험 경계. 학습할수록 진한 영역이 점선 위쪽 모서리에 맞춰집니다.</p></div></div><div class="card"><h3>무엇이 학습되나</h3><p id="dW" class="small"></p><div id="dB"></div></div></div></div>';
    function setup() { QP.DNN.reset($("#dM", el).value); QP.DNN.setData(ds.split.train.slice(0, 3000), ds.split.test.slice(0, 1500)); draw(); } // 새 신경망과 자료를 준비함 / prepare a new network and data
    function draw() {                               // 신경망, 곡선, 지도를 그림 / draw the network, curves and map
      const m = QP.DNN.model, nIn = m.nIn, P = A.canvas($("#dNet", el), Math.max(320, Math.min(620, el.clientHeight - 150))), g = P.g; // 캔버스임 / canvas
      const lab = D.signals.filter(function (_, i) { return !D.exclusions.has(i); }).map(function (s) { return s[1]; }).concat(["비×경사", "심박×피로", "일몰×지연", "통신×배터리", "결빙×경사", "이탈×절벽"]).slice(0, nIn); // 입력 이름임 / input names
      A.deepNet(g, m, { x0: 118, x1: P.w - 36, y0: 18, y1: P.h - 26, labels: lab, deltas: m.deltas }); g.fillStyle = "#a9482a"; g.font = "bold 12px Malgun Gothic,sans-serif"; g.textAlign = "right"; g.fillText("위험 점수", P.w - 6, P.h / 2 - 26); g.textAlign = "left"; // 심층 신경망(은닉층 3개)을 그림 / draw the deep network (3 hidden layers)
      C.line($("#dCur", el), [{ values: m.loss.length ? m.loss : [.7], color: "#a9482a" }, { values: m.acc.length ? m.acc : [.5], color: "#003087" }], { height: 110, min: 0, max: 1, xLabel: "반복 →   ① 주황 선 = 손실(내려갈수록 좋음)   ② 청 선 = 학습 정확도(올라갈수록 좋음)" }); // 학습 곡선임 / learning curve
      (function () { const cv = $("#dCur", el), g = cv.getContext("2d"), r = window.devicePixelRatio || 1; g.save(); g.setTransform(r, 0, 0, r, 0, 0); const w = cv.clientWidth; g.font = "bold 11px sans-serif"; const tag = function (t, c, y) { g.fillStyle = c; g.beginPath(); g.arc(w - 18, y, 8, 0, 7); g.fill(); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(t, w - 18, y + 4); }; const la = m.loss.length ? m.loss[m.loss.length - 1] : .7, ac = m.acc.length ? m.acc[m.acc.length - 1] : .5; tag("①", "#a9482a", Math.max(14, Math.min(96, 6 + (1 - la) * 84))); tag("②", "#003087", Math.max(14, Math.min(96, 6 + (1 - ac) * 84))); g.restore(); })(); // 선 끝에 번호표를 달아 위 지표와 연결 / number tags at the line ends, linked to the metrics above
      const QZ = [["맑은 날 완만한 흙길", {}], ["소나기 속 젖은 돌계단 하산", { 3: .85, 9: .8 }], ["비는 강하지만 평탄한 임도", { 3: .9, 9: .2 }], ["68세, 깔딱고개에서 심박 높고 지침", { 0: .85, 1: .8 }], ["해 지기 전 하산이 늦어짐", { 8: .8, 11: .75 }], ["심박만 높은 짧은 오르막(피로 낮음)", { 0: .9, 1: .2 }], ["결빙된 겨울 급경사", { 7: .8, 9: .75 }], ["비, 경사 모두 중간", { 3: .6, 9: .6 }]]; // 실제 산행에서 흔한 상황 8개(정답은 두 위험의 겹침 규칙으로 정함) / 8 common real hiking situations (labels from the overlap rule)
      let okN = 0; $("#dQuiz", el).innerHTML = QZ.map(function (q) { const x = new Array(20).fill(.1); Object.keys(q[1]).forEach(function (k) { x[k] = q[1][k]; }); const t = D.syntheticLabel(x), sc = QP.DNN.predict(x), ok = (sc >= .5) === t; if (ok) okN++; return '<div class="dq ' + (ok ? "ok" : "ng") + '"><span class="dqn">' + q[0] + '</span><span class="dqa">정답 <b>' + (t ? "위험" : "정상") + '</b></span><span class="dqb"><i style="width:' + Math.round(sc * 100) + '%;background:' + (sc >= .5 ? "#c62828" : "#4d6b8c") + '"></i><em></em></span><span class="dqs">' + Math.round(sc * 100) + '%</span><span class="dqm">' + (ok ? "✔" : "✘") + "</span></div>"; }).join(""); // 문제마다 AI 점수 막대와 정답 여부를 그림 / draw the AI score bar and correctness per question
      $("#dQs", el).innerHTML = "반복 " + m.epoch + "회, 맞힌 문제 <b class='" + (okN >= 7 ? "c-plum" : "c-maple") + "'>" + okN + " / " + QZ.length + "</b>"; // 맞힌 개수임 / number correct
      const grid = []; for (let r = 0; r < 26; r++) { const row = []; for (let c = 0; c < 26; c++) { const x = new Array(20).fill(0); x[3] = c / 25; x[9] = 1 - r / 25; row.push(QP.DNN.predict(x)); } grid.push(row); } // 지도 계산임 / compute the map
      C.heatmap($("#dMap", el), grid, .5, { height: 170, corners: true, truth: function (a) { return a > .46 ? .46 / a : null; }, xLabel: "비의 세기 (약함 → 강함)", yLabel: "경사 (완만 → 급함)" }); // 지도임 / the map
      const ta = QP.DNN.testAcc(); $("#dE", el).textContent = m.epoch; $("#dL", el).textContent = m.loss.length ? m.loss[m.loss.length - 1].toFixed(3) : "-"; $("#dA", el).textContent = m.acc.length ? pct(m.acc[m.acc.length - 1]) : "-"; $("#dR", el).textContent = ta ? pct(ta.recall) : "-"; // 숫자 표시임 / number display
      const imp = lab.map(function (n, k) { let s = 0; for (let j = 0; j < m.nH; j++) s += Math.abs(m.W1[j][k]); return [n, s]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5); // 영향이 큰 입력 5개임 / 5 most influential inputs
      $("#dW", el).innerHTML = "학습되는 숫자: 층 " + m.sizes.join(" → ") + "의 가중치와 절편 <b>" + M.mlpCount(m) + "개</b>(은닉층 3개). 양자 회로 자체는 고정(학습 안 함). 지금 영향 큰 입력: " + imp.map(function (x) { return x[0]; }).join(", "); // 학습 대상 설명임 / description of what is learned
      $("#dB", el).innerHTML = B.box({ data: ds.name + " 학습 3,000행, 시험 1,500행", method: "미니배치 32, 경사하강법(학습률 0.3), 은닉층 3개(tanh 12, 8, 6), Xavier 초기값, 출력 sigmoid, 교차엔트로피 손실, 층별 역전파", formula: "h₁ = tanh(W₁f + b₁), h₂ = tanh(W₂h₁ + b₂), h₃ = tanh(W₃h₂ + b₃), 점수 = σ(W₄h₃ + b₄), W ← W − η∂손실/∂W", code: "models.js mlpCreate(), mlpForward(), mlpEpoch() / dnn.js", ref: "Rumelhart, Hinton & Williams, Nature 323:533 (1986) 역전파" }, "DNN 학습"); // 근거임 / evidence
    }
    $("#dMapT", el).onclick = function () { const b = $("#dMapBox", el), q = $("#dQuiz", el); b.hidden = !b.hidden; q.hidden = !b.hidden; this.textContent = b.hidden ? "판단 지도로 보기" : "문제 풀기로 보기"; draw(); }; // 두 가지 표현을 바꿔 봄 / switch between the two views
    $("#dGo", el).onclick = function () { if (timer) return; if (!QP.State.touring) QP.Voice.speak("신경망 학습을 시작합니다. 반복할 때마다 노란 선이 크게 바뀐 연결입니다. 오른쪽에서는 실제 산행 상황 여덟 문제를 신경망이 풀고 있으며, 학습할수록 맞힌 문제가 늘어납니다.", true); timer = setInterval(function () { QP.DNN.step(); draw(); if (QP.DNN.model.epoch >= 60) { clearInterval(timer); timer = null; } }, 550); }; // 학습 시작임 / start training
    $("#dSt", el).onclick = function () { clearInterval(timer); timer = null; }; // 멈춤임 / stop
    $("#dRe", el).onclick = function () { clearInterval(timer); timer = null; setup(); }; // 초기화임 / reset
    $("#dM", el).onchange = function () { clearInterval(timer); timer = null; setup(); }; // 입력 방식 변경임 / change the input type
    setup();                                        // 처음 준비함 / initial preparation
    return function () { clearInterval(timer); QP.DNN.train(ds.split.train, 25); }; // 떠날 때 관제실용 신경망을 다시 학습해 둠 / retrain the control-room network when leaving
  }

  /* ===== VQC 학습 / VQC training  ===== */
  function vqc(el) {
    let model = M.vqcCreate(2, 3), timer = null; const train = M.vqcData(11, 160), test = M.vqcData(12, 400); // 모델과 자료임 / model and data
    el.innerHTML = '<div class="grid two"><div class="card stack"><h3>변분 양자 회로(VQC): 회로의 회전 각도 θ를 학습</h3><canvas id="vC"></canvas><div class="btns"><button id="vGo" data-autoplay="1" class="primary">▶ 학습 시작</button><button id="vSt">멈춤</button><button id="vRe">초기화</button></div><p>반복 <b id="vE">0</b>, 손실 <b id="vL">-</b>, 시험 정확도 <b id="vA" class="c-plum">-</b></p><div id="vB"></div><div class="card tint-plum"><b>VQC가 무엇인가요?</b><p>일반 신경망은 <b>숫자(가중치)</b>를 고치며 배웁니다. VQC(변분 양자 회로)는 큐비트를 돌리는 <b>각도 θ</b>를 고치며 배웁니다. 라디오 다이얼 네 개를 조금씩 돌려 잡음이 가장 적은 위치를 찾는 것과 같다고 이해하시면 좋을 듯합니다. 위 다이얼이 바로 학습되는 각도입니다.</p></div></div>' +
      '<div class="card stack"><div class="vqcr">' +
      '<div style="grid-column:1/-1"><p class="small"><b>학습 = 실제 산행 상황 문제 풀기</b> <span id="vQs"></span></p><div id="vQuiz" class="dquiz"></div></div>' +
      '<div><p class="small"><b>판단 지도</b>(산 그림 아님: 가로 비, 세로 경사, 진할수록 위험, 점선 = 실제 위험 경계)</p><canvas id="vM"></canvas></div><div><p class="small"><b>손실 = 틀린 정도</b>(내려갈수록 잘 배움)</p><canvas id="vLC"></canvas></div></div>' +
      '<p class="qa small"><b>양자 특징 AI와 차이</b>: 기본 방식은 회로를 고정하고 뒤의 AI만 학습합니다. VQC는 회로 각도까지 학습합니다. 각도의 기울기는 매개변수 이동 규칙 ∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)]/2로 구하며, 실제 양자 장비에서도 그대로 쓰는 방법입니다.</p></div></div>';
    let shown = [0, 0, 0, 0];                       // 각도 다이얼 표시값임 / displayed angle dial values
    function draw() {                               // 상태를 그림 / draw the state
      const grid = []; for (let r = 0; r < 26; r++) { const row = []; for (let c = 0; c < 26; c++) row.push(M.vqcPredict(model, c / 25, 1 - r / 25)); grid.push(row); } // 지도 계산임 / compute the map
      const hh = Math.max(150, Math.round(el.clientHeight * .3)); // 아래 두 그림 높이임 / height of the two lower plots
      C.heatmap($("#vM", el), grid, .5, { height: hh, corners: true, truth: function (a) { return a > .42 ? .42 / a : null; }, xLabel: "비의 세기 →", yLabel: "경사 →" }); // 지도임 / the map
      C.line($("#vLC", el), [{ values: model.loss.length ? model.loss : [.7], color: "#6e4c82" }], { height: hh, min: 0, xLabel: "반복 →" }); // 손실임 / loss
      const VQ = [["소나기 속 젖은 돌계단 하산", .85, .8], ["비는 강하지만 평탄한 임도", .9, .2], ["맑은 날 가파른 바위길", .1, .9], ["보슬비 내리는 완만한 길", .3, .3], ["폭우 속 깔딱고개", .95, .7], ["비, 경사 모두 중간", .6, .6]]; let ok = 0; // 실제 상황 6개(비, 경사)임 / 6 real situations (rain, slope)
      $("#vQuiz", el).innerHTML = VQ.map(function (q) { const t = q[1] * q[2] > .42, sc = M.vqcPredict(model, q[1], q[2]), good = (sc >= .5) === t; if (good) ok++; return '<div class="dq ' + (good ? "ok" : "ng") + '"><span class="dqn">' + q[0] + '</span><span class="dqa">정답 <b>' + (t ? "위험" : "정상") + '</b></span><span class="dqb"><i style="width:' + Math.round(sc * 100) + '%;background:' + (sc >= .5 ? "#c62828" : "#4d6b8c") + '"></i><em></em></span><span class="dqs">' + Math.round(sc * 100) + '%</span><span class="dqm">' + (good ? "✔" : "✘") + "</span></div>"; }).join(""); $("#vQs", el).innerHTML = "맞힌 문제 <b>" + ok + " / " + VQ.length + "</b> " + (QP.I18N && QP.I18N.lang() === "en" ? "(click a row to show that case on the circuit)" : "(줄을 누르면 왼쪽 회로에 그 상황이 보임)"); if (typeof markSit === "function") markSit(); // 문제 풀이 표시임 / show the question solving
      $("#vE", el).textContent = model.epoch; $("#vL", el).textContent = model.loss.length ? model.loss[model.loss.length - 1].toFixed(3) : "-"; $("#vA", el).textContent = pct(M.vqcAccuracy(model, test)); // 숫자임 / numbers
    }
    // 회로 그림: 두 큐비트(비 q0, 경사 q1)가 게이트를 지날 때마다 상태가 어떻게 바뀌는지, 학습되는 θ 다이얼은 상자 안에서 돌아감 / circuit view: how the two qubits (rain q0, slope q1) change at each gate; the learned θ dials turn inside their boxes
    const SIT = [["소나기 속 젖은 돌계단 하산", "Wet stone steps in a shower", .85, .8], ["비는 강하지만 평탄한 임도", "Heavy rain, flat forest road", .9, .2], ["맑은 날 가파른 바위길", "Steep rock path, clear day", .1, .9], ["보슬비 내리는 완만한 길", "Gentle path in drizzle", .3, .3], ["폭우 속 깔딱고개", "Steep pass in a downpour", .95, .7], ["비, 경사 모두 중간", "Rain and slope both medium", .6, .6]]; // 퀴즈와 같은 상황 / same situations as the quiz
    let sit = 0, sitT = 0, sP = [0, 0, 0, 0];   // 현재 상황, 시간, 표시용 부드러운 값 / current situation, timer, smoothed display values
    const zz = function (p) { return p[0] + p[3] - p[1] - p[2]; }; // 두 큐비트 상관 ⟨Z₀Z₁⟩(+ 같은 쪽, − 반대) / correlation (+ same, − opposite)
    function trace(a, b) {                          // 게이트 열마다 상태를 기록함 / record the state after each gate column
      const th = model.theta, st = S.createState(2), out = [], snap = function () { const p = S.probs(st); out.push({ q0: p[1] + p[3], q1: p[2] + p[3], zz: zz(p) }); };
      snap(); S.ry(st, 0, Math.PI * a); S.ry(st, 1, Math.PI * b); snap(); S.cx(st, 0, 1); snap();
      for (let l = 0; l < model.layers; l++) { S.ry(st, 0, th[2 * l]); S.ry(st, 1, th[2 * l + 1]); snap(); S.cx(st, 0, 1); snap(); S.ry(st, 0, Math.PI * a * (l + 2) / 2); snap(); }
      return out;                                    // 시작 + 8열 = 9개 / start + 8 columns = 9
    }
    function mini(g, x, y, r, t, col) { g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = "#c9cfe0"; g.lineWidth = 1; g.stroke(); g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(t) * (r - 3), y - Math.cos(t) * (r - 3)); g.stroke(); } // 상자 안 작은 각도 다이얼 / small angle dial inside a box
    const stop = A.loop(function (dt) {
      const EN = QP.I18N && QP.I18N.lang() === "en", T = function (k, e) { return EN ? e : k; };
      sitT += dt; if (sitT > 4.5 && !el._vSitHold) { sitT = 0; sit = (sit + 1) % SIT.length; markSit(); } // 4.5초마다 다음 상황 / next situation every 4.5 s
      const P = A.canvas($("#vC", el), 350), g = P.g, W = P.w, Y = [52, 122], X0 = 74, X1 = W - 14, cols = 9, sp = (X1 - X0) / cols, bw = Math.min(44, sp - 8);
      const q = SIT[sit], tr = trace(q[2], q[3]); model.theta.forEach(function (t, k) { shown[k] = A.lerp(shown[k], t, .15); });
      g.font = "bold 12px Malgun Gothic,sans-serif"; g.textAlign = "left"; g.fillStyle = "#1d2a4d"; g.fillText(T("비 q0", "rain q0"), 4, Y[0] + 4); g.fillText(T("경사 q1", "slope q1"), 4, Y[1] + 4);
      [0, 1].forEach(function (k) { g.strokeStyle = "#8892ad"; g.lineWidth = 2; g.beginPath(); g.moveTo(X0 - 6, Y[k]); g.lineTo(X1, Y[k]); g.stroke(); });
      const cx = function (i) { return X0 + sp * (i + .5); }; // 열 중심 / column center
      const box = function (i, k, fill, txt) { g.fillStyle = fill; g.fillRect(cx(i) - bw / 2, Y[k] - bw / 2, bw, bw); if (txt) { g.fillStyle = "#fff"; g.font = "bold 10px sans-serif"; g.textAlign = "center"; g.fillText(txt, cx(i), Y[k] + 4); } };
      const cnot = function (i) { g.strokeStyle = "#b07a00"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx(i), Y[0]); g.lineTo(cx(i), Y[1] + 11); g.stroke(); g.fillStyle = "#b07a00"; g.beginPath(); g.arc(cx(i), Y[0], 5, 0, 7); g.fill(); g.beginPath(); g.arc(cx(i), Y[1], 11, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx(i) - 11, Y[1]); g.lineTo(cx(i) + 11, Y[1]); g.stroke(); };
      box(0, 0, "#003087", "RY"); box(0, 1, "#003087", "RY"); cnot(1);   // 데이터 부호화 + 얽힘 / data encoding + entanglement
      [[2, 0], [5, 1]].forEach(function (L) { const i = L[0], l = L[1]; [0, 1].forEach(function (k) { box(i, k, "#6e4c82"); mini(g, cx(i), Y[k] - 2, bw / 2 - 6, shown[2 * l + k], "#6e4c82"); g.fillStyle = "#fff"; g.font = "bold 9px sans-serif"; g.textAlign = "center"; g.fillText("θ" + (2 * l + k + 1), cx(i), Y[k] + bw / 2 - 2); }); cnot(i + 1); box(i + 2, 0, "#3b6fb6", T("재", "re")); }); // 학습 층 2개 / two trainable layers
      g.fillStyle = "#4d6b8c"; g.fillRect(X1 - 8, Y[1] - 14, 16, 28); // 측정 표시 / measurement mark
      g.font = "10.5px Malgun Gothic,sans-serif"; g.textAlign = "center"; g.fillStyle = "#4a5470";
      g.fillText(T("부호화", "encode"), cx(0), 18); g.fillText(T("얽힘", "entangle"), cx(1), 18); g.fillText(T("학습 1층", "layer 1"), cx(3), 18); g.fillText(T("학습 2층", "layer 2"), cx(6), 18);
      for (let i = 0; i < 8; i++) { const s2 = tr[i + 1], x = cx(i) + sp / 2; [["q0", 0], ["q1", 1]].forEach(function (z) { const v = s2[z[0]]; g.fillStyle = v > .5 ? "#c62828" : "#1f6fd1"; g.font = "bold 10px sans-serif"; g.fillText((v * 100).toFixed(0), x, Y[z[1]] + (z[1] ? 30 : -16)); }); } // 각 게이트 뒤 1이 나올 확률(%) / P(1) in % after each gate
      g.fillStyle = "#6d5e55"; g.font = "10.5px Malgun Gothic,sans-serif"; g.fillText(T("선 위아래 숫자 = 그 지점에서 1(위험 쪽)이 나올 확률 %, 빨강 50 이상", "numbers by the wires = % chance of reading 1 (risk side) at that point, red ≥ 50"), W / 2, 168);
      // 아래 패널: 지금 상황의 최종 큐비트 상태와 상관 / lower panel: final qubit states and correlation for this situation
      const f = tr[tr.length - 1]; sP[0] = A.lerp(sP[0], f.q0, .1); sP[1] = A.lerp(sP[1], f.q1, .1); sP[2] = A.lerp(sP[2], f.zz, .1);
      const sc = M.vqcPredict(model, q[2], q[3]), truth = q[2] * q[3] > .42; sP[3] = A.lerp(sP[3], sc, .1);
      g.fillStyle = "#f3f5fa"; g.fillRect(0, 180, W, 170); g.fillStyle = "#1d2a4d"; g.font = "bold 13px Malgun Gothic,sans-serif"; g.textAlign = "left";
      g.fillText(T("지금 상황: ", "Now: ") + (EN ? q[1] : q[0]) + T(" (비 ", " (rain ") + Math.round(q[2] * 100) + T(", 경사 ", ", slope ") + Math.round(q[3] * 100) + ")", 8, 200);
      A.dial(g, 46, 244, 24, 2 * Math.asin(Math.sqrt(Math.min(1, sP[0]))), T("비 q0", "rain q0"), "#003087", 0); A.dial(g, 126, 244, 24, 2 * Math.asin(Math.sqrt(Math.min(1, sP[1]))), T("경사 q1(출력)", "slope q1 (output)"), "#6e4c82", sP[1] > .5 ? .6 : 0);
      const mx0 = 180, mx1 = Math.min(W - 150, 420), mm = (mx0 + mx1) / 2, my = 250; g.fillStyle = "#e1e5ef"; g.fillRect(mx0, my - 8, mx1 - mx0, 16); const zx = mm + sP[2] * (mx1 - mx0) / 2; g.fillStyle = sP[2] >= 0 ? "#6e4c82" : "#9fb3d9"; g.fillRect(Math.min(mm, zx), my - 8, Math.abs(zx - mm), 16); g.fillStyle = "#1d2a4d"; g.fillRect(mm - 1, my - 12, 2, 24);
      g.font = "bold 12px Malgun Gothic,sans-serif"; g.textAlign = "center"; g.fillText(T("두 큐비트 상관 ⟨Z₀Z₁⟩ = ", "qubit correlation ⟨Z₀Z₁⟩ = ") + sP[2].toFixed(2), mm, my - 16); g.font = "11px Malgun Gothic,sans-serif"; g.textAlign = "left"; g.fillText(T("−1 반대로 움직임", "−1 opposite"), mx0, my + 24); g.textAlign = "right"; g.fillText(T("+1 함께 움직임", "+1 together"), mx1, my + 24);
      const ox = mx1 + 20; g.textAlign = "left"; g.font = "12px Malgun Gothic,sans-serif"; g.fillStyle = "#1d2a4d"; g.fillText(T("위험 점수", "risk score"), ox, 232); g.font = "bold 22px Malgun Gothic,sans-serif"; g.fillStyle = sP[3] >= .5 ? "#c62828" : "#1f6fd1"; g.fillText((sP[3] * 100).toFixed(0) + "%", ox, 258); g.font = "12px Malgun Gothic,sans-serif"; g.fillStyle = (sc >= .5) === truth ? "#2e7d32" : "#c62828"; g.fillText(T("정답 ", "answer ") + (truth ? T("위험", "risk") : T("정상", "normal")) + ((sc >= .5) === truth ? " ✔" : " ✘"), ox, 278);
      g.fillStyle = "#4a3f5c"; g.font = "12px Malgun Gothic,sans-serif"; g.textAlign = "left";
      const zOut = 1 - 2 * f.q1;                     // 출력 큐비트 읽은 값 ⟨Z₁⟩ / readout of the output qubit
      g.fillText(T("출력: 경사 q1을 읽은 ⟨Z₁⟩ = ", "Output: slope q1 read as ⟨Z₁⟩ = ") + zOut.toFixed(2) + T(" → 후처리(k=", " → post-processing (k=") + model.k.toFixed(2) + ", c=" + model.c.toFixed(2) + T(")로 위험 점수 ", ") gives risk score ") + (sc * 100).toFixed(0) + "%", 8, 318);
      g.fillText(T("학습 = θ 다이얼을 돌려, 얽힌(CNOT) 두 큐비트가 위험 상황과 정상 상황에서 서로 다른 출력을 내도록 맞추는 과정입니다. 상황을 바꿔 보며 숫자와 상관이 어떻게 달라지는지 비교해 보십시오.", "Training = turning the θ dials so the entangled qubits give different outputs for risky and normal cases. Switch cases to compare how the numbers and correlation change."), 8, 338);
    });
    function markSit() { el.querySelectorAll("#vQuiz .dq").forEach(function (d, i) { d.classList.toggle("sel", i === sit); }); } // 퀴즈 줄 강조 / highlight the quiz row
    el.addEventListener("click", function (e) { const d = e.target.closest && e.target.closest("#vQuiz .dq"); if (!d) return; const i = Array.prototype.indexOf.call(d.parentNode.children, d); if (i >= 0) { sit = i; sitT = 0; markSit(); } }); // 퀴즈 줄을 누르면 그 상황을 회로에 보임 / clicking a quiz row shows that situation on the circuit
    $("#vGo", el).onclick = function () { if (timer) return; timer = setInterval(function () { for (let k = 0; k < 3; k++) M.vqcStep(model, train, .8); draw(); if (model.epoch >= 240) { clearInterval(timer); timer = null; } }, 220); }; // 학습임 / training
    $("#vSt", el).onclick = function () { clearInterval(timer); timer = null; }; // 멈춤임 / stop
    $("#vRe", el).onclick = function () { clearInterval(timer); timer = null; model = M.vqcCreate(2, 3); draw(); }; // 초기화임 / reset
    $("#vB", el).innerHTML = B.box({ data: "비, 경사 2차원 합성 표본 학습 160, 시험 400(정답: 비×경사 > 0.42)", method: "2큐비트, 2층, 데이터 재업로딩, 학습 각도 4개 + 후처리 2개", formula: "∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)]/2", code: "models.js vqcStep()", ref: "Mitarai et al., PRA 98:032309 (2018) / Schuld et al., PRA 99:032331 (2019) / Pérez-Salinas et al., Quantum 4:226 (2020) 재업로딩" }, "VQC"); // 근거임 / evidence
    draw();                                         // 처음 그림임 / first drawing
    return function () { stop(); clearInterval(timer); }; // 떠날 때 정리함 / clean up when leaving
  }

  /* ===== 학습 에코 사이클 / Learning eco-cycle  ===== */
  function eco(el) {
    const nodes = [                                 // [이름, 무엇을, 학습되어 저장되는 것, 고정되는 것]임 / [name, what it does, what is learned and stored, what is fixed]
      ["① 데이터 수집", "워치 심박(1분 묶음+긴급), GPS 궤적, 기상, 스탬프 인증 기록(DTO-1~4)", "없음(원자료 저장)", "수집 규격(DTO)"],
      ["② 신호화(20개)", "원자료를 0~1 신호로 바꿈(%HRR, 경사, POI 거리 등)", "개인 기준선: 안정시 심박, 최대심박, 평소 속도", "변환 규칙, 감지 거리"],
      ["③ 양자 특징 변환", "신호 쌍 → RY → CNOT → ⟨Z⟩ 겹침 점수 6개", "VQC를 쓰면 회전 각도 θ", "기본 회로 구조(고정)"],
      ["④ AI 학습(오프라인)", "로지스틱, DNN을 합성+실측 데이터로 학습", "로지스틱 가중치 23개, DNN 441개(은닉층 3개), 경보 기준", "학습 절차, 공정 비교 규칙"],
      ["⑤ 배포(추론 API)", "학습된 모델로 실시간 점수 계산(DTO-5)", "버전 태그(어떤 데이터로 학습했는지)", "API 형식"],
      ["⑥ 현장 경보, 안전 규칙", "점수 경보 + 즉시 규칙(통제, 낙상, 낙뢰, 증상)", "없음", "안전 규칙(사람이 정함, 학습 금지)"],
      ["⑦ 사용자 피드백", "경보 확인/무시, 사고, 아차사고 신고, 스탬프 인증 시각", "정답 라벨(위험/정상)과 오경보 기록", "신고 양식"],
      ["⑧ 재학습, 메타학습", "주간 재학습 + FOMAML로 코스, 개인 집단별 좋은 시작점 학습", "메타 초기값 → 새 사용자 적은 데이터로 빠른 적응", "평가 기준(같은 시험 세트)"]
    ];
    el.innerHTML = '<div class="grid two-1"><div class="card"><canvas id="eC"></canvas></div><div class="stack"><div class="card" id="eD"></div><div class="card tint-ochre"><b>한 줄 요약</b><p>데이터가 쌓일수록(①⑦) AI가 다시 배우고(④⑧), 개인마다 기준이 맞춰지며(②⑧), 안전 규칙(⑥)은 학습과 무관하게 항상 먼저 작동함.</p></div><div class="card ehist"><h3>지나온 단계: 지금까지 본 화면이 에코 사이클의 어디에 해당하는가</h3><div id="eH"></div></div><div id="eB"></div></div></div>';
    let sel = 0, t = 0, hold = 0, seen = [];                             // 선택 노드와 애니메이션 시각임 / selected node and animation time
    const REL = [[["datamgr", "데이터 관리 센터"], ["realdata", "실측을 위한 필요 데이터 명세"]], [["sim", "산행 관제(입력 신호)"], ["persona", "초개인화(%HRR)"]], [["entangle", "얽힘 짝꿍(CNOT)"], ["compare", "일반 vs 양자"], ["vqc", "VQC"]], [["dnn", "DNN 학습 관제"], ["same", "왜 대조군과 같은가"]], [["sim", "산행 관제 시뮬레이션"], ["stamp", "스탬프 투어"]], [["sim", "관제실 경보 띠"], ["zone4q", "4큐비트 위험구역"]], [["ecolab", "전체 사이클 ⑦"]], [["meta", "메타학습"], ["ecolab", "전체 사이클 ⑧"]]]; // 노드별 관련 화면 / related screens per node
    function hist() { $("#eH", el).innerHTML = seen.map(function (k) { const n = nodes[k]; return '<div class="eh' + (k === sel ? " on" : "") + '"><b>' + n[0] + '</b><span>' + n[1] + '</span><span class="ehl">본 화면: ' + REL[k].map(function (r) { return '<a data-go="' + r[0] + '">' + r[1] + "</a>"; }).join(", ") + "</span></div>"; }).join("") || '<p class="small">노란 흐름이 각 단계를 지날 때마다 여기에 하나씩 쌓입니다.</p>'; $("#eH", el).querySelectorAll("[data-go]").forEach(function (a) { a.onclick = function () { QP.App.go(a.dataset.go); }; }); } // 지나온 단계 목록 / visited-stage list
    function detail() { const n = nodes[sel]; $("#eD", el).innerHTML = "<h3>" + n[0] + "</h3><p>" + n[1] + "</p><table><tr><th>학습되어 저장</th><td>" + n[2] + "</td></tr><tr><th>고정(학습 안 함)</th><td>" + n[3] + "</td></tr></table>"; } // 노드 설명임 / node explanation
    const cv = $("#eC", el);                        // 캔버스임 / canvas
    cv.onclick = function (e) { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, cx = r.width / 2, cy = r.height / 2, R = Math.min(cx, cy) - 62; nodes.forEach(function (_, k) { const a = -Math.PI / 2 + k * 2 * Math.PI / nodes.length; if (Math.hypot(x - (cx + R * Math.cos(a)), y - (cy + R * Math.sin(a))) < 46) { sel = k; hold = 8; if (seen.indexOf(k) < 0) seen.push(k); hist(); detail(); QP.Voice.speak(nodes[k][0] + ". " + nodes[k][1] + ". 학습되어 저장되는 것은 " + nodes[k][2] + ". 고정되는 것은 " + nodes[k][3] + ".", true); } }); }; // 노드를 누르면 설명함 / click a node to explain it
    const stop = A.loop(function (dt) {             // 순환 애니메이션임 / cycle animation
      t += dt * .12; const P = A.canvas(cv, Math.max(380, el.clientHeight - 40)), g = P.g, cx = P.w / 2, cy = P.h / 2, R = Math.min(cx, cy) - 62; // 준비임 / prepare
      g.strokeStyle = "#c9d3ea"; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); // 순환 고리임 / the cycle ring
      const head = (t % 1) * 2 * Math.PI - Math.PI / 2;
      hold = Math.max(0, hold - dt); const hk = Math.floor(((t % 1) * nodes.length + .5)) % nodes.length; // 노란 흐름이 지나는 노드 / node the yellow flow is passing
      if (!hold && hk !== sel) { sel = hk; if (seen.indexOf(hk) < 0) seen.push(hk); else if (hk === 0) seen = [0]; detail(); hist(); } // 흐름을 따라 자동으로 설명이 바뀌고 지나온 단계가 쌓임(한 바퀴 돌면 새로 시작) / explanation follows the flow and visited stages accumulate (restart each lap) g.strokeStyle = "#ffb500"; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, R, head - .5, head); g.stroke(); // 움직이는 데이터 흐름임 / moving data flow
      nodes.forEach(function (n, k) { const a = -Math.PI / 2 + k * 2 * Math.PI / nodes.length, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); const on = k === sel; g.fillStyle = on ? "#003087" : k === 5 ? "#c76b67" : [3, 7, 1, 2].indexOf(k) >= 0 ? "#6e4c82" : "#4d6b8c"; g.beginPath(); g.arc(x, y, on ? 60 : 54, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 15px Malgun Gothic,sans-serif"; g.textAlign = "center"; n[0].split(" ").reduce(function (acc, w) { const l = acc[acc.length - 1]; if ((l + " " + w).length > 7) acc.push(w); else acc[acc.length - 1] = (l + " " + w).trim(); return acc; }, [""]).forEach(function (line, i, arr) { g.fillText(line, x, y + 5 + (i - (arr.length - 1) / 2) * 18); }); }); // 노드 원과 이름임 / node circles and names
      g.fillStyle = "#1d2a4d"; g.font = "bold 20px Malgun Gothic,sans-serif"; g.fillText("학습 에코 사이클", cx, cy - 14); g.font = "15px Malgun Gothic,sans-serif"; g.fillText("자두색 = 학습이 일어나는 곳", cx, cy + 12); g.fillText("장밋빛 = 학습 금지(안전 규칙)", cx, cy + 34); // 가운데 설명임 / center explanation
    });
    seen = [0]; detail(); hist();                   // 첫 설명임 / first explanation
    $("#eB", el).innerHTML = B.box({ data: "S.A.F.E. 과제 DTO-1~5 설계(유즈케이스 및 요구사항 명세서 v1.1, AI 모델 설계서 v1.2)", method: "MAML 안쪽 루프 = 개인 세션 실시간 적응(DTO-1), 바깥 루프 = 산행 이력 오프라인(DTO-4)", ref: "Finn et al., ICML 2017(MAML) / Nichol et al., arXiv:1803.02999(1차 근사)" }, "에코 사이클"); // 근거임 / evidence
    return stop;                                    // 떠날 때 멈춤 / stop when leaving
  }

  /* ===== 초개인화 실험실 / Hyper-personalization lab  ===== */
  function persona(el) {
    el.innerHTML = '<div class="grid two-1"><div class="stack"><div class="card"><h3>같은 심박, 다른 사람 → 다른 위험 <button id="pAuto" data-autoplay="1">▶ 심박 실시간 변화</button></h3><div class="slider"><span>현재 심박 bpm</span><input id="pH" type="range" min="80" max="185" value="140"><output></output></div><div class="slider"><span>경사 %</span><input id="pS" type="range" min="0" max="45" value="30"><output></output></div><div class="slider"><span>피로(0~100)</span><input id="pF" type="range" min="0" max="100" value="55"><output></output></div></div>' +
      '<div class="card"><h3>나만의 산행자 만들기 <select id="cX"><option value="F">여성</option><option value="M">남성</option></select></h3><div class="slider"><span>나이</span><input id="cA" type="range" min="20" max="85" value="60"><output></output></div><div class="slider"><span>안정시 심박</span><input id="cR" type="range" min="45" max="95" value="68"><output></output></div><div class="slider"><span>체력 계수 ×100</span><input id="cF" type="range" min="60" max="130" value="95"><output></output></div><div class="slider"><span>측정 최대심박(0=공식)</span><input id="cM" type="range" min="0" max="200" value="0"><output></output></div></div><div id="pB"></div></div>' +
      '<div class="stack"><div id="pCards" class="cmp4"></div><div class="card"><h3>같은 코스(북한산, 소나기)를 걸을 때 개인별 심박 부담(%HRR)</h3><canvas id="pC"></canvas><div class="legend" id="pL"></div></div></div></div>';
    const cols = ["#a9482a", "#4d6b8c", "#7a9a6a", "#6e4c82"]; // 사람별 색임 / color per person
    function people() { const c = { id: "나", name: "나만의 산행자(" + ($("#cX", el).value === "F" ? "여" : "남") + ")", sex: $("#cX", el).value, age: Number($("#cA", el).value), rest: Number($("#cR", el).value), fit: $("#cF", el).value / 100 }; const mm = Number($("#cM", el).value); if (mm > 0) c.maxMeasured = mm; return G.personas.concat([c]); } // 네 사람 목록임 / four people
    function upd() {                                // 다시 계산함 / recompute
      el.querySelectorAll("input[type=range]").forEach(function (i) { i.nextSibling.value = i.value; }); // 숫자 표시임 / number display
      const hr = Number($("#pH", el).value), sl = $("#pS", el).value / 100, fa = $("#pF", el).value / 100; // 공통 입력임 / common input
      const Lm = QP.State.results.find(function (m) { return m.key === "linear"; }), Qm = QP.State.results.find(function (m) { return m.key === "quantum"; }); // 두 모델임 / the two models
      $("#pCards", el).innerHTML = people().map(function (p, k) { const mx = G.hrMax(p), hrr = (hr - p.rest) / (mx - p.rest), load = Math.max(0, Math.min(1, (hrr - .35) / .55)); const x = new Array(20).fill(0); x[0] = load; x[1] = fa; x[9] = Math.min(1, sl / .4); const ql = Qm.predict(x), ll = Lm.predict(x); return '<div class="card" style="border-top:4px solid ' + cols[k] + '"><b>' + p.name + '</b><p class="small">최대심박 ' + Math.round(mx) + (p.maxMeasured ? "(측정)" : p.sex === "F" ? "(여성 206−0.88×" + p.age + ")" : "(208−0.7×" + p.age + ")") + '</p><p>%HRR <b>' + Math.round(hrr * 100) + '%</b> → 심박 부담 신호 ' + load.toFixed(2) + '</p><p class="c-plum">양자 특징 AI ' + pct(ql) + (ql >= Qm.threshold ? " 경보" : "") + '</p><p class="c-dusk">일반 AI ' + pct(ll) + (ll >= Lm.threshold ? " 경보" : "") + '</p><p class="small">' + (hrr > .85 ? "고강도: 휴식 권고" : hrr > .6 ? "격렬(ACSM 60~89%)" : hrr > .4 ? "중강도(ACSM 40~59%)" : "가벼움") + '</p></div>'; }).join(""); // 사람별 카드임 / card per person
      const course = G.makeCourse(0), lines = people().map(function (p, k) { const run = G.simulate(course, p, G.weathers[1]); return { values: run.steps.filter(function (_, i) { return i % 6 === 0; }).map(function (s) { return s.pHRR; }), color: cols[k] }; }); // 같은 코스를 사람마다 시뮬레이션함 / simulate the same course per person
      pLines = lines; pNames = people().map(function (p) { return p.name; }); // 아래 애니메이션이 매 프레임 조금씩 그려 나감 / the animation below reveals it frame by frame
    }
    let pLines = null, pNames = [], pCur = 0, pFr = 0;   // 곡선, 이름, 진행 위치, 프레임 / curves, names, progress, frame
    const stopP = A.loop(function (dt) {              // 같은 코스를 네 사람이 동시에 걷는 것처럼 곡선이 실시간으로 그려짐 / curves are drawn live as if the four people walk the same course together
      if (!pLines || !$("#pC", el)) return; const n = pLines[0].values.length; pCur += dt * 2 * 6; if (pCur > n + 12) pCur = 2; if (++pFr % 3) return; // 약 1분에 한 칸, 끝나면 처음부터 / about one point per tick, restart at the end
      const k = Math.min(n, Math.floor(pCur)), shown = pLines.map(function (l) { return { values: l.values.slice(0, Math.max(2, k)), color: l.color }; });
      shown.push({ values: new Array(n).fill(0.6), color: "rgba(198,40,40,.45)" }); // 60% 선 = 격렬 운동 시작(ACSM) / 60% line = vigorous intensity (ACSM)
      C.line($("#pC", el), shown, { height: Math.max(200, el.clientHeight - $("#pCards", el).offsetHeight - 105), min: 0, max: 1, xLabel: "시간(분) →  빨간 선 = 60% HRR(격렬 운동 시작, ACSM)", fmt: function (v) { return Math.round(v * 100) + "%"; } });
      const idx = Math.max(0, Math.min(n - 1, k - 1)); $("#pL", el).innerHTML = pNames.map(function (nm, j) { const v = pLines[j].values[idx]; return '<span style="--c:' + cols[j] + '">' + nm + " <b>" + Math.round(v * 100) + "%</b>" + (v >= .6 ? ' <b style="color:#c62828">격렬</b>' : v >= .4 ? " 중강도" : " 가벼움") + "</span>"; }).join("") + '<span class="small">지금 ' + (idx * 6 / 6).toFixed(0) + "분째</span>"; // 지금 시각의 사람별 부담 / per-person load right now
    });
    el.querySelectorAll("input").forEach(function (i) { i.oninput = upd; }); $("#cX", el).onchange = upd; // 입력 연결임 / wire up inputs
    $("#pB", el).innerHTML = B.box({ data: "심박, 나이, 안정시 심박(아이나비 DTO-1 생체, 사용자 프로필)", method: "개인 최대심박 → 심박예비율 %HRR → 심박 부담 신호 = (%HRR − 0.35)/0.55 → 같은 AI에 입력", formula: "HRmax = 208 − 0.7×나이(Tanaka 2001), 여성 206 − 0.88×나이(Gulati 2010), %HRR = (HR − 안정시)/(HRmax − 안정시)(Karvonen 1957)", code: "mountain.js hrMax(), simulate() / views_ai.js persona()", ref: "ACSM's Guidelines for Exercise Testing and Prescription(11판) 강도 구분: 중강도 40~59% HRR, 격렬 60~89% HRR", note: "초개인화 2단계(개인 데이터로 가중치 자체를 적응)는 메타러너(FOMAML) 엔진과 연결 예정" }, "초개인화"); // 근거임 / evidence
    let pt = null, ph = 0; $("#pAuto", el).onclick = function () { if (pt) { clearInterval(pt); pt = null; this.textContent = "▶ 심박 실시간 변화"; return; } this.textContent = "■ 멈춤"; pt = setInterval(function () { ph += .15; $("#pH", el).value = Math.round(130 + 35 * Math.sin(ph) + 6 * Math.sin(ph * 3.1)); $("#pS", el).value = Math.round(22 + 18 * Math.sin(ph * .7)); upd(); }, 1300); }; // 오르막을 오르는 것처럼 심박과 경사가 계속 변함 / heart rate and slope keep changing as if climbing
    upd();                                          // 처음 계산함 / first computation
    return function () { clearInterval(pt); stopP(); }; // 떠날 때 멈춤 / stop when leaving
  }


  /* ===== 메타학습(초개인화 적응) 과정 : 양자 특징 AI → 메타러너 / Meta-learning (personal adaptation): quantum-feature AI → meta-learner  ===== */
  function meta(el) {
    let m = QP.Meta.create(77), timer = null, cur = 0, sub = 0, hist = [], ev = QP.Meta.evaluate(m), people = []; // 메타학습기, 타이머, 보여 줄 사람, 적응 걸음, θ 궤적, 적응 곡선임 / meta-learner, timer, shown person, adaptation step, θ trajectory, adaptation curve
    const prj = (function () { const r = QP.Sim.rng(5), n = QP.Meta.H * 5 + 1; return [0, 1].map(function () { return Array.from({ length: n }, function () { return r() - .5; }); }); })(); // 가중치 31개를 2차원으로 내리는 고정 투영 벡터임 / fixed projection vectors reducing 31 weights to 2-D
    const flat = function (t) { const v = []; t.W1.forEach(function (r) { v.push(r[0], r[1], r[2]); }); return v.concat(t.b1, t.W2, [t.b2]); }; // 가중치를 한 줄로 폄 / flatten the weights into one row
    const proj = function (t) { const v = flat(t); return prj.map(function (p) { return p.reduce(function (a, w, i) { return a + w * v[i]; }, 0); }); }; // 2차원 좌표임 / 2-D coordinates
    el.innerHTML = '<div class="grid metav"><div class="stack"><div class="card"><div class="row" style="justify-content:space-between"><h3>양자 특징 AI → 메타러너 → 사람마다 맞춘 경보</h3><div class="btns"><button id="mGo" data-autoplay="1" class="primary">▶ 메타 학습 시작</button><button id="mSt">멈춤</button><button id="mRe">초기화</button></div></div><canvas id="mFlow"></canvas></div>' +
      '<div class="card"><h3 id="mNetT">신경망 3→6→1 (청=+, 장밋빛=−, 굵기=크기, 노랑=이 사람에게 맞추며 크게 바뀐 연결)</h3><canvas id="mNet"></canvas></div></div>' +
      '<div class="stack"><div class="card"><h3>가중치 공간: 공통 시작점 θ와 사람별 적응 θ′</h3><canvas id="mPar"></canvas></div>' +
      '<div class="card"><h3>새 사람 적응 곡선 (기록 10개, 걸음 0~10)</h3><canvas id="mAd"></canvas><p id="mNum" class="small"></p></div><div class="card"><div id="mPeople" class="small"></div><div id="mB"></div></div></div></div>';
    function drawFlow() {                            // 관계도: 센서 → 양자 회로 → 겹침 점수 → 메타러너 → 개인 적응 / relationship diagram: sensor → quantum circuit → overlap score → meta-learner → personal adaptation
      const P = A.canvas($("#mFlow", el), 154), g = P.g, W = P.w, tt = performance.now() / 900; // 캔버스임 / canvas
      const t = m.last[cur] || null, per = t ? t.p : { sex: "F", age: 62, rest: 70, max: 151 }; // 지금 보여 줄 사람임 / person shown now
      const load = Math.min(1, Math.max(0, .35 + .3 * Math.sin(tt))), fat = Math.min(1, Math.max(0, .55 + .35 * Math.sin(tt * .7 + 1))), z = QP.Models.pairExact(load, fat); // 움직이는 예시 입력과 양자 겹침 점수임 / moving example inputs and the quantum overlap score
      const bx = [[6, "센서(워치)", "심박 " + Math.round(90 + load * 90) + "bpm\n피로 " + Math.round(fat * 100) + "%", "#003087"], [.205, "양자 특징 AI", "RY(πa)⊗RY(πb)\nCNOT → ⟨Z⟩", "#6e4c82"], [.41, "겹침 점수", "⟨Z⟩ = " + z.toFixed(2) + "\n(부담×피로)", "#6e4c82"], [.615, "메타러너 θ", "여러 사람에게서\n배운 시작점", "#a9482a"], [.82, "개인 θ′", (per.sex === "F" ? "여 " : "남 ") + per.age + "세\n10개로 5걸음 적응", "#c38a2b"]]; // 다섯 상자임 / five boxes
      const bw = W * .172, bh = 88, y0 = 40; g.font = "bold 13px Malgun Gothic,sans-serif"; // 상자 크기임 / box size
      const SEG = 1.8, CYC = 1 + 4 * SEG + 3, tp = (performance.now() / 1000) % CYC, prog = function (i) { return Math.max(0, Math.min(1, (tp - 1 - i * SEG) / SEG)); }; // 왼쪽부터 차례로: 화살표 i가 자라는 정도 / left to right in order: how far arrow i has grown
      const lit = function (i) { return i === 0 ? tp > .2 : prog(i - 1) >= 1; }; // 상자 i가 켜졌는지 / whether box i is lit
      bx.forEach(function (b, i) { const x = i === 0 ? 6 : b[0] * W, on = lit(i); g.globalAlpha = on ? 1 : .28; g.fillStyle = on && i === Math.min(4, Math.floor(Math.max(0, tp - 1) / SEG)) && tp < 1 + 4 * SEG ? "#fff8e1" : "#fff"; g.strokeStyle = b[3]; g.lineWidth = on ? 3 : 1.5; g.beginPath(); g.roundRect ? g.roundRect(x, y0, bw, bh, 10) : g.rect(x, y0, bw, bh); g.fill(); g.stroke(); g.fillStyle = b[3]; g.textAlign = "center"; g.font = "bold 13px Malgun Gothic,sans-serif"; g.fillText(b[1], x + bw / 2, y0 + 20); g.fillStyle = "#1d2a4d"; g.font = "11.5px Malgun Gothic,sans-serif"; b[2].split("\n").forEach(function (l, k) { g.fillText(l, x + bw / 2, y0 + 44 + k * 18); });
        g.globalAlpha = 1;
        if (i < 4) { const x2 = bx[i + 1][0] * W, ax = x + bw + 3, aw = x2 - ax - 4, pr = prog(i), yy = y0 + bh / 2; g.strokeStyle = "#d5dae6"; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(ax, yy); g.lineTo(ax + aw, yy); g.stroke(); g.setLineDash([]); // 아직 가지 않은 길(점선) / path not yet taken (dashed)
          if (pr > 0) { g.strokeStyle = b[3]; g.lineWidth = 3.5; g.beginPath(); g.moveTo(ax, yy); g.lineTo(ax + aw * pr, yy); g.stroke(); if (pr < 1) { g.fillStyle = "#ffb500"; g.strokeStyle = "#c62828"; g.lineWidth = 1.5; g.beginPath(); g.arc(ax + aw * pr, yy, 6, 0, 7); g.fill(); g.stroke(); } else { g.fillStyle = b[3]; g.beginPath(); g.moveTo(ax + aw, yy); g.lineTo(ax + aw - 10, yy - 6); g.lineTo(ax + aw - 10, yy + 6); g.fill(); } } } }); // 화살표가 왼쪽부터 차례로 그려지고, 다 그려지면 화살촉과 다음 상자가 켜짐 / arrows are drawn one at a time from the left; when complete, the arrowhead and next box light up
      { const k = tp < 1 ? 0 : Math.min(4, Math.floor((tp - 1) / SEG) + (tp >= 1 + 4 * SEG ? 0 : 0)); const msg = tp >= 1 + 4 * SEG ? "완료: 센서 값이 개인 θ′까지 전달되어 이 사람에게 맞춘 경보가 됩니다" : ["① 워치가 심박, 피로를 잽니다", "② 두 신호를 양자 회로에 넣습니다", "③ 회로가 겹침 점수를 냅니다", "④ 메타러너의 공통 시작점에 넣습니다", "⑤ 이 사람 기록 10개로 몇 걸음 만에 맞춥니다"][Math.min(4, tp < 1 ? 0 : Math.floor((tp - 1) / SEG) + 1)]; void k; g.fillStyle = "#1d2a4d"; g.font = "bold 12px Malgun Gothic,sans-serif"; g.textAlign = "left"; g.fillText("지금: " + msg, 6, y0 + bh + 18); } // 지금 진행 중인 단계 문장 / sentence for the current step
      g.fillStyle = "#6e4c82"; g.font = "12px Malgun Gothic,sans-serif"; g.textAlign = "left"; g.font = "12px Malgun Gothic,sans-serif"; g.fillText("① 양자 특징 AI: 겹침 신호를 만듦(고정 회로, 학습 안 함)", 6, 14); g.fillStyle = "#a9482a"; g.fillText("② 메타러너: 그 신호를 사람마다 얼마나 믿을지 빠르게 맞춤(학습함)", 6, 31); // 역할 분담 설명임 / explanation of roles
      g.fillStyle = "#a9482a"; g.textAlign = "right"; g.fillText("↺ 바깥 루프: 여러 사람의 적응 결과로 θ를 고침(" + m.it + "회)", W - 6, y0 + bh + 18); g.textAlign = "left"; // 메타 루프 설명임 / explanation of the meta loop
    }
    function drawNet() {                             // 3→6→1 신경망: θ(공통) 또는 θ′(개인 적응 중) / 3→6→1 network: θ (shared) or θ′ (adapting to a person)
      const t = m.last[cur], path = t ? t.path : [m.theta], w = path[Math.min(sub, path.length - 1)], w0 = path[0]; // 지금 보여 줄 가중치와 시작점임 / weights shown now and the start
      const P = A.canvas($("#mNet", el), Math.max(200, el.clientHeight - 300)), g = P.g, H = QP.Meta.H; // 캔버스임 / canvas
      const xi = 130, xh = P.w * .55, xo = P.w - 90, yi = function (k) { return P.h * (.2 + k * .3); }, yh = function (j) { return 18 + j * (P.h - 36) / (H - 1); }; // 위치임 / positions
      const names = ["심박(bpm)", "경사", "양자 겹침 ⟨Z⟩"], cols = ["#003087", "#003087", "#6e4c82"]; // 입력 이름과 색임 / input names and colors
      let mx = .01; w.W1.forEach(function (r) { r.forEach(function (v) { mx = Math.max(mx, Math.abs(v)); }); }); // 최대 가중치임 / maximum weight
      for (let j = 0; j < H; j++) for (let k = 0; k < 3; k++) { const v = w.W1[j][k], d = Math.abs(v - w0.W1[j][k]); g.strokeStyle = d > .15 && sub > 0 ? "rgba(255,181,0,.95)" : (v > 0 ? "rgba(0,48,135," : "rgba(199,107,103,") + (.15 + .75 * Math.abs(v) / mx) + ")"; g.lineWidth = .6 + 4 * Math.abs(v) / mx; g.beginPath(); g.moveTo(xi, yi(k)); g.lineTo(xh, yh(j)); g.stroke(); } // 입력→은닉 연결임 / input → hidden connections
      for (let j = 0; j < H; j++) { const v = w.W2[j], d = Math.abs(v - w0.W2[j]); g.strokeStyle = d > .15 && sub > 0 ? "rgba(255,181,0,.95)" : (v > 0 ? "rgba(0,48,135," : "rgba(199,107,103,") + Math.min(1, .25 + Math.abs(v) / 3) + ")"; g.lineWidth = .8 + Math.min(5, Math.abs(v) * 1.5); g.beginPath(); g.moveTo(xh, yh(j)); g.lineTo(xo, P.h / 2); g.stroke(); } // 은닉→출력 연결임 / hidden → output connections
      g.font = "13px Malgun Gothic,sans-serif"; g.textAlign = "right"; for (let k = 0; k < 3; k++) { g.fillStyle = cols[k]; g.beginPath(); g.arc(xi, yi(k), 9, 0, 7); g.fill(); g.fillStyle = "#1d2a4d"; g.fillText(names[k], xi - 14, yi(k) + 5); } // 입력 뉴런임 / input neurons
      for (let j = 0; j < H; j++) { g.fillStyle = "#ffb500"; g.strokeStyle = "#8892ad"; g.beginPath(); g.arc(xh, yh(j), 9, 0, 7); g.fill(); g.stroke(); } // 은닉 뉴런임 / hidden neurons
      g.fillStyle = "#a9482a"; g.beginPath(); g.arc(xo, P.h / 2, 15, 0, 7); g.fill(); g.fillStyle = "#1d2a4d"; g.textAlign = "center"; g.fillText("위험 점수", xo, P.h / 2 + 34); // 출력 뉴런임 / output neuron
      g.textAlign = "left"; g.fillStyle = sub > 0 ? "#c38a2b" : "#a9482a"; g.font = "bold 13px Malgun Gothic,sans-serif"; g.fillText(sub > 0 ? "개인 적응 θ′: " + sub + "걸음째 (" + (t.p.sex === "F" ? "여 " : "남 ") + t.p.age + "세)" : "공통 시작점 θ (메타 " + m.it + "회)", 8, 16); // 상태 글자임 / status text
    }
    function drawPar() {                             // 가중치 공간 그림: θ 궤적(바깥 루프)과 사람별 적응 화살표(안쪽 루프) / weight-space plot: θ trajectory (outer loop) and per-person adaptation arrows (inner loop)
      const P = A.canvas($("#mPar", el), 150), g = P.g, pts = hist.slice(-120); m.last.forEach(function (t) { pts.push(proj(t.path[t.path.length - 1])); }); pts.push(proj(m.theta)); // 그릴 점들임 / points to draw
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); // 범위임 / range
      const sx = function (v) { return 14 + (v - x0) / Math.max(1e-6, x1 - x0) * (P.w - 28); }, sy = function (v) { return P.h - 12 - (v - y0) / Math.max(1e-6, y1 - y0) * (P.h - 46); }; // 화면 좌표임 / screen coordinates
      g.strokeStyle = "rgba(169,72,42,.6)"; g.lineWidth = 2; g.beginPath(); hist.slice(-120).forEach(function (p, i) { if (i) g.lineTo(sx(p[0]), sy(p[1])); else g.moveTo(sx(p[0]), sy(p[1])); }); g.stroke(); // θ 궤적임 / θ trajectory
      m.last.forEach(function (t, i) { g.strokeStyle = i === cur ? "#c38a2b" : "rgba(195,138,43,.45)"; g.lineWidth = i === cur ? 2.5 : 1.3; g.beginPath(); t.path.slice(0, i === cur ? sub + 1 : t.path.length).forEach(function (w, k) { const q = proj(w); if (k) g.lineTo(sx(q[0]), sy(q[1])); else g.moveTo(sx(q[0]), sy(q[1])); }); g.stroke(); const e = proj(t.path[i === cur ? Math.min(sub, t.path.length - 1) : t.path.length - 1]); g.fillStyle = "#c38a2b"; g.beginPath(); g.arc(sx(e[0]), sy(e[1]), i === cur ? 6 : 4, 0, 7); g.fill(); }); // 사람별 적응 경로와 끝점 θ′임 / per-person adaptation paths and end points θ′
      const c = proj(m.theta); g.fillStyle = "#a9482a"; g.beginPath(); g.arc(sx(c[0]), sy(c[1]), 8, 0, 7); g.fill(); g.fillStyle = "#1d2a4d"; g.font = "bold 12px Malgun Gothic,sans-serif"; g.fillText("θ", sx(c[0]) + 10, sy(c[1]) - 6); // 현재 θ임 / current θ
      g.font = "11px Malgun Gothic,sans-serif"; g.fillStyle = "#1d2a4d"; g.fillText("주황 선 = θ가 지나온 길(바깥 루프, 메타 갱신)", 6, 12); g.fillText("금색 = 사람별 5걸음 적응 θ′ (가중치 31개를 2차원으로 투영)", 6, 26); // 범례임 / legend
    }
    function drawSide() {                            // 적응 곡선, 숫자, 사람 카드, 근거임 / adaptation curve, numbers, person cards, evidence
      C.line($("#mAd", el), [{ values: ev.meta, color: "#a9482a" }, { values: ev.rand, color: "#8892ad" }], { height: 100, min: .4, max: 1, xLabel: "적응 걸음 → (주황: 메타 시작점, 회색: 무작위 시작점)" }); // 곡선임 / curves
      $("#mNum", el).innerHTML = "처음 보는 12명 평균 정확도: 메타 시작점 <b class='c-plum'>" + pct(ev.meta[0]) + " → 1걸음 " + pct(ev.meta[1]) + " → 5걸음 " + pct(ev.meta[5]) + "</b>, 무작위 시작점 " + pct(ev.rand[0]) + " → 5걸음 " + pct(ev.rand[5]) + ". 메타 손실 " + (m.loss.length ? m.loss[0].toFixed(3) + " → " + m.loss[m.loss.length - 1].toFixed(3) : "-"); // 수치임 / numbers
      $("#mPeople", el).innerHTML = "<b>이번 산행자 " + m.last.length + "명</b> (적응 전 → 5걸음 뒤): " + m.last.map(function (t, i) { return (i === cur ? "▶" : "") + (t.p.sex === "F" ? "여" : "남") + t.p.age + "세 " + pct(t.before) + "→<b>" + pct(t.after) + "</b>"; }).join(", "); // 사람 카드임 / person cards
    }
    function drawAll() { drawFlow(); drawNet(); drawPar(); drawSide(); } // 전부 그림 / draw everything
    $("#mB", el).innerHTML = B.box({ data: "가상 산행자(여/남, 25~79세, 안정심박 52~81): 입력 [심박/200, 경사, 양자 겹침 ⟨Z⟩(부담, 피로)], 정답은 개인 %HRR 기준(사람마다 경계가 다름). 실제 적용 시 아이나비 개인 워치 기록으로 교체", method: "FOMAML: 사람(과제)마다 기록 10개로 5걸음 적응(안쪽 루프, 학습률 0.8) → 평가 기록 30개의 기울기를 평균해 θ 갱신(바깥 루프, 0.25)", formula: "θ′ = θ − α∇L_support(θ),  θ ← θ − β·평균∇L_query(θ′),  ⟨Z⟩ = cos(πa)cos(πb)", code: "meta.js create(), metaStep(), evaluate() / views_ai.js meta()", ref: "Finn, Abbeel & Levine, ICML 2017(MAML), Nichol et al. 2018(1차 근사), Gulati 2010, Tanaka 2001", note: "양자 회로는 고정된 특징 생성기이고, 학습되는 것은 메타러너의 가중치 31개임. 정확도는 가상 자료 기준이며 실측 검증 전임" }, "메타학습 근거");
    function tick() {                                // 0.7초마다: 적응 걸음을 한 칸 보여 주고, 끝나면 다음 사람, 한 바퀴 돌면 메타 갱신 / every 0.7 s: show one adaptation step; then the next person; after a full round, a meta update
      sub++; if (!m.last.length || sub > m.inner) { sub = 0; cur++; if (cur >= m.last.length) { cur = 0; for (let k = 0; k < 25; k++) { QP.Meta.metaStep(m, 4); if (k % 5 === 0) hist.push(proj(m.theta)); } ev = QP.Meta.evaluate(m); } } // 다음 단계로 감 / go to the next step
      drawAll(); if (m.it >= 600 && timer) { clearInterval(timer); timer = null; } // 그림을 갱신하고 충분하면 멈춤 / update the drawing and stop when enough
    }
    $("#mGo", el).onclick = function () { if (timer) return; if (!QP.State.touring) QP.Voice.speak("메타 학습을 시작합니다. 금색 화살표는 한 사람에게 맞추는 다섯 걸음이고, 주황 선은 여러 사람의 결과로 공통 시작점이 옮겨 가는 길입니다. 시작점이 좋아질수록 새 사람도 한두 걸음 만에 맞춰집니다.", true); timer = setInterval(tick, 700); }; // 시작임 / start
    $("#mSt", el).onclick = function () { clearInterval(timer); timer = null; }; // 멈춤임 / stop
    $("#mRe", el).onclick = function () { clearInterval(timer); timer = null; m = QP.Meta.create(77); hist = []; cur = 0; sub = 0; QP.Meta.metaStep(m, 4); hist.push(proj(m.theta)); ev = QP.Meta.evaluate(m); drawAll(); }; // 초기화임 / reset
    QP.Meta.metaStep(m, 4); hist.push(proj(m.theta)); drawAll(); // 처음 한 번 준비함 / prepare once at first
    const flowLoop = setInterval(drawFlow, 120);    // 관계도의 신호 점은 계속 흐르게 함 / keep the signal dots in the diagram flowing
    return function () { clearInterval(timer); clearInterval(flowLoop); }; // 떠날 때 정리함 / clean up when leaving
  }

  QP.ViewDefs = (QP.ViewDefs || []).concat([        // 화면 정의를 등록함 / register the screen definitions
    { id: "persona", group: "AI 학습과 순환", title: "초개인화 실험실(개인 심박)", render: persona },
    { id: "dnn", group: "AI 학습과 순환", title: "AI DNN 학습 관제", render: dnn },
    { id: "meta", group: "AI 학습과 순환", title: "AI 메타학습(사람마다 빠른 적응)", render: meta },
    { id: "vqc", group: "AI 학습과 순환", title: "VQC(회로 자체 학습)", render: vqc },
    { id: "eco", group: "AI 학습과 순환", title: "양자와 AI 학습 선순환(에코 사이클)", render: eco }
  ]);
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
