/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Animated LSTM cell for "risk that builds up over time" (fatigue, battery): gates, cell-state conveyor belt and a risk curve versus a moment-only model. */
/* =====================================================================
 * lstmviz.js : 시간 누적형 위험(피로 누적, 배터리 감소)을 LSTM 셀 한 개로 단계별 애니메이션 (2026-11-12 신규, 레고 부품)
 * ---------------------------------------------------------------------
 * 한 시간 단계(10분)마다 4개 장면을 차례로 보여 줌
 *  ① 입력 도착 : x_t(피로, 배터리 부족)와 직전 출력 h_(t−1)가 네 게이트로 흘러 들어감
 *  ② 망각 게이트 f : 기억 띠(셀 상태 c)를 얼마나 남길지 곱함, c ← f × c
 *  ③ 입력 게이트 i, 후보 g : 새 정보를 얼마나 더할지, c ← c + i × g
 *  ④ 출력 게이트 o : h_t = o × tanh(c_t) → 누적 위험 점수 = σ(5h − 2.6)
 * 비교선 : 지금 순간 값만 보는 모델 σ(2.2(피로 + 배터리 부족) − 2.4)
 * 가중치 : 교육용으로 손으로 정한 값(학습 전 예시)이며, 실제 모델은 아이나비 시계열로 학습해야 함
 * 근거 : Hochreiter & Schmidhuber, Neural Computation 9(8), 1997 / Gers, Schmidhuber & Cummins, Neural Computation 12(10), 2000(망각 게이트)
 * ===================================================================== */
