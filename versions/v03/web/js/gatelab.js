/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Gate-card lab (lesson 3): animated two-qubit dials, rotation trails, amplitude and probability bars,
 * a growing circuit diagram, entanglement link (concurrence) and falling measurement shots, with an automatic narrated lesson. */
/* =====================================================================
 * gatelab.js : 큐비트 용어 교실 3과 "게이트 카드" 동적 실험대 (2026-11-12 신규, 레고 부품)
 * ---------------------------------------------------------------------
 * 화면 구성(번호는 캔버스 안 번호와 같음)
 *  ① 큐비트 A(제어), B(대상) 다이얼 : 화살표가 돌아간 길을 색 궤적으로 남김(남색 = A, 진분홍 = B)
 *  ② 각 큐비트의 진폭(cos, sin)과 확률 막대(파랑 = 0, 주황 = 1)
 *  ③ 두 큐비트 결과 4가지(00, 01, 10, 11) 확률 막대 : 에뮬레이터 상태벡터를 그대로 읽음
 *  ④ 얽힘 고리 : 동시 발생도(concurrence) C = 2|a00·a11 − a01·a10| (Wootters 1998), 굵을수록 강하게 얽힘
 *  ⑤ 회로도 : 지금까지 적용한 게이트가 시간 순서대로 쌓이고 노란 점이 방금 지난 게이트로 이동함
 *  ⑥ 측정 상자 : 측정 결과 공이 하나씩 떨어져 쌓임(20번 측정 = 확률이 눈에 보임)
 * 자동 수업 : 화면이 열리면 10단계를 음성 설명과 같은 속도(QP.Pace.say, QP.Pace.wait)로 진행함.
 * 근거 : Nielsen & Chuang(2010) 1.3절(게이트), 2.2.3절(측정), Wootters, PRL 80, 2245(1998)(동시 발생도)
 * ===================================================================== */
