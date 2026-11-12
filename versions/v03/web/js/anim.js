/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Animation helpers: frame loop with speed control, qubit dials, pair-circuit widget, deep-network drawing. */
/* =====================================================================
 * anim.js : 애니메이션 공통 부품 (큐비트 다이얼, 회로 위젯, 반복 루프)
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 큐비트가 "돌아간다"는 것을 눈으로 보이게 하기 위함임.
 *  - 큐비트 다이얼: 위(↑)=|0⟩, 아래(↓)=|1⟩. RY(θ) 회전은 화살표를 θ만큼
 *    돌리는 것과 같음(블로흐 구의 단면, x-z 평면). 1이 나올 확률 = sin²(θ/2).
 *  - 쌍 회로 위젯: 두 신호 → 두 다이얼 회전 → CNOT(제어 1이면 대상 뒤집기)
 *    → 대상 큐비트 판독값 ⟨Z⟩(겹침 점수) 막대.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 애니메이션 부품을 붙임 / attaches animation parts to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const loops = new Set();                          // 실행 중인 반복 루프 목록임 / list of running loops
  function loop(fn) {                               // 매 화면 갱신(약 60fps)마다 fn을 부르는 루프를 만듦 / creates a loop that calls fn on every screen refresh (about 60 fps)
    const h = { on: true };                         // 루프 손잡이(멈춤 표시)임 / loop handle (stop flag)
    let last = performance.now();                   // 이전 시각임 / previous time
    function tick(now) {                            // 한 프레임 처리임 / one frame
      if (!h.on) return;                            // 멈췄으면 끝냄 / end if stopped
      const dt = Math.min(.1, (now - last) / 1000); last = now; // 지난 프레임과의 시간(초)임 / time since the last frame (s)
      const k = (QP.State && QP.State.animSpeed) || .5; // 애니메이션 속도 배율(기본 0.5배: 눈이 편하게) / animation speed factor (default 0.5× for comfortable viewing)
      fn(dt * k, now);                              // 그리기 함수를 부름(시간 흐름을 배율만큼 늦춤) / call the draw function (time slowed by the factor)
      requestAnimationFrame(tick);                  // 다음 프레임을 예약함 / schedule the next frame
    }
    requestAnimationFrame(tick); loops.add(h);      // 시작하고 목록에 넣음 / start and add to the list
    return function () { h.on = false; loops.delete(h); }; // 멈춤 함수를 돌려줌 / return the stop function
  }
  function stopAll() { loops.forEach(function (h) { h.on = false; }); loops.clear(); } // 화면을 떠날 때 모든 루프를 멈춤 / stop every loop when leaving a screen
  const lerp = function (a, b, t) { return a + (b - a) * t * ((QP.State && QP.State.animSpeed) || .5); }; // a에서 b로 t만큼 다가간 값(속도 배율 반영)임 / value moved from a toward b by t (speed factor applied)

  // 큐비트 다이얼 그리기: theta(라디안) 0=|0⟩, π=|1⟩ / draws a qubit dial: theta (radians) 0=|0⟩, π=|1⟩
  function dial(g, x, y, r, theta, label, color, glow) {
    const p1 = Math.pow(Math.sin(theta / 2), 2);    // 1이 나올 확률임 / probability of 1
    g.save();                                       // 그리기 설정을 저장함 / save drawing settings
    if (glow) { g.shadowColor = color; g.shadowBlur = 12 * glow; } // 활발하면 빛나게 함 / glow when active
    g.fillStyle = "#fff"; g.strokeStyle = "#c9cfe0"; g.lineWidth = 1.5; // 바탕과 테두리 색임 / background and border colors
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.shadowBlur = 0; // 원을 그림 / draw the circle
    g.fillStyle = "rgba(255,181,0,.28)";            // 1 확률을 노란 부채꼴로 칠함 / fill a yellow wedge for the probability of 1
    g.beginPath(); g.moveTo(x, y); g.arc(x, y, r - 2, Math.PI / 2 - Math.PI * p1, Math.PI / 2 + Math.PI * p1); g.closePath(); g.fill(); // 아래쪽(1)부터 확률만큼 채움 / fill from the bottom (1) by the probability
    g.strokeStyle = "#e1e5ef"; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); // 0-1 세로축임 / 0-1 vertical axis
    g.strokeStyle = color; g.lineWidth = Math.max(3, r / 12); // 상태 화살표 색과 굵기(큰 다이얼은 굵게)임 / arrow color and width (thicker on big dials)
    const tipR = Math.max(3.5, r / 9), reach = r - tipR - 3; // 끝 점이 원 안에 머물러 0, 1 글자와 이름표를 가리지 않게 함 / keep the tip dot inside the circle so it never covers the 0/1 marks or the name tag
    const ex = x + Math.sin(theta) * reach, ey = y - Math.cos(theta) * reach; // 화살표 끝 좌표(위에서 시계 방향으로 회전)임 / arrow tip coordinates (clockwise from the top)
    g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); // 화살표 몸통임 / arrow body
    g.fillStyle = color; g.beginPath(); g.arc(ex, ey, tipR, 0, 7); g.fill(); // 화살표 끝 점임 / arrow tip dot
    const fs = Math.max(11.5, Math.min(17, r * .3)); g.fillStyle = "#4a5470"; g.font = fs + "px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; // 글씨 설정(다이얼이 크면 글씨도 큼)임 / text settings (bigger text on big dials)
    g.fillText("0", x, y - r - 5); g.fillText("1", x, y + r + fs + 1); // 위 0, 아래 1 표시임 / labels 0 at top, 1 at bottom
    if (label) g.fillText(label, x, y + r + fs * 2.1);    // 이름표임 / name tag
    g.restore();                                    // 설정을 되돌림 / restore settings
    return p1;                                      // 1 확률을 돌려줌 / return the probability of 1
  }

  // 쌍 회로 위젯: a,b(0~1) 신호를 받아 회로 그림과 겹침 점수를 그림 / pair-circuit widget: takes a,b (0~1) and draws the circuit and overlap score
  function pair(g, x, y, w, h, a, b, names, active) {
    const r = Math.max(14, Math.min(h * .3, w * .12)); // 다이얼 반지름임(카드 크기에 맞춰 크게 그림) / dial radius (drawn large to fit the card)
    g.save();                                       // 설정을 저장함 / save settings
    g.fillStyle = active ? "#fff8e6" : "#f7f8fc"; g.strokeStyle = active ? "#ffb500" : "#dfe3ee"; g.lineWidth = active ? 2 : 1; // 활성이면 노란 테두리임 / yellow border when active
    g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 8) : g.rect(x, y, w, h); g.fill(); g.stroke(); // 카드 모양을 그림 / draw the card shape
    g.fillStyle = "#003087"; g.font = "bold 12.5px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "left"; // 제목 글씨임 / title text
    g.fillText(names[0] + " × " + names[1], x + 6, y + 13); // 신호 쌍 이름임 / name of the signal pair
    const cx1 = x + w * .22, cx2 = x + w * .52, cy = y + h * .48; // 두 다이얼 위치임 / positions of the two dials
    dial(g, cx1, cy, r, Math.PI * a, Math.round(a * 100) + "", "#003087", a > .5 ? a : 0); // 첫 큐비트(제어) 다이얼임 / first qubit (control) dial
    dial(g, cx2, cy, r, Math.PI * b, Math.round(b * 100) + "", "#6e4c82", b > .5 ? b : 0); // 둘째 큐비트(대상) 다이얼임 / second qubit (target) dial
    const on = Math.pow(Math.sin(Math.PI * a / 2), 2); // 제어 큐비트가 1일 확률 = CNOT이 작동하는 정도임 / probability the control is 1 = how much the CNOT acts
    g.strokeStyle = "rgba(255,181,0," + (.25 + .75 * on) + ")"; g.lineWidth = 1 + 3 * on; // 작동 정도만큼 연결선을 진하게 함 / darken the link by that amount
    g.beginPath(); g.moveTo(cx1 + r, cy); g.lineTo(cx2 - r, cy); g.stroke(); // 제어→대상 연결선(CNOT)임 / control → target link (CNOT)
    g.fillStyle = "#b07a00"; g.font = "bold 12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillText("⊕", (cx1 + cx2) / 2, cy - 4); // CNOT 기호임 / CNOT symbol
    const z = Math.cos(Math.PI * a) * Math.cos(Math.PI * b); // 대상 큐비트 판독값 ⟨Z⟩(에뮬레이터 결과와 같음)임 / target readout ⟨Z⟩ (same as the emulator result)
    const bx = x + w * .74, bw = w * .2, by = y + 20, bh = h - 32; // 판독 막대 위치임 / readout bar position
    g.fillStyle = "#eef0f6"; g.fillRect(bx, by, bw, bh); // 막대 바탕임 / bar background
    const mid = by + bh / 2, zh = -z * bh / 2;      // 가운데(0)와 막대 길이임 / center (0) and bar length
    g.fillStyle = z >= 0 ? "#6e4c82" : "#c76b67"; g.fillRect(bx, Math.min(mid, mid + zh), bw, Math.abs(zh)); // +면 자두색, -면 장밋빛임 / plum if +, rose if -
    g.fillStyle = "#2e2420"; g.font = "bold " + Math.max(10, Math.min(15, r * .28)) + "px sans-serif"; g.fillText("⟨Z⟩ " + z.toFixed(2), bx + bw / 2, y + h - 3); // 값 글씨임 / value text
    g.restore();                                    // 설정을 되돌림 / restore settings
    return z;                                       // 겹침 점수를 돌려줌 / return the overlap score
  }

  // 심층 신경망 그림(층이 몇 개든 그림): m = models.js mlpCreate() 신경망, o = { x0, x1, y0, y1, labels, acts, deltas, small } / deep-network drawing (any number of layers): m = models.js mlpCreate() network, o = { x0, x1, y0, y1, labels, acts, deltas, small }
  function deepNet(g, m, o) {
    const L = m.sizes.length, xs = function (l) { return o.x0 + (o.x1 - o.x0) * l / (L - 1); }; // 층의 가로 위치임 / horizontal position of a layer
    const ys = function (l, k) { const n = m.sizes[l], pad = l === 0 ? 0 : (o.y1 - o.y0) * .5 * (1 - Math.min(1, n / m.sizes[0] * 1.15 + .25)); return n === 1 ? (o.y0 + o.y1) / 2 : o.y0 + pad + k * (o.y1 - o.y0 - 2 * pad) / (n - 1); }; // 뉴런 세로 위치(작은 층은 가운데로 모음)임 / vertical neuron position (small layers centered)
    for (let l = 0; l < L - 1; l++) {               // 층 사이 연결마다 / for each connection between layers
      let mx = .01; m.W[l].forEach(function (r) { r.forEach(function (v) { mx = Math.max(mx, Math.abs(v)); }); }); // 그 층의 최대 가중치임 / maximum weight of that layer
      let md = 1e-9; if (o.deltas) o.deltas[l].forEach(function (r) { r.forEach(function (v) { md = Math.max(md, v); }); }); // 그 층의 최대 변화량임 / maximum change of that layer
      for (let j = 0; j < m.sizes[l + 1]; j++) for (let i = 0; i < m.sizes[l]; i++) {
        const w = m.W[l][j][i]; let a = Math.abs(w) / mx; if (o.acts) a = Math.min(1, Math.abs(w * o.acts[l][i]) / mx * 1.6); if (o.acts && a < .06) continue; // 활성값이 있으면 실제로 흐르는 신호 세기로 그림 / with activations, draw the actual flowing signal strength
        const hot = o.deltas && md > 1e-6 && o.deltas[l][j][i] / md > .6; // 이번 반복에 크게 바뀐 연결임 / connections that changed a lot this iteration
        g.strokeStyle = hot ? "rgba(0,176,80,.95)" : (w > 0 ? "rgba(0,48,135," : "rgba(199,107,103,") + (.06 + .7 * a) + ")"; g.lineWidth = hot ? 2 : .3 + (o.small ? 1.4 : 2.2) * a; g.beginPath(); g.moveTo(xs(l), ys(l, i)); g.lineTo(xs(l + 1), ys(l + 1, j)); g.stroke(); // 연결선임 / connection line
      }
    }
    const r0 = o.small ? 3.5 : 5;                   // 뉴런 반지름 기준임 / base neuron radius
    for (let l = 0; l < L; l++) for (let k = 0; k < m.sizes[l]; k++) { // 뉴런마다 / for each neuron
      const x = xs(l), y = ys(l, k), last = l === L - 1, v = o.acts ? o.acts[l][k] : null; // 위치와 활성값임 / position and activation
      const qf = o.qFrom || 16; if (l === 0) g.fillStyle = k >= qf ? "#6e4c82" : "#003087"; else if (last) g.fillStyle = v != null ? "rgba(169,72,42," + (.25 + .75 * v) + ")" : "#a9482a"; else g.fillStyle = v != null ? (v > 0 ? "rgba(255,181,0," + (.2 + .8 * v) + ")" : "rgba(199,107,103," + (.2 - .8 * v) + ")") : "#ffb500"; // 입력=청/자두, 은닉=노랑, 출력=단풍색임 / input = blue/plum, hidden = yellow, output = maple
      g.strokeStyle = "#8892ad"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, last ? r0 * 2.6 : l === 0 ? r0 : r0 * 1.5, 0, 7); g.fill(); if (l) g.stroke(); // 뉴런 원임 / neuron circle
    }
    g.fillStyle = "#1d2a4d"; g.font = (o.small ? "bold 10px" : "bold 12px") + " Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; // 층 이름 글씨임 / layer name text
    for (let l = 1; l < L; l++) g.fillText(l === L - 1 ? "출력" : "은닉 " + l + " (" + m.sizes[l] + ")", xs(l), o.y1 + (o.small ? 11 : 16)); // 층 이름임 / layer name
    if (!o.small) for (let l = 1; l < L - 2; l++) { g.fillStyle = "#8892ad"; g.font = "bold 16px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("⋯", (xs(l) + xs(l + 1)) / 2, o.y0 - 2); } // 층이 이어짐을 뜻하는 표시임 / mark meaning the layers continue
    if (o.labels) { g.textAlign = "right"; g.font = (o.small ? 9 : 11) + "px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; for (let k = 0; k < m.sizes[0]; k++) { g.fillStyle = k >= (o.qFrom || 16) ? "#6e4c82" : "#1d2a4d"; g.fillText(o.labels[k] || "", xs(0) - 8, ys(0, k) + 4); } } // 입력 이름임 / input names
    g.textAlign = "left"; return { xs: xs, ys: ys };  // 좌표 함수를 돌려줌 / return the coordinate functions
  }
  function canvas(cv, h) { return QP.Charts.prep(cv, h); } // 캔버스 준비(배율 처리)를 공유함 / share canvas preparation (scaling)

  QP.Anim = { loop: loop, stopAll: stopAll, lerp: lerp, dial: dial, pair: pair, canvas: canvas, deepNet: deepNet }; // 공개함 / make public
  /* 설명과 같이 가기: 최소 시간이 지나고, 읽던 설명이 끝나야 다음 단계로 감 / keep pace with narration: next step only after a minimum time and after the current speech ends */
  QP.Pace = {
    last: null,                                     // 마지막으로 맡긴 설명의 표식 / mark of the last narration
    say: function (text) { const P = QP.Pace, av = document.getElementById("autoVoice"), St = QP.State || {};
      if (!text || !QP.Voice || (av && !av.checked) || St.welcoming) { P.last = { done: true }; return P.last; }
      if (!St.touring) { P.last = QP.Voice.speak(text, true); return P.last; }   // 읽는 중이면 끝난 뒤 이어 읽음(끊지 않음) / queued, never cuts
      if (St.hold) { const m = { pending: true }, h0 = St.holdId; P.last = m; (function q() { if (!St.hold || St.holdId !== h0) { m.pending = false; m.done = true; return; } if (QP.Voice.busy()) { setTimeout(q, 400); return; } const r = QP.Voice.speak(text, true, true); m.pending = false; Object.assign(m, r); })(); return m; } // 투어 설명이 끝난 뒤 이어 읽음 / after the tour narration
      P.last = { done: true }; return P.last; },    // 투어 중이고 붙잡지 않은 화면은 투어 설명만 읽음 / otherwise the tour narration only
    done: function (m) { return QP.Voice.finished(m || QP.Pace.last); }, // 그 설명을 다 읽었는지 / whether that narration is finished
    wait: function (minMs, cb, alive) { const t0 = Date.now(), m = QP.Pace.last; (function w() { if (alive && !alive()) return; if (Date.now() - t0 < minMs || (!QP.Voice.finished(m) && Date.now() - t0 < 600000)) { setTimeout(w, 400); return; } cb(); })(); }, // 최소 시간과, 맡긴 설명이 끝날 때까지 기다린 뒤 실행 / wait for the minimum time and until the narration ends
    hold: function (on) { const St = QP.State || {}; St.hold = !!on; if (on) St.holdId = (St.holdId || 0) + 1; } // 화면 시연이 끝날 때까지 투어를 붙잡음 / hold the tour until the demo finishes
  };

})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