(function (QP) {
  "use strict";
  const A = QP.Anim;
  const sg = function (z) { return 1 / (1 + Math.exp(-z)); }, th = Math.tanh;
  const W = { f: [-1.2, -0.8, 2.0], i: [2.2, 1.6, -1.8], g: [2.4, 1.8, -0.8], o: [1.8, 1.8, -0.6], h: 1.0 };   // [피로, 배터리 부족, 절편], h는 직전 출력 가중치 / weights
  const COL = { f: "#c62828", i: "#2e7d32", g: "#1e63c6", o: "#8e24aa", c: "#ef7d00", h: "#003087", x1: "#a9482a", x2: "#00897b", now: "#9aa3ba" };   // 서로 다른 천연색 / distinct colors
  // 산행 3시간 20분(10분 × 20단계): 피로는 서서히 오르고, 9~10단계 쉼터에서 잠깐 내려감. 배터리 부족은 꾸준히 오름 / 20 steps of 10 min
  const SEQ = []; for (let t = 0; t < 20; t++) { const rest = t === 9 || t === 10; SEQ.push([Math.min(1, .12 + t * .04 - (rest ? .18 : 0) + (t > 10 ? -.06 : 0)), Math.min(1, .05 + t * .036)]); }
  function run() {                                  // 전체 순서를 미리 계산함 / precompute the whole sequence
    let c = 0, h = 0; const out = [];
    SEQ.forEach(function (x) { const z = function (w) { return w[0] * x[0] + w[1] * x[1] + w[2] + W.h * h; };
      const f = sg(z(W.f)), i = sg(z(W.i)), g = th(z(W.g)), o = sg(z(W.o)), c0 = c; c = f * c + i * g; h = o * th(c);
      out.push({ x: x, f: f, i: i, g: g, o: o, c0: c0, cf: f * c0, c: c, h: h, risk: sg(5 * h - 2.6), now: sg(2.2 * (x[0] + x[1]) - 2.4) }); });
    return out;
  }
  const PH = ["① 입력 도착", "② 망각 게이트 f", "③ 입력 게이트 i와 후보 g", "④ 출력 게이트 o → 누적 위험"];
  function mount(box) {
    box.innerHTML = '<canvas class="lstm-cv"></canvas><div class="lstm-x"></div><div class="lstm-leg">' +
      [["f", "망각 게이트 f(기억을 얼마나 남길지)"], ["i", "입력 게이트 i(새 정보를 얼마나 넣을지)"], ["g", "후보 g(넣을 새 정보)"], ["o", "출력 게이트 o(얼마나 내보낼지)"], ["c", "셀 상태 c(기억 띠)"], ["h", "출력 h, LSTM 누적 위험"], ["x1", "입력: 피로"], ["x2", "입력: 배터리 부족"], ["now", "비교: 지금 순간만 보는 모델"]].map(function (k, n) {
        return '<span><i style="background:' + COL[k[0]] + '"></i>' + (n + 1) + ". " + k[1] + "</span>"; }).join("") + "</div>";
    const cv = box.querySelector(".lstm-cv"), tx = box.querySelector(".lstm-x"), R = run();
    let t = 0, ph = 0, pt = 0, belt = 0, alive = true, spoke = {};
    function text() {
      const r = R[t], m = (t + 1) * 10, hh = Math.floor(m / 60), mm = m % 60, when = (hh ? hh + "시간 " : "") + (mm ? mm + "분" : "");
      const L = [
        "산행 " + when + " 시점: 피로 " + r.x[0].toFixed(2) + ", 배터리 부족 " + r.x[1].toFixed(2) + " 값이 들어옵니다. 직전 출력 h " + (t ? R[t - 1].h.toFixed(2) : "0.00") + "도 함께 네 게이트로 갑니다." + (t === 9 ? " 쉼터에서 쉬어 피로가 잠깐 내려갔습니다." : ""),
        "망각 게이트 f = " + r.f.toFixed(2) + ": 기억 띠 c " + r.c0.toFixed(2) + " × " + r.f.toFixed(2) + " = " + r.cf.toFixed(2) + ". 1에 가까우면 지난 피로를 거의 그대로 기억합니다.",
        "입력 게이트 i = " + r.i.toFixed(2) + ", 후보 g = " + r.g.toFixed(2) + ": c = " + r.cf.toFixed(2) + " + " + r.i.toFixed(2) + " × " + r.g.toFixed(2) + " = <b>" + r.c.toFixed(2) + "</b>. 피로가 쌓일수록 기억 띠가 차오릅니다.",
        "출력 게이트 o = " + r.o.toFixed(2) + ": h = o × tanh(c) = " + r.h.toFixed(2) + " → LSTM 누적 위험 <b>" + (r.risk * 100).toFixed(0) + "%</b>, 지금 순간만 보는 모델 " + (r.now * 100).toFixed(0) + "%." + (r.risk >= .5 && r.now < .5 ? " 지금 순간 값은 아직 경보 기준 아래지만, 쌓인 기억 때문에 LSTM이 먼저 경보합니다." : r.risk < .5 ? " 아직 경보 기준(0.5) 아래입니다." : " 두 모델 모두 경보입니다.") + (t === 9 || t === 10 ? " 쉼터에서 피로가 잠깐 내려가도 망각 게이트가 기억을 대부분 남겨 위험이 바로 사라지지 않습니다." : "")
      ];
      tx.innerHTML = "<b>" + PH[ph] + "</b> (" + (t + 1) + "/" + R.length + "단계) " + L[ph];
      const key = t + "-" + ph;
      if (t === 0 && !spoke[key]) { spoke[key] = 1; QP.Pace.say(["엘에스티엠은 시간이 흐르며 쌓이는 위험을 기억하는 신경망입니다. 첫 단계로 피로와 배터리 부족 입력이 네 개의 게이트로 들어갑니다.", "빨간 망각 게이트는 위쪽 주황 기억 띠를 얼마나 남길지 곱합니다.", "초록 입력 게이트와 파란 후보가 새 정보를 기억 띠에 더합니다.", "보라 출력 게이트가 기억을 내보내 누적 위험 점수가 됩니다. 이 네 장면이 십 분마다 반복되며, 오른쪽 그래프에서 엘에스티엠 위험선이 지금 순간만 보는 회색 선보다 먼저 올라가는 것을 보시기 바랍니다."][ph]); }
    }
    const Wide = function () { return (cv.clientWidth || 600) > 900; };
    const stop = A.loop(function (dt) {
      if (!alive || !cv.isConnected) return;
      pt += dt; belt += dt * 40; const dur = t === 0 ? 4 : 1.1;   // 첫 단계는 천천히, 이후 장면당 1.6초 / slow first step
      if (pt > dur) { pt = 0; ph++; if (ph > 3) { ph = 0; t++; if (t >= R.length) t = 0; } text(); }
      const P = A.canvas(cv, Wide() ? 300 : 480), g = P.g, Wd = P.w, r = R[t], k = Math.min(1, pt / (dur * .7));
      g.font = "12px Times New Roman, Noto Serif KR, serif";
      // 셀 그림(왼쪽 58%) / cell diagram
      const wide = Wd > 900, cx0 = 16, cx1 = wide ? Wd * .56 : Wd - 16, by = 44, gy = 168, cyIn = 262, bw2 = Math.min(34, (cx1 - cx0 - 120) / 8 - 3);
      g.fillStyle = "#f7f8fc"; g.strokeStyle = "#c9d3e6"; g.lineWidth = 1.5; g.beginPath(); g.roundRect ? g.roundRect(cx0 + 30, 22, cx1 - cx0 - 60, 210, 14) : g.rect(cx0 + 30, 22, cx1 - cx0 - 60, 210); g.fill(); g.stroke();
      g.fillStyle = "#1d2a4d"; g.font = "bold 12.5px Times New Roman, Noto Serif KR, serif"; g.fillText("LSTM 셀(10분마다 한 번 계산)", cx0 + 40, 16);
      // 기억 띠(컨베이어) / cell-state belt
      g.strokeStyle = COL.c; g.lineWidth = 6 + 10 * Math.min(1, Math.abs(ph >= 2 ? r.c : ph === 1 ? r.cf : r.c0)); g.setLineDash([14, 8]); g.lineDashOffset = -belt; g.beginPath(); g.moveTo(cx0, by); g.lineTo(cx1, by); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.c; g.font = "bold 12px Times New Roman, Noto Serif KR, serif"; g.fillText("c(t−1) " + r.c0.toFixed(2), cx0, by - 12); g.textAlign = "right"; g.fillText("c(t) " + (ph >= 2 ? r.c : ph === 1 ? r.cf : r.c0).toFixed(2), cx1, by - 12); g.textAlign = "left";
      const gx = [cx0 + 70, cx0 + 70 + (cx1 - cx0 - 140) / 3, cx0 + 70 + 2 * (cx1 - cx0 - 140) / 3, cx1 - 70], names = [["f", "σ 망각"], ["i", "σ 입력"], ["g", "tanh 후보"], ["o", "σ 출력"]], vals = [r.f, r.i, r.g, r.o];
      const act = [[0], [0], [1, 2], [3]][ph], showAll = ph === 0;
      // 곱셈, 덧셈 기호 / × and + nodes on the belt
      [[gx[0], "×", 1], [gx[1] + (gx[2] - gx[1]) / 2, "+", 2]].forEach(function (n) { const on = ph === n[2]; g.fillStyle = on ? "#fff4d6" : "#fff"; g.strokeStyle = on ? "#ffb500" : "#1d2a4d"; g.lineWidth = on ? 3 : 1.5; g.beginPath(); g.arc(n[0], by, 13, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#1d2a4d"; g.font = "bold 16px Times New Roman, serif"; g.textAlign = "center"; g.fillText(n[1], n[0], by + 5); g.textAlign = "left"; });
      // 게이트 상자와 값 막대 / gate boxes with value bars
      names.forEach(function (n, j) { const on = act.indexOf(j) >= 0, x = gx[j], v = vals[j];
        g.globalAlpha = showAll || on ? 1 : .35; g.fillStyle = on ? "#fff" : "#fbfbfd"; g.strokeStyle = COL[n[0]]; g.lineWidth = on ? 3 : 1.5; g.fillRect(x - bw2, gy - 20, 2 * bw2, 40); g.strokeRect(x - bw2, gy - 20, 2 * bw2, 40);
        g.fillStyle = COL[n[0]]; g.font = "bold 12px Times New Roman, Noto Serif KR, serif"; g.textAlign = "center"; g.fillText((j + 1) + ". " + n[1], x, gy - 4);
        const bw = (2 * bw2 - 12) * (n[0] === "g" ? Math.abs(v) : v) * (on || showAll ? k : 1); g.fillRect(x - bw2 + 6, gy + 4, bw, 8); g.fillStyle = "#1d2a4d"; g.font = "11px Times New Roman, serif"; g.fillText(v.toFixed(2), x, gy + 30);
        // 게이트 → 띠 연결선 / gate-to-belt lines
        g.strokeStyle = COL[n[0]]; g.lineWidth = on ? 3 : 1.2; g.beginPath(); const tx2 = j === 0 ? gx[0] : j === 3 ? cx1 - 70 : gx[1] + (gx[2] - gx[1]) / 2; g.moveTo(x, gy - 20); g.lineTo(j === 3 ? x : tx2, j === 3 ? by + 40 : by + 13); g.stroke();
        // 입력이 게이트로 흘러 들어가는 점 / dots flowing from inputs into gates
        if (ph === 0) { const sx = cx0 + 60 + j * 8, fx = sx + (x - sx) * k, fy = cyIn + (gy + 20 - cyIn) * k; g.fillStyle = COL.x1; g.beginPath(); g.arc(fx, fy, 4.5, 0, 7); g.fill(); g.fillStyle = COL.x2; g.beginPath(); g.arc(fx + 8, fy, 4.5, 0, 7); g.fill(); }
        g.globalAlpha = 1; g.textAlign = "left"; });
      // 출력 h / output
      const ox = cx1 - 70, oy = by + 64; g.strokeStyle = COL.h; g.lineWidth = ph === 3 ? 3 : 1.4; g.beginPath(); g.moveTo(ox, by + 13); g.lineTo(ox, oy); g.lineTo(cx1 + 6, oy); g.stroke();
      g.fillStyle = COL.h; g.font = "bold 12px Times New Roman, Noto Serif KR, serif"; g.fillText("h(t) " + (ph === 3 ? r.h.toFixed(2) : t ? R[t - 1].h.toFixed(2) : "0.00"), cx1 - 64, oy - 6);
      // 입력 막대 / input bars
      g.fillStyle = "#1d2a4d"; g.font = "bold 12px Times New Roman, Noto Serif KR, serif"; g.fillText("입력 x(t)", cx0, cyIn - 14);
      [[r.x[0], "피로", COL.x1], [r.x[1], "배터리 부족", COL.x2]].forEach(function (b, j) { const y = cyIn + j * 16; g.fillStyle = "#eef1f7"; g.fillRect(cx0 + 80, y - 8, 120, 10); g.fillStyle = b[2]; g.fillRect(cx0 + 80, y - 8, 120 * b[0], 10); g.fillStyle = "#1d2a4d"; g.font = "11.5px Times New Roman, Noto Serif KR, serif"; g.fillText(b[1], cx0, y + 1); g.fillText(b[0].toFixed(2), cx0 + 206, y + 1); });
      // 시간 그래프(오른쪽) / time chart
      const gx0 = wide ? Wd * .6 : 40, gx1 = Wd - 10, gy0 = wide ? 26 : 316, gy1 = wide ? 270 : 446, X = function (s) { return gx0 + (gx1 - gx0) * s / (R.length - 1); }, Y = function (v) { return gy1 - (gy1 - gy0) * v; };
      g.fillStyle = "#1d2a4d"; g.font = "bold 12.5px Times New Roman, Noto Serif KR, serif"; g.fillText("시간에 따른 위험(10분 간격)", gx0, gy0 - 10);
      g.strokeStyle = "#ccd3e4"; g.lineWidth = 1; g.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0); g.setLineDash([4, 3]); g.strokeStyle = "#c62828"; g.beginPath(); g.moveTo(gx0, Y(.5)); g.lineTo(gx1, Y(.5)); g.stroke(); g.setLineDash([]); g.fillStyle = "#c62828"; g.font = "10.5px Times New Roman, Noto Serif KR, serif"; g.fillText("경보 기준 0.5", gx1 - 66, Y(.5) - 4);
      const upto = ph === 3 ? t : t - 1;
      [["x1", function (q) { return q.x[0]; }, 1.4], ["x2", function (q) { return q.x[1]; }, 1.4], ["now", function (q) { return q.now; }, 2.4], ["h", function (q) { return q.risk; }, 3.2]].forEach(function (L) {
        if (upto < 0) return; g.strokeStyle = COL[L[0]]; g.lineWidth = L[2]; g.beginPath(); for (let s = 0; s <= upto; s++) { const v = L[1](R[s]); if (s) g.lineTo(X(s), Y(v)); else g.moveTo(X(s), Y(v)); } g.stroke();
        const v = L[1](R[upto]); g.fillStyle = COL[L[0]]; g.beginPath(); g.arc(X(upto), Y(v), L[0] === "h" ? 5 : 3.5, 0, 7); g.fill(); });
      if (upto >= 0) { g.font = "bold 11.5px Times New Roman, Noto Serif KR, serif"; g.fillStyle = COL.h; g.fillText("LSTM " + (R[upto].risk * 100).toFixed(0) + "%", Math.min(gx1 - 70, X(upto) + 6), Y(R[upto].risk) - 6); g.fillStyle = "#6b7591"; g.fillText("지금만 " + (R[upto].now * 100).toFixed(0) + "%", Math.min(gx1 - 70, X(upto) + 6), Y(R[upto].now) + 14); }
      const fL = R.findIndex(function (q) { return q.risk >= .5; }), fN = R.findIndex(function (q) { return q.now >= .5; });
      if (fL >= 0 && fL <= upto) { g.fillStyle = COL.h; g.beginPath(); g.moveTo(X(fL), gy0 + 2); g.lineTo(X(fL) - 5, gy0 - 6); g.lineTo(X(fL) + 5, gy0 - 6); g.fill(); }
      if (fN >= 0 && fN <= upto) { g.fillStyle = COL.now; g.beginPath(); g.moveTo(X(fN), gy0 + 2); g.lineTo(X(fN) - 5, gy0 - 6); g.lineTo(X(fN) + 5, gy0 - 6); g.fill(); }
      g.fillStyle = "#4a5470"; g.font = "10.5px Times New Roman, Noto Serif KR, serif"; g.fillText("0분", gx0, gy1 + 13); g.textAlign = "right"; g.fillText("200분", gx1, gy1 + 13); g.textAlign = "left";
      if (fL >= 0 && fN >= 0) g.fillText("▼ 첫 경보: LSTM " + (fL + 1) * 10 + "분, 지금만 보는 모델 " + (fN + 1) * 10 + "분", gx0, gy1 + 27);
    });
    text();
    return function () { alive = false; stop(); };
  }
  QP.LSTMViz = { mount: mount, run: run };
})(window.QP = window.QP || {});