(function (QP) {
  "use strict";
  const S = QP.Sim, A = QP.Anim;
  const PI = Math.PI, CA = "#003087", CB = "#d81b60", C0 = "#1e63c6", C1 = "#ef7d00", CY = "#ffb500";   // A 남색, B 진분홍, 0 파랑, 1 주황, 진행 점 노랑
  const OUTC = ["#1e63c6", "#2e7d32", "#8e24aa", "#ef7d00"];   // 00 파랑, 10 초록, 01 보라, 11 주황(결과 4가지, 서로 다른 천연색)
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; };
  const NUM = "①②③④⑤⑥⑦⑧⑨⑩";
  function mount(body, opt) {
    opt = opt || {};
    body.innerHTML = '<div class="grid glab">' +
      '<div class="stack glab-left"><div class="card glab-ctl"><b>게이트 카드(눌러서 적용)</b>' +
      [["xa", "① X(A) 뒤집기", "A 화살표를 위↔아래로 180° 돌림"], ["xb", "② X(B) 뒤집기", "B 화살표를 위↔아래로 180° 돌림"], ["ry", "③ RY(+45°) 돌리기(A)", "A 화살표를 45°씩 돌림, 산행 신호를 넣는 방법"],
        ["h", "④ H 반반 섞기(A)", "0을 0과 1이 반반인 상태로(옆으로 눕힘)"], ["cx", "⑤ CNOT(A → B)", "A가 1인 부분에서만 B를 뒤집음 → 얽힘"], ["m1", "⑥ 측정 1번", "하나로 정해짐(상태가 무너짐)"],
        ["m20", "⑦ 측정 20번", "같은 준비를 20번 반복해 확률을 눈으로 확인"], ["rs", "⑧ 처음으로 |00⟩", "두 화살표를 위(0)로 되돌림"]].map(function (c) {
          return '<button class="gate" data-g="' + c[0] + '"><b>' + c[1] + "</b><small>" + c[2] + "</small></button>"; }).join("") +
      '</div><div class="card glab-auto"><div class="row"><button id="glAuto" class="primary">▶ 자동 수업 다시 보기</button><button id="glStop">❚❚ 멈춤</button></div><div id="glSteps" class="glsteps"></div></div></div>' +
      '<div class="card stack glab-right"><h3 id="glT">게이트 카드 실험대</h3><div id="glX" class="glx"></div><canvas id="glC"></canvas>' +
      '<div class="glleg"><span><i style="background:' + CA + '"></i>큐비트 A(제어) 화살표, 궤적</span><span><i style="background:' + CB + '"></i>큐비트 B(대상) 화살표, 궤적</span><span><i style="background:' + C0 + '"></i>0이 나올 확률</span><span><i style="background:' + C1 + '"></i>1이 나올 확률</span><span><i style="background:' + CY + '"></i>지금 계산 위치(회로도)</span><span><i style="background:#7b1fa2"></i>얽힘 고리(굵을수록 강함)</span></div>' +
      '</div></div>';
    const $ = function (s) { return body.querySelector(s); };
    let st = S.createState(2), hist = [], shots = [], drops = [], cur = { a: 0, b: 0 }, trail = [], flash = 0, dot = 0, alive = true, auto = null, stepNo = -1;
    // 상태에서 읽는 값들 / values read from the state
    function amp(i) { return st.re[i]; }                                   // 이 실험대의 게이트는 실수 진폭만 만듦(X, RY, H, CNOT) / these gates keep amplitudes real
    function pr() { return Array.from(S.probs(st)); }                                  // [00, 10, 01, 11] 순서(인덱스 0..3, q0 = A가 낮은 비트) / index order 0..3 (q0 = A is the low bit)
    function pA1() { const p = pr(); return p[1] + p[3]; }
    function pB1() { const p = pr(); return p[2] + p[3]; }
    function conc() { return Math.min(1, 2 * Math.abs(amp(0) * amp(3) - amp(1) * amp(2))); }   // 동시 발생도 / concurrence
    function zB() { return 1 - 2 * pB1(); }                                 // ⟨Z_B⟩ = P(B=0) − P(B=1)
    const ang = function (p) { return 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, p)))); };
    function snap() { const p = pr(); return { a: pA1(), b: pB1(), p: p.slice(), c: conc() }; }
    function apply(g, quiet) {                                              // 게이트 적용 + 설명 / apply a gate and explain
      const b0 = snap(), fromA = ang(b0.a), fromB = ang(b0.b); let title = "", what = "", why = "";
      if (g === "xa") { S.x(st, 0); title = "X(A) 뒤집기"; why = "X는 0과 1의 진폭을 맞바꿉니다. 그래서 A 화살표가 위아래로 반 바퀴(180°) 돕니다."; }
      if (g === "xb") { S.x(st, 1); title = "X(B) 뒤집기"; why = "B의 0과 1 진폭을 맞바꿉니다. B 화살표가 반 바퀴 돕니다."; }
      if (g === "ry") { S.ry(st, 0, PI / 4); title = "RY(+45°) 돌리기(A)"; why = "RY(θ)는 화살표를 θ만큼 돌립니다. 1이 나올 확률은 sin²(각도/2)이라 45° 돌릴 때마다 확률이 고르게 늘지 않고 S자로 늘어납니다. 산행 신호 0~1을 각도 π×신호로 바꿔 넣을 때 이 게이트를 씁니다."; }
      if (g === "h") { S.h(st, 0); title = "H 반반 섞기(A)"; why = "H는 |0⟩을 (|0⟩ + |1⟩)/√2로 만듭니다. 두 진폭이 모두 0.707이고, 제곱하면 50%, 50%입니다. 실수 진폭만 쓰는 이 화면에서는 RY(90°)를 0에 적용한 것과 결과가 같습니다."; }
      if (g === "cx") { S.cx(st, 0, 1); title = "CNOT(A → B) 조건부 뒤집기"; why = "A가 1인 갈래에서만 B를 뒤집습니다. A가 0과 1을 동시에 가진 상태라면, 결과가 ‘A=0이면 B=0, A=1이면 B=1’처럼 짝지어져 따로 떼어 설명할 수 없게 됩니다. 이것이 얽힘이며, 보라색 고리가 굵게 나타납니다."; }
      if (g === "rs") { st = S.createState(2); hist = []; shots = []; drops = []; title = "처음으로 |00⟩"; why = "두 큐비트를 모두 0(위)으로 되돌렸습니다. 1이 나올 확률은 둘 다 0%입니다."; }
      if (g === "m1") { const p = pr(), r = Math.random(); let k = 0, s = 0; for (; k < 4; k++) { s += p[k]; if (r < s) break; } k = Math.min(3, k); st = S.createState(2); st.re[0] = 0; st.re[k] = 1; flash = 1; drops.push({ k: k, y: 0, v: 0 }); title = "측정 1번 → 결과 " + S.label(k, 2); why = "측정하면 여러 가능성 중 하나(" + S.label(k, 2) + ")로 정해지고, 상태도 그 결과로 무너집니다(측정 후 상태). 얽혀 있었다면 A를 읽는 순간 B도 함께 정해집니다. 다시 측정하면 같은 결과가 나옵니다."; }
      if (g === "m20") { const p = pr(); shots = []; drops = []; for (let n = 0; n < 20; n++) { const r = Math.random(); let k = 0, s = 0; for (; k < 4; k++) { s += p[k]; if (r < s) break; } shots.push(Math.min(3, k)); } title = "측정 20번(같은 준비를 20번 반복)"; const cnt = [0, 0, 0, 0]; shots.forEach(function (k) { cnt[k]++; }); why = "한 번 측정은 하나의 결과만 주므로, 같은 상태를 20번 준비해 측정한 횟수로 확률을 봅니다. 결과 공이 하나씩 떨어집니다. 이번 결과: " + [0, 1, 2, 3].map(function (k) { return S.label(k, 2) + " " + cnt[k] + "번"; }).join(", ") + ". 정확 확률은 " + [0, 1, 2, 3].map(function (k) { return S.label(k, 2) + " " + pct(p[k]); }).join(", ") + "입니다."; }
      if (QP.I18N && QP.I18N.lang() === "en") {      // 영어 모드 설명 / English explanations
        const W = { xa: "X swaps the amplitudes of 0 and 1, so arrow A turns half a circle (180°) up and down.", xb: "It swaps the 0 and 1 amplitudes of B, so arrow B turns half a circle.",
          ry: "RY(θ) turns the arrow by θ. The chance of 1 is sin²(angle/2), so each 45° turn raises the probability along an S-shaped curve. This gate is how hiking signals from 0 to 1 are fed in as an angle of π × signal.",
          h: "H turns |0⟩ into (|0⟩ + |1⟩)/√2. Both amplitudes are 0.707, and squared they give 50% and 50%. On this screen, with real amplitudes only, it gives the same result as RY(90°) applied to 0.",
          cx: "B is flipped only in the branch where A is 1. If A holds 0 and 1 at once, the results pair up as 'A=0 then B=0, A=1 then B=1' and can no longer be described separately. This is entanglement, shown by a thick purple link.",
          rs: "Both qubits were returned to 0 (up). The chance of 1 is 0% for both." };
        if (W[g]) why = W[g];
        if (g === "m1") why = "Measuring fixes one of the possibilities, and the state collapses to that result. If the qubits were entangled, reading A fixes B at the same moment. Measuring again gives the same result.";
        if (g === "m20") { const p2 = pr(), c2 = [0, 0, 0, 0]; drops.forEach(function (d) { c2[d.k]++; }); shots.forEach(function (k2) { c2[k2]++; }); why = "One measurement gives only one result, so we prepare the same state 20 times and count. The result balls drop one by one. This run: " + [0, 1, 2, 3].map(function (k2) { return S.label(k2, 2) + " " + c2[k2] + " times"; }).join(", ") + ". Exact probabilities: " + [0, 1, 2, 3].map(function (k2) { return S.label(k2, 2) + " " + pct(p2[k2]); }).join(", ") + "."; }
      }
      if (g !== "rs" && g !== "m20") hist.push(g); if (hist.length > 12) hist.shift();
      const a0 = snap();
      trail.push({ q: "a", from: fromA, to: ang(a0.a), life: 1 }); trail.push({ q: "b", from: fromB, to: ang(a0.b), life: 1 }); dot = 0;
      what = "A의 1 확률 " + pct(b0.a) + " → <b>" + pct(a0.a) + "</b>, B의 1 확률 " + pct(b0.b) + " → <b>" + pct(a0.b) + "</b>, 얽힘 정도 C " + b0.c.toFixed(2) + " → <b>" + a0.c.toFixed(2) + "</b>, 결과 확률(00, 10, 01, 11) = " + a0.p.map(pct).join(", ");
      $("#glT").textContent = title;
      $("#glX").innerHTML = "<p><b>1. 무엇을 했나</b> " + title + "</p><p><b>2. 무엇이 바뀌었나</b> " + what + "</p><p><b>3. 왜 그렇게 되나</b> " + why + "</p>";
      if (!quiet) QP.Voice.speak(title + ". " + why.replace(/[|⟩⟨]/g, " "), true, true);   // 카드를 직접 누르면 바로 읽음 / direct click reads at once
      return { title: title, why: why };
    }
    // 자동 수업 10단계 / automatic 10-step lesson
    const LESSON = [
      ["처음 상태", function () { apply("rs", true); }, "처음 상태입니다. 두 화살표 모두 위쪽 영을 가리키므로, 일이 나올 확률은 둘 다 영 퍼센트입니다. 오른쪽 결과 막대도 영영 하나만 백 퍼센트입니다."],
      ["X로 뒤집기", function () { apply("xa", true); }, "엑스 게이트를 큐비트 에이에 적용합니다. 남색 화살표가 반 바퀴 돌아 아래쪽 일을 가리킵니다. 남은 궤적이 돈 길을 보여 주며, 결과는 일영이 백 퍼센트가 됩니다."],
      ["다시 뒤집기", function () { apply("xa", true); }, "엑스를 한 번 더 적용하면 원래대로 돌아옵니다. 뒤집기를 두 번 하면 제자리라는 뜻입니다."],
      ["RY로 45° 돌리기", function () { apply("ry", true); }, "알와이 게이트로 화살표를 사십오 도 돌립니다. 일이 나올 확률은 사인 제곱 이십이 점 오 도, 약 십사 점 육 퍼센트입니다. 노란 부채꼴과 주황 막대가 그만큼 차오릅니다."],
      ["RY로 한 번 더(90°)", function () { apply("ry", true); }, "한 번 더 돌려 구십 도가 되었습니다. 화살표가 옆으로 누워 영과 일이 반반, 오십 퍼센트씩입니다. 각도는 똑같이 사십오 도씩 늘었지만 확률은 십사 점 육에서 오십으로, 에스 자 모양으로 늘어납니다."],
      ["H로 반반 섞기", function () { apply("rs", true); apply("h", true); }, "처음으로 되돌린 뒤 하다마드 게이트를 적용합니다. 영 상태를 영과 일이 반반인 상태로 바로 만듭니다. 진폭은 둘 다 영 점 칠 영 칠, 제곱하면 오십 퍼센트입니다."],
      ["CNOT으로 얽기", function () { apply("cx", true); }, "씨낫 게이트를 적용합니다. 에이가 일인 갈래에서만 비를 뒤집으므로, 결과는 영영과 일일만 오십 퍼센트씩 남습니다. 두 큐비트가 짝지어 움직이는 얽힘 상태이며, 보라색 고리가 가장 굵게, 얽힘 정도 씨는 일이 됩니다. 각각의 화살표는 옆으로 누워 있지만, 둘을 따로 보면 이 짝 관계가 보이지 않습니다."],
      ["측정 20번", function () { apply("m20", true); }, "같은 얽힘 상태를 스무 번 준비해 측정합니다. 결과 공이 하나씩 떨어지는데, 영영과 일일만 나오고 영일이나 일영은 한 번도 나오지 않습니다. 두 큐비트가 항상 같은 값으로 읽힌다는 뜻입니다."],
      ["측정 1번(무너짐)", function () { apply("m1", true); }, "이번에는 한 번만 측정합니다. 결과가 하나로 정해지면 상태도 그 결과로 무너집니다. 에이를 읽는 순간 비도 같은 값으로 정해지는 것이 얽힘의 특징입니다."],
      ["산행 신호 넣기", function () { apply("rs", true); S.ry(st, 0, PI * .8); S.ry(st, 1, PI * .7); hist.push("ry"); hist.push("ryb"); apply("cx", true); $("#glX").innerHTML += "<p><b>4. 산행 신호로 읽기</b> 비 0.8 → A를 π×0.8 = 144° 회전, 경사 0.7 → B를 π×0.7 = 126° 회전, CNOT 뒤 B를 읽은 겹침 점수 ⟨Z_B⟩ = P(B=0) − P(B=1) = <b>" + zB().toFixed(3) + "</b>, 공식 cos(π×0.8)×cos(π×0.7) = " + (Math.cos(PI * .8) * Math.cos(PI * .7)).toFixed(3) + "과 같음. 두 신호가 함께 높을 때 양수로 커지는 이 값이 양자 특징 AI의 겹침 점수입니다.</p>"; },
        "마지막으로 실제 산행 신호를 넣어 봅니다. 비의 세기 영 점 팔은 에이를 백사십사 도, 경사 영 점 칠은 비를 백이십육 도 돌립니다. 씨낫 뒤에 비를 읽은 값이 겹침 점수이며, 코사인 곱 공식과 정확히 같은 값이 나옵니다. 두 신호가 함께 높을수록 이 점수가 커져, 양자 특징 인공지능이 겹친 위험을 알아챕니다."]
    ];
    function steps() { $("#glSteps").innerHTML = LESSON.map(function (s, k) { return '<button data-k="' + k + '" class="' + (k === stepNo ? "on" : k < stepNo ? "done" : "") + '">' + (k < 10 ? NUM[k] : k + 1) + " " + s[0] + "</button>"; }).join(""); body.querySelectorAll("#glSteps button").forEach(function (b) { b.onclick = function () { stopAuto(); run(+b.dataset.k, false); }; }); }
    function run(k, chain) {
      if (!alive) return; if (chain && k === 0) QP.Pace.hold(true);   // 자동 수업 동안 전체 안내가 기다림 / the tour waits during the lesson stepNo = k; steps();
      if (!chain) for (let j = 0; j < k; j++) if (j !== 7 && j !== 8) LESSON[j][1]();   // 단계를 바로 고르면 앞 단계 상태를 조용히 다시 만듦(측정 단계는 건너뜀) / rebuild earlier state silently when jumping
      if (!chain && k === 8) { /* 측정 1번은 얽힘 상태에서 해야 의미가 있음 */ }
      LESSON[k][1]();
      $("#glT").textContent = NUM[k] + " " + LESSON[k][0] + " (" + (k + 1) + "/" + LESSON.length + ")";
      QP.Pace.say((QP.I18N && QP.I18N.lang() === "en" && QP.NarrEN) ? QP.NarrEN.lesson[k] : LESSON[k][2]);
      if (chain) { auto = { k: k }; QP.Pace.wait(k === 7 ? 9000 : 7000, function () { if (auto && auto.k === k) { if (k + 1 < LESSON.length) run(k + 1, true); else { auto = null; QP.Pace.hold(false); $("#glAuto").textContent = "▶ 자동 수업 다시 보기"; if (opt.onDone) setTimeout(opt.onDone, 1500); } } }, function () { return alive && !!auto; }); }
    }
    function stopAuto() { auto = null; QP.Pace.hold(false); $("#glAuto").textContent = "▶ 자동 수업 다시 보기"; }
    $("#glAuto").onclick = function () { $("#glAuto").textContent = "자동 수업 진행 중…"; run(0, true); };
    $("#glStop").onclick = function () { stopAuto(); QP.Voice && QP.Voice.stop && QP.Voice.stop(); };
    body.querySelectorAll(".glab-ctl .gate").forEach(function (b) { b.onclick = function () { stopAuto(); stepNo = -1; steps(); apply(b.dataset.g, false); }; });
    // 그리기 / drawing
    let shownA = 0, shownB = 0, sh = [0, 0, 0, 0], shotT = 0;
    const stopLoop = A.loop(function (dt) {
      const cv = $("#glC"); if (!cv || !cv.isConnected) return;
      const P = A.canvas(cv, 432), g = P.g, W = P.w, p = pr(), tA = ang(pA1()), tB = ang(pB1()), c = conc();
      const k = Math.min(1, dt * 3.2); shownA += (tA - shownA) * k; shownB += (tB - shownB) * k; for (let i = 0; i < 4; i++) sh[i] += (p[i] - sh[i]) * k;
      dot = Math.min(1, dot + dt * 1.2); flash = Math.max(0, flash - dt * 1.5);
      g.font = "12.5px Times New Roman, Noto Serif KR, serif"; g.textAlign = "left";
      // ① 다이얼과 궤적 / dials and trails
      const r = 58, xa = W * .14, xb = W * .43, yd = 92;
      [[xa, shownA, "a", CA, "A(제어)"], [xb, shownB, "b", CB, "B(대상)"]].forEach(function (d) {
        trail.filter(function (t) { return t.q === d[2] && t.life > 0; }).forEach(function (t) {
          g.strokeStyle = d[3]; g.globalAlpha = .55 * t.life; g.lineWidth = 7; const s0 = -PI / 2 + Math.min(t.from, t.to), s1 = -PI / 2 + Math.max(t.from, t.to);
          if (Math.abs(t.to - t.from) > .01) { g.beginPath(); g.arc(d[0], yd, r + 9, s0, s1); g.stroke(); const e = -PI / 2 + t.to; g.beginPath(); g.arc(d[0] + Math.cos(e) * (r + 9), yd + Math.sin(e) * (r + 9), 5, 0, 7); g.fillStyle = d[3]; g.fill(); }
          g.globalAlpha = 1; });
        A.dial(g, d[0], yd, r, d[1], "", d[3], .5);
        g.fillStyle = d[3]; g.font = "bold 13px Times New Roman, Noto Serif KR, serif"; g.textAlign = "center"; g.fillText("① 큐비트 " + d[4], d[0], 16);
        g.font = "12px Times New Roman, Noto Serif KR, serif"; g.fillStyle = "#1d2a4d"; g.fillText("각도 " + Math.round(d[1] * 180 / PI) + "°", d[0] + r + 34, yd - 4);
      });
      trail.forEach(function (t) { t.life -= dt * .25; }); trail = trail.filter(function (t) { return t.life > 0; });
      // ④ 얽힘 고리 / entanglement link
      if (c > .02) { g.strokeStyle = "#7b1fa2"; g.lineWidth = 2 + 8 * c; g.setLineDash([10, 6]); g.lineDashOffset = -performance.now() / 40; g.beginPath(); g.moveTo(xa + r + 4, yd + 26); g.quadraticCurveTo((xa + xb) / 2, yd + 70, xb - r - 4, yd + 26); g.stroke(); g.setLineDash([]); g.fillStyle = "#7b1fa2"; g.textAlign = "center"; g.font = "bold 12.5px Times New Roman, Noto Serif KR, serif"; g.fillText("④ 얽힘 C = " + c.toFixed(2), (xa + xb) / 2, yd + 62); }
      // ② 확률 막대 / probability bars
      [[xa, pA1(), shownA, "A"], [xb, pB1(), shownB, "B"]].forEach(function (d) {
        const bx = d[0] - 70, by = 178, bw = 140, p1 = Math.pow(Math.sin(d[2] / 2), 2);
        g.fillStyle = "#eef1f7"; g.fillRect(bx, by, bw, 14); g.fillStyle = C0; g.fillRect(bx, by, bw * (1 - p1), 14); g.fillStyle = C1; g.fillRect(bx + bw * (1 - p1), by, bw * p1, 14);
        g.fillStyle = "#1d2a4d"; g.font = "11.5px Times New Roman, Noto Serif KR, serif"; g.textAlign = "center";
        g.fillText("② P(0) " + pct(1 - p1) + ", P(1) " + pct(p1), d[0], by + 29); g.fillText("진폭 cos " + Math.cos(d[2] / 2).toFixed(2) + ", sin " + Math.sin(d[2] / 2).toFixed(2), d[0], by + 44);
      });
      // ③ 결과 4가지 확률 / four-outcome probabilities
      const ox = W * .62, ow = W * .36, oy = 30, oh = 150; g.textAlign = "left"; g.fillStyle = "#003087"; g.font = "bold 13px Times New Roman, Noto Serif KR, serif"; g.fillText("③ 두 큐비트 결과 확률(A B 순서)", ox, 16);
      for (let i = 0; i < 4; i++) { const bw = ow / 4 - 12, x = ox + i * (ow / 4), hh = oh * sh[i]; g.fillStyle = "#f2f4f9"; g.fillRect(x, oy, bw, oh); g.fillStyle = OUTC[i]; g.fillRect(x, oy + oh - hh, bw, hh); g.fillStyle = "#1d2a4d"; g.textAlign = "center"; g.font = "bold 13px Times New Roman, serif"; g.fillText(S.label(i, 2), x + bw / 2, oy + oh + 16); g.font = "11.5px Times New Roman, serif"; g.fillText(pct(sh[i]), x + bw / 2, oy + oh - hh - 4 < oy + 10 ? oy + 12 : oy + oh - hh - 4); }
      g.textAlign = "left"; g.fillStyle = "#4a5470"; g.font = "11.5px Times New Roman, Noto Serif KR, serif"; g.fillText("⟨Z_B⟩ = P(B=0) − P(B=1) = " + zB().toFixed(3), ox, oy + oh + 34);
      // ⑤ 회로도 / circuit
      const cy0 = 262, cy1 = 302, cx0 = 70, cx1 = W - 30; g.fillStyle = "#003087"; g.font = "bold 13px Times New Roman, Noto Serif KR, serif"; g.fillText("⑤ 회로도(왼쪽 → 오른쪽 시간 순서)", 12, 238);
      g.strokeStyle = "#9aa3ba"; g.lineWidth = 1.5; [cy0, cy1].forEach(function (y, q) { g.beginPath(); g.moveTo(cx0, y); g.lineTo(cx1, y); g.stroke(); g.fillStyle = q ? CB : CA; g.font = "bold 12.5px Times New Roman, serif"; g.fillText(q ? "B |0⟩" : "A |0⟩", 18, y + 4); });
      const gap = Math.min(64, (cx1 - cx0 - 20) / Math.max(1, hist.length)), gx = function (i) { return cx0 + 30 + i * gap; };
      hist.forEach(function (h, i) { const x = gx(i), last = i === hist.length - 1; g.lineWidth = last ? 2.5 : 1.2;
        if (h === "cx") { g.strokeStyle = "#1d2a4d"; g.beginPath(); g.moveTo(x, cy0); g.lineTo(x, cy1 + 11); g.stroke(); g.fillStyle = "#1d2a4d"; g.beginPath(); g.arc(x, cy0, 5, 0, 7); g.fill(); g.beginPath(); g.arc(x, cy1, 11, 0, 7); g.fillStyle = "#fff"; g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 11, cy1); g.lineTo(x + 11, cy1); g.moveTo(x, cy1 - 11); g.lineTo(x, cy1 + 11); g.stroke(); }
        else { const y = h === "xb" || h === "ryb" ? cy1 : cy0, lab = { xa: "X", xb: "X", ry: "RY", ryb: "RY", h: "H", m1: "측정" }[h] || h; g.fillStyle = last ? "#fff4d6" : "#fff"; g.strokeStyle = last ? CY : "#1d2a4d"; g.fillRect(x - 17, y - 13, 34, 26); g.strokeRect(x - 17, y - 13, 34, 26); g.fillStyle = "#1d2a4d"; g.textAlign = "center"; g.font = "bold 12px Times New Roman, Noto Serif KR, serif"; g.fillText(lab, x, y + 4); g.textAlign = "left"; } });
      if (hist.length) { const xe = gx(hist.length - 1), xs = hist.length > 1 ? gx(hist.length - 2) : cx0, xd = xs + (xe - xs) * dot + 24 * dot; g.fillStyle = CY; g.shadowColor = CY; g.shadowBlur = 12; [cy0, cy1].forEach(function (y) { g.beginPath(); g.arc(xd, y, 6, 0, 7); g.fill(); }); g.shadowBlur = 0; }
      // ⑥ 측정 상자 / measurement bins
      const my = 342, mh = 70; g.fillStyle = "#003087"; g.font = "bold 13px Times New Roman, Noto Serif KR, serif"; g.textAlign = "left"; g.fillText("⑥ 측정 결과 상자(공 1개 = 측정 1번)", 12, my - 8);
      if (shots.length) { shotT += dt; if (shotT > .18) { shotT = 0; drops.push({ k: shots.shift(), y: 0, v: 0 }); } }
      const cnt = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) { const x = 40 + i * (W - 60) / 4, bw = (W - 60) / 4 - 20; g.strokeStyle = OUTC[i]; g.lineWidth = 1.5; g.strokeRect(x, my, bw, mh); g.fillStyle = OUTC[i]; g.font = "bold 12.5px Times New Roman, serif"; g.textAlign = "center"; g.fillText(S.label(i, 2), x + bw / 2, my + mh + 14); }
      drops.forEach(function (d) { const i = d.k, x0 = 40 + i * (W - 60) / 4, bw = (W - 60) / 4 - 20, n = cnt[i]++, perRow = Math.max(1, Math.floor(bw / 16)), tx = x0 + 10 + (n % perRow) * 16, ty = my + mh - 9 - Math.floor(n / perRow) * 16; d.v += dt * 900; d.y = Math.min(ty, (d.y || my - 30) + d.v * dt); g.fillStyle = OUTC[i]; g.beginPath(); g.arc(tx, d.y, 7, 0, 7); g.fill(); });
      g.fillStyle = "#1d2a4d"; g.font = "12px Times New Roman, Noto Serif KR, serif"; for (let i = 0; i < 4; i++) { const x = 40 + i * (W - 60) / 4, bw = (W - 60) / 4 - 20; g.fillText(cnt[i] + "번", x + bw - 14, my + 14); }
      if (flash > 0) { g.fillStyle = "rgba(255,181,0," + (.25 * flash) + ")"; g.fillRect(0, 0, W, 220); }
    });
    steps(); apply("rs", true);
    setTimeout(function () { if (alive) { $("#glAuto").textContent = "자동 수업 진행 중…"; run(0, true); } }, 600);   // 화면이 열리면 바로 자동 수업 / start the lesson right away
    return function () { alive = false; auto = null; stopLoop(); QP.Pace.hold(false); };
  }
  QP.GateLab = { mount: mount };
})(window.QP = window.QP || {});
