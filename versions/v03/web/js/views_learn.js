/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Quantum basics screens: coins, entanglement, vocabulary class, 2-qubit bench. */
/* =====================================================================
 * views_learn.js : 양자 기초 교실 (동전 큐비트, 얽힘 짝꿍, 용어 교실 5과, 2큐비트 실험대)
 * ---------------------------------------------------------------------
 * 설계 원칙 : 모든 개념을 (1) 눌러 보기 (2) 자동 시연(누르지 않아도 움직임)
 *            (3) 음성+자막 설명 세 가지로 동시에 보여 줌.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 화면을 추가함 / adds screens to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const S = QP.Sim, A = QP.Anim, C = QP.Charts, B = QP.Basis, M = QP.Models; // 모듈 짧은 이름임 / short module names
  const $ = function (s, r) { return (r || document).querySelector(s); }; // 요소 찾기임 / find an element
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; }; // 백분율임 / percentage
  const say = function (t) { if (!QP.State.touring) QP.Voice.speak(t, true); }; // 바로 읽어 주기임(자동 안내 중에는 생략) / read immediately (skipped during the auto guide)
  const coin = function (id, label) { return '<div class="coin3d" id="' + id + '"><div class="face f0">0</div><div class="face f1">1</div></div><p class="coin-l">' + label + '</p>'; }; // 3D 동전 HTML임 / 3D coin HTML
  function setCoin(el, v, spin) {                   // 동전 모양을 정함(v: 0/1, spin: 도는 중) / sets the coin look (v: 0/1, spin: spinning)
    el.classList.toggle("spin", !!spin);            // 도는 애니메이션을 켜거나 끔 / turn the spin animation on or off
    el.classList.toggle("show1", !spin && v === 1); // 멈췄을 때 1이면 뒷면을 보임 / show tails when stopped at 1
  }

  /* ===== 1. 동전으로 보는 큐비트 / 1. Qubits seen through coins  ===== */
  function kid(el) {
    let theta = 70, auto = null;                    // 기울기(도)와 자동 시연 타이머임 / tilt (degrees) and auto-demo timer
    el.innerHTML = '<div class="grid kidv">' +
      '<div class="card stack"><h3>① 동전 하나 = 비트, 돌고 있는 동전 = 큐비트</h3><div class="row center">' + coin("kc", "돌려 보시기 바랍니다") + '<div class="stack" style="flex:1"><label>기울기(RY 회전 각도) <b id="kTh"></b><input id="kT" type="range" min="0" max="180" value="70"></label><canvas id="kDial"></canvas></div></div>' +
      '<p>도는 동전은 아직 0도 1도 아닙니다. 기울기에 따라 <b>1이 나올 가능성</b>만 정해져 있어요(중첩). 가능성 = sin²(각도/2)</p><div class="btns"><button id="kSpin">🪙 돌리기</button><button id="kCatch">✋ 잡기(측정 1번)</button><button id="kAuto" data-autoplay="1" class="primary">▶ 자동 시연</button></div></div>' +
      '<div class="card stack"><h3>② 측정을 많이 하면 가능성이 보여요</h3><div class="btns"><button data-n="1">1번</button><button data-n="100">100번</button><button data-n="10000" class="primary">10,000번 (애니메이션)</button><button id="kClr">지우기</button></div>' +
      '<div class="row" style="align-items:flex-start"><div><canvas id="kGrid"></canvas><p class="small" id="kGl">점 하나 = 측정 1번(노랑=1, 파랑=0)</p></div><div class="stack" style="flex:1"><canvas id="kHist"></canvas><canvas id="kConv"></canvas></div></div><p id="kOut"></p><div id="kB"></div></div></div>';
    const total = 10000, res = new Uint8Array(total); let n = 0, ones = 0, rand = S.rng(12345), conv = [], target = 0; // 측정 결과 저장소와 진행 변수임 / measurement storage and progress variables
    const p1 = function () { return Math.pow(Math.sin(theta * Math.PI / 360), 2); }; // 현재 1 확률임 / current probability of 1
    let shown = 0;                                  // 다이얼 표시 각도임 / displayed dial angle
    function drawAll() {                            // 측정 결과를 그림 / draws the measurement results
      const P = A.canvas($("#kGrid", el), Math.max(200, Math.round(el.clientHeight * .5))), g = P.g, cell = Math.min(2, (P.w) / 100); // 100×100 점판 준비임 / prepare the 100×100 dot board
      const sz = Math.min(P.w, P.h) / 100;           // 점 크기임 / dot size
      g.fillStyle = "#f4f6fb"; g.fillRect(0, 0, sz * 100, sz * 100); void cell; // 바탕임 / background
      for (let k = 0; k < n; k++) { g.fillStyle = res[k] ? "#ffb500" : "#003087"; g.fillRect((k % 100) * sz, Math.floor(k / 100) * sz, sz, sz); } // 측정 1번마다 점 하나를 찍음 / one dot per measurement
      C.bars($("#kHist", el), [{ label: "0", values: [n - ones] }, { label: "1", values: [ones] }], [{ color: "#003087" }], { height: Math.max(110, Math.round(el.clientHeight * .22)), max: Math.max(10, n), fmt: function (v) { return String(Math.round(v)); } }); // 0, 1 횟수 막대임 / bars of 0 and 1 counts
      C.line($("#kConv", el), [{ values: conv.length ? conv : [0], color: "#a9482a" }, { values: (conv.length ? conv : [0]).map(function () { return p1(); }), color: "#6e4c82" }], { height: Math.max(90, Math.round(el.clientHeight * .22)), min: 0, max: 1, xLabel: "측정 횟수 → (주황=지금까지 비율, 자두=정확한 가능성)" }); // 비율이 정확값으로 다가가는 그래프임 / graph of the share approaching the exact value
      $("#kOut", el).innerHTML = "정확한 가능성 <b>" + pct(p1()) + "</b>, 지금까지 " + n.toLocaleString("ko-KR") + "번 중 1은 " + ones.toLocaleString("ko-KR") + "번(<b>" + pct(ones / Math.max(1, n)) + "</b>). 오차 " + (n ? (Math.abs(ones / n - p1()) * 100).toFixed(2) + "%p" : "-") + ", 횟수가 많을수록 오차가 줄어요(큰 수의 법칙: 오차 ≈ 1/√횟수)."; // 설명 글임 / explanation text
    }
    function measure(k) {                           // k번 더 측정함 / measure k more times
      const p = p1();                               // 현재 가능성임 / current probability
      for (let j = 0; j < k && n < total; j++) { res[n] = rand() < p ? 1 : 0; ones += res[n]; n++; if (n % Math.max(1, Math.floor(n / 40)) === 0 || n < 50) conv.push(ones / n); } // 측정하고 비율을 기록함 / measure and record the share
      setCoin($("#kc", el), res[n - 1], false);     // 마지막 결과를 동전에 보임 / show the last result on the coin
    }
    function clear() { n = 0; ones = 0; conv = []; target = 0; drawAll(); } // 결과를 지움 / clear the results
    $("#kT", el).oninput = function (e) { theta = Number(e.target.value); clear(); }; // 기울기가 바뀌면 다시 시작함 / restart when the tilt changes
    $("#kSpin", el).onclick = function () { setCoin($("#kc", el), 0, true); say("동전이 돌고 있습니다. 아직 0도 1도 아닙니다. 1이 나올 가능성은 " + Math.round(p1() * 100) + "퍼센트입니다."); }; // 돌리기임 / spin
    $("#kCatch", el).onclick = function () { measure(1); drawAll(); say("탁 잡았더니 " + res[n - 1] + "이 나왔습니다. 한 번으로는 가능성을 알 수 없습니다."); }; // 1번 측정임 / measure once
    el.querySelectorAll("[data-n]").forEach(function (b) { b.onclick = function () { const k = Number(b.dataset.n); if (k < 10000) { measure(k); drawAll(); return; } target = Math.min(total, n + 10000); say("만 번을 측정해 보겠습니다. 점 하나가 측정 한 번입니다. 노란 점의 비율이 정확한 가능성에 점점 가까워지는 것을 보시기 바랍니다."); }; }); // 측정 버튼임 / measure button
    $("#kClr", el).onclick = clear;                 // 지우기임 / clear
    $("#kAuto", el).onclick = function () {         // 자동 시연(누르지 않아도 진행)임 / auto demo (runs without clicking)
      if (auto) { clearInterval(auto); auto = null; this.textContent = "▶ 자동 시연"; return; } // 다시 누르면 멈춤 / click again to stop
      this.textContent = "■ 시연 멈춤"; let step = 0; const angles = [0, 45, 90, 135, 180]; // 시연 단계와 각도임 / demo step and angle
      const run = function () { theta = angles[step % 5]; $("#kT", el).value = theta; clear(); setCoin($("#kc", el), 0, true); say("기울기 " + theta + "도. 1이 나올 가능성은 " + Math.round(p1() * 100) + "퍼센트. 만 번 측정해 보겠습니다."); target = 10000; step++; }; // 각도를 바꾸고 측정을 시작함 / change the angle and start measuring
      run(); auto = setInterval(run, 12000);         // 9초마다 다음 각도로 감 / move to the next angle every 9 s
    };
    const stop = A.loop(function () {               // 애니메이션 루프임 / animation loop
      shown = A.lerp(shown, theta * Math.PI / 180, .1); // 다이얼을 부드럽게 회전함 / rotate the dial smoothly
      const P = A.canvas($("#kDial", el), Math.max(120, Math.round(el.clientHeight * .3))), g = P.g; A.dial(g, P.w / 2, P.h / 2, Math.min(P.h / 2 - 12, 90), shown, "", "#003087", .4); // 큐비트 다이얼임 / qubit dial
      $("#kTh", el).textContent = theta + "° → P(1) " + pct(p1()); // 각도와 확률 표시임 / angle and probability display
      if (target > n) { measure(Math.min(250, target - n)); drawAll(); if (n >= target) setCoin($("#kc", el), res[n - 1], false); } // 10,000번 측정을 프레임마다 250개씩 진행함 / 10,000 measurements, 250 per frame
    });
    measure(1000); drawAll();                       // 처음부터 1,000번 측정한 모습을 보여 줌(빈 화면 방지) / show 1,000 measurements from the start (no blank screen)
    $("#kB", el).innerHTML = B.box({ data: "브라우저 난수(고정 씨앗 12345)로 측정을 흉내 냄", method: "RY(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩ → 측정 시 1이 나올 확률 sin²(θ/2) → 난수 < 확률이면 1", formula: "추정 오차의 표준편차 = √(p(1−p)/N) → 10,000번이면 최대 0.5%p", code: "views_learn.js kid(), emulator.js ry(), sampleProb()", ref: "Nielsen & Chuang, Quantum Computation and Quantum Information(2010) 1.2절, 2.2.3절(측정 공리)" }, "측정과 확률"); // 근거임 / evidence
    return function () { stop(); if (auto) clearInterval(auto); }; // 떠날 때 정리함 / clean up when leaving
  }

  /* ===== 2. 얽힘 짝꿍 실험 / 2. Entangled-pair experiment  ===== */
  function entangle(el) {
    let a = 75, b = 70, auto = null, phase = 0;      // 비, 경사 기울기(0~100)와 자동 시연 상태임 / rain and slope tilt (0~100) and auto-demo state
    el.innerHTML = '<div class="grid ent">' +
      '<div class="card stack"><h3>규칙 하나: “비 동전이 1이면, 짝꿍(경사) 동전을 뒤집어라” = CNOT</h3><p class="qa"><b>네, 맞습니다.</b> 비 동전이 <b>0이면 그대로</b>, <b>1이면 경사 동전을 뒤집어요</b>(0↔1). 비 동전 자체는 바뀌지 않습니다.</p>' +
      '<div class="row center ent-stage">' + coin("eA", "비 동전(제어)") + '<div class="hand" id="eH">⟶ 뒤집기 ✋</div>' + coin("eB", "경사 동전(대상)") + '<div class="arrowbig">⇒</div><div class="readout" id="eR">?</div></div>' +
      '<div class="slider"><span>비 세기</span><input id="ea" type="range" min="0" max="100" value="75"><output></output></div><div class="slider"><span>경사</span><input id="eb" type="range" min="0" max="100" value="70"><output></output></div>' +
      '<div class="btns"><button id="eAuto" data-autoplay="1" class="primary">▶ 자동 시연(기본)</button><button id="e1">1번 해 보기</button><button data-n="100">100번</button><button data-n="10000">10,000번</button></div><p id="eStep" class="steptext"></p></div>' +
      '<div class="flowdown">⬇ 위 동전 실험 한 번 한 번이 아래 표의 칸에 쌓입니다 ⬇</div><div class="card entb"><div><h3>CNOT 전과 후, 네 가지 경우 세기</h3><table class="ct" id="eT"></table></div><div><h3>전(연청)과 후(자두) 확률</h3><canvas id="eC"></canvas></div><div class="card tint-plum"><b>왜 이게 “겹침 점수”가 됩니까?</b><p>뒤집기 뒤 경사 동전은 <b>“두 동전이 같았나(0) 달랐나(1)”</b>를 알려 줍니다. 경사 동전만 읽어서 (0의 비율 − 1의 비율)을 계산한 값 = <b>⟨Z⟩ = cos(π, 비)×cos(π, 경사)</b>. 비와 경사가 <b>둘 다 높으면</b> “같음”이 많아져 값이 다시 +로 돌아오고, <b>한쪽만 높으면</b> −가 됩니다. 원래 신호와 함께 보면 AI가 “둘 다 높음”을 구별합니다.</p></div><div id="eB2"></div></div></div>';
    let cnt = { pre: [0, 0, 0, 0], post: [0, 0, 0, 0], n: 0 }, rand = S.rng(777); // 경우별 횟수와 난수임 / counts per case and random generator
    const pa = function () { return Math.pow(Math.sin(Math.PI * a / 200), 2); }, pb = function () { return Math.pow(Math.sin(Math.PI * b / 200), 2); }; // 각 동전이 1일 가능성임 / probability that each coin is 1
    function table() {                              // 표와 그래프를 갱신함 / update the table and graph
      const lab = ["비0 경사0", "비1 경사0", "비0 경사1", "비1 경사1"], n = Math.max(1, cnt.n); // 경우 이름과 횟수임 / case names and counts
      const st = S.createState(2); S.ry(st, 0, Math.PI * a / 100); S.ry(st, 1, Math.PI * b / 100); const pre = S.probs(st); S.cx(st, 0, 1); const post = S.probs(st); // 에뮬레이터의 정확한 확률임 / exact probabilities from the emulator
      $("#eT", el).innerHTML = "<tr><th>경우</th><th>CNOT 전(측정)</th><th>CNOT 후(측정)</th><th>에뮬레이터 정확 확률(후)</th></tr>" + [0, 1, 2, 3].map(function (i) { return "<tr><td>" + lab[i] + "</td><td>" + cnt.pre[i] + " (" + pct(cnt.pre[i] / n) + ")</td><td>" + cnt.post[i] + " (" + pct(cnt.post[i] / n) + ")</td><td>" + pct(post[i]) + "</td></tr>"; }).join("") +
        "<tr><td><b>경사 동전 ⟨Z⟩</b></td><td colspan=2>측정: " + (cnt.n ? ((cnt.post[0] + cnt.post[1] - cnt.post[2] - cnt.post[3]) / n).toFixed(3) : "-") + "</td><td>정확: <b>" + S.expectZ(st, 1).toFixed(3) + "</b> = cos×cos " + M.pairAnalytic(a / 100, b / 100).toFixed(3) + "</td></tr>"; // 표를 채움 / fill the table
      C.bars($("#eC", el), lab.map(function (l, i) { return { label: l, values: [pre[i], post[i]] }; }), [{ color: "#9fb3d9" }, { color: "#6e4c82" }], { height: Math.max(140, Math.round(el.clientHeight * .3)), max: 1 }); // 전후 확률 막대임 / before/after probability bars
      void pre;                                     // 사용 표시임 / usage display
    }
    function once(show) {                           // 한 번 실험함(show면 단계 애니메이션) / one experiment (with step animation if show)
      const ra = rand() < pa() ? 1 : 0, rb = rand() < pb() ? 1 : 0, rb2 = ra ? 1 - rb : rb; // 두 동전 결과와 뒤집기 결과임 / results of the two coins and the flip
      cnt.pre[ra + 2 * rb]++; cnt.post[ra + 2 * rb2]++; cnt.n++; // 횟수를 셈 / count
      if (!show) return;                            // 애니메이션 없이 끝냄 / finish without animation
      const A1 = $("#eA", el), B1 = $("#eB", el), H = $("#eH", el), R = $("#eR", el); // 요소들임 / elements
      const alive = function () { return A1.isConnected; }; // 화면을 떠났으면 이후 단계를 건너뜀 / skip later steps if the screen was left
      setCoin(A1, 0, true); setCoin(B1, rb, false); B1.classList.remove("flipped"); H.classList.remove("on"); R.textContent = "?"; $("#eStep", el).textContent = "① 비 동전을 먼저 돌려요(중첩)…"; // 1단계: 비 동전만 돎 / step 1: only the rain coin spins
      setTimeout(function () { if (!alive()) return; setCoin(A1, ra, false); $("#eStep", el).textContent = "② 비 동전 = " + ra + " (잠시 뒤 경사 동전을 돌립니다)"; }, 1800); // 2단계: 비 동전 결과 / step 2: rain coin result
      setTimeout(function () { if (!alive()) return; setCoin(B1, 0, true); $("#eStep", el).textContent = "③ 경사 동전을 돌려요…"; }, 3000); // 3단계: 잠시 쉬었다가 경사 동전이 돎 / step 3: after a pause the slope coin spins
      setTimeout(function () { if (!alive()) return; setCoin(B1, rb, false); $("#eStep", el).textContent = "④ 경사 동전 = " + rb + (ra ? " → 비가 1이니 뒤집습니다!" : " → 비가 0이니 그대로 둡니다."); if (ra) H.classList.add("on"); }, 4800); // 4단계: 경사 결과와 규칙 안내 / step 4: slope result and rule notice
      setTimeout(function () { if (!alive()) return; setCoin(B1, rb2, false); B1.classList.toggle("flipped", !!ra); R.textContent = rb2 === 0 ? "같음(0)" : "다름(1)"; $("#eStep", el).textContent = "⑤ 경사 동전 = " + rb2 + " → 두 동전이 " + (rb2 === 0 ? "같았습니다" : "달랐습니다"); table(); }, 6600); // 5단계: 뒤집기 결과와 의미 / step 5: flip result and meaning
    }
    ["ea", "eb"].forEach(function (id) { const i = $("#" + id, el); i.nextSibling.value = i.value; i.oninput = function () { a = Number($("#ea", el).value); b = Number($("#eb", el).value); i.nextSibling.value = i.value; cnt = { pre: [0, 0, 0, 0], post: [0, 0, 0, 0], n: 0 }; table(); }; }); // 슬라이더 연결임 / wire the slider
    $("#e1", el).onclick = function () { once(true); say("두 동전을 돌린 뒤, 비 동전이 1이면 경사 동전을 뒤집습니다. 0이면 그대로 둡니다."); }; // 1번 실험임 / one experiment
    el.querySelectorAll("[data-n]").forEach(function (bt) { bt.onclick = function () { const k = Number(bt.dataset.n); for (let j = 0; j < k; j++) once(false); table(); say(k + "번 실험했습니다. 표에서 뒤집기 전과 후의 경우를 비교해 보시기 바랍니다. 뒤집기 뒤에는 경사 동전만 읽어도 두 동전이 같았는지 달랐는지 알 수 있습니다."); }; }); // 여러 번 실험임 / many experiments
    $("#eAuto", el).onclick = function () { if (auto) { clearInterval(auto); auto = null; this.textContent = "▶ 자동 시연(기본)"; return; } this.textContent = "■ 멈춤"; once(true); auto = setInterval(function () { phase++; if (phase % 4 === 0) { a = [80, 20, 85, 50][(phase / 4) % 4]; b = [75, 80, 20, 50][(phase / 4) % 4]; $("#ea", el).value = a; $("#eb", el).value = b; } once(true); }, 9500); }; // 자동 시연(조건을 바꿔 가며 반복, 눈이 편하도록 9.5초 간격)임 / auto demo (repeats with changing conditions, 9.5 s apart for comfortable viewing)
    table();                                        // 처음 표임 / first table
    $("#eB2", el).innerHTML = B.box({ data: "두 동전(큐비트) 각각 RY(π, 값) 회전 후 측정 흉내", method: "CNOT: |제어, 대상⟩ → |제어, 대상 ⊕ 제어⟩. 측정 뒤 대상 비트 = 비 XOR 경사", formula: "⟨Z₁⟩ = P(같음) − P(다름) = (cos²−sin²)(cos²−sin²) = cos(π, 비), cos(π, 경사)", code: "emulator.js cx(), expectZ() / views_learn.js entangle()", ref: "Nielsen & Chuang(2010) 1.3.2절 CNOT, 2.6절 얽힘", note: "이 회로는 회전 후 바로 측정하므로 통계가 ‘독립 동전 + XOR’과 같음 → 일반 수식으로 똑같이 계산됨(‘왜 대조군과 같나’ 화면 참고)" }, "CNOT과 겹침 점수"); // 근거임 / evidence
    return function () { if (auto) clearInterval(auto); }; // 떠날 때 정리함 / clean up when leaving
  }

  /* ===== 3. 큐비트 용어 교실 (5과) / 3. Qubit vocabulary class (5 lessons)  ===== */
  function basics(el, sub) {
    const tab = Number(sub || 1);                   // 몇 과를 보여 줄지임 / which lessons to show
    const tabs = ["비트와 큐비트", "진폭과 확률", "게이트 카드", "상태벡터 읽기", "회로도 읽는 법"]; // 과 이름임 / lesson names
    el.innerHTML = '<div class="tabs">' + tabs.map(function (t, i) { return '<button data-t="' + (i + 1) + '" class="' + (i + 1 === tab ? "on" : "") + '">' + (i + 1) + "과 " + t + "</button>"; }).join("") + '<button id="bAuto" class="primary">▶ 5과 자동 수업</button></div><div id="bBody" class="bbody"></div>'; // 과 선택 줄임 / lesson selector row
    el.querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { QP.App.go("basics-" + b.dataset.t); }; }); // 과 이동임 / go to a lesson
    let stop = null, autoT = null;                  // 루프와 자동 수업 타이머임 / loop and auto-class timer
    const body = $("#bBody", el);                   // 내용 영역임 / content area
    const L = {                                     // 과별 내용임 / content per lesson
      1: function () { body.innerHTML = '<div class="grid two"><div class="card stack"><h3>비트(bit)</h3><p>0 아니면 1. 스위치 꺼짐/켜짐, 탁자 위 동전 앞/뒤.</p><div class="bits" id="bb"></div><button id="bf">스위치 누르기</button></div><div class="card stack"><h3>큐비트(qubit)</h3><p>측정 전에는 0과 1의 <b>가능성을 동시에</b> 가진 상태(중첩). 화살표의 방향이 상태입니다. 위=0, 아래=1, 옆=반반.</p><canvas id="bq"></canvas><p class="small">화살표는 자동으로 천천히 돕니다. 측정하면 0 또는 1 하나로 정해집니다.</p></div>' + '<div class="card" style="grid-column:1/-1"><b>핵심 차이</b> 비트 n개는 2ⁿ가지 중 <b>하나</b>만 저장, 큐비트 n개의 상태는 2ⁿ개 진폭 <b>전부</b>로 표현됨(그래서 에뮬레이터는 2ⁿ개 숫자를 저장해야 함).</div></div>'; let v = 0; const draw = function () { $("#bb", body).innerHTML = '<span class="bit ' + (v ? "on" : "") + '">' + v + "</span>"; }; draw(); $("#bf", body).onclick = function () { v = 1 - v; draw(); }; let th = 0; return A.loop(function (dt) { th += dt * .8; const P = A.canvas($("#bq", body), 225), g = P.g; const t = (Math.sin(th) + 1) / 2 * Math.PI; A.dial(g, P.w / 2, 96, 70, t, "P(1) = " + pct(Math.pow(Math.sin(t / 2), 2)), "#6e4c82", .5); }); },
      2: function () { body.innerHTML = '<div class="grid two"><div class="card stack"><h3>진폭(amplitude)과 확률</h3><canvas id="ba"></canvas><input id="bs" type="range" min="0" max="180" value="60"></div><div class="card stack"><p>상태 = <b>cos(θ/2)</b>, |0⟩ + <b>sin(θ/2)</b>, |1⟩</p><p>그림의 화살표를 세로축(|0⟩)과 가로축(|1⟩)에 비춘 그림자 길이가 <b>진폭</b>입니다.</p><p>진폭을 <b>제곱</b>하면 확률: P(0)=cos²(θ/2), P(1)=sin²(θ/2). 두 확률의 합은 항상 1(피타고라스).</p><p id="bv" class="kpi c-plum"></p><p class="small">진폭은 음수도 될 수 있어서 서로 상쇄(간섭)될 수 있지만, 확률은 항상 0 이상입니다.</p></div></div>'; let sh = 0; return A.loop(function () { const th = Number($("#bs", body).value) * Math.PI / 180; sh = A.lerp(sh, th, .12); const P = A.canvas($("#ba", body), 230), g = P.g, cx = 110, cy = 120, r = 90; g.strokeStyle = "#ccd3e4"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); const c = Math.cos(sh / 2), s = Math.sin(sh / 2); g.strokeStyle = "#003087"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + s * r, cy - c * r); g.stroke(); g.lineWidth = 6; g.strokeStyle = "rgba(0,48,135,.35)"; g.beginPath(); g.moveTo(cx - 100, cy); g.lineTo(cx - 100, cy - c * r); g.stroke(); g.strokeStyle = "rgba(255,181,0,.8)"; g.beginPath(); g.moveTo(cx, cy + 105); g.lineTo(cx + s * r, cy + 105); g.stroke(); g.fillStyle = "#1d2a4d"; g.font = "11px Malgun Gothic"; g.fillText("|0⟩ 진폭 " + c.toFixed(2), cx - 100, 14); g.fillText("|1⟩ 진폭 " + s.toFixed(2), cx + 10, cy + 100); g.fillStyle = "rgba(0,48,135,.25)"; g.fillRect(230, 200 - c * c * 160, 50, c * c * 160); g.fillStyle = "rgba(255,181,0,.6)"; g.fillRect(290, 200 - s * s * 160, 50, s * s * 160); g.fillStyle = "#1d2a4d"; g.fillText("P(0)", 240, 214); g.fillText("P(1)", 300, 214); $("#bv", body).textContent = "θ=" + Math.round(sh * 180 / Math.PI) + "° → 진폭 (" + c.toFixed(2) + ", " + s.toFixed(2) + ") → 확률 (" + pct(c * c) + ", " + pct(s * s) + ")"; }); },
      3: function () { const cards = [["X", "뒤집기(NOT)", "0↔1을 맞바꿉니다. 화살표가 위↔아래로 180° 돕니다."], ["RY(θ)", "돌리기", "화살표를 θ만큼 돌립니다. 산행 신호(0~1)를 각도 π, 신호로 넣을 때 씁니다."], ["H", "반반 섞기", "0을 0과 1이 반반인 상태로 만들어요(옆으로 눕힘)."], ["CNOT", "조건부 뒤집기", "제어 큐비트가 1이면 대상 큐비트를 X로 뒤집어요(얽힘)."], ["측정", "읽기", "화살표를 0 또는 1 하나로 정해 읽습니다. 여러 번 하면 확률이 보입니다."]]; body.innerHTML = '<div class="grid gates"><div class="stack">' + cards.map(function (c, i) { return '<button class="gate" data-g="' + i + '"><b>' + c[0] + '</b> ' + c[1] + '<small>' + c[2] + '</small></button>'; }).join("") + '</div><div class="card stack"><h3 id="gt">게이트 카드를 눌러 적용해 보세요</h3><canvas id="gc"></canvas><p id="gx"></p></div></div>'; let q = [0, 0], tq = [0, 0]; body.querySelectorAll(".gate").forEach(function (b) { b.onclick = function () { const k = Number(b.dataset.g); if (k === 0) tq[0] = Math.PI - tq[0]; if (k === 1) tq[0] = Math.min(Math.PI, tq[0] + Math.PI / 4); if (k === 2) tq[0] = Math.PI / 2; if (k === 3 && Math.pow(Math.sin(tq[0] / 2), 2) > .5) tq[1] = Math.PI - tq[1]; if (k === 4) { tq[0] = Math.random() < Math.pow(Math.sin(tq[0] / 2), 2) ? Math.PI : 0; } $("#gt", body).textContent = cards[k][0] + " 적용"; $("#gx", body).textContent = cards[k][2]; say(cards[k][0] + ". " + cards[k][1] + ". " + cards[k][2]); }; }); return A.loop(function () { q[0] = A.lerp(q[0], tq[0], .08); q[1] = A.lerp(q[1], tq[1], .08); const P = A.canvas($("#gc", body), 230), g = P.g; A.dial(g, P.w * .3, 100, 64, q[0], "큐비트 A(제어)", "#003087", .4); A.dial(g, P.w * .7, 100, 64, q[1], "큐비트 B(대상)", "#6e4c82", .4); }); },
      4: function () { body.innerHTML = '<div class="grid two"><div class="card stack"><h3>2큐비트 상태벡터 = 진폭 4개 목록</h3><div class="slider"><span>A 각도</span><input id="sa" type="range" min="0" max="100" value="60"><output></output></div><div class="slider"><span>B 각도</span><input id="sb" type="range" min="0" max="100" value="30"><output></output></div><label class="tog"><input type="checkbox" id="sc"> CNOT 적용</label><table id="sv" class="ct"></table></div><div class="card stack"><p>결과 이름 “10”은 <b>A=1, B=0</b>(왼쪽부터 A, B 순서)입니다.</p><p>컴퓨터 안에서는 이 4칸 숫자 목록만 저장하면 모든 것을 계산할 수 있습니다. 큐비트가 n개면 2ⁿ칸입니다.</p><canvas id="svc"></canvas></div></div>'; const up = function () { const a = $("#sa", body).value / 100, b = $("#sb", body).value / 100; $("#sa", body).nextSibling.value = $("#sa", body).value; $("#sb", body).nextSibling.value = $("#sb", body).value; const st = S.createState(2); S.ry(st, 0, Math.PI * a); S.ry(st, 1, Math.PI * b); if ($("#sc", body).checked) S.cx(st, 0, 1); const p = S.probs(st); $("#sv", body).innerHTML = "<tr><th>결과(A B)</th><th>진폭</th><th>확률=진폭²</th></tr>" + [0, 1, 2, 3].map(function (i) { return "<tr><td>" + S.label(i, 2) + "</td><td>" + st.re[i].toFixed(3) + "</td><td>" + pct(p[i]) + "</td></tr>"; }).join("") + "<tr><td>합계</td><td></td><td>" + pct(S.norm(st)) + "</td></tr>"; C.bars($("#svc", body), [0, 1, 2, 3].map(function (i) { return { label: S.label(i, 2), values: [p[i]] }; }), [{ color: "#6e4c82" }], { height: 170, max: 1 }); }; ["sa", "sb", "sc"].forEach(function (id) { $("#" + id, body).oninput = up; $("#" + id, body).onchange = up; }); up(); return null; },
      5: function () {                              // 5과: 회로도를 한 단계씩 따라가며 무엇이 왜 바뀌는지 보여 줌 / lesson 5: walk the circuit step by step, showing what changes and why
        const EN = QP.I18N && QP.I18N.lang() === "en"; // 영문 모드인지임 / English mode?
        const T = function (k, e) { return EN ? e : k; }; // 한영 선택 도우미 / bilingual helper
        body.innerHTML = '<div class="card stack"><h3>' + T("회로도 읽는 법: 노란 점 = 지금 계산이 진행된 위치(시간은 왼쪽에서 오른쪽으로 흐름)", "Reading a circuit: the yellow dot = how far the computation has gone (time flows left to right)") + '</h3>' +
          '<div class="btns"><button id="rcPrev">◀ ' + T("이전 단계", "Previous step") + '</button><button id="rcNext" class="primary">' + T("다음 단계", "Next step") + ' ▶</button><button id="rcAuto">▶ ' + T("천천히 자동 진행", "Slow auto play") + '</button>' +
          '<label class="rcsl">' + T("비 세기", "Rain") + ' <input id="rcA" type="range" min="0" max="100" value="80"><output>80</output></label><label class="rcsl">' + T("경사", "Slope") + ' <input id="rcB" type="range" min="0" max="100" value="30"><output>30</output></label></div>' +
          '<canvas id="rc"></canvas><div class="rcsteps" id="rcSteps"></div><p id="rcTxt" class="rctxt"></p></div>';
        const names = EN ? ["① Start", "② RY rotation", "③ CNOT", "④ Measure"] : ["① 시작", "② RY 회전", "③ CNOT", "④ 측정"]; // 단계 이름 / step names
        $("#rcSteps", body).innerHTML = names.map(function (n, k) { return '<button data-k="' + k + '">' + n + "</button>"; }).join(""); // 단계 바로가기 / step shortcuts
        let step = 0, pos = 0, autoT = null, sh0 = 0, sh1 = 0; // 단계, 점 위치, 자동 타이머, 표시 각도 / step, dot position, auto timer, shown angles
        const val = function (id) { return Number($("#" + id, body).value) / 100; }; // 슬라이더 값 / slider value
        const pc = function (x) { return (x * 100).toFixed(0) + "%"; }; // 백분율 / percent
        function calc() {                           // 단계별 상태를 계산함 / compute the state for each step
          const a = val("rcA"), b = val("rcB"), p0 = Math.pow(Math.sin(Math.PI * a / 2), 2), p1 = Math.pow(Math.sin(Math.PI * b / 2), 2); // 회전 후 1 확률 / P(1) after rotation
          const pc1 = p0 * (1 - p1) + (1 - p0) * p1; // CNOT 뒤 경사 큐비트의 1 확률 = 두 값이 다를 확률 / P(1) of the slope qubit after CNOT = P(values differ)
          return { a: a, b: b, p0: p0, p1: p1, pc1: pc1, z: 1 - 2 * pc1 };
        }
        function text() {                           // 지금 단계의 설명 / explanation for the current step
          const c = calc();
          const K = [
            "① 시작: 가로선 두 개가 각각 큐비트 하나입니다(위: 비 q0, 아래: 경사 q1). 처음에는 둘 다 |0⟩이라 오른쪽 상태 그림의 화살표가 모두 위(0)를 가리키고, 1이 나올 확률은 0%입니다.",
            "② RY 회전: 노란 점이 파란 네모를 지나면 화살표가 입력값만큼 돌아갑니다. 비 q0는 π×" + c.a.toFixed(2) + "만큼, 경사 q1은 π×" + c.b.toFixed(2) + "만큼 돌아서, 1이 나올 확률이 비 " + pc(c.p0) + ", 경사 " + pc(c.p1) + "가 됩니다. 산행 신호가 클수록 많이 돕니다.",
            "③ CNOT: 노란 점이 세로선을 지나면, ●(제어, 비)가 1일 때 ⊕(대상, 경사)를 뒤집습니다. 비 q0는 그대로 " + pc(c.p0) + "이고, 경사 q1의 1 확률은 " + pc(c.p1) + "에서 " + pc(c.pc1) + "로 바뀝니다. 이제 경사 큐비트는 ‘두 값이 서로 다른가’를 담고 있으며, 두 큐비트가 얽힌 상태입니다.",
            "④ 측정: 계기판에서 경사 q1을 읽습니다. 0이면 두 신호가 같음, 1이면 다름입니다. 여러 번 측정한 평균 ⟨Z⟩ = 1 − 2×" + pc(c.pc1) + " = " + c.z.toFixed(2) + "가 겹침 점수이며, cos(π×비)×cos(π×경사) 계산값과 같습니다."];
          const E = [
            "① Start: each horizontal line is one qubit (top: rain q0, bottom: slope q1). Both begin in |0⟩, so both arrows in the state panel on the right point up (0) and the probability of 1 is 0%.",
            "② RY rotation: when the yellow dot passes a blue box, the arrow turns by the input value. Rain q0 turns by π×" + c.a.toFixed(2) + " and slope q1 by π×" + c.b.toFixed(2) + ", so P(1) becomes " + pc(c.p0) + " for rain and " + pc(c.p1) + " for slope. A larger hiking signal turns the arrow further.",
            "③ CNOT: when the yellow dot passes the vertical line, ● (control, rain) flips ⊕ (target, slope) if it is 1. Rain q0 stays at " + pc(c.p0) + ", while slope q1 changes from " + pc(c.p1) + " to " + pc(c.pc1) + ". The slope qubit now holds 'do the two values differ?', and the two qubits are entangled.",
            "④ Measure: the meter reads slope q1. 0 means the two signals agree, 1 means they differ. The average over many shots, ⟨Z⟩ = 1 − 2×" + pc(c.pc1) + " = " + c.z.toFixed(2) + ", is the overlap score and equals cos(π×rain)×cos(π×slope)."];
          $("#rcTxt", body).textContent = (EN ? E : K)[step];
          body.querySelectorAll("#rcSteps button").forEach(function (b2) { b2.classList.toggle("on", Number(b2.dataset.k) === step); });
          return (EN ? E : K)[step];
        }
        function go(k, voice) { step = Math.max(0, Math.min(3, k)); const t = text(); if (voice && !QP.State.basicsAuto) say(t); } // 단계 이동 / go to a step
        $("#rcPrev", body).onclick = function () { stopAuto(); go(step - 1, true); };
        $("#rcNext", body).onclick = function () { stopAuto(); go(step + 1, true); };
        body.querySelectorAll("#rcSteps button").forEach(function (b2) { b2.onclick = function () { stopAuto(); go(Number(b2.dataset.k), true); }; });
        ["rcA", "rcB"].forEach(function (id) { const i2 = $("#" + id, body); i2.oninput = function () { i2.nextSibling.value = i2.value; text(); }; });
        function stopAuto() { if (autoT) { clearInterval(autoT); autoT = null; $("#rcAuto", body).textContent = "▶ " + T("천천히 자동 진행", "Slow auto play"); } }
        function startAuto() { stopAuto(); go(0, false); $("#rcAuto", body).textContent = "■ " + T("멈춤", "Stop"); autoT = setInterval(function () { if (!body.isConnected) return stopAuto(); go((step + 1) % 4, false); }, 6000); } // 6초마다 한 단계 / one step every 6 s
        $("#rcAuto", body).onclick = function () { if (autoT) stopAuto(); else startAuto(); };
        go(0, false); startAuto();                  // 처음에는 천천히 자동으로 보여 줌 / start with the slow auto play
        const stopLoop = A.loop(function () {
          const c = calc(), P = A.canvas($("#rc", body), 300), g = P.g, W = P.w, Y = [85, 205];
          const X1 = 110, X2 = W - 230, xs = [X1, X1 + (X2 - X1) * .3, X1 + (X2 - X1) * .62, X1 + (X2 - X1) * .9]; // 선 시작, RY, CNOT, 측정 x 위치 / x positions of start, RY, CNOT, measure
          pos = A.lerp(pos, xs[step] + [0, 66, 24, 44][step], .05);   // 장치를 막 지난 자리에 멈춰 글자를 가리지 않음 / stop just past the device so its label stays visible         // 노란 점이 천천히 다음 장치로 이동 / the yellow dot moves slowly to the next device
          g.font = "13px Malgun Gothic,sans-serif"; g.textAlign = "left";
          [0, 1].forEach(function (k) { g.strokeStyle = "#8892ad"; g.lineWidth = 2; g.beginPath(); g.moveTo(X1 - 20, Y[k]); g.lineTo(X2 + 40, Y[k]); g.stroke(); g.fillStyle = "#1d2a4d"; g.fillText(k ? T("경사 q1", "slope q1") : T("비 q0", "rain q0"), 6, Y[k] - 4); g.fillText("|0⟩", 6, Y[k] + 14); });
          const hl = function (k) { return step === k; }; // 지금 단계의 장치는 강조 / highlight the current device
          [[0, T("RY(π×비)", "RY(π×rain)")], [1, T("RY(π×경사)", "RY(π×slope)")]].forEach(function (bx) { const x = xs[1], y = Y[bx[0]]; g.fillStyle = hl(1) ? "#0a4fd6" : "#003087"; if (hl(1)) { g.shadowColor = "#ffb500"; g.shadowBlur = 16; } g.fillRect(x - 52, y - 17, 104, 34); g.shadowBlur = 0; g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(bx[1], x, y + 5); g.textAlign = "left"; });
          g.strokeStyle = hl(2) ? "#e08a00" : "#b07a00"; g.lineWidth = hl(2) ? 4 : 2; if (hl(2)) { g.shadowColor = "#ffb500"; g.shadowBlur = 14; } g.beginPath(); g.moveTo(xs[2], Y[0]); g.lineTo(xs[2], Y[1] + 13); g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(xs[2], Y[0], 7, 0, 7); g.fill(); g.beginPath(); g.arc(xs[2], Y[1], 13, 0, 7); g.stroke(); g.beginPath(); g.moveTo(xs[2] - 13, Y[1]); g.lineTo(xs[2] + 13, Y[1]); g.stroke(); g.shadowBlur = 0;
          g.fillStyle = "#4d6b8c"; g.textAlign = "center"; g.font = "12px Malgun Gothic,sans-serif"; g.fillText(T("● 제어", "● control"), xs[2], Y[0] - 14); g.fillText(T("⊕ 대상", "⊕ target"), xs[2], Y[1] + 32);
          if (hl(3)) { g.shadowColor = "#ffb500"; g.shadowBlur = 16; } g.fillStyle = "#4d6b8c"; g.fillRect(xs[3] - 30, Y[1] - 18, 60, 36); g.shadowBlur = 0; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(xs[3], Y[1] + 10, 16, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.moveTo(xs[3], Y[1] + 10); g.lineTo(xs[3] + 11, Y[1] - 8); g.stroke(); g.fillStyle = "#4d6b8c"; g.fillText(T("측정", "measure"), xs[3], Y[1] + 34);
          g.fillStyle = "#ffb500"; g.strokeStyle = "#c62828"; g.lineWidth = 2; [0, 1].forEach(function (k) { g.beginPath(); g.arc(pos, Y[k], 8, 0, 7); g.fill(); g.stroke(); }); // 노란 점 = 계산 진행 위치 / yellow dot = computation position
          g.fillStyle = "#1d2a4d"; g.font = "bold 13px Malgun Gothic,sans-serif"; g.fillText(names[step], pos, 22);
          const t0 = step >= 1 ? Math.PI * c.a : 0, t1 = step >= 2 ? 2 * Math.asin(Math.sqrt(c.pc1)) : (step >= 1 ? Math.PI * c.b : 0); // 오른쪽 상태 그림의 각도 / angles in the state panel
          sh0 = A.lerp(sh0, t0, .06); sh1 = A.lerp(sh1, t1, .06);
          const DX = W - 110; g.fillStyle = "#f3f5fa"; g.fillRect(DX - 100, 34, 200, 250); g.fillStyle = "#1d2a4d"; g.font = "bold 12px Malgun Gothic,sans-serif"; g.textAlign = "center"; g.fillText(T("지금 상태", "Current state"), DX, 46);
          A.dial(g, DX - 45, Y[0] + 12, 26, sh0, "", "#003087", .3); A.dial(g, DX - 45, Y[1] + 12, 26, sh1, "", "#6e4c82", .3);
          g.textAlign = "left"; g.font = "12px Malgun Gothic,sans-serif"; g.fillStyle = "#1d2a4d";
          g.fillText(T("비 P(1)", "rain P(1)"), DX - 10, Y[0] + 6); g.font = "bold 15px Malgun Gothic,sans-serif"; g.fillText(pc(Math.pow(Math.sin(sh0 / 2), 2)), DX - 10, Y[0] + 26);
          g.font = "12px Malgun Gothic,sans-serif"; g.fillText(step >= 2 ? T("경사 P(1)=다름", "slope P(1)=differ") : T("경사 P(1)", "slope P(1)"), DX - 10, Y[1] + 6); g.font = "bold 15px Malgun Gothic,sans-serif"; g.fillText(pc(Math.pow(Math.sin(sh1 / 2), 2)), DX - 10, Y[1] + 26);
          if (step === 3) { g.fillStyle = "#c62828"; g.font = "bold 13px Malgun Gothic,sans-serif"; g.fillText("⟨Z⟩ = " + c.z.toFixed(2), DX - 10, Y[1] + 48); }
        });
        return function () { stopLoop && stopLoop(); stopAuto(); };
      }
    };
    stop = L[tab]();                                // 선택한 과를 그림 / draws the chosen lesson
    let demo = null;                                // 과마다 화면이 저절로 움직이게 하는 시연 타이머임 / demo timer making each lesson move by itself
    if (tab === 3) { let k = 0; demo = setInterval(function () { const bs = body.querySelectorAll(".gate"); if (bs.length) { const b = bs[k++ % bs.length]; b.classList.add("on"); setTimeout(function () { b.classList.remove("on"); }, 900); QP.State.touring = true; b.click(); QP.State.touring = false; } }, 5000); } // 3과: 게이트 카드를 차례로 눌러 화살표가 돌아가게 함(카드 음성은 끔) / lesson 3: click the gate cards in turn to rotate the arrow (card voice off)
    if (tab === 4) { let ph = 0; demo = setInterval(function () { ph += .25; const a = body.querySelector("#sa"), b = body.querySelector("#sb"), c = body.querySelector("#sc"); if (!a) return; a.value = Math.round(50 + 45 * Math.sin(ph)); b.value = Math.round(50 + 45 * Math.sin(ph * .7 + 1)); c.checked = Math.sin(ph * .3) > 0; a.oninput(); }, 1400); } // 4과: 두 각도와 CNOT을 바꿔 가며 진폭 표가 계속 변하게 함 / lesson 4: vary two angles and CNOT so the amplitude table keeps changing
    if (tab === 2) { let ph = 0; demo = setInterval(function () { const r = body.querySelector("#bs"); if (!r) return; ph += .05; r.value = Math.round(90 + 85 * Math.sin(ph)); }, 120); } // 2과: 각도가 천천히 오가며 진폭과 확률이 바뀜 / lesson 2: the angle sweeps slowly, changing amplitudes and probabilities
    // 5과 자동 수업: 1과부터 시작해 각 과의 설명을 목소리로 끝까지 읽고, 다 읽으면 1.5초 뒤 다음 과로 넘어감 / 5-lesson auto class: from lesson 1, read each lesson's explanation to the end, then go to the next lesson 1.5 s later
    const bA = $("#bAuto", el);                      // 자동 수업 버튼임 / auto-class button
    bA.textContent = QP.State.basicsAuto ? "■ 자동 수업 멈춤 (" + tab + "/5과 진행 중)" : "▶ 5과 자동 수업"; // 진행 중이면 멈춤 버튼으로 보임 / shown as a stop button while running
    function lesson() {                             // 이 과의 설명을 읽고 끝나면 다음 과로 넘김 / read this lesson's explanation and go next when done
      QP.Voice.wake();                              // 오디오 장치를 깨움 / wake the audio device
      QP.Voice.speak(QP.Narration.sub("basics", tab), true); // 이 과의 설명을 읽음(화면 그림과 함께) / read this lesson's explanation (with the screen)
      const wait = function () {                    // 다 읽었는지 확인함 / check whether reading is finished
        if (!QP.State.basicsAuto || !bA.isConnected) return; // 멈췄거나 화면을 떠났으면 끝냄 / end if stopped or the screen was left
        if (QP.Voice.isActive() || QP.Voice.isPaused()) { autoT = setTimeout(wait, 500); return; } // 읽는 중(또는 멈춤)이면 기다림 / wait while reading (or paused)
        autoT = setTimeout(function () {            // 잠시 쉬고 / pause briefly
          if (!QP.State.basicsAuto || !bA.isConnected) return; // 그 사이 멈췄으면 끝냄 / end if stopped meanwhile
          if (tab < 5) QP.App.go("basics-" + (tab + 1)); // 다음 과로 넘어감 / go to the next lesson
          else { QP.State.basicsAuto = false; bA.textContent = "▶ 5과 자동 수업"; QP.Voice.speak("다섯 과 수업을 모두 마쳤습니다. 다시 들으려면 5과 자동 수업을 누르시기 바랍니다.", true); } // 마지막 과면 끝냄 / end at the last lesson
        }, 1500);
      };
      autoT = setTimeout(wait, 1200);               // 읽기가 시작된 뒤부터 확인함 / check only after reading has started
    }
    bA.onclick = function () {                      // 자동 수업 시작, 멈춤 버튼임 / auto-class start/stop button
      if (QP.State.basicsAuto) { QP.State.basicsAuto = false; clearTimeout(autoT); QP.Voice.stop(); bA.textContent = "▶ 5과 자동 수업"; return; } // 진행 중이면 멈춤 / stop if running
      QP.State.basicsAuto = true;                   // 자동 수업을 켬 / turn on the auto class
      if (tab === 1) { bA.textContent = "■ 자동 수업 멈춤 (1/5과 진행 중)"; lesson(); } else QP.App.go("basics-1"); // 1과부터 시작함(이미 1과면 바로 읽음) / start from lesson 1 (read at once if already there)
    };
    if (QP.State.basicsAuto && !QP.State.touring) autoT = setTimeout(lesson, 500); // 자동 수업 중이면 이 과에 도착하자마자 설명을 시작함 / during the auto class, start explaining as soon as this lesson opens
    return function () { if (stop) stop(); clearTimeout(autoT); clearInterval(demo); }; // 떠날 때 정리함 / clean up when leaving
  }

  /* ===== 4. 2큐비트 실험대 (애니메이션) / 4. 2-qubit bench (animation)  ===== */
  function lab2q(el) {
    let stage = 3, shots = 0, sa = 0, sb = 0, auto = null; // 단계, 샷 수, 표시 각도, 자동 시연임 / step, shots, displayed angles, auto demo
    el.innerHTML = '<div class="grid v3"><div class="card stack"><h3>입력</h3><div class="slider"><span>비의 세기</span><input id="lR" type="range" min="0" max="100" value="85"><output></output></div><div class="slider"><span>경사 부담</span><input id="lS" type="range" min="0" max="100" value="83"><output></output></div>' +
      '<div class="btns" id="lStage"><button data-s="1">① 회전</button><button data-s="2">② 얽기</button><button data-s="3">③ 측정</button><button id="lAuto" data-autoplay="1" class="primary">▶ 자동 진행</button></div>' +
      '<select id="lShots"><option value="0">정확 판독(에뮬레이터)</option><option value="1000">샷 1000번</option><option value="100">샷 100번</option><option value="20">샷 20번</option></select>' +
      '<div class="btns"><button data-p="85,83">비+급경사</button><button data-p="95,15">비만</button><button data-p="15,95">경사만</button><button data-p="10,10">맑고 평탄</button></div><p id="lNote" class="small"></p></div>' +
      '<div class="card stack"><h3>큐비트 다이얼과 확률</h3><canvas id="lD"></canvas><canvas id="lAmp"></canvas></div>' +
      '<div class="card stack"><h3>겹침 점수 ⟨Z⟩</h3><p class="kpi c-plum" id="lZ"></p><p id="lZt"></p><canvas id="lH"></canvas><div id="lB"></div></div></div>';
    const r = $("#lR", el), s = $("#lS", el);       // 슬라이더임 / sliders
    function upd() {                                // 계산과 글을 갱신함 / update computation and text
      const a = r.value / 100, b = s.value / 100; r.nextSibling.value = r.value; s.nextSibling.value = s.value; // 입력값임 / input values
      const st = S.createState(2); if (stage >= 1) { S.ry(st, 0, Math.PI * a); S.ry(st, 1, Math.PI * b); } if (stage >= 2) S.cx(st, 0, 1); // 단계까지 계산함 / compute up to the step
      const p = S.probs(st); C.bars($("#lAmp", el), [0, 1, 2, 3].map(function (i) { return { label: S.label(i, 2), values: [p[i]] }; }), [{ color: "#6e4c82" }], { height: Math.max(120, Math.round(el.clientHeight * .26)), max: 1 }); // 확률 막대임 / probability bars
      const z = S.expectZ(st, 1), rand = S.rng(Math.round(a * 997 + b * 13)); // 판독값과 난수임 / readout and random generator
      const est = shots ? 1 - 2 * S.sampleProb((1 - z) / 2, shots, rand) : z; // 샷 추정값임 / shot estimate
      $("#lZ", el).textContent = stage < 3 ? "측정 전" : est.toFixed(3); // 점수 표시임 / score display
      $("#lZt", el).innerHTML = stage < 3 ? "③ 측정을 눌러 보시기 바랍니다." : a > .6 && b > .6 ? "<b>둘 다 높음</b>: 두 동전이 ‘같음’이 많아 +쪽. 원래 신호(둘 다 높음)와 함께 보면 위험 겹침임." : Math.abs(a - b) > .5 ? "<b>한쪽만 높음</b>: ‘다름’이 많아 −쪽." : "둘 다 낮거나 비슷하면 +쪽."; // 쉬운 해석임 / easy interpretation
      const vals = []; for (let k = 0; k < 40; k++) vals.push(shots ? 1 - 2 * S.sampleProb((1 - z) / 2, shots, rand) : z); C.line($("#lH", el), [{ values: vals, color: "#c76b67" }, { values: vals.map(function () { return z; }), color: "#6e4c82" }], { height: Math.max(100, Math.round(el.clientHeight * .33)), min: -1, max: 1, xLabel: "같은 측정 40번 반복" }); // 샷 흔들림 그래프임 / shot-noise graph
      $("#lNote", el).textContent = shots ? "실제 장비처럼 " + shots + "번 측정해 추정함." : "에뮬레이터는 상태벡터를 알아 정확히 계산함."; // 판독 방식임 / readout method
      el.querySelectorAll("#lStage [data-s]").forEach(function (bt) { bt.classList.toggle("on", Number(bt.dataset.s) === stage); }); // 단계 강조임 / highlight the step
      $("#lB", el).innerHTML = B.box({ data: "슬라이더 값 비=" + a.toFixed(2) + ", 경사=" + b.toFixed(2), method: "RY(π, 비)⊗RY(π, 경사) → CNOT(0→1) → 큐비트1 측정", formula: "⟨Z₁⟩ = cos(π, 비)cos(π, 경사) = " + M.pairAnalytic(a, b).toFixed(3), code: "models.js pairExact()" }, "겹침 점수"); // 근거임 / evidence
    }
    r.oninput = upd; s.oninput = upd; $("#lShots", el).onchange = function (e) { shots = Number(e.target.value); upd(); }; // 입력 연결임 / wire up inputs
    el.querySelectorAll("#lStage [data-s]").forEach(function (bt) { bt.onclick = function () { stage = Number(bt.dataset.s); upd(); say(["", "회전 단계입니다. 비와 경사 값만큼 두 큐비트 화살표를 돌립니다.", "얽기 단계입니다. 비 큐비트가 1일 가능성만큼 경사 큐비트를 뒤집습니다.", "측정 단계입니다. 경사 큐비트를 읽어 겹침 점수를 얻습니다."][stage]); }; }); // 단계 버튼임 / step buttons
    el.querySelectorAll("[data-p]").forEach(function (bt) { bt.onclick = function () { const v = bt.dataset.p.split(","); r.value = v[0]; s.value = v[1]; upd(); }; }); // 예시 버튼임 / example buttons
    $("#lAuto", el).onclick = function () { if (auto) { clearInterval(auto); auto = null; this.textContent = "▶ 자동 진행"; return; } this.textContent = "■ 멈춤"; stage = 0; auto = setInterval(function () { stage = stage % 3 + 1; upd(); say(["", "회전.", "얽기.", "측정. 겹침 점수는 " + $("#lZ", el).textContent + "입니다."][stage]); }, 6500); }; // 자동 진행(천천히)임 / auto progress (slowly)
    const stop = A.loop(function () {               // 다이얼 애니메이션임 / dial animation
      const a = stage >= 1 ? r.value / 100 : 0, b = s.value / 100 * (stage >= 1 ? 1 : 0); // 목표 각도 비율임 / target angle ratio
      const bEff = stage >= 2 ? b : b;              // 대상 각도(얽힘은 연결선으로 표현)임 / target angle (entanglement shown as a link)
      sa = A.lerp(sa, a, .1); sb = A.lerp(sb, bEff, .1); // 부드럽게 따라감 / follow smoothly
      const P = A.canvas($("#lD", el), Math.max(230, Math.round(el.clientHeight * .5))), g = P.g; A.pair(g, 4, 4, P.w - 8, P.h - 8, sa, sb, ["비", "경사"], stage >= 2); // 회로 위젯을 그림 / draw the circuit widget
    });
    upd();                                          // 처음 계산함 / first computation
    return function () { stop(); if (auto) clearInterval(auto); }; // 떠날 때 정리함 / clean up when leaving
  }

  QP.ViewDefs = (QP.ViewDefs || []).concat([        // 화면 정의를 등록함 / register the screen definitions
    { id: "kid", group: "양자 기초 교실", title: "동전으로 보는 큐비트", render: kid },
    { id: "entangle", group: "양자 기초 교실", title: "얽힘 짝꿍 실험(CNOT)", render: entangle },
    { id: "basics", group: "양자 기초 교실", title: "큐비트 용어 교실", render: basics, subs: ["1과 비트와 큐비트", "2과 진폭과 확률", "3과 게이트 카드", "4과 상태벡터 읽기", "5과 회로도 읽는 법"] },
    { id: "lab2q", group: "양자 기초 교실", title: "2큐비트 실험대", render: lab2q }
  ]);
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
