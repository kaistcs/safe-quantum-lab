/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* =====================================================================
 * views.js : 오른쪽 한 화면에 들어가는 12개 화면
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 왼쪽 메뉴를 누르면 오른쪽에서 스크롤 없이 한 장으로
 *            보이도록, 화면마다 그리는 코드를 따로 나눔(부품화).
 * 구조      : QP.Views = [{id, group, title, color, render(el)}...]
 *            render는 화면을 그리고, 떠날 때 정리할 함수를 돌려줄 수 있음.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 화면 목록을 붙임
  "use strict";                                     // 엄격 모드를 켬
  const S = QP.Sim, D = QP.Data, M = QP.Models, C = QP.Charts; // 자주 쓰는 모듈을 짧은 이름으로 씀
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; }; // 0.379 → "37.9%"
  const $ = function (sel, root) { return (root || document).querySelector(sel); }; // 요소 하나를 찾는 짧은 함수임
  const COL = { linear: "#4d6b8c", quantum: "#6e4c82", analytic: "#c38a2b", shots: "#c76b67" }; // 방식별 고정 색임
  const NAME = { linear: "일반 AI", quantum: "양자 특징 AI", analytic: "일반 수식 대조군", shots: "양자(샷 측정)" }; // 방식별 이름임
  const State = QP.State = QP.State || { results: null, custom: null, customName: "" }; // 화면들이 함께 쓰는 상태 저장소임
  const byKey = function (k) { return State.results.find(function (m) { return m.key === k; }); }; // 결과에서 방식 하나를 찾음
  const go = function (id) { if (QP.App) QP.App.go(id); }; // 다른 화면으로 이동하는 함수임
  const say = function (t) { QP.Voice.speak(t); };  // 짧은 글을 바로 읽어 주는 함수임
  const imgSrc = function (n) { return (window.QP_IMG && window.QP_IMG[n]) || "img/" + n; }; // 사진 주소(한 파일 묶음본이면 내장 사진)를 고름

  /* ===== 1. 한눈에 보기 ===== */
  function home(el) {
    const L = byKey("linear"), Q = byKey("quantum"); // 일반, 양자 결과를 꺼냄
    el.innerHTML =                                  // 화면 내용을 한 번에 넣음(고정 문구라 안전함)
      '<div class="grid v-home">' +
      '<div class="hero card"><div><p class="eyebrow">실버 산행안전 × 양자 에뮬레이팅</p>' +
      '<h2>위험이 <span class="c-maple">겹치는 순간</span>을<br>양자 회로로 한 숫자에 담아 봐요</h2>' +
      '<p style="margin-top:10px;font-size:15px">일반 컴퓨터에서 양자컴퓨터의 계산을 흉내 내는 <b>에뮬레이터</b>로, 같은 데이터를 <b class="c-dusk">일반 AI</b>와 <b class="c-plum">양자 특징 AI</b>에 넣고 무엇이 달라지는지 비교합니다.</p>' +
      '<div class="btns" style="margin-top:12px"><button class="primary" data-go="kid">처음이라면: 동전으로 배우기</button><button data-go="compare">바로 비교 보기</button><button data-go="sim">가상 산행 재생</button></div></div>' +
      '<img src="' + imgSrc("ridge.jpg") + '" alt="늦가을 능선을 걷는 가상의 산행자(AI 생성 이미지)"></div>' +
      '<div class="cards4">' +
      '<div class="card tint-rose"><h3>양자가 뭐예요?</h3><p>돌고 있는 동전처럼 0과 1의 <b>가능성</b>을 함께 가진 계산 칸(큐비트)을 씁니다. 두 칸을 <b>얽으면</b> 서로의 결과가 함께 움직입니다.</p></div>' +
      '<div class="card tint-dusk"><h3>산행에서 무엇을?</h3><p>비와 경사, 심박과 피로처럼 <b>함께 높을 때 더 위험한</b> 신호 쌍 6개를 2큐비트 회로로 묶어 “겹침 점수”를 만듭니다.</p></div>' +
      '<div class="card tint-plum"><h3>얼마나 달라졌나</h3><p>같은 오경보 예산에서 위험 탐지율</p><p class="kpi"><span class="c-dusk">' + pct(L.recall) + '</span> <span class="arrow">→</span> <span class="c-plum">' + pct(Q.recall) + '</span></p><p class="small">합성 시험 ' + L.P + '건 기준, AUC ' + L.auc.toFixed(3) + ' → ' + Q.auc.toFixed(3) + '</p></div>' +
      '<div class="card tint-ochre"><h3>정직한 한계</h3><p>이 작은 회로는 <b>일반 수식(cos 곱)과 같은 값</b>이라 대조군도 같은 성적입니다. 이득은 “겹침 특징” 덕분이며, 양자 고유 이점은 큰 회로와 실측에서 확인할 과제입니다.</p></div>' +
      '</div></div>';
    el.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; }); // 버튼을 누르면 해당 화면으로 이동함
  }

  /* ===== 2. 양자 쉽게 이해하기 (동전 놀이 6장) ===== */
  function coinSVG(p1, label, w) {                  // 돌아가는 동전 그림(SVG 글자)을 만듦. p1 = 뒷면(1) 확률
    const rx = 46 * Math.max(.12, Math.abs(1 - 2 * p1)); // 확률이 반반에 가까울수록 옆으로 선 동전(얇은 타원)처럼 그림
    const col = p1 < .5 ? "#a9482a" : "#6e4c82";   // 앞면 쪽이면 단풍색, 뒷면 쪽이면 자두색임
    return '<svg viewBox="0 0 120 130" width="' + (w || 120) + '"><ellipse cx="60" cy="58" rx="' + rx.toFixed(1) + '" ry="46" fill="' + col + '" opacity=".88"/>' + // 동전 몸통임
      '<text x="60" y="64" text-anchor="middle" fill="#fff" font-size="18" font-weight="800">' + (rx > 20 ? (p1 < .5 ? "0" : "1") : "") + '</text>' + // 넓게 보이면 숫자를 씀
      '<text x="60" y="124" text-anchor="middle" font-size="12" fill="#2e2420">' + label + '</text></svg>'; // 아래 이름표임
  }
  function kid(el) {
    let page = 0, theta = 60;                       // 현재 쪽과 동전 기울기(도)임
    const pages = [                                 // 6장의 그림과 글을 만드는 함수 목록임
      function () { return { pic: '<div class="row">' + coinSVG(0, "앞면 = 0", 130) + coinSVG(1, "뒷면 = 1", 130) + '</div>',
        h: "1. 일반 컴퓨터는 탁자 위 동전", t: "<p>일반 컴퓨터의 한 칸(비트)은 탁자 위에 놓인 동전처럼 <b>앞면(0)</b> 아니면 <b>뒷면(1)</b>, 둘 중 하나만 기억해요.</p><p>스마트워치의 심박, GPS 위치도 결국 이런 0과 1로 저장돼요.</p>" }; },
      function () { const p = Math.pow(Math.sin(theta * Math.PI / 360), 2); return { pic: '<div class="stack" style="justify-items:center">' + coinSVG(p, "돌고 있는 동전(큐비트)", 170) + '<label style="width:260px">기울기 <input id="kTheta" type="range" min="0" max="180" value="' + theta + '"></label><p class="kpi"><span class="c-maple">0: ' + pct(1 - p) + '</span>, <span class="c-plum">1: ' + pct(p) + '</span></p></div>',
        h: "2. 큐비트는 돌고 있는 동전", t: "<p>양자컴퓨터의 한 칸(<b>큐비트</b>)은 빙글빙글 도는 동전 같아요. 아직 0인지 1인지 정해지지 않았지만, <b>얼마나 기울어져 도는지</b>에 따라 0이 나올 가능성과 1이 나올 가능성이 정해져 있어요. 이것을 <b>중첩</b>이라고 불러요.</p><p>슬라이더로 기울기를 바꿔 보세요. 이 회전을 <b>RY 게이트</b>라고 해요. 우리 프로그램은 “비가 얼마나 오는지”를 이 기울기로 바꿔 넣어요.</p>" }; },
      function () { return { pic: '<div class="stack" style="justify-items:center"><canvas id="kHist" style="width:320px"></canvas><div class="btns"><button id="kCatch" class="primary">동전 100번 잡아 보기</button><button id="kCatch1">1번만 잡기</button></div><p id="kOut" class="small"></p></div>',
        h: "3. 측정은 동전을 탁 잡는 것", t: "<p>도는 동전을 손으로 <b>탁 잡으면</b> 그 순간 0이나 1 하나로 정해져요. 이것이 <b>측정</b>이에요. 한 번 잡아서는 가능성을 알 수 없어요.</p><p>그래서 진짜 양자컴퓨터는 같은 계산을 수백, 수천 번 반복해서(<b>샷</b>) 몇 번 1이 나왔는지 세요. 에뮬레이터는 반복하지 않고 가능성을 <b>정확히</b> 계산할 수도 있어요.</p>" }; },
      function () { return { pic: '<table style="max-width:360px;font-size:15px"><tr><th>비 동전</th><th>경사 동전(전)</th><th></th><th>경사 동전(후)</th></tr><tr><td>0</td><td>0</td><td class="arrow">→</td><td>0 (그대로)</td></tr><tr><td>0</td><td>1</td><td class="arrow">→</td><td>1 (그대로)</td></tr><tr><td><b class="c-plum">1</b></td><td>0</td><td class="arrow">→</td><td><b class="c-plum">1 (뒤집힘)</b></td></tr><tr><td><b class="c-plum">1</b></td><td>1</td><td class="arrow">→</td><td><b class="c-plum">0 (뒤집힘)</b></td></tr></table>',
        h: "4. 얽힘은 짝꿍 동전", t: "<p>두 동전을 짝꿍으로 묶는 방법이 있어요. “<b>첫째 동전이 1이면 둘째 동전을 뒤집어라</b>”라는 규칙이에요. 이것을 <b>CNOT(씨낫) 게이트</b>라고 해요.</p><p>이렇게 하면 두 동전의 결과가 따로 놀지 않고 <b>함께 움직여요</b>. 이것이 <b>얽힘</b>이에요. 둘째 동전만 읽어도 두 동전의 관계를 알 수 있어요.</p>" }; },
      function () { return { pic: '<div class="row">' + coinSVG(.75, "비 큐비트", 120) + '<span class="arrow" style="font-size:28px">⊕</span>' + coinSVG(.7, "경사 큐비트", 120) + '<span class="arrow" style="font-size:28px">→</span><div class="card tint-plum" style="width:150px"><b>겹침 점수</b><p class="small">둘 다 높을 때 뚜렷하게 바뀌는 숫자</p></div></div>',
        h: "5. 산행에는 이렇게 써요", t: "<p>비의 세기를 비 큐비트의 기울기로, 경사를 경사 큐비트의 기울기로 넣어요. 그다음 짝꿍 규칙(CNOT)으로 묶고 경사 큐비트를 읽으면 <b>겹침 점수</b>가 나와요.</p><p>비만 오거나, 경사만 급할 때보다 <b>둘 다 높을 때</b>를 잘 알아차리게 도와줘요. 이 점수를 AI에게 추가로 알려 주는 것이 우리 방법이에요.</p>" }; },
      function () { return { pic: '<div class="stack" style="justify-items:center;text-align:center"><p class="kpi c-plum">큐비트 +1 = 메모리 ×2</p><p>4큐비트 → 숫자 16개<br>20큐비트 → 숫자 약 100만 개<br>40큐비트 → 숫자 약 1조 개</p><button data-go="scale">큐비트와 메모리 화면 보기</button></div>',
        h: "6. 에뮬레이터는 흉내 내는 계산기", t: "<p>진짜 양자컴퓨터는 아주 차갑고 특별한 장비가 필요해요. 그래서 우리는 일반 컴퓨터로 양자컴퓨터의 계산을 <b>똑같이 흉내 내요</b>. 이것이 <b>양자 에뮬레이터</b>예요.</p><p>작은 회로는 정확하게 흉내 낼 수 있지만, 큐비트가 하나 늘 때마다 기억해야 할 숫자가 두 배가 돼요. 아주 큰 회로는 진짜 양자컴퓨터가 필요한 이유예요.</p>" }; }
    ];
    function draw(read) {                           // 현재 쪽을 그림
      const pg = pages[page]();                     // 현재 쪽의 그림과 글을 얻음
      el.innerHTML = '<div class="grid kid"><div class="pic">' + pg.pic + '</div><div class="card txt"><h2>' + pg.h + '</h2>' + pg.t + '</div>' + // 그림과 글을 배치함
        '<div class="row" style="grid-column:1/-1;justify-content:space-between"><button id="kPrev">◀ 이전</button><div class="dots">' + pages.map(function (_, i) { return '<i class="' + (i === page ? "on" : "") + '"></i>'; }).join("") + '</div><div class="btns"><button id="kRead">이 장 읽어 주기</button><button id="kNext" class="primary">다음 ▶</button></div></div></div>'; // 아래 넘김 줄임
      $("#kPrev", el).disabled = page === 0; $("#kNext", el).disabled = page === pages.length - 1; // 처음, 끝에서는 버튼을 막음
      $("#kPrev", el).onclick = function () { page--; draw(true); }; // 이전 쪽으로 감
      $("#kNext", el).onclick = function () { page++; draw(true); }; // 다음 쪽으로 감
      const readPage = function () { const t = $(".txt", el).innerText; say(t); }; // 이 쪽 글을 읽어 주는 함수임
      $("#kRead", el).onclick = readPage;           // 읽기 버튼에 연결함
      if (read) readPage();                         // 쪽을 넘기면 자동으로 읽음
      const th = $("#kTheta", el);                  // 2쪽 기울기 슬라이더임
      if (th) th.oninput = function () { theta = Number(th.value); const k = $(".pic", el); const p = Math.pow(Math.sin(theta * Math.PI / 360), 2); k.querySelector("svg").outerHTML = coinSVG(p, "돌고 있는 동전(큐비트)", 170); k.querySelector(".kpi").innerHTML = '<span class="c-maple">0: ' + pct(1 - p) + '</span>, <span class="c-plum">1: ' + pct(p) + '</span>'; }; // 기울기에 따라 동전과 확률을 다시 그림
      const hist = $("#kHist", el);                 // 3쪽 막대그래프임
      if (hist) {                                   // 3쪽일 때만 실행함
        const p = Math.pow(Math.sin(theta * Math.PI / 360), 2), rand = S.rng(Date.now() % 100000); // 2쪽에서 정한 기울기와 난수임
        let c0 = 0, c1 = 0;                         // 0, 1이 나온 횟수임
        const show = function () { C.bars(hist, [{ label: "0 (앞면)", values: [c0] }, { label: "1 (뒷면)", values: [c1] }], [{ color: "#a9482a" }], { height: 170, max: Math.max(10, c0, c1), fmt: function (v) { return String(Math.round(v)); } }); $("#kOut", el).textContent = "정확한 가능성 1: " + pct(p) + " / 지금까지 " + (c0 + c1) + "번 중 1은 " + c1 + "번(" + pct(c1 / Math.max(1, c0 + c1)) + ")"; }; // 횟수를 그림과 글로 보여 줌
        $("#kCatch", el).onclick = function () { for (let k = 0; k < 100; k++) { if (rand() < p) c1++; else c0++; } show(); }; // 100번 측정함
        $("#kCatch1", el).onclick = function () { if (rand() < p) c1++; else c0++; show(); }; // 1번 측정함
        show();                                     // 처음 그림을 그림
      }
      el.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; }); // 이동 버튼을 연결함
    }
    draw(false);                                    // 첫 쪽을 그림(자동 읽기는 하지 않음)
  }

  /* ===== 3. 2큐비트 실험대 ===== */
  function lab2q(el) {
    let stage = 3, shots = 0;                       // 보여 줄 단계(1 회전, 2 얽기, 3 측정)와 샷 수임
    el.innerHTML = '<div class="grid v3">' +
      '<div class="card stack"><h3>입력</h3><div class="slider"><span>비의 세기</span><input id="lR" type="range" min="0" max="100" value="85"><output id="lRo"></output></div>' +
      '<div class="slider"><span>경사 부담</span><input id="lS" type="range" min="0" max="100" value="83"><output id="lSo"></output></div>' +
      '<h3 style="margin-top:6px">단계 보기</h3><div class="btns" id="lStage"><button data-s="1">① 회전(RY)</button><button data-s="2">② 얽기(CNOT)</button><button data-s="3">③ 측정</button></div>' +
      '<h3 style="margin-top:6px">측정 횟수(샷)</h3><select id="lShots"><option value="0">정확 판독(에뮬레이터만 가능)</option><option value="1000">1000번</option><option value="100">100번</option><option value="20">20번</option></select>' +
      '<p class="small" id="lNote"></p><div class="btns"><button data-p="85,83">비+급경사</button><button data-p="95,15">비만 강함</button><button data-p="15,95">경사만 급함</button><button data-p="10,10">맑고 평탄</button></div></div>' +
      '<div class="card stack"><h3>회로와 진폭</h3><svg id="lCirc" viewBox="0 0 420 120" style="width:100%"></svg><canvas id="lAmp"></canvas><p class="small">결과 이름은 비 큐비트, 경사 큐비트 순서(예: 10 = 비 1, 경사 0)임. 막대는 그 결과가 나올 확률(진폭의 제곱)임.</p></div>' +
      '<div class="card stack"><h3>겹침 점수(AI에 주는 추가 특징)</h3><p class="kpi c-plum" id="lZ"></p><p id="lZt"></p><canvas id="lHist"></canvas><div class="card tint-ochre"><b>대조군 확인</b><p id="lAn" class="small"></p></div></div></div>';
    const r = $("#lR", el), s = $("#lS", el);       // 두 슬라이더를 찾음
    function circuit() {                            // 회로 그림(SVG)을 그림
      const on = function (k) { return stage >= k ? "#6e4c82" : "#d9cfc3"; }; // 지난 단계는 자두색, 아직이면 회색임
      $("#lCirc", el).innerHTML = '<text x="4" y="38" font-size="12">비 q0</text><text x="4" y="88" font-size="12">경사 q1</text><line x1="52" y1="34" x2="410" y2="34" stroke="#8a7b70"/><line x1="52" y1="84" x2="410" y2="84" stroke="#8a7b70"/>' + // 두 큐비트 선임
        '<rect x="80" y="18" width="60" height="32" rx="6" fill="' + on(1) + '"/><text x="110" y="39" fill="#fff" text-anchor="middle" font-size="12">RY(π, 비)</text>' + // 첫 회전 상자임
        '<rect x="80" y="68" width="60" height="32" rx="6" fill="' + on(1) + '"/><text x="110" y="89" fill="#fff" text-anchor="middle" font-size="12">RY(π, 경사)</text>' + // 둘째 회전 상자임
        '<line x1="210" y1="34" x2="210" y2="84" stroke="' + on(2) + '" stroke-width="2"/><circle cx="210" cy="34" r="6" fill="' + on(2) + '"/><circle cx="210" cy="84" r="11" fill="none" stroke="' + on(2) + '" stroke-width="2"/><line x1="199" y1="84" x2="221" y2="84" stroke="' + on(2) + '" stroke-width="2"/><line x1="210" y1="73" x2="210" y2="95" stroke="' + on(2) + '" stroke-width="2"/>' + // CNOT 기호임
        '<rect x="300" y="68" width="60" height="32" rx="6" fill="' + on(3) + '"/><text x="330" y="89" fill="#fff" text-anchor="middle" font-size="12">측정</text>'; // 측정 상자임
    }
    function upd() {                                // 슬라이더나 단계가 바뀌면 다시 계산함
      const a = r.value / 100, b = s.value / 100;   // 0~1 값으로 바꿈
      $("#lRo", el).value = r.value; $("#lSo", el).value = s.value; // 숫자 표시를 맞춤
      const st = S.createState(2);                  // 2큐비트 상태를 만듦
      if (stage >= 1) { S.ry(st, 0, Math.PI * a); S.ry(st, 1, Math.PI * b); } // 1단계: 회전함
      if (stage >= 2) S.cx(st, 0, 1);               // 2단계: 얽음
      const p = S.probs(st);                        // 네 결과의 확률을 구함
      C.bars($("#lAmp", el), [0, 1, 2, 3].map(function (i) { return { label: S.label(i, 2), values: [p[i]] }; }), [{ color: "#6e4c82" }], { height: 150, max: 1, fmt: function (v) { return (v * 100).toFixed(0) + "%"; } }); // 확률 막대를 그림
      const z = S.expectZ(st, 1);                   // 경사 큐비트의 P(0)-P(1)임
      const rand = S.rng(Math.round(a * 1000 + b * 7));  // 샷 흉내용 난수임
      const est = shots ? 1 - 2 * S.sampleProb((1 - z) / 2, shots, rand) : z; // 샷이면 추정값을, 아니면 정확값을 씀
      $("#lZ", el).textContent = stage < 3 ? "측정 전" : est.toFixed(3); // 측정 단계에서만 점수를 보여 줌
      $("#lZt", el).innerHTML = stage < 3 ? "③ 측정 버튼을 눌러 읽어 보세요." : (a > .6 && b > .6 ? "<b class='c-plum'>둘 다 높음</b>: 회로 출력이 ‘둘 다 낮음’과 같은 쪽(+)으로 돌아오고, 한쪽만 높을 때(−)와 뚜렷이 갈라집니다. AI는 이 차이로 겹침을 알아챔." : (Math.abs(a - b) > .5 ? "<b class='c-maple'>한쪽만 높음</b>: 출력이 −쪽으로 갑니다. 원래 신호와 함께 보면 ‘한쪽만 높음’과 ‘둘 다 높음’이 구별됨." : "두 신호가 비슷한 수준이면 출력이 +쪽에 가까움.")); // 상황별 쉬운 해석임
      if (shots && stage >= 3) {                    // 샷 모드면 같은 측정을 50번 반복한 흔들림을 보여 줌
        const vals = []; for (let k = 0; k < 50; k++) vals.push(1 - 2 * S.sampleProb((1 - z) / 2, shots, rand)); // 50번 반복해 추정값을 모음
        C.line($("#lHist", el), [{ values: vals, color: "#c76b67" }, { values: vals.map(function () { return z; }), color: "#6e4c82" }], { height: 110, min: -1, max: 1, xLabel: "같은 측정을 50번 반복(장밋빛=샷 추정, 자두=정확값)" }); // 흔들림 그래프임
      } else C.line($("#lHist", el), [{ values: [z, z], color: "#6e4c82" }], { height: 110, min: -1, max: 1, xLabel: "정확 판독은 흔들림 없음" }); // 정확 판독은 평평한 선임
      $("#lAn", el).textContent = "cos(π, 비)×cos(π, 경사) = " + M.pairAnalytic(a, b).toFixed(3) + " → 회로 정확값 " + z.toFixed(3) + "과 같음. 이 작은 회로는 일반 수식으로도 계산 가능하다는 뜻임."; // 대조군 수식 결과임
      $("#lNote", el).textContent = shots ? "실제 양자 장비처럼 " + shots + "번 측정해서 확률을 추정함. 적을수록 결과가 흔들림." : "에뮬레이터는 상태벡터를 알고 있어서 측정 없이 정확한 확률을 계산함."; // 판독 방식 설명임
      el.querySelectorAll("#lStage button").forEach(function (bt) { bt.classList.toggle("on", Number(bt.dataset.s) === stage); }); // 현재 단계 버튼을 강조함
      circuit();                                    // 회로 그림을 다시 그림
    }
    r.oninput = upd; s.oninput = upd;               // 슬라이더를 움직이면 다시 계산함
    $("#lShots", el).onchange = function (e) { shots = Number(e.target.value); upd(); }; // 샷 수를 바꾸면 다시 계산함
    el.querySelectorAll("#lStage button").forEach(function (bt) { bt.onclick = function () { stage = Number(bt.dataset.s); upd(); }; }); // 단계 버튼을 연결함
    el.querySelectorAll("[data-p]").forEach(function (bt) { bt.onclick = function () { const v = bt.dataset.p.split(","); r.value = v[0]; s.value = v[1]; upd(); }; }); // 예시 버튼을 연결함
    upd();                                          // 처음 화면을 그림
  }

  /* ===== 4. 산행 시뮬레이션 ===== */
  function sim(el) {
    let ri = 0, si = 0, inputs = [], timer = null;  // 산행 번호, 단계 번호, 현재 신호, 재생 타이머임
    el.innerHTML = '<div class="grid v-sim">' +
      '<div class="card stack"><select id="sRoute"></select><img id="sPhoto" class="photo" alt="선택한 가상 산행 장면(AI 생성 이미지)"><div id="sSteps" class="stepbtns"></div>' +
      '<div class="btns"><button id="sPlay" class="primary">재생</button><button id="sPause">멈춤</button><button id="sReset">처음</button></div><label class="tog"><input type="checkbox" id="sVoice" checked> 단계마다 음성 설명</label></div>' +
      '<div class="stack"><div class="card"><p class="eyebrow" id="sCnt"></p><h3 id="sTitle" style="font-size:18px"></h3><p id="sDesc"></p></div><div id="sPolicy" class="banner" hidden></div>' +
      '<div class="card stack" id="sScores"></div><div class="card tint-lav" style="background:var(--lav)"><h3 id="sVerdict"></h3><p id="sWhy" style="font-size:13px"></p></div></div>' +
      '<div class="card" id="sSig" style="overflow:auto"></div></div>';
    D.routes.forEach(function (rt, i) { $("#sRoute", el).add(new Option(rt.name, i)); }); // 산행 목록을 채움
    const sig = $("#sSig", el), sliders = [];      // 신호 슬라이더 영역과 목록임
    let html = '<h3>감시 신호 20개 <span class="small">(장밋빛 = 안전 규칙)</span></h3>', last = ""; // 신호 영역 머리말임
    D.signals.forEach(function (sg, i) {            // 신호마다 슬라이더를 만듦
      if (sg[0] !== last) { html += '<div class="sig-group"><h4>' + sg[0] + '</h4></div>'; last = sg[0]; } // 그룹이 바뀌면 그룹 이름을 씀
      html += '<label class="sig' + (D.exclusions.has(i) ? " rule" : "") + '"><span>' + sg[1] + '</span><input type="range" min="0" max="100" data-i="' + i + '"><output></output></label>'; // 신호 한 줄임
    });
    sig.innerHTML = html;                           // 신호 영역을 채움
    sig.querySelectorAll("input").forEach(function (inp) { sliders[inp.dataset.i] = inp; inp.oninput = function () { inputs[inp.dataset.i] = inp.value / 100; inp.nextSibling.value = inp.value; update(); }; }); // 슬라이더를 움직이면 다시 계산함
    function gauge(k, score) {                      // 방식 하나의 점수 막대를 만듦
      const m = byKey(k), on = score >= m.threshold; // 결과와 경보 여부임
      return '<div><div class="row" style="justify-content:space-between"><b class="c-' + (k === "linear" ? "dusk" : k === "quantum" ? "plum" : "ochre") + '">' + NAME[k] + '</b><span>' + pct(score) + ' <span class="pill ' + (on ? "rose" : "dusk") + '">' + (on ? "경보 후보" : "기준 미달") + '</span></span></div>' +
        '<div class="bar"><i style="width:' + (score * 100) + '%;background:' + COL[k] + '"></i><b style="left:' + (m.threshold * 100) + '%"></b></div></div>'; // 막대와 기준선임
    }
    function update() {                             // 현재 신호로 점수와 설명을 다시 계산함
      const st = D.routes[ri].steps[si];            // 현재 단계 정보임
      const warn = D.policy(inputs);                // 안전 규칙을 먼저 확인함
      const sc = {}; ["linear", "quantum", "analytic"].forEach(function (k) { sc[k] = byKey(k).predict(inputs); }); // 세 방식의 점수를 계산함
      $("#sTitle", el).textContent = st[0]; $("#sDesc", el).textContent = st[1]; // 제목과 설명을 씀
      $("#sCnt", el).textContent = D.routes[ri].name + ", 단계 " + (si + 1) + " / " + D.routes[ri].steps.length; // 진행 위치를 씀
      $("#sPolicy", el).hidden = !warn; $("#sPolicy", el).textContent = "안전 규칙 우선: " + warn; // 규칙 알림을 보여 줌
      $("#sScores", el).innerHTML = gauge("linear", sc.linear) + gauge("quantum", sc.quantum) + gauge("analytic", sc.analytic) + '<p class="small">세로선 = 각 방식이 검증 데이터에서 정한 경보 기준(같은 오경보 예산 약 10%)</p>'; // 점수 막대 3개를 그림
      const a = sc.linear >= byKey("linear").threshold, b = sc.quantum >= byKey("quantum").threshold; // 각 방식의 경보 여부임
      const top = D.pairs.reduce(function (best, p) { return inputs[p[0]] * inputs[p[1]] > inputs[best[0]] * inputs[best[1]] ? p : best; }); // 가장 함께 높은 신호 쌍을 찾음
      const both = inputs[top[0]] > .25 && inputs[top[1]] > .25; // 둘 다 어느 정도 높은지 확인함
      const verdict = a === b ? (a ? "두 방식 모두 경보 후보" : "두 방식 모두 기준 미달") : (b ? "양자 특징 AI만 경보 후보 — 겹친 위험을 먼저 알아챔" : "일반 AI만 경보 후보"); // 판정 비교 문장임
      $("#sVerdict", el).textContent = verdict;     // 판정을 씀
      const truth = D.syntheticLabel(inputs);       // 합성 정답을 확인함
      const why = (both ? "‘" + D.signals[top[0]][1] + "’과 ‘" + D.signals[top[1]][1] + "’이 함께 높아요. 일반 AI는 두 신호를 따로 더하지만, 양자 특징 AI는 2큐비트 회로가 만든 겹침 점수도 함께 봐요. " : "함께 높은 신호 쌍이 뚜렷하지 않아요. ") +
        "점수 차이는 " + ((sc.quantum - sc.linear) * 100).toFixed(1) + "%p예요. 합성 정답은 " + (truth ? "‘위험 사건’" : "‘정상’") + "이에요."; // 이유 설명임
      $("#sWhy", el).textContent = why;             // 이유를 씀
      State.simNarr = (warn ? "안전 규칙이 먼저예요. " + warn + " " : "") + st[0] + ". " + st[1] + " " + verdict + ". " + why.replace(/%p/g, " 퍼센트포인트"); // 음성용 문장을 저장함
    }
    function load(i, speak) {                       // 단계를 불러옴
      si = i; inputs = D.vector(D.routes[ri].steps[i][2]); // 단계의 가상 신호를 적용함
      sliders.forEach(function (sl, k) { sl.value = Math.round(inputs[k] * 100); sl.nextSibling.value = sl.value; }); // 슬라이더 위치를 맞춤
      $("#sPhoto", el).src = imgSrc(D.routes[ri].image); // 사진을 바꿈
      $("#sSteps", el).innerHTML = D.routes[ri].steps.map(function (s, k) { return '<button data-k="' + k + '" class="' + (k === i ? "cur" : "") + '">' + (k + 1) + ". " + s[0] + "</button>"; }).join(""); // 단계 버튼을 그림
      $("#sSteps", el).querySelectorAll("button").forEach(function (b) { b.onclick = function () { stop(); load(Number(b.dataset.k), true); }; }); // 단계 버튼을 연결함
      update();                                     // 점수를 계산함
      if (speak && $("#sVoice", el).checked) say(State.simNarr); // 음성 설명을 켰으면 읽음
    }
    function stop() { clearInterval(timer); timer = null; } // 자동 재생을 멈춤
    $("#sPlay", el).onclick = function () {         // 재생 버튼임
      if (timer) return; load(si, true);            // 이미 재생 중이면 무시하고, 현재 단계부터 읽음
      timer = setInterval(function () {             // 일정 간격으로 다음 단계로 감
        if (QP.Voice.isActive() && $("#sVoice", el).checked) return; // 음성이 끝날 때까지 기다림
        if (si + 1 >= D.routes[ri].steps.length) { stop(); return; } // 마지막이면 멈춤
        load(si + 1, true);                         // 다음 단계로 감
      }, 5000);                                     // 5초마다 확인함
    };
    $("#sPause", el).onclick = function () { stop(); QP.Voice.stop(); }; // 멈춤 버튼임
    $("#sReset", el).onclick = function () { stop(); QP.Voice.stop(); load(0); }; // 처음 버튼임
    $("#sRoute", el).onchange = function (e) { stop(); QP.Voice.stop(); ri = Number(e.target.value); load(0); }; // 산행을 바꾸면 처음부터 시작함
    load(0);                                        // 첫 단계를 보여 줌
    return stop;                                    // 화면을 떠날 때 재생을 멈추도록 돌려줌
  }

  /* ===== 5. 일반 vs 양자 비교 ===== */
  function compare(el) {
    const L = byKey("linear"), Q = byKey("quantum"), A = byKey("analytic"); // 세 결과임
    const N = QP.Narration.nums(State.results);     // 대본용 숫자 묶음임
    const cases = { both: [.85, .83, "비+급경사 겹침"], rain: [.95, .2, "비만 강함"], slope: [.2, .95, "경사만 급함"] }; // 비교할 세 상황임
    let cur = "both";                               // 현재 상황임
    el.innerHTML = '<div class="grid v-cmp">' +
      '<div class="steps4"><div class="card"><p class="eyebrow">① 상황</p><p id="cSit"></p></div><div class="card tint-dusk"><p class="eyebrow" style="color:var(--dusk)">② 일반 AI는</p><p id="cLin"></p></div><div class="card tint-plum"><p class="eyebrow" style="color:var(--plum)">③ 양자 특징 AI는</p><p id="cQ"></p></div><div class="card tint-rose"><p class="eyebrow">④ 그래서</p><p id="cRes"></p></div></div>' +
      '<div class="card stack"><div class="row" style="justify-content:space-between"><h3 class="c-dusk">일반 AI의 위험 지도</h3><span class="small" id="cNoteL"></span></div><canvas id="cMapL"></canvas></div>' +
      '<div class="card stack"><div class="row" style="justify-content:space-between"><h3 class="c-plum">양자 특징 AI의 위험 지도</h3><span class="small" id="cNoteQ"></span></div><canvas id="cMapQ"></canvas></div>' +
      '<div class="stack" style="grid-row:2;grid-column:3"><div class="card"><h3>얼마나 좋아졌나 <span class="small">(같은 오경보 예산)</span></h3>' +
      '<table><tr><th></th><th class="c-dusk">일반</th><th class="c-plum">양자</th></tr><tr><td>위험 탐지율</td><td>' + pct(L.recall) + '</td><td><b>' + pct(Q.recall) + '</b></td></tr><tr><td>놓친 위험(' + N.P + '건 중)</td><td>' + N.missL + '건</td><td><b>' + N.missQ + '건</b></td></tr><tr><td>정상 오경보율</td><td>' + pct(L.falseAlarm) + '</td><td>' + pct(Q.falseAlarm) + '</td></tr><tr><td>AUC</td><td>' + L.auc.toFixed(3) + '</td><td><b>' + Q.auc.toFixed(3) + '</b></td></tr></table></div>' +
      '<div class="card tint-ochre"><h3>정직한 확인: 대조군</h3><p style="font-size:12.8px">cos 곱 수식으로 같은 특징을 만든 대조군도 탐지율 <b>' + pct(A.recall) + '</b>. 이득의 원인은 <b>겹침 특징</b>이며, 양자 고유 이점은 큰 회로, 실제 장비에서 검증할 질문임.</p></div>' +
      '<div class="btns"><button data-c="both" class="on">비+급경사</button><button data-c="rain">비만</button><button data-c="slope">경사만</button></div><button id="cLong" class="primary">▶ 길게 설명 듣기(약 3분)</button>' +
      '<div class="legend"><span style="--c:#a9482a">높은 점수</span><span style="--c:#fbf6ec">낮은 점수</span><span style="--c:#6e4c82">경보 경계</span><span style="--c:#2e2420">진짜 위험 경계(점선)</span><span style="--c:#fff">흰 원 = 지금 상황</span></div></div></div>';
    const base = new Array(20).fill(0);             // 다른 신호는 0으로 고정함
    const gl = M.decisionMap(L.predict, 3, 9, base, 34), gq = M.decisionMap(Q.predict, 3, 9, base, 34); // 비(3) × 경사(9) 지도를 계산함
    const truth = function (a) { return a > .46 ? .46 / a : null; }; // 정답 경계: 비×경사 = 0.46 곡선임
    function draw() {                               // 지도와 설명을 그림
      const c = cases[cur], h = Math.max(200, Math.min($("#cMapL", el).clientWidth, el.clientHeight - 230)); // 현재 상황과 지도 높이(정사각형에 가깝게)임
      C.heatmap($("#cMapL", el), gl, L.threshold, { height: h, truth: truth, mark: c, color: "#4d6b8c", xLabel: "비의 세기 →", yLabel: "경사 부담 →" }); // 일반 AI 지도임
      C.heatmap($("#cMapQ", el), gq, Q.threshold, { height: h, truth: truth, mark: c, color: "#6e4c82", xLabel: "비의 세기 →", yLabel: "경사 부담 →" }); // 양자 특징 AI 지도임
      const anyL = gl.some(function (r) { return r.some(function (v) { return v >= L.threshold; }); }); // 일반 AI 지도에 경보 영역이 있는지 확인함
      $("#cNoteL", el).textContent = anyL ? "경계가 곧은 직선(따로 더하기)" : "경보 영역 없음: 비, 경사가 최고여도 기준 미달"; // 일반 AI 지도 해설임
      $("#cNoteQ", el).textContent = "경보 영역(진한 색)이 위험 모서리를 따라 휨"; // 양자 특징 AI 지도 해설임
      const x = base.slice(); x[3] = c[0]; x[9] = c[1]; // 현재 상황의 입력을 만듦
      const sl = L.predict(x), sq = Q.predict(x), al = sl >= L.threshold, aq = sq >= Q.threshold, t = D.syntheticLabel(x); // 점수, 경보, 정답임
      $("#cSit", el).innerHTML = "<b>" + c[2] + "</b>: 비 " + Math.round(c[0] * 100) + ", 경사 " + Math.round(c[1] * 100) + ". 정답은 " + (t ? "<b class='c-maple'>위험</b>" : "정상") + "(비×경사 > 0.46 규칙)."; // 상황 설명임
      $("#cLin", el).innerHTML = "비 점수 + 경사 점수를 <b>따로 더함</b> → " + pct(sl) + ", " + (al ? "경보" : "<b>기준 미달</b>") + "(기준 " + pct(L.threshold) + ")"; // 일반 AI 처리임
      $("#cQ", el).innerHTML = "RY로 두 신호를 넣고 CNOT으로 얽어 <b>겹침 점수 " + M.pairExact(c[0], c[1]).toFixed(2) + "</b>를 추가 → " + pct(sq) + ", " + (aq ? "<b>경보</b>" : "기준 미달") + "(기준 " + pct(Q.threshold) + ")"; // 양자 특징 AI 처리임
      const judge = function (alarm) { return t ? (alarm ? "위험을 잡음" : "위험을 놓침") : (alarm ? "오경보" : "조용히 넘어감(정답)"); }; // 방식별 판정을 정답과 비교해 말로 바꿈
      const head = (t && aq && !al) ? "<b>양자 특징 AI만 겹친 위험을 잡음.</b> 전체 시험에서 놓친 위험 " + N.missL + " → " + N.missQ + "건." : (!t && aq && !al) ? "<b>양자 특징 AI의 오경보.</b> 결합 특징도 완벽하지 않음(지도 왼쪽 위 구석). 그래서 전체 오경보율을 함께 봐야 함." : (!t && !aq && al) ? "<b>양자 특징 AI는 불필요한 경보를 피함.</b>" : "두 방식의 판정이 같음."; // 핵심 한 줄임
      $("#cRes", el).innerHTML = head + "<br><span class='small'>일반: " + judge(al) + ", 양자: " + judge(aq) + "</span>"; // 결과 요약을 씀
    }
    el.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { cur = b.dataset.c; el.querySelectorAll("[data-c]").forEach(function (x) { x.classList.toggle("on", x === b); }); draw(); }; }); // 상황 버튼을 연결함
    $("#cLong", el).onclick = function () { QP.App.readLong(); }; // 긴 설명 버튼을 연결함
    requestAnimationFrame(draw);                    // 배치가 끝난 뒤 그림을 그림
  }

  /* ===== 6. 4큐비트 위험구역 회로 ===== */
  function zone4q(el) {
    el.innerHTML = '<div class="grid v3">' +
      '<div class="card stack"><h3>입력(거리 m)</h3>' +
      ['위험구역|z0|15', '야생동물 신고 지역|z1|260', '낙석 구간|z2|190'].map(function (t) { const p = t.split("|"); return '<div class="slider"><span>' + p[0] + '</span><input id="' + p[1] + '" type="range" min="0" max="300" value="' + p[2] + '"><output></output></div>'; }).join("") +
      '<div class="slider"><span>위치 신뢰도</span><input id="zq" type="range" min="0" max="100" value="95"><output></output></div>' +
      '<label class="tog"><input type="checkbox" id="zClosed"> 공식 출입 통제 구간</label><label class="tog"><input type="checkbox" id="zMiss"> 위험구역 거리 자료 없음</label>' +
      '<h3>세미나 자료 예시</h3><div class="btns"><button data-f="15,260,190">위험구역</button><button data-f="220,20,170">야생동물</button><button data-f="240,300,12">낙석</button><button data-f="220,270,180">안전</button></div></div>' +
      '<div class="card stack"><h3>4큐비트 회로(진폭 16개)</h3><svg id="zCirc" viewBox="0 0 460 210" style="width:100%"></svg><p class="small">① 거리를 0~1로 바꿔 RY 회전 ② 세 위험 큐비트를 CNOT으로 보조 큐비트 q3에 연결 ③ 신뢰도만큼 RY(π, 신뢰도/12) 보정 ④ 큐비트별 P(1) 판독. 세미나 자료 부록 Python 코드와 같은 계산임.</p><div id="zAct" class="banner" style="background:var(--sky);border-color:#c5d4e3;color:#2c4763"></div></div>' +
      '<div class="card stack"><h3>판독 결과</h3><canvas id="zBars"></canvas><div class="legend"><span style="--c:#4d6b8c">고전 거리 점수</span><span style="--c:#6e4c82">양자 판독 P(q=1)</span></div><p id="zTxt" class="small"></p></div></div>';
    const ids = ["z0", "z1", "z2", "zq"];          // 슬라이더 id 목록임
    function svg() {                                // 회로 그림을 그림
      const names = ["q0 위험구역", "q1 야생동물", "q2 낙석", "q3 신뢰도"]; let t = ""; // 큐비트 이름임
      names.forEach(function (n, q) { const y = 30 + q * 46; t += '<text x="2" y="' + (y + 4) + '" font-size="11">' + n + '</text><line x1="78" y1="' + y + '" x2="450" y2="' + y + '" stroke="#8a7b70"/><rect x="90" y="' + (y - 13) + '" width="44" height="26" rx="5" fill="#a9482a"/><text x="112" y="' + (y + 4) + '" fill="#fff" font-size="11" text-anchor="middle">RY</text>'; }); // 큐비트 선과 입력 회전임
      [0, 1, 2].forEach(function (c, k) { const x = 180 + k * 50, y = 30 + c * 46; t += '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="168" stroke="#6e4c82" stroke-width="2"/><circle cx="' + x + '" cy="' + y + '" r="5" fill="#6e4c82"/><circle cx="' + x + '" cy="168" r="10" fill="none" stroke="#6e4c82" stroke-width="2"/><line x1="' + (x - 10) + '" y1="168" x2="' + (x + 10) + '" y2="168" stroke="#6e4c82" stroke-width="2"/>'; }); // CNOT 3개임
      [0, 1, 2].forEach(function (q) { const y = 30 + q * 46; t += '<rect x="340" y="' + (y - 13) + '" width="44" height="26" rx="5" fill="#c38a2b"/><text x="362" y="' + (y + 4) + '" fill="#fff" font-size="10" text-anchor="middle">RY 보정</text>'; }); // 보정 회전임
      [0, 1, 2, 3].forEach(function (q) { const y = 30 + q * 46; t += '<rect x="400" y="' + (y - 13) + '" width="44" height="26" rx="5" fill="#4d6b8c"/><text x="422" y="' + (y + 4) + '" fill="#fff" font-size="11" text-anchor="middle">판독</text>'; }); // 판독 상자임
      $("#zCirc", el).innerHTML = t;                // 그림을 넣음
    }
    function upd() {                                // 입력이 바뀌면 다시 계산함
      ids.forEach(function (id) { const i = $("#" + id, el); i.nextSibling.value = id === "zq" ? (i.value / 100).toFixed(2) : i.value; }); // 숫자 표시를 맞춤
      const dist = [Number($("#z0", el).value), Number($("#z1", el).value), Number($("#z2", el).value)]; // 세 거리를 읽음
      if ($("#zMiss", el).checked) dist[0] = null;  // 자료 없음이면 첫 거리를 비움
      const r = M.zoneAssess(dist, $("#zq", el).value / 100, $("#zClosed", el).checked); // 세미나 자료와 같은 판단 절차를 실행함
      const act = { block_route: "block_route — 공식 통제: 회로를 돌리지 않고 즉시 경로 후보에서 제외", check_sources: "check_sources — 위치 신뢰도 0.6 미만 또는 거리 자료 없음: 판독 보류, 출처 확인", score_only: "score_only — 점수만 계산(안내 결정은 안전 정책, 사용자 확인과 함께)" }; // 행동 설명표임
      $("#zAct", el).textContent = act[r.action];   // 행동을 보여 줌
      if (r.action !== "score_only") { C.bars($("#zBars", el), [{ label: "판독 없음", values: [0] }], [{ color: "#ccc" }], { height: 200 }); $("#zTxt", el).textContent = "안전 정책이 회로보다 먼저 적용되었음."; return; } // 회로를 안 돌린 경우임
      C.bars($("#zBars", el), ["위험구역", "야생동물", "낙석"].map(function (n, i) { return { label: n, values: [r.classical[i], r.quantum[i]] }; }).concat([{ label: "보조 q3", values: [0, r.ancilla] }]), [{ color: "#4d6b8c" }, { color: "#6e4c82" }], { height: 220, max: 1 }); // 고전, 양자 값을 나란히 그림
      const top = r.quantum.indexOf(Math.max.apply(null, r.quantum)); // 가장 높은 위험을 찾음
      $("#zTxt", el).textContent = Math.max.apply(null, r.quantum) < .1 ? "세 위험 모두 낮음(안전 예시와 같은 판독)." : "가장 높은 판독: " + ["위험구역", "야생동물 신고 지역", "낙석 구간"][top] + " P=" + r.quantum[top].toFixed(3) + ". 고전 거리 점수와 순위가 같으므로, 이 회로의 가치는 정확도보다 ‘같은 입력을 양자 형식으로 다루는 실험 틀’에 있음."; // 해석 문장임
    }
    ids.concat(["zClosed", "zMiss"]).forEach(function (id) { $("#" + id, el).oninput = upd; $("#" + id, el).onchange = upd; }); // 입력을 연결함
    el.querySelectorAll("[data-f]").forEach(function (b) { b.onclick = function () { const v = b.dataset.f.split(","); ["z0", "z1", "z2"].forEach(function (id, i) { $("#" + id, el).value = v[i]; }); $("#zq", el).value = 95; $("#zClosed", el).checked = false; $("#zMiss", el).checked = false; upd(); }; }); // 예시 버튼임
    svg(); upd();                                   // 처음 그림을 그림
  }

  /* ===== 7. 비교 성적표 ===== */
  function bench(el) {
    el.innerHTML = '<div class="grid" style="grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr">' +
      '<div class="card row" style="grid-column:1/-1"><b>설정</b> 샷 수 <select id="bShots"><option value="0">샷 모드 끄기</option><option value="1000">1000</option><option value="100" selected>100</option><option value="20">20</option><option value="5">5</option></select>' +
      ' 장비 잡음 <select id="bNoise"><option value="0">없음</option><option value="0.05">5%</option><option value="0.15" selected>15%</option><option value="0.3">30%</option></select>' +
      ' 데이터 <select id="bData"><option value="default">기본 합성(씨앗 901, 902, 903)</option><option value="custom">데이터 센터 데이터</option></select><button id="bRun" class="primary">다시 실행</button><span id="bMsg" class="small"></span></div>' +
      '<div class="card stack"><h3>성적표</h3><table id="bTable"></table><p class="small">학습 1,400 / 기준 설정 550 / 시험 800건(기본). 모든 방식이 같은 로지스틱 회귀, 같은 학습 횟수, 검증 정상 표본 기준 약 10% 오경보 예산을 씀. 시간은 이 브라우저에서 학습+판정에 걸린 실제 시간임.</p><div id="bPy"></div>' +
      '<p class="small">근거: Havlíček et al., Nature 567 (2019) 양자 특징 공간 / Schuld, PRL 122 (2019); arXiv:2101.11020 양자 모델은 커널 방법 / Huang et al., Nat. Commun. 12 (2021) 데이터의 힘 / Bowles et al., arXiv:2403.07059 (2024) 고전 기준선이 자주 이김 → 대조군을 반드시 둠.</p></div>' +
      '<div class="card stack"><h3>막대그래프</h3><canvas id="bChart"></canvas><div class="legend" id="bLeg"></div><p id="bSum"></p></div></div>';
    function render() {                             // 결과를 표와 그림으로 그림
      const R = State.results;                      // 현재 결과임
      $("#bTable", el).innerHTML = '<tr><th>방식</th><th>위험 탐지율</th><th>오경보율</th><th>AUC</th><th>경보 기준</th><th>시간</th></tr>' + R.map(function (m) { return '<tr><td><span class="pill" style="background:' + COL[m.key] + '22;color:' + COL[m.key] + '">' + NAME[m.key] + '</span></td><td>' + pct(m.recall) + '</td><td>' + pct(m.falseAlarm) + '</td><td>' + m.auc.toFixed(3) + '</td><td>' + pct(m.threshold) + '</td><td>' + m.ms.toFixed(0) + 'ms</td></tr>'; }).join(""); // 표를 채움
      C.bars($("#bChart", el), [{ label: "위험 탐지율", values: R.map(function (m) { return m.recall; }) }, { label: "오경보율", values: R.map(function (m) { return m.falseAlarm; }) }, { label: "AUC", values: R.map(function (m) { return m.auc; }) }], R.map(function (m) { return { color: COL[m.key] }; }), { height: Math.max(200, el.clientHeight - 280), max: 1 }); // 막대그래프를 그림
      $("#bLeg", el).innerHTML = R.map(function (m) { return '<span style="--c:' + COL[m.key] + '">' + NAME[m.key] + '</span>'; }).join(""); // 범례를 씀
      const sh = R.find(function (m) { return m.key === "shots"; }), Lr = byKey("linear"), Qr = byKey("quantum"); // 샷 결과와 기본 결과임
      $("#bSum", el).innerHTML = "양자 특징 AI는 일반 AI보다 탐지율 <b>" + ((Qr.recall - Lr.recall) * 100).toFixed(1) + "%p</b> 높음(대조군과 동일). " + (sh ? "샷 " + $("#bShots", el).value + "번, 잡음 " + Math.round($("#bNoise", el).value * 100) + "%로 실제 장비를 흉내 내면 탐지율 " + pct(sh.recall) + "(정확 판독 대비 " + ((sh.recall - Qr.recall) * 100).toFixed(1) + "%p), AUC " + sh.auc.toFixed(3) + ". " + (Qr.recall - sh.recall > .03 ? "측정 횟수가 적고 잡음이 클수록 성능이 깎임을 확인할 수 있음." : "이 설정에서는 영향이 작음. 샷 5, 잡음 30%로 바꿔 다시 실행해 보세요(탐지율 약 10%p 하락).") : ""); // 요약 문장임
      const py = window.QP_PY_RESULTS;              // 파이썬 실험 결과(있으면)임
      $("#bPy", el).innerHTML = py ? '<div class="card tint-ochre"><b>파이썬 실행 결과(' + py.created + ')</b><p class="small">' + py.methods.map(function (m) { return NAME[m.key] + " 탐지율 " + pct(m.recall) + ", AUC " + m.auc.toFixed(3); }).join(" / ") + '</p></div>' : '<p class="small">D:\\QP에서 run_benchmark.bat을 실행하면 파이썬 결과도 여기에 함께 표시됨.</p>'; // 파이썬 결과 카드임
    }
    $("#bRun", el).onclick = function () {          // 다시 실행 버튼임
      const useCustom = $("#bData", el).value === "custom"; // 사용자 데이터 사용 여부임
      if (useCustom && !State.custom) { $("#bMsg", el).textContent = "데이터 센터에서 먼저 데이터를 만들거나 올려 주세요."; return; } // 데이터가 없으면 안내함
      $("#bMsg", el).textContent = "계산 중…";      // 진행 표시임
      setTimeout(function () {                      // 화면이 먼저 바뀌도록 잠깐 뒤에 계산함
        State.results = M.experiment({ shots: Number($("#bShots", el).value) || undefined, noise: Number($("#bNoise", el).value), data: useCustom ? State.custom : undefined }); // 실험을 다시 실행함
        State.dataName = useCustom ? State.customName : "기본 합성"; // 데이터 이름을 기록함
        $("#bMsg", el).textContent = "완료, 데이터: " + State.dataName; render(); // 결과를 그림
      }, 30);
    };
    $("#bData", el).value = State.dataName && State.dataName !== "기본 합성" ? "custom" : "default"; // 현재 데이터 선택을 표시함
    if (!byKey("shots")) $("#bRun", el).onclick(); else render(); // 샷 결과가 없으면 한 번 실행하고, 있으면 그림만 그림
  }

  /* ===== 8. 양자와 AI 학습 ===== */
  function learn(el) {
    let model = M.vqcCreate(2, 3), timer = null;    // 2층 VQC와 학습 타이머임
    const train = M.vqcData(11, 160), test = M.vqcData(12, 400); // 학습, 시험 표본임
    el.innerHTML = '<div class="grid" style="grid-template-columns:1.05fr 1fr">' +
      '<div class="stack"><div class="card tint-dusk"><h3>방식 A, 이 프로그램의 기본: “회로는 특징, 학습은 AI”</h3><p>신호 <span class="arrow">→</span> <b>고정 2큐비트 회로</b>(학습 안 함) <span class="arrow">→</span> 겹침 점수 6개 <span class="arrow">→</span> <b>로지스틱 회귀가 학습</b> <span class="arrow">→</span> 위험 점수</p><p class="small">회로는 계산기처럼 입력을 바꾸기만 함. 학습되는 것은 22개 특징의 가중치임. (양자 커널, 특징 맵 방식: Havlíček 2019)</p></div>' +
      '<div class="card tint-plum"><h3>방식 B, 변분 양자 회로(VQC): “회로의 각도도 학습”</h3><p>신호 <span class="arrow">→</span> 회로(<b>학습되는 각도 θ</b> 포함) <span class="arrow">→</span> 측정 <span class="arrow">→</span> 오차 계산 <span class="arrow">→</span> <b>매개변수 이동 규칙</b>으로 θ 기울기 계산 <span class="arrow">→</span> θ 수정 (반복)</p><p class="small">∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)] / 2 → 실제 양자 장비에서도 그대로 쓰는 정확한 미분법(Mitarai 2018, Schuld 2019).</p></div>' +
      '<div class="card qa"><h3>자주 묻는 질문</h3><p><b>Q. 양자로 하면 학습은 안 하나요?</b> 방식 A는 회로가 아닌 AI가 학습하고, 방식 B는 회로 자체가 학습함. 둘 다 “데이터로 학습”함.</p><p><b>Q. 그럼 양자가 AI를 대신하나요?</b> 아님. 양자 회로는 AI 안의 <b>한 부품</b>(특징 만들기 또는 분류기)임. 안전 규칙과 고전 AI는 그대로 유지됨.</p><p><b>Q. 메타러너와는?</b> 코스, 사람 집단을 과제로 삼아 θ의 좋은 시작점을 메타학습(FOMAML)하면, 적은 데이터로 빠르게 적응하는 2단계 실험이 됨.</p></div></div>' +
      '<div class="card stack"><div class="row" style="justify-content:space-between"><h3>방식 B 실습: VQC가 배우는 모습</h3><div class="btns"><button id="vStart" class="primary">학습 시작</button><button id="vStopT">멈춤</button><button id="vReset">초기화</button></div></div>' +
      '<div class="row" style="gap:18px"><span>반복 <b id="vEp">0</b></span><span>손실 <b id="vLoss">-</b></span><span>시험 정확도 <b id="vAcc" class="c-plum">-</b></span><span class="small" id="vTh"></span></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><p class="small">VQC 위험 지도(점선 = 정답 경계 비×경사=0.42)</p><canvas id="vMap"></canvas></div><div><p class="small">손실 곡선(낮을수록 잘 배움)</p><canvas id="vLossC"></canvas></div></div>' +
      '<p class="small">2큐비트, 학습 각도 4개 + 후처리 2개, 학습 표본 160개, 시험 400개. 처음에는 엉뚱한 지도에서 시작해서, 반복할수록 오른쪽 위 모서리(비와 경사가 함께 높은 곳)를 위험으로 배움.</p></div></div>';
    function draw() {                               // 현재 VQC 상태를 그림
      const g = 28, grid = [];                      // 지도 칸 수와 배열임
      for (let r = 0; r < g; r++) { const row = []; for (let c = 0; c < g; c++) row.push(M.vqcPredict(model, c / (g - 1), 1 - r / (g - 1))); grid.push(row); } // 칸마다 VQC 점수를 계산함
      const h = Math.max(180, Math.min($("#vMap", el).clientWidth, el.clientHeight - 260)); // 그림 높이(정사각형에 가깝게)임
      C.heatmap($("#vMap", el), grid, .5, { height: h, truth: function (a) { return a > .42 ? .42 / a : null; }, xLabel: "비 →", yLabel: "경사 →" }); // 위험 지도를 그림
      C.line($("#vLossC", el), [{ values: model.loss.length ? model.loss : [0.7], color: "#6e4c82" }], { height: h, min: 0, xLabel: "반복 횟수 →" }); // 손실 곡선을 그림
      $("#vEp", el).textContent = model.epoch;      // 반복 횟수를 씀
      $("#vLoss", el).textContent = model.loss.length ? model.loss[model.loss.length - 1].toFixed(3) : "-"; // 최근 손실을 씀
      $("#vAcc", el).textContent = pct(M.vqcAccuracy(model, test)); // 시험 정확도를 씀
      $("#vTh", el).textContent = "θ = [" + model.theta.map(function (t) { return t.toFixed(2); }).join(", ") + "]"; // 학습된 각도를 보여 줌
    }
    function stop() { clearInterval(timer); timer = null; } // 학습을 멈춤
    $("#vStart", el).onclick = function () { if (timer) return; timer = setInterval(function () { for (let k = 0; k < 3; k++) M.vqcStep(model, train, .8); draw(); if (model.epoch >= 240) stop(); }, 60); }; // 조금씩 학습하며 그림을 갱신함
    $("#vStopT", el).onclick = stop;                // 멈춤 버튼임
    $("#vReset", el).onclick = function () { stop(); model = M.vqcCreate(2, 3); draw(); }; // 초기화 버튼임
    requestAnimationFrame(draw);                    // 처음 그림을 그림
    return stop;                                    // 화면을 떠나면 학습을 멈춤
  }

  /* ===== 9. 큐비트와 메모리 ===== */
  function scale(el) {
    const fmt = function (b) { const u = ["B", "KB", "MB", "GB", "TB", "PB", "EB"]; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return b.toFixed(b < 10 ? 1 : 0) + " " + u[i]; }; // 바이트를 읽기 쉬운 단위로 바꿈
    el.innerHTML = '<div class="grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="card stack"><h3>큐비트 수를 바꿔 보세요</h3><input id="mN" type="range" min="1" max="50" value="20"><p class="kpi c-plum" id="mK"></p><p id="mT"></p>' +
      '<table>' + [4, 10, 20, 30, 40, 50].map(function (n) { return '<tr><td>' + n + '큐비트</td><td>진폭 ' + Math.pow(2, n).toLocaleString("ko-KR") + '개</td><td><b>' + fmt(S.memoryBytes(n)) + '</b></td></tr>'; }).join("") + '</table>' +
      '<p class="small">진폭 1개 = 복소수(실수 8B + 허수 8B) = 16바이트 기준임. 노트북 메모리 16GB로는 약 30큐비트가 상태벡터 방식의 한계임.</p></div>' +
      '<div class="card stack"><div class="row" style="justify-content:space-between"><h3>이 컴퓨터에서 직접 재기</h3><button id="mRun" class="primary">측정 시작</button></div><canvas id="mC"></canvas><p id="mOut" class="small">각 큐비트에 RY 1번 + CNOT 사슬을 적용하는 데 걸리는 시간을 4~22큐비트에서 잼.</p>' +
      '<div class="card tint-plum"><b>그래서 무엇이 다른가?</b><p class="small">에뮬레이터: 정확하지만 큐비트마다 2배씩 무거워짐. 실제 양자 장비: 큐비트가 늘어도 상태를 물리적으로 담지만, 결과는 샷으로만 읽고 잡음이 있음. 우리 과제는 작은 회로(2~4큐비트)라 에뮬레이터로 충분히 정확하며, 실제 장비 연동은 3차년도 시범연구 범위임.</p></div></div></div>';
    const n = $("#mN", el);                         // 큐비트 슬라이더임
    function upd() { const k = Number(n.value); $("#mK", el).textContent = k + "큐비트 → " + fmt(S.memoryBytes(k)); $("#mT", el).textContent = "진폭 " + Math.pow(2, k).toLocaleString("ko-KR") + "개를 저장해야 함. 1개 늘리면 " + fmt(S.memoryBytes(k + 1)) + "."; } // 메모리를 계산해 씀
    n.oninput = upd; upd();                         // 슬라이더를 연결하고 처음 값을 씀
    $("#mRun", el).onclick = function () {          // 측정 버튼임
      const ns = [4, 8, 12, 14, 16, 18, 20, 22], times = []; let k = 0; // 잴 큐비트 수와 결과 배열임
      $("#mOut", el).textContent = "측정 중…";      // 진행 표시임
      (function stepRun() {                         // 한 번에 하나씩 재서 화면이 멈추지 않게 함
        if (k >= ns.length) { C.line($("#mC", el), [{ values: times, color: "#a9482a" }], { height: 190, xLabel: "4, 8, 12, 14, 16, 18, 20, 22 큐비트 →", fmt: function (v) { return v.toFixed(0) + "ms"; } }); $("#mOut", el).textContent = ns.map(function (q, i) { return q + "q: " + times[i].toFixed(1) + "ms"; }).join(", ") + " → 2큐비트 늘 때마다 약 4배."; return; } // 끝나면 그림을 그림
        const q = ns[k], st = S.createState(q), t0 = performance.now(); // 상태를 만들고 시각을 잼
        for (let i = 0; i < q; i++) S.ry(st, i, .3); for (let i = 0; i < q - 1; i++) S.cx(st, i, i + 1); // 회로를 실행함
        times.push(performance.now() - t0); k++; setTimeout(stepRun, 10); // 시간을 기록하고 다음으로 감
      })();
    };
  }

  /* ===== 10. 데이터 센터 ===== */
  function data(el) {
    el.innerHTML = '<div class="grid v3" style="grid-template-columns:1fr 1fr 1fr">' +
      '<div class="card stack"><h3>① 합성 데이터 만들기</h3><div class="slider"><span>씨앗(seed)</span><input id="dSeed" type="number" value="2026"><span></span></div><div class="slider"><span>표본 수</span><input id="dN" type="number" value="2750"><span></span></div>' +
      '<div class="slider"><span>위험 기준(곱)</span><input id="dCut" type="number" step="0.01" value="0.46"><span></span></div><div class="slider"><span>정답 잡음 비율</span><input id="dNoise" type="number" step="0.01" value="0.03"><span></span></div>' +
      '<div class="btns"><button id="dMake" class="primary">만들기</button><button id="dDown">CSV 내려받기</button><button id="dUse">성적표에서 쓰기</button></div><p id="dStat"></p><p class="small">학습 50% / 기준 20% / 시험 30%로 나눔. 정답 잡음은 현실 기록의 오류를 흉내 냄.</p></div>' +
      '<div class="card stack"><h3>② 공개 데이터 CSV 올리기</h3><input type="file" id="dFile" accept=".csv"><p id="dUp" class="small">열 이름은 아래 20개 신호 이름(0~1)과 선택 label(0/1)임. 없는 열은 0으로, label이 없으면 합성 규칙으로 채움.</p><div class="mono" style="font-size:11.5px;line-height:1.5">' + D.signals.map(function (s) { return '<span title="' + s[1] + '">' + s[2] + '</span>'; }).join(", ") + ', label</div><table id="dPrev" style="font-size:11.5px"></table></div>' +
      '<div class="card stack"><h3>③ 공개 데이터 연결(파이썬)</h3><table style="font-size:12px"><tr><th>출처</th><th>→ 신호</th></tr><tr><td>기상청 ASOS 시간자료(공공데이터포털 API)</td><td>rain, wind, heat, ice</td></tr><tr><td>산림청 등산로 공간정보, GPX</td><td>slope, delay</td></tr><tr><td>국립공원공단 탐방로, 통제 정보</td><td>closed, rockfall</td></tr><tr><td>한국천문연구원 일출몰 API</td><td>sunset</td></tr><tr><td>아이나비 DTO-1 생체(워치)</td><td>hr_load, fatigue</td></tr></table>' +
      '<pre class="mono">cd /d D:\\QP\npython -m qp.data.public --asos asos.csv --gpx trail.gpx --out data\\public\\merged.csv\npython -m qp.data.synthetic --seed 2026 --n 2750</pre><p class="small">GitHub Actions(.github/workflows/synthetic-data.yml)가 매주 월요일 합성 데이터와 성적표를 새로 만들어 저장소에 올림.</p></div></div>';
    let last = null;                                // 마지막으로 만든 표본 목록임
    function split(rows, name) {                    // 표본을 학습, 기준, 시험으로 나눠 상태에 저장함
      const a = Math.floor(rows.length * .5), b = Math.floor(rows.length * .7); // 나눌 위치임
      State.custom = { train: rows.slice(0, a), valid: rows.slice(a, b), test: rows.slice(b) }; State.customName = name; // 저장함
    }
    function preview(rows) {                        // 앞 5줄을 표로 보여 줌
      const cols = [3, 9, 0, 1, 8, 11];             // 보여 줄 대표 신호 6개임
      $("#dPrev", el).innerHTML = '<tr>' + cols.map(function (c) { return '<th>' + D.signals[c][2] + '</th>'; }).join("") + '<th>label</th></tr>' + rows.slice(0, 5).map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + r.x[c].toFixed(2) + '</td>'; }).join("") + '<td>' + r.label + '</td></tr>'; }).join(""); // 표를 채움
    }
    $("#dMake", el).onclick = function () {         // 만들기 버튼임
      last = D.sampleSet(Number($("#dSeed", el).value), Number($("#dN", el).value), { cut: Number($("#dCut", el).value), labelNoise: Number($("#dNoise", el).value) }); // 합성 표본을 만듦
      const pos = last.filter(function (r) { return r.label; }).length; // 위험 표본 수를 셈
      $("#dStat", el).innerHTML = "표본 <b>" + last.length + "</b>개, 위험 <b>" + pos + "</b>개(" + pct(pos / last.length) + ")"; // 통계를 씀
      split(last, "합성 seed " + $("#dSeed", el).value); preview(last); // 상태에 저장하고 미리 보기를 그림
    };
    $("#dDown", el).onclick = function () {         // CSV 내려받기 버튼임
      if (!last) $("#dMake", el).onclick();         // 아직 없으면 먼저 만듦
      const name = "synthetic_seed" + $("#dSeed", el).value + ".csv", csv = "\ufeff" + D.toCSV(last); // 파일 이름과 내용(엑셀용 BOM 포함)임
      if (window.claude && window.claude.use) {     // claude.ai에 게시된 페이지면 플랫폼 저장 기능을 씀
        window.claude.use("downloads").then(function (dl) { if (dl) return dl.save({ filename: name, data: csv }); $("#dStat", el).textContent = "이 화면에서는 내려받기가 막혀 있음. D:\\QP에서 run.bat으로 열어 주세요."; }).catch(function () { }); // 거절해도 조용히 넘어감
        return;                                     // 일반 링크 방식은 쓰지 않음
      }
      const a = document.createElement("a");        // 내려받기용 링크를 만듦
      a.href = URL.createObjectURL(new Blob(["\ufeff" + D.toCSV(last)], { type: "text/csv" })); // 엑셀에서 한글이 안 깨지도록 BOM을 붙임
      a.download = "synthetic_seed" + $("#dSeed", el).value + ".csv"; a.click(); // 파일 이름을 정하고 내려받음
    };
    $("#dUse", el).onclick = function () { if (!State.custom) $("#dMake", el).onclick(); State.dataName = State.customName; State.results = M.experiment({ data: State.custom, shots: 100, noise: .15 }); go("bench"); }; // 성적표로 이동해 이 데이터로 실험함
    $("#dFile", el).onchange = function (e) {       // CSV 파일을 고르면
      const f = e.target.files[0]; if (!f) return;  // 파일이 없으면 무시함
      const rd = new FileReader();                  // 파일 읽기 도구임
      rd.onload = function () {                     // 다 읽으면
        const res = D.fromCSV(String(rd.result).replace(/^\ufeff/, "")); // BOM을 지우고 표본으로 바꿈
        last = res.rows; split(res.rows, f.name); preview(res.rows); // 저장하고 미리 보기를 그림
        $("#dUp", el).textContent = f.name + ": " + res.rows.length + "행, 정답 열 " + (res.hasLabel ? "있음" : "없음(합성 규칙으로 채움)") + (res.missing.length ? ", 없는 열 " + res.missing.length + "개는 0" : ""); // 결과를 알림
      };
      rd.readAsText(f, "utf-8");                    // 글자로 읽음
    };
  }

  /* ===== 11. 개발 환경과 버전 ===== */
  function dev(el) {
    el.innerHTML = '<div class="grid" style="grid-template-columns:1fr 1.1fr">' +
      '<div class="card stack"><h3>D:\\QP 폴더 구조</h3><pre class="mono tree">D:\\QP\n├─ run.bat              ← 두 번 클릭: 최신 버전 웹 실행(빈 포트 자동)\n├─ setup.bat            ← 처음 1번: 가상환경 .venv + 패키지 설치\n├─ new_version.bat      ← 최신 버전을 복사해 다음 번호 폴더 생성\n├─ run_benchmark.bat    ← 파이썬 비교 실험 → 웹 성적표에 표시\n├─ make_voice.bat       ← 음성 대본을 MP3로 녹음(Azure Neural)\n├─ git_connect.bat      ← GitHub 저장소 연결, 첫 업로드\n├─ tools\\  serve.py, new_version.py, make_voice.py, build_site.py\n├─ .github\\workflows\\  pages.yml, synthetic-data.yml\n└─ versions\\\n   ├─ v01\\   원본(ChatGPT 작업본) 보관\n   └─ v02\\   ← 현재 버전(깨끗한 코드만)\n      ├─ web\\   index.html, css, js(주석 포함), img, audio, data\n      ├─ qp\\    파이썬 패키지(emulator, models, data)\n      ├─ tests\\ pytest 검증\n      └─ VERSION, CHANGELOG.md</pre></div>' +
      '<div class="stack"><div class="card"><h3>버전 기록</h3><table><tr><th>버전</th><th>내용</th></tr><tr><td>v01</td><td>2큐비트 결합 특징, 시나리오 5개, 고정 녹음 2개, ES 모듈(서버 필요)</td></tr><tr><td><b>v02</b></td><td>좌측 메뉴 1화면 UI, 동전 놀이, 2큐비트 실험대, 4큐비트 위험구역 회로, 샷, 잡음, VQC 학습, 메모리 측정, 데이터 센터, 문장 단위 TTS+자막, 파일 더블클릭 실행, 빈 포트 자동, 파이썬 패키지, GitHub 자동화, 모든 문장 주석</td></tr></table></div>' +
      '<div class="card"><h3>어디서나 접속(웹)</h3><p>① 지금: claude.ai에 게시한 v02 페이지 주소로 접속(공유 전까지 본인만 보임) ② GitHub에 올리면 <b>GitHub Pages</b>가 versions\\*\\web을 /v01, /v02 주소로 자동 게시 ③ 같은 PC: run.bat → http://127.0.0.1:포트 ④ 같은 와이파이의 휴대폰: run.bat 실행 후 표시되는 LAN 주소</p></div>' +
      '<div class="card"><h3>포트 문제 해결 내용</h3><p class="small">v01은 ES 모듈이라 파일을 직접 열면 동작하지 않고, 8080 포트가 이미 쓰이면 서버가 실패했음. Windows 레지스트리에서 .js가 text/plain으로 잡히면 모듈이 차단되는 문제도 있음. v02는 일반 스크립트라 파일 더블클릭으로도 동작하고, serve.py가 8765부터 빈 포트를 찾아 열고 .js MIME을 강제로 지정함.</p></div></div></div>';
  }

  /* ===== 12. 용어 사전 ===== */
  function glossary(el) {
    const terms = [                                 // [용어, 쉬운 설명] 목록임
      ["비트", "0 또는 1 하나만 기억하는 일반 컴퓨터의 칸. 탁자 위 동전."], ["큐비트", "0과 1의 가능성을 함께 가진 양자 계산의 칸. 돌고 있는 동전."],
      ["중첩", "측정 전까지 0과 1의 가능성이 함께 있는 상태."], ["측정(판독)", "큐비트를 읽어 0 또는 1 하나로 정하는 일. 동전을 탁 잡기."],
      ["샷", "회로를 한 번 실행하고 측정하는 일. 확률을 알려면 여러 번 반복해야 함."], ["게이트", "큐비트 상태를 바꾸는 계산 단계(RY, CNOT 등)."],
      ["RY 게이트", "큐비트를 y축으로 돌리는 게이트. 입력값을 회전 각도로 넣을 때 씀."], ["CNOT(씨낫)", "제어 큐비트가 1이면 대상 큐비트를 뒤집는 게이트. 얽힘을 만듦."],
      ["얽힘", "두 큐비트의 결과가 따로 놀지 않고 함께 움직이는 관계."], ["진폭", "각 결과에 붙은 계산용 숫자. 제곱하면 그 결과의 확률."],
      ["상태벡터", "모든 결과의 진폭을 적은 목록. n큐비트면 2ⁿ개."], ["에뮬레이터", "양자 회로 계산을 일반 컴퓨터에서 똑같이 흉내 내는 프로그램."],
      ["특징(feature)", "AI에 넣는 숫자. 겹침 점수는 회로가 만든 추가 특징."], ["로지스틱 회귀", "특징마다 가중치를 곱해 더한 뒤 0~1 점수로 바꾸는 간단한 AI."],
      ["재현율(탐지율)", "실제 위험 중 경보를 낸 비율. 높을수록 덜 놓침."], ["오경보율", "정상인데 경보를 낸 비율. 낮을수록 덜 귀찮음."],
      ["AUC", "위험을 정상보다 높게 점수 매긴 비율. 0.5=찍기, 1=완벽."], ["대조군", "같은 특징을 일반 수식으로 만든 비교 대상. 양자 고유 효과를 가려냄."],
      ["VQC(변분 양자 회로)", "회전 각도를 학습하는 양자 회로. 양자판 신경망."], ["매개변수 이동 규칙", "각도를 ±90도 옮겨 두 번 측정해 정확한 기울기를 얻는 방법."],
      ["잡음(탈분극)", "실제 장비에서 큐비트 정보가 흐려지는 현상. 결과가 0.5쪽으로 쏠림."], ["합성 데이터", "규칙으로 만든 가상 데이터. 씨앗이 같으면 항상 같음."]
    ];
    el.innerHTML = '<div class="stack" style="height:100%"><input id="gQ" type="text" placeholder="찾을 단어를 입력하세요(예: 얽힘)" style="max-width:360px"><div id="gL" class="grid gloss" style="height:auto"></div></div>'; // 검색창과 목록 자리임
    function list() {                               // 검색어에 맞는 항목만 그림
      const q = $("#gQ", el).value.trim();          // 검색어임
      $("#gL", el).innerHTML = terms.filter(function (t) { return !q || (t[0] + t[1]).indexOf(q) >= 0; }).map(function (t) { return '<div class="card" data-t="' + t[0] + '"><b class="c-plum">' + t[0] + '</b> <span>' + t[1] + '</span></div>'; }).join(""); // 걸러서 그림
      $("#gL", el).querySelectorAll(".card").forEach(function (c) { c.onclick = function () { say(c.innerText); }; }); // 누르면 읽어 줌
    }
    $("#gQ", el).oninput = list; list();            // 입력할 때마다 다시 거름
  }

  // 메뉴 순서대로 화면 목록을 공개함(그룹, 제목, 점 색)
  QP.Views = [
    { id: "home", group: "처음 배우기", title: "한눈에 보기", color: "#e7b98f", render: home },
    { id: "kid", group: "처음 배우기", title: "양자 쉽게 이해하기", color: "#e7b98f", render: kid },
    { id: "lab2q", group: "처음 배우기", title: "2큐비트 실험대", color: "#e7b98f", render: lab2q },
    { id: "sim", group: "산행 안전 실험", title: "가상 산행 시뮬레이션", color: "#d9a5a0", render: sim },
    { id: "compare", group: "산행 안전 실험", title: "일반 vs 양자, 무엇이 다른가", color: "#d9a5a0", render: compare },
    { id: "zone4q", group: "산행 안전 실험", title: "4큐비트 위험구역 회로", color: "#d9a5a0", render: zone4q },
    { id: "bench", group: "산행 안전 실험", title: "비교 성적표(샷, 잡음)", color: "#d9a5a0", render: bench },
    { id: "learn", group: "AI와 학습", title: "양자와 AI 학습의 관계", color: "#cbbfe0", render: learn },
    { id: "scale", group: "AI와 학습", title: "큐비트와 메모리", color: "#cbbfe0", render: scale },
    { id: "data", group: "데이터와 개발", title: "데이터 센터", color: "#bcd0e3", render: data },
    { id: "dev", group: "데이터와 개발", title: "개발 환경과 버전", color: "#bcd0e3", render: dev },
    { id: "glossary", group: "데이터와 개발", title: "용어 사전", color: "#bcd0e3", render: glossary }
  ];
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김
