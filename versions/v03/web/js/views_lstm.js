/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Screen: real LSTM training experiment for time-accumulated risk (moment model vs LSTM vs LSTM + quantum overlap inputs). */
/* =====================================================================
 * views_lstm.js (2026-11-17) : "LSTM 실제 학습 실험" 화면
 *  6단계를 차례로 보여 주며, 단계마다 설명을 다 읽은 뒤에만 다음 단계로 넘어감
 *  ① 산행 시계열 만들기 ② 정답 붙이기(쌓인 부담) ③ 세 모델을 같은 조건으로 학습(BPTT, Adam) ④ 시험 산행 80개 채점
 *  ⑤ 미리 알림 시간 비교(시험 산행 하나를 그림으로) ⑥ 판정과 의미(씨앗 3개 평균)
 *  계산은 lstmlab.js, 그림은 이 파일이 맡음(레고 부품 분리)
 * ===================================================================== */
(function (QP) {
  "use strict";
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const en = function () { return QP.I18N && QP.I18N.lang() === "en"; }, L = function (k, e) { return en() ? e : k; };
  const F = "Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif", pct = function (v) { return (v * 100).toFixed(1) + "%"; };
  const MC = [["now", "순간 모델(지금 10분 값만)", "Moment model (current 10 min only)", "#8a8f9c"], ["lc", "LSTM(일반 입력 4개)", "LSTM (4 plain inputs)", "#003087"], ["lq", "LSTM + 양자 겹침 입력 2개", "LSTM + 2 quantum overlap inputs", "#8e24aa"]];
  const SIG = [["심박 부담", "heart-rate load", "#c62828"], ["배터리 부족", "battery deficit", "#00897b"], ["비", "rain", "#1e63c6"], ["경사", "slope", "#8a6d3b"]];
  const ST = [["산행 시계열 만들기", "Make hike time series"], ["정답 붙이기(쌓인 부담)", "Label (accumulated strain)"], ["세 모델을 같은 조건으로 학습", "Train 3 models equally"], ["시험 산행 80개 채점", "Score 80 test hikes"], ["미리 알림 시간 비교", "Compare early warning"], ["판정과 의미(씨앗 3개 평균)", "Verdict (3-seed mean)"]];
  const CK = [5, 15, 40];
  function say(t, user) { if (QP.State.touring) return QP.Pace.say(t); if (user) return QP.Voice.speak(t, true, true); return QP.Pace.say(t); }
  function after(mark, min, cb, alive) { const t0 = Date.now(); (function w() { if (!alive()) return; if (Date.now() - t0 < min || (!QP.Voice.finished(mark) && Date.now() - t0 < 600000)) { setTimeout(w, 300); return; } cb(); })(); }
  function point(e) { if (!e || !QP.App || !QP.App.pointAt) return; try { e.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (x) { } setTimeout(function () { if (!e.isConnected) return; const r = e.getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < innerHeight) QP.App.pointAt(r.left + Math.min(40, r.width / 2), r.top + 26); }, 500); }

  function render(el) {
    el.innerHTML = '<div class="grid lstmv"><div class="stack">' +
      '<div class="card" id="kSet"><div class="row" style="justify-content:space-between"><h3>' + L("LSTM 실제 학습 실험: 시간이 쌓여야 생기는 위험", "Real LSTM training: risk that builds up over time") + QP.Guide.btn("lstm") + '</h3><div class="btns"><button id="kGo" class="primary">▶ ' + L("학습 실험 시작", "Start experiment") + '</button><button id="kStop">' + L("멈춤", "Stop") + '</button></div></div>' +
      '<div class="mc-ctl"><b>' + L("학습 산행 수", "Training hikes") + "</b> " + [20, 40, 160].map(function (n, i) { return '<label><input type="radio" name="kN" value="' + n + '"' + (n === 160 ? " checked" : "") + "> " + (i + 1) + ". " + n + L("개", "") + (n === 20 ? L("(적은 자료)", " (little data)") : n === 160 ? L("(충분)", " (enough)") : "") + "</label>"; }).join(" ") + "</div>" +
      '<ol class="mc-st" id="kSt">' + ST.map(function (s, i) { return '<li data-i="' + i + '">' + L(s[0], s[1]) + "</li>"; }).join("") + '</ol><p class="small" id="kSay">' + L("▶ 학습 실험 시작을 누르면 6단계를 차례로 보여 드립니다. 단계마다 설명이 끝난 뒤 다음으로 넘어갑니다.", "Press ▶ Start: the 6 steps are shown in order, each after its explanation ends.") + "</p></div>" +
      '<div class="card" id="kSeqC"><h3>' + L("① ② 산행 한 번의 시계열과 정답(10분 × 20단계)", "1, 2. One hike's time series and labels (10 min × 20 steps)") + QP.Guide.btn("lstm") + '</h3><canvas id="kSeq"></canvas></div>' +
      '<div class="card" id="kLossC"><h3>' + L("③ 학습 과정: 세 모델의 손실(틀린 정도, 내려갈수록 좋음)", "3. Training: loss of the three models (lower is better)") + QP.Guide.btn("lstm") + '</h3><canvas id="kLoss"></canvas></div></div>' +
      '<div class="stack"><div class="card" id="kTestC"><h3>' + L("④ ⑤ 시험 산행 하나: 세 모델의 위험 점수와 첫 경보", "4, 5. One test hike: risk scores and first alarms") + QP.Guide.btn("lstm") + '</h3><canvas id="kTest"></canvas></div>' +
      '<div class="card" id="kResC"><h3>' + L("⑥ 채점표(학습 5, 15, 40바퀴) 와 의미", "6. Scorecard (after 5, 15, 40 epochs) and meaning") + QP.Guide.btn("lstm") + '</h3><canvas id="kBar"></canvas><div id="kTbl"></div><p class="small" id="kMean"></p></div><div class="card"><div id="kB"></div></div></div></div>';
    $("#kB", el).innerHTML = QP.Basis.box({ data: L("가상 산행 시계열(한 산행 10분 × 20단계). 워치 신호 4개 [심박 부담, 배터리 부족, 비, 경사], 보이지 않는 피로는 경사에서 쌓이고 쉼터에서 줄어듦. 학습 160개(또는 20, 40개), 시험 80개(학습과 다른 씨앗)", "Virtual hike series (10 min × 20 steps). 4 watch signals [heart-rate load, battery deficit, rain, slope]; hidden fatigue builds on slopes and drops at shelters. 160 (or 20, 40) training hikes, 80 test hikes (different seed)"),
      method: L("정답 = 쌓인 부담 S가 1.9를 넘는 단계. 세 모델 모두 같은 미니배치(16개), 같은 갱신 횟수, Adam. LSTM 은닉 8개, 시간 역전파(BPTT), 기울기 ±5 자름. 채점은 정상 구간 오경보 10% 문턱", "Label = steps where accumulated strain S exceeds 1.9. All three models use the same minibatches (16), the same number of updates and Adam. LSTM hidden size 8, BPTT, gradients clipped at ±5. Scoring at the threshold giving 10% false alarms on normal steps"),
      formula: "S_t = 0.82 S_(t−1) + 피로×경사 + 0.8 비×경사 + 0.25 배터리×피로,  c_t = f⊙c_(t−1) + i⊙g,  h_t = o⊙tanh(c_t),  ⟨Z⟩ = cos(πa)cos(πb)", code: "lstmlab.js create(), epoch(), evaluate() / views_lstm.js render()",
      ref: "Hochreiter & Schmidhuber 1997(LSTM), Gers 등 2000(망각 게이트), Werbos 1990(BPTT), Kingma & Ba 2015(Adam), Fawcett 2006(ROC, AUC)", note: L("가중치는 실제로 학습됨(손으로 정한 값 아님). 결과는 가상 자료 기준이며 실제 아이나비 시계열로 다시 확인해야 함", "Weights are actually trained (not hand-set). Results are on virtual data and must be rechecked on real iNavi time series") }, L("LSTM 학습 실험 근거", "Evidence for the LSTM experiment"));
    const st = { tok: 0, stage: -1, E: null, ex: 0, cur: 20, snaps: [], avg: null, seqT: 20, testT: 0, testOn: false };
    function stage(i) { st.stage = i; el.querySelectorAll("#kSt li").forEach(function (li, k) { li.className = k < i ? "done" : k === i ? "on" : ""; }); const tg = [$("#kSeqC", el), $("#kSeqC", el), $("#kLossC", el), $("#kTestC", el), $("#kTestC", el), $("#kResC", el)][i]; if (tg) point(tg); }
    // ---- 그림 1: 시계열과 정답 / plot 1 ----
    function drawSeq() {
      const cv = $("#kSeq", el); if (!cv || !cv.isConnected) return; const P = QP.Anim.canvas(cv, 310), g = P.g, W = P.w, H = P.h;
      const E = st.E || QP.LSTMLab.create(7), h = E.train.c[st.ex], raw = h.X, S = h.S, x0 = 44, x1 = W - 12, yT = 14, yB = H - 140, X = function (t) { return x0 + t / 19 * (x1 - x0); }, Y = function (v) { return yB - v * (yB - yT); };
      const n = Math.min(20, Math.ceil(st.seqT));
      g.strokeStyle = "#e5e8f0"; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x0, Y(k / 4)); g.lineTo(x1, Y(k / 4)); g.stroke(); }
      // 정답 띠(분홍) / risk band
      if (st.stage >= 1) h.y.forEach(function (y, t) { if (y && t < n) { g.fillStyle = "rgba(216,27,96,.14)"; g.fillRect(X(t) - (x1 - x0) / 38, yT, (x1 - x0) / 19, yB - yT); } });
      SIG.forEach(function (s, k) { g.strokeStyle = s[2]; g.lineWidth = 2; g.beginPath(); for (let t = 0; t < n; t++) { const v = raw[t][k]; if (t) g.lineTo(X(t), Y(v)); else g.moveTo(X(t), Y(v)); } g.stroke(); });
      const Fh = h.F || null; if (Fh) { g.strokeStyle = "#9aa3ba"; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); for (let t = 0; t < n; t++) { if (t) g.lineTo(X(t), Y(Fh[t])); else g.moveTo(X(t), Y(Fh[t])); } g.stroke(); g.setLineDash([]); }
      // 쌓인 부담 막대(아래) / accumulated strain bars
      const yb0 = H - 8, bh = 64, smax = 3.2;
      if (st.stage >= 1) for (let t = 0; t < n; t++) { const v = Math.min(1, S[t] / smax); g.fillStyle = S[t] > 1.9 ? "#c62828" : "#ef7d00"; g.fillRect(X(t) - 6, yb0 - v * bh, 12, v * bh); }
      if (st.stage >= 1) { const yl = yb0 - 1.9 / smax * bh; g.strokeStyle = "#c62828"; g.setLineDash([5, 3]); g.beginPath(); g.moveTo(x0, yl); g.lineTo(x1, yl); g.stroke(); g.setLineDash([]); g.fillStyle = "#c62828"; g.font = "bold 10.5px " + F; g.textAlign = "right"; g.fillText(L("기준 1.9", "threshold 1.9"), x1, yl - 3); }
      g.fillStyle = "#1d2a4d"; g.font = "10.5px " + F; g.textAlign = "center"; [0, 5, 10, 15, 19].forEach(function (t) { g.fillText((t + 1) * 10 + L("분", "m"), X(t), yB + 12); });
      g.textAlign = "left"; g.font = "11px " + F; let lx = 4; SIG.forEach(function (s, k) { g.fillStyle = s[2]; g.fillRect(lx, yB + 21, 9, 9); g.fillStyle = "#1d2a4d"; const tx = (k + 1) + ". " + L(s[0], s[1]); g.fillText(tx, lx + 12, yB + 30); lx += g.measureText(tx).width + 26; });
      g.fillStyle = "#9aa3ba"; g.fillText("5. ┄ " + L("피로(워치로 못 잼)", "fatigue (not measured)"), lx, yB + 30);
      g.fillStyle = "#ef7d00"; g.fillText(L("6. 막대 = 쌓인 부담 S (빨강은 기준 초과 = 위험 정답)", "6. bars = accumulated strain S (red = above threshold = risk label)"), 4, yB + 46);
      if (st.stage >= 1) { g.fillStyle = "#d81b60"; g.textAlign = "right"; g.fillText(L("7. 분홍 띠 = 위험 정답 구간", "7. pink band = risk label"), x1, yB + 46); }
      if (n < 20) { g.strokeStyle = "#ffb500"; g.lineWidth = 2; g.beginPath(); g.moveTo(X(n - 1), yT); g.lineTo(X(n - 1), yB); g.stroke(); }
    }
    // ---- 그림 2: 손실 곡선 / plot 2 ----
    function drawLoss() {
      const cv = $("#kLoss", el); if (!cv || !cv.isConnected) return; const P = QP.Anim.canvas(cv, 190), g = P.g, W = P.w, H = P.h, E = st.E, x0 = 40, x1 = W - 10, yT = 10, yB = H - 40;
      g.strokeStyle = "#e5e8f0"; g.strokeRect(x0, yT, x1 - x0, yB - yT);
      const X = function (e) { return x0 + e / 39 * (x1 - x0); }, Y = function (v) { return yB - Math.min(1, v / .7) * (yB - yT); };
      CK.forEach(function (c) { g.strokeStyle = "#ffb500"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(c - 1), yT); g.lineTo(X(c - 1), yB); g.stroke(); g.setLineDash([]); g.fillStyle = "#a06a00"; g.font = "10.5px " + F; g.textAlign = c === 40 ? "right" : "center"; g.fillText(c + L("바퀴 채점", " ep. scored"), X(c - 1), yB + 12); });
      if (E) MC.forEach(function (m) { const a = E.loss[m[0]]; if (a.length < 1) return; g.strokeStyle = m[3]; g.lineWidth = 2.4; g.beginPath(); a.forEach(function (v, e) { if (e) g.lineTo(X(e), Y(v)); else g.moveTo(X(e), Y(v)); }); g.stroke(); const e = a.length - 1; g.fillStyle = m[3]; g.beginPath(); g.arc(X(e), Y(a[e]), 4, 0, 7); g.fill(); });
      g.fillStyle = "#1d2a4d"; g.font = "10.5px " + F; g.textAlign = "right"; [0, .35, .7].forEach(function (v) { g.fillText(v.toFixed(2), x0 - 4, Y(v) + 4); });
      g.textAlign = "left"; g.font = "11px " + F; MC.forEach(function (m, i) { g.fillStyle = m[3]; g.fillRect(x0 + i * (x1 - x0) / 3, H - 13, 10, 10); g.fillStyle = "#1d2a4d"; g.fillText((i + 1) + ". " + L(m[1], m[2]) + (E && E.loss[m[0]].length ? " " + E.loss[m[0]][E.loss[m[0]].length - 1].toFixed(3) : ""), x0 + i * (x1 - x0) / 3 + 13, H - 4); });
      g.fillStyle = "#1d2a4d"; g.font = "bold 12px " + F; g.fillText(L("학습 바퀴 ", "epoch ") + (E ? E.ep : 0) + " / 40", x0 + 6, yT + 14);
    }
    // ---- 그림 3: 시험 산행 하나 / plot 3 ----
    function drawTest() {
      const cv = $("#kTest", el); if (!cv || !cv.isConnected) return; const P = QP.Anim.canvas(cv, 260), g = P.g, W = P.w, H = P.h, E = st.E, x0 = 40, x1 = W - 12, yT = 12, yB = H - 86;
      const X = function (t) { return x0 + t / 19 * (x1 - x0); }, Y = function (v) { return yB - v * (yB - yT); };
      g.strokeStyle = "#e5e8f0"; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x0, Y(k / 4)); g.lineTo(x1, Y(k / 4)); g.stroke(); }
      g.fillStyle = "#1d2a4d"; g.font = "10.5px " + F; g.textAlign = "right"; [0, .5, 1].forEach(function (v) { g.fillText(v.toFixed(1), x0 - 4, Y(v) + 4); });
      if (!E || !st.res || st.th == null) { g.textAlign = "left"; g.font = "12px " + F; g.fillText(L("학습이 끝나면 처음 보는 시험 산행에서 세 모델이 매긴 위험 점수가 왼쪽부터 그려집니다.", "After training, the risk scores the three models give to an unseen test hike are drawn from the left."), x0 + 6, Y(.5)); return; }
      const h = st.th, y = E.test.c[h].y, n = Math.min(20, Math.ceil(st.testT)), R = st.res;
      y.forEach(function (v, t) { if (v) { g.fillStyle = "rgba(216,27,96,.16)"; g.fillRect(X(t) - (x1 - x0) / 38, yT, (x1 - x0) / 19, yB - yT); } });
      MC.forEach(function (m, k) { const p = R[m[0]].P[h], thr = R[m[0]].thr; g.strokeStyle = m[3]; g.lineWidth = k ? 2.6 : 2; g.beginPath(); for (let t = 0; t < n; t++) { if (t) g.lineTo(X(t), Y(p[t])); else g.moveTo(X(t), Y(p[t])); } g.stroke();
        const on = y.indexOf(1); let first = -1; for (let t = Math.max(0, on - 3); t < n; t++) if (p[t] > thr) { first = t; break; }
        if (first >= 0) { const xx = X(first), yy = yB + 8 + k * 13; g.fillStyle = m[3]; g.beginPath(); g.moveTo(xx, yy - 6); g.lineTo(xx - 5, yy + 3); g.lineTo(xx + 5, yy + 3); g.fill(); g.font = "bold 10.5px " + F; g.textAlign = "left"; const d = (on - first) * 10; g.fillText((k + 1) + ". " + (d > 0 ? L(d + "분 미리", d + " min early") : d === 0 ? L("시작과 동시", "at onset") : L(-d + "분 늦게", -d + " min late")), xx + 7, yy + 3); } });
      // LSTM 기억 띠 / LSTM memory
      const mem = st.mem, yb0 = H - 6, bh = 26; if (mem) { const mx = Math.max.apply(null, mem) || 1; for (let t = 0; t < n; t++) { g.fillStyle = "rgba(239,125,0,.75)"; const v = mem[t] / mx; g.fillRect(X(t) - 6, yb0 - v * bh, 12, v * bh); } }
      g.fillStyle = "#ef7d00"; g.font = "10.5px " + F; g.textAlign = "left"; g.fillText(L("주황 막대 = LSTM 기억 띠(셀 상태) 크기: 시간이 지나며 쌓임", "orange bars = LSTM memory (cell state) size: builds over time"), x0, yb0 - bh - 2);
      g.fillStyle = "#d81b60"; g.textAlign = "right"; g.fillText(L("분홍 띠 = 실제 위험 구간, 세모 = 첫 경보", "pink band = real risk, triangle = first alarm"), x1, yT + 10);
      if (n < 20) { g.strokeStyle = "#ffb500"; g.lineWidth = 2; g.beginPath(); g.moveTo(X(n - 1), yT); g.lineTo(X(n - 1), yB); g.stroke(); }
    }
    // ---- 그림 4: 채점 막대 / plot 4 ----
    function drawBar() {
      const cv = $("#kBar", el); if (!cv || !cv.isConnected) return; const P = QP.Anim.canvas(cv, 170), g = P.g, W = P.w, H = P.h, x0 = 70, x1 = W - 60;
      g.fillStyle = "#1d2a4d"; g.font = "bold 12px " + F; g.textAlign = "left"; g.fillText(L("위험 구간 탐지율(정상 구간 오경보 10%로 같게 맞춤), 씨앗 3개 평균", "Detection of risk steps at 10% false alarms on normal steps, mean of 3 seeds"), 4, 14);
      const rows = st.avg || st.snaps.map(function (s) { return s.r; }); const gh = (H - 40) / 3;
      CK.forEach(function (c, r) { const y = 24 + r * gh; g.fillStyle = "#1d2a4d"; g.font = "bold 11px " + F; g.textAlign = "left"; g.fillText(c + L("바퀴", " ep."), 4, y + gh / 2 + 3); const R = rows[r]; if (!R) return;
        MC.forEach(function (m, k) { const v = R[m[0]].stepRecall, a = Math.min(1, st.barA || 0), bh = (gh - 6) / 3; g.fillStyle = m[3]; g.fillRect(x0, y + k * bh, (x1 - x0) * v * a, bh - 2); g.fillStyle = "#1d2a4d"; g.font = "10.5px " + F; g.fillText(pct(v * a), x0 + (x1 - x0) * v * a + 4, y + k * bh + bh - 3); }); });
    }
    const loop = setInterval(function () { if (st.seqT < 20) st.seqT += .08; if (st.testOn && st.testT < 20) st.testT += .06; if (st.barA < 1) st.barA = Math.min(1, (st.barA || 0) + .03); drawSeq(); drawLoss(); drawTest(); drawBar(); }, 60);
    function table() {
      const rows = st.avg || [], src = st.avg ? L("씨앗 3개 평균", "mean of 3 seeds") : L("씨앗 1개", "1 seed");
      $("#kTbl", el).innerHTML = rows.length ? '<table class="labtbl"><tr><th>' + L("학습 바퀴", "Epochs") + "</th><th>" + L("모델", "Model") + "</th><th>AUC</th><th>" + L("위험 구간 탐지율", "Risk-step detection") + "</th><th>" + L("사건 탐지(산행)", "Events caught") + "</th><th>" + L("평균 첫 경보", "Mean first alarm") + "</th></tr>" +
        rows.map(function (R, r) { return MC.map(function (m, k) { const o = R[m[0]]; return "<tr>" + (k ? "" : '<td rowspan="3"><b>' + CK[r] + "</b></td>") + '<td style="color:' + m[3] + '">' + (k + 1) + ". " + L(m[1], m[2]) + "</td><td>" + o.auc.toFixed(3) + "</td><td>" + pct(o.stepRecall) + "</td><td>" + pct(o.recall) + "</td><td>" + (o.lead >= 0 ? L(o.lead.toFixed(1) + "분 미리", o.lead.toFixed(1) + " min early") : L((-o.lead).toFixed(1) + "분 늦게", (-o.lead).toFixed(1) + " min late")) + "</td></tr>"; }).join(""); }).join("") + "</table><p class='small'>" + src + L(", 시험 산행 80개, 사건 탐지는 사건 30분 전부터 끝까지 사이 경보", ", 80 test hikes; an event counts as caught if an alarm comes from 30 min before onset to its end") + "</p>" : "";
    }
    function mean(list) { const o = {}; ["now", "lc", "lq"].forEach(function (w) { o[w] = {}; ["auc", "stepRecall", "recall", "lead"].forEach(function (k) { o[w][k] = list.reduce(function (a, R) { return a + R[w][k]; }, 0) / list.length; }); }); return o; }
    function verdict(A) {
      const a = A[2], b = A[0], d40 = a.lq.auc - a.lc.auc, d5 = b.lq.auc - b.lc.auc, p3 = function (v) { return v.toFixed(3); };
      return L("씨앗 3개 평균으로, 40바퀴 학습 뒤 AUC는 1번 순간 모델 " + p3(a.now.auc) + ", 2번 LSTM " + p3(a.lc.auc) + ", 3번 LSTM과 양자 겹침 " + p3(a.lq.auc) + "입니다. 위험 구간 탐지율은 " + pct(a.now.stepRecall) + ", " + pct(a.lc.stepRecall) + ", " + pct(a.lq.stepRecall) + "로, 시간을 기억하는 LSTM이 지금 순간만 보는 모델보다 " + (a.lc.stepRecall - a.now.stepRecall > .05 ? "분명히 낫습니다. " : "조금 낫습니다. ") +
        "양자 겹침 입력의 효과는 학습 5바퀴에서 AUC " + p3(b.lq.auc) + " 대 " + p3(b.lc.auc) + "로 " + (d5 > .02 ? "더 빨리 배웠고, " : d5 < -.02 ? "오히려 느렸고, " : "차이가 없었고, ") + "40바퀴 뒤에는 차이 " + (d40 >= 0 ? "+" : "") + d40.toFixed(3) + "로 " + (Math.abs(d40) < .01 ? "사실상 같습니다. " : d40 > 0 ? "조금 높습니다. " : "조금 낮습니다. ") + "즉 양자 겹침 입력은 최종 정확도의 한계를 올리기보다, 자료가 적거나 학습이 짧을 때 도움이 되는지가 핵심이며, 학습 산행 수를 20개로 바꾸어 확인해 보실 수 있습니다. 결과는 가상 자료 기준이므로 실제 아이나비 시계열로 다시 확인해야 합니다.",
        "Averaged over 3 seeds, after 40 epochs the AUC is 1, moment model " + p3(a.now.auc) + "; 2, LSTM " + p3(a.lc.auc) + "; 3, LSTM with quantum overlap " + p3(a.lq.auc) + ". Risk-step detection is " + pct(a.now.stepRecall) + ", " + pct(a.lc.stepRecall) + ", " + pct(a.lq.stepRecall) + ", so the LSTM, which remembers time, is " + (a.lc.stepRecall - a.now.stepRecall > .05 ? "clearly better " : "a little better ") + "than the model that only sees the current moment. " +
        "For the quantum overlap inputs, after 5 epochs the AUC was " + p3(b.lq.auc) + " versus " + p3(b.lc.auc) + ", so it " + (d5 > .02 ? "learned faster; " : d5 < -.02 ? "learned more slowly; " : "made no difference; ") + "after 40 epochs the gap is " + (d40 >= 0 ? "+" : "") + d40.toFixed(3) + ", " + (Math.abs(d40) < .01 ? "practically equal. " : d40 > 0 ? "slightly higher. " : "slightly lower. ") + "So the key question for quantum overlap inputs is whether they help with little data or short training rather than raising the final ceiling; you can check by switching to 20 training hikes. Results are on virtual data and must be rechecked on real iNavi time series.");
    }
    const TX = [
      ["1단계, 산행 시계열을 만듭니다. 한 산행은 10분 간격 스무 단계, 3시간 20분입니다. 워치가 재는 신호는 1번 심박 부담, 2번 배터리 부족, 3번 비, 4번 경사이고, 5번 회색 점선은 워치로 직접 잴 수 없는 피로입니다. 노란 세로선이 시간을 따라 오른쪽으로 갑니다.", "Step 1, we make the hike time series. One hike has twenty 10-minute steps, 3 hours 20 minutes. The watch measures 1, heart-rate load; 2, battery deficit; 3, rain; and 4, slope. 5, the gray dotted line, is fatigue, which the watch cannot measure directly. The yellow line moves right with time."],
      ["2단계, 정답을 붙입니다. 경사에서 쌓인 피로와 비 속의 경사 부담이 시간이 지나며 쌓입니다. 아래 막대가 쌓인 부담이고, 빨간 점선 기준을 넘으면 위험 정답이 되어 분홍 띠로 표시됩니다. 지금 10분 값만 보아서는 알 수 없는, 시간이 쌓여야 생기는 위험입니다.", "Step 2, we add the labels. Fatigue from slopes and the strain of slopes in the rain build up over time. The bars below are the accumulated strain; above the red dotted threshold the label becomes risk, shown as a pink band. This is risk that only appears as time builds up, which the current 10-minute values alone cannot show."],
      ["3단계, 세 모델을 같은 조건으로 학습합니다. 1번 회색은 지금 10분 값만 보는 순간 모델, 2번 남색은 LSTM, 3번 자주색은 LSTM에 양자 겹침 점수 두 개를 더한 모델입니다. 같은 미니배치, 같은 횟수로 고치며, 손실 곡선이 내려갈수록 잘 맞는 것입니다. LSTM은 시간을 거슬러 오차를 전달하는 시간 역전파로 학습합니다. 노란 점선의 5, 15, 40바퀴에서 채점합니다.", "Step 3, we train the three models under the same conditions. 1, gray, is the moment model that sees only the current 10 minutes; 2, navy, is the LSTM; 3, plum, is the LSTM with two quantum overlap scores added. They are corrected with the same minibatches the same number of times, and a falling loss curve means a better fit. The LSTM learns by backpropagation through time, passing errors back in time. We score at 5, 15 and 40 epochs, the yellow dotted lines."],
      ["4단계, 처음 보는 시험 산행 80개로 채점합니다. 공정하게 비교하려고 정상 구간에서 오경보가 10퍼센트만 나오도록 세 모델의 문턱을 같게 맞춘 뒤, 위험 구간을 얼마나 잡는지 셉니다. 같은 실험을 씨앗 두 개로 더 반복해 평균을 냅니다.", "Step 4, we score on 80 unseen test hikes. For a fair comparison, each model's threshold is set so that only 10 percent of normal steps raise false alarms, and then we count how many risk steps are caught. The same experiment is repeated with two more seeds and averaged."],
      ["5단계, 미리 알림 시간을 봅니다. 오른쪽 위 그림은 시험 산행 하나입니다. 분홍 띠가 실제 위험 구간이고, 세 선이 각 모델의 위험 점수, 아래 세모가 첫 경보입니다. 주황 막대는 LSTM의 기억 띠 크기로, 시간이 지나며 쌓이는 모습을 보여 줍니다.", "Step 5, we look at early warning. The upper right picture is one test hike. The pink band is the real risk period, the three lines are each model's risk score, and the triangles below are first alarms. The orange bars are the size of the LSTM memory, showing how it builds up over time."]];
    function run(user, done) {
      const my = ++st.tok, alive = function () { return my === st.tok && el.isConnected; }, nEl = el.querySelector("input[name=kN]:checked"), N = nEl ? +nEl.value : 160;
      const mkE = function (sd) { const E = QP.LSTMLab.create(sd); E.train.c = E.train.c.slice(0, N); E.train.q = E.train.q.slice(0, N); return E; };
      st.E = mkE(7); st.snaps = []; st.avg = null; st.res = null; st.th = null; st.mem = null; st.testOn = false; st.testT = 0; st.barA = 0; table(); $("#kMean", el).textContent = "";
      // 예시 산행: 위험이 있는 학습 산행 중 사건이 늦게 시작하는 것 / example hike with a late onset
      st.ex = Math.max(0, st.E.train.c.findIndex(function (h) { const on = h.y.indexOf(1); return on >= 8; }));
      const sayStep = function (i, cb, min) { stage(i); const t = TX[i][en() ? 1 : 0]; $("#kSay", el).textContent = (i + 1) + ". " + t; const mk = say(t, user); after(mk, min || 6000, cb, alive); };
      st.seqT = 0;
      sayStep(0, function () { sayStep(1, function () {
        stage(2); const t3 = TX[2][en() ? 1 : 0]; $("#kSay", el).textContent = "3. " + t3; const mk3 = say(t3, user);
        const others = [mkE(8), mkE(9)], snapsAll = [[], [], []];
        (function tr() { if (!alive()) return; QP.LSTMLab.epoch(st.E); others.forEach(function (E) { QP.LSTMLab.epoch(E); });
          if (CK.indexOf(st.E.ep) >= 0) { const R0 = QP.LSTMLab.evaluate(st.E); st.snaps.push({ ep: st.E.ep, r: R0 }); snapsAll[0].push(R0); others.forEach(function (E, k) { snapsAll[k + 1].push(QP.LSTMLab.evaluate(E)); }); st.barA = 0; }
          if (st.E.ep < 40) { setTimeout(tr, N > 100 ? 160 : 260); return; }
          after(mk3, 1000, function () {
            st.res = st.snaps[2].r; st.avg = CK.map(function (_, r) { return mean([snapsAll[0][r], snapsAll[1][r], snapsAll[2][r]]); }); st.barA = 0; table();
            sayStep(3, function () {
              st.th = Math.max(0, st.E.test.c.findIndex(function (h) { return h.y.indexOf(1) >= 8; })); st.mem = QP.LSTMLab.memory(st.E, "lc", st.th); st.testT = 0; st.testOn = true;
              sayStep(4, function () { stage(5); const v = verdict(st.avg); $("#kMean", el).textContent = v; $("#kSay", el).textContent = "6. " + v; const mk = say(v, user); after(mk, 5000, function () { stage(6); if (done) done(); }, alive); }, 12000);
            });
          }, alive); })();
      }); });
    }
    $("#kGo", el).onclick = function () { run(true); };
    $("#kStop", el).onclick = function () { st.tok++; QP.Voice.stop(); };
    if (QP.State.touring) { QP.Pace.hold(true); (function w0() { if (!el.isConnected) return; if (QP.Voice.busy()) { setTimeout(w0, 500); return; } run(false, function () { QP.Pace.hold(false); }); })(); } // 전체 안내 중이면 화면 설명 뒤 자동 실행 / auto-run after the screen narration during the tour
    return function () { st.tok++; clearInterval(loop); QP.Pace.hold(false); };
  }
  QP.ViewDefs = (QP.ViewDefs || []).concat([{ id: "lstmlab", group: "AI 학습과 순환", title: "AI LSTM 학습 실험(시간 누적 위험)", render: render }]);
})(window.QP = window.QP || {});
