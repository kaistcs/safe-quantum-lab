/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Guided experiment with Snowflake (7 steps, pre-registered hypotheses, verdict, log). */
/* =====================================================================
 * views_lab.js : 에뮬레이팅 실험실 (눈송이 안내형 실험, guided experiment)
 * ---------------------------------------------------------------------
 * 목적 : 전체 자동 안내와 별개로, 연구자(또는 평가위원)가 직접 실험을 설계하고
 *        실행하고 결과를 판정하는 과정을 눈송이가 한 단계씩 지정해 줌.
 * 절차 : ① 실험 고르기 → ② 데이터 고르기 → ③ 조건 입력 → ④ 가설과 관찰 포인트
 *        → ⑤ 실행 → ⑥ 결과 확인과 판정 → ⑦ 실험 기록(CSV)
 * 원칙 : 실험마다 "가설, 판정 기준, 관찰할 숫자"를 실행 전에 먼저 고정함(사전 등록).
 *        그래야 결과를 본 뒤 기준을 바꾸는 일이 없어 결과를 믿을 수 있음.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 실험실 화면을 붙임 / attaches the lab screen to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const M = QP.Models, C = QP.Charts, B = QP.Basis; // 모델, 차트, 근거 모듈임 / model, chart and evidence modules
  const $ = function (s, r) { return (r || document).querySelector(s); }; // 요소 찾기임 / find an element
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; }; // 백분율 표기임 / percentage notation
  const LOG = QP.State.labLog = QP.State.labLog || []; // 실험 기록(세션 동안 유지)임 / experiment log (kept during the session)

  /* ---------- 실험 목록: 질문, 가설, 판정 기준, 관찰 포인트를 미리 정해 둠 / Experiment list: question, hypothesis, criteria and observation points fixed in advance  ---------- */
  const EXPS = [
    { id: "E1", title: "양자 겹침 특징이 위험을 더 잘 잡는가", q: "같은 오경보 예산(10%)에서 양자 겹침 특징을 더한 AI가 일반 AI보다 위험 순간을 더 많이 잡는지 확인합니다.",
      hyp: "양자 특징 AI의 탐지율이 일반 AI보다 3%p 이상 높음", h0: "차이가 3%p 미만(효과 없음)", watch: ["탐지율(같은 오경보 10%에서)", "AUC(경보 기준과 무관한 구별 능력)", "해석 대조군(cos 수식)과 양자 결과가 같은지(정직성 확인)"], cond: ["data"] },
    { id: "E2", title: "측정 횟수와 잡음이 결과를 얼마나 바꾸는가", q: "실제 양자 장비는 유한 번 측정하고 잡음이 있습니다. 샷 수를 1000, 100, 20, 5로 줄이면 탐지율이 얼마나 떨어지는지 확인합니다.",
      hyp: "샷 100 이상에서는 정확 판독 대비 탐지율 하락이 2%p 이내", h0: "샷 100에서도 2%p 넘게 떨어짐(장비 요구 수준이 높음)", watch: ["샷 수별 탐지율 곡선", "정확 판독(무한 샷)과의 차이", "잡음 수준에 따른 추가 하락"], cond: ["data", "noise"] },
    { id: "E3", title: "메타학습이 새 사람에게 빨리 맞추는가", q: "여러 산행자에게서 공통 시작점을 배운 메타러너가, 처음 보는 사람의 기록 10개만으로 몇 걸음 만에 맞춰지는지 확인합니다. 입력에는 양자 겹침 점수가 들어갑니다.",
      hyp: "메타 시작점의 1걸음 정확도가 무작위 시작점의 5걸음 정확도보다 10%p 이상 높음", h0: "차이가 10%p 미만", watch: ["걸음별 적응 곡선(메타 vs 무작위)", "1걸음 정확도", "메타 손실 감소"], cond: ["metaN"] }
  ];
  const STEPS = ["실험 고르기", "데이터 고르기", "조건 입력", "가설과 관찰 포인트", "실행", "결과 확인과 판정", "실험 기록"]; // 일곱 단계임 / seven steps

  function lab(el) {
    const st = { step: 0, exp: 0, data: QP.State.dataId || (QP.Datasets.list[0] && QP.Datasets.list[0].id), noise: .05, metaN: 300, seed: 7, out: null, auto: false }; // 실험 상태임 / experiment state
    let autoT = null, runT = null, alive = true;    // 자동 진행 타이머, 실행 타이머, 화면 유지 여부임 / auto-progress timer, run timer, whether the screen is alive
    el.innerHTML = '<div class="grid labv"><div class="card stack labsteps"><h3>실험 절차</h3><ol id="lSteps"></ol><button id="lAuto" data-autoplay="1" class="primary">▶ 눈송이와 자동 실험</button><p class="small">자동 실험은 기본값으로 다음 단계를 차례로 진행합니다. 직접 해 보시려면 오른쪽 아래 다음 단계 버튼을 누르시면 됩니다.</p><div id="lLogMini" class="small"></div></div>' +
      '<div class="card stack labpanel"><div class="row" style="justify-content:space-between"><h3 id="lTitle"></h3><span id="lExp" class="pill"></span></div><div id="lGuide" class="labguide"></div><div id="lBody" class="labbody"></div><div class="row labnav"><button id="lPrev">◀ 이전 단계</button><span class="grow"></span><button id="lNext" class="primary">다음 단계 ▶</button></div></div></div>';
    const E = function () { return EXPS[st.exp]; };  // 지금 고른 실험임 / experiment chosen now
    function say(t) { if (!QP.State.touring && alive) QP.Voice.speak(t, true); } // 눈송이 음성 안내임 / Snowflake voice guide
    function aim(sel) {                              // 눈송이가 다음에 조작할 곳을 지시봉으로 가리킴 / Snowflake points the stick at what to operate next
      setTimeout(function () { if (!alive) return; const t = $(sel, el); if (!t) return; const r = t.getBoundingClientRect(); t.classList.add("labaim"); setTimeout(function () { t.classList.remove("labaim"); }, 2600); if (QP.App && QP.App.pointAt) QP.App.pointAt(r.left + Math.min(40, r.width / 2), r.top + r.height / 2); }, 350); // 대상 왼쪽 가운데를 가리키고 잠깐 반짝이게 함 / points at the left middle of the target and highlights it briefly
    }
    function guide(html) { $("#lGuide", el).innerHTML = '<span class="labsnow">❄</span><div>' + html + "</div>"; } // 눈송이 말풍선임 / Snowflake speech bubble
    function steps() { $("#lSteps", el).innerHTML = STEPS.map(function (s, i) { return '<li class="' + (i === st.step ? "on" : i < st.step ? "done" : "") + '">' + (i < st.step ? "✔ " : "") + s + "</li>"; }).join(""); } // 단계 목록 표시임 / step list display
    function mini() { $("#lLogMini", el).innerHTML = LOG.length ? "<b>지금까지 실험 " + LOG.length + "건</b><br>" + LOG.slice(-4).map(function (l) { return l.id + " " + l.verdict + " (" + l.key + ")"; }).join("<br>") : ""; } // 최근 기록 요약임 / summary of recent records
    function dsOpts() { return QP.Datasets.list.map(function (d) { return '<option value="' + d.id + '"' + (d.id === st.data ? " selected" : "") + ">" + d.id + " " + d.name + " (" + d.stats.n + "행, 등급 " + d.grade + ")</option>"; }).join(""); } // 데이터 선택 목록임 / dataset choices

    function render() {                              // 현재 단계 화면을 그림 / draws the current step screen
      steps(); mini(); const e = E(), b = $("#lBody", el); $("#lTitle", el).textContent = (st.step + 1) + "단계. " + STEPS[st.step]; $("#lExp", el).textContent = e.id + " " + e.title; // 제목과 실험 이름임 / title and experiment name
      $("#lPrev", el).disabled = st.step === 0; $("#lNext", el).textContent = st.step === 4 ? "실행 ▶" : st.step === 6 ? "새 실험 ↺" : "다음 단계 ▶"; $("#lNext", el).disabled = st.step === 5 && !st.out; // 버튼 상태임 / button states
      if (st.step === 0) {                           // ① 실험 고르기 / ① choose an experiment
        b.innerHTML = '<div class="labcards">' + EXPS.map(function (x, i) { return '<button class="labcard' + (i === st.exp ? " sel" : "") + '" data-i="' + i + '"><b>' + x.id + ". " + x.title + "</b><span>" + x.q + "</span></button>"; }).join("") + '</div><div class="labpreview"><div class="card tint-plum"><b>가설(H1)</b><p>' + e.hyp + '</p><b>반대 가설(H0)</b><p>' + e.h0 + '</p></div><div class="card tint-ochre"><b>우리가 보아야 할 결과</b><ol>' + e.watch.map(function (w) { return "<li>" + w + "</li>"; }).join("") + '</ol></div><div class="card"><b>실행 순서</b><ol>' + plan().map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ol></div></div>";
        b.querySelectorAll(".labcard").forEach(function (c) { c.onclick = function () { st.exp = Number(c.dataset.i); st.out = null; render(); }; }); // 고르면 다시 그림 / redraw on choice
        guide("어떤 질문에 답할지 먼저 고릅니다. 실험은 하나의 질문에 하나의 답을 얻는 것입니다. 선택하신 실험은 <b>" + e.id + "</b>입니다."); say("첫 단계입니다. 답하고 싶은 질문, 즉 실험을 고르시기 바랍니다. 지금은 " + e.title + " 실험이 선택되어 있습니다."); aim(".labcard.sel");
      } else if (st.step === 1) {                    // ② 데이터 고르기 / ② choose data
        if (e.id === "E3") { b.innerHTML = '<div class="labform"><p>이 실험은 메타학습용 가상 산행자(여/남, 25~79세, 안정심박 52~81)를 자동으로 만듭니다. 한 사람은 기록 10개(적응용)와 30개(평가용)를 가집니다.</p><label>난수 씨앗(같은 값이면 같은 결과가 재현됩니다) <input id="lSeed" type="number" value="' + st.seed + '"></label></div>'; $("#lSeed", el).onchange = function () { st.seed = Number(this.value) || 7; }; guide("메타학습 실험은 사람별 가상 산행 기록을 씁니다. 씨앗 값은 <b>재현성</b>을 위한 번호입니다."); say("두 번째 단계입니다. 이 실험은 가상 산행자 기록을 자동으로 만듭니다. 씨앗 값을 같게 두면 누가 실행해도 같은 결과가 나옵니다."); aim("#lSeed"); }
        else { const d = QP.Datasets.list.find(function (x) { return x.id === st.data; }) || QP.Datasets.list[0]; b.innerHTML = '<div class="labform"><label>실험 데이터 <select id="lData">' + dsOpts() + '</select></label><button id="lGen">＋ 근거 기반 산행 20회 새로 생성</button><div id="lDInfo" class="small"></div></div>';
          const info = function () { const x = QP.Datasets.list.find(function (y) { return y.id === st.data; }); $("#lDInfo", el).innerHTML = x ? "<b>" + x.id + "</b> " + x.name + ": " + x.stats.n + "행, 위험 비율 " + pct(x.stats.pos / Math.max(1, x.stats.n)) + ", 근거 등급 <b>" + x.grade + "</b>. 학습, 기준, 시험 표본을 서로 나누어 씁니다." : ""; }; info(); // 데이터 정보임 / data info
          $("#lData", el).onchange = function () { st.data = this.value; info(); }; $("#lGen", el).onclick = function () { const x = QP.Datasets.makeGrounded(5000 + QP.Datasets.list.length, 20); st.data = x.id; $("#lData", el).innerHTML = dsOpts(); info(); say(x.id + " 데이터를 새로 만들었습니다. 근거 등급은 " + x.grade + "입니다."); }; // 선택과 생성임 / choose and generate
          guide("실험에 쓸 데이터를 고릅니다. 등급 <b>A</b>는 심박 공식, 기온 감률, 보행 속도 같은 근거 점검을 모두 통과한 데이터입니다. 지금 선택: <b>" + (d ? d.id : "-") + "</b>"); say("두 번째 단계입니다. 실험 데이터를 고르시기 바랍니다. 근거 등급이 에이인 데이터를 쓰시면 결과를 더 믿을 수 있습니다. 새로 만들 수도 있습니다."); aim("#lData"); }
      } else if (st.step === 2) {                    // ③ 조건 입력 / ③ enter conditions
        let h = '<div class="labform">';            // 조건 입력 칸임 / condition inputs
        if (e.id === "E1") h += "<p>비교 방식은 세 가지로 고정합니다: <b>일반 AI</b>(신호 16개), <b>양자 특징 AI</b>(16개 + 2큐비트 겹침 점수 6개), <b>해석 대조군</b>(16개 + cos 수식 6개). 오경보 예산은 모두 10%로 같게 맞춥니다.</p>";
        if (e.cond.indexOf("noise") >= 0) h += '<label>장비 잡음 <select id="lNoise"><option value="0">없음</option><option value="0.05">5%</option><option value="0.15">15%</option><option value="0.3">30%</option></select></label><p class="small">샷 수는 1000, 100, 20, 5를 모두 차례로 실행합니다.</p>';
        if (e.cond.indexOf("metaN") >= 0) h += '<label>메타 학습 반복(바깥 루프) <select id="lMetaN"><option value="50">50회</option><option value="150">150회</option><option value="300">300회</option><option value="600">600회</option></select></label><p class="small">반복마다 4명에게 5걸음씩 적응해 본 결과로 공통 시작점을 고칩니다.</p>';
        b.innerHTML = h + "</div>";
        if ($("#lNoise", el)) { $("#lNoise", el).value = String(st.noise); $("#lNoise", el).onchange = function () { st.noise = Number(this.value); }; } // 잡음 입력임 / noise input
        if ($("#lMetaN", el)) { $("#lMetaN", el).value = String(st.metaN); $("#lMetaN", el).onchange = function () { st.metaN = Number(this.value); }; } // 반복 수 입력임 / iteration input
        guide("실험 조건을 입력합니다. <b>바꾸는 것(독립변수)</b>과 <b>같게 두는 것(통제변수)</b>을 구분하는 것이 핵심입니다."); say("세 번째 단계입니다. 실험 조건을 입력합니다. 바꾸는 조건과 같게 두는 조건을 구분하시면 됩니다. 기본값 그대로 두셔도 좋습니다."); aim(e.id === "E1" ? "#lBody p" : e.id === "E2" ? "#lNoise" : "#lMetaN");
      } else if (st.step === 3) {                    // ④ 가설과 관찰 포인트(사전 등록) / ④ hypothesis and observation points (pre-registration)
        b.innerHTML = '<div class="labhyp"><div class="card tint-plum"><b>가설(H1)</b><p>' + e.hyp + '</p></div><div class="card"><b>반대 가설(H0)</b><p>' + e.h0 + '</p></div><div class="card tint-ochre" style="grid-column:1/-1"><b>우리가 보아야 할 결과</b><ol>' + e.watch.map(function (w) { return "<li>" + w + "</li>"; }).join("") + '</ol><p class="small">판정 기준은 실행 전에 고정합니다(사전 등록). 결과를 본 뒤 기준을 바꾸지 않습니다.</p></div></div>';
        guide("실행하기 전에 <b>무엇이 나오면 가설이 맞는지</b>를 먼저 정해 둡니다. 이것이 믿을 수 있는 실험의 조건입니다."); say("네 번째 단계입니다. 실행 전에 가설과 판정 기준을 먼저 고정합니다. 가설은 " + e.hyp + "입니다. 결과에서는 " + e.watch[0] + "을 가장 먼저 보시면 됩니다."); aim(".labhyp .tint-plum");
      } else if (st.step === 4) {                    // ⑤ 실행 준비 / ⑤ prepare to run
        b.innerHTML = '<div class="labrun"><p>실행 버튼을 누르시면 아래 순서로 계산합니다.</p><ol id="lPlan">' + plan().map(function (p) { return "<li>" + p + "</li>"; }).join("") + '</ol><div class="labbar"><i id="lBar"></i></div><p id="lRunMsg" class="small"></p></div>';
        guide("준비가 끝났습니다. <b>실행 ▶</b>을 누르시면 에뮬레이터가 계산을 시작합니다."); say("다섯 번째 단계입니다. 준비가 끝났습니다. 실행 버튼을 누르시기 바랍니다."); aim("#lNext");
      } else if (st.step === 5) {                    // ⑥ 결과 확인과 판정 / ⑥ results and verdict
        if (st.out) showResult(b); else { b.innerHTML = '<div class="labrun"><ol id="lPlan">' + plan().map(function (p) { return "<li>" + p + "</li>"; }).join("") + '</ol><div class="labbar"><i id="lBar"></i></div><p id="lRunMsg" class="small">계산 중입니다.</p></div>'; }
      } else {                                       // ⑦ 실험 기록 / ⑦ experiment log
        b.innerHTML = '<div class="stack"><table class="labtbl"><tr><th>번호</th><th>시각</th><th>실험</th><th>데이터, 조건</th><th>핵심 수치</th><th>판정</th></tr>' + LOG.map(function (l, i) { return "<tr><td>" + (i + 1) + "</td><td>" + l.at + "</td><td>" + l.id + "</td><td>" + l.cond + "</td><td>" + l.key + "</td><td><b class='" + (l.ok ? "c-plum" : "") + "'>" + l.verdict + "</b></td></tr>"; }).join("") + '</table><div class="row"><button id="lCsv" class="primary">⬇ 실험 기록 CSV 내려받기</button></div></div>';
        $("#lCsv", el).onclick = function () { QP.App.download("experiment_log.csv", "﻿번호,시각,실험,데이터와 조건,핵심 수치,판정\n" + LOG.map(function (l, i) { return [i + 1, l.at, l.id, l.cond, l.key, l.verdict].map(function (v) { return '"' + String(v).replace(/"/g, "'") + '"'; }).join(","); }).join("\n")); }; // CSV 저장임 / save CSV
        guide("실험 기록은 연구 노트입니다. 같은 실험을 다른 데이터나 조건으로 반복하면 결론이 얼마나 단단한지 알 수 있습니다."); say("마지막 단계입니다. 실험 결과가 기록표에 저장되었습니다. 시에스브이로 내려받아 보고서에 붙이실 수 있습니다. 다른 조건으로 다시 실험해 보시면 결론의 신뢰도가 높아집니다."); aim("#lCsv");
      }
    }
    function plan() {                                // 실행 계획 목록임 / execution plan list
      const e = E();                                 // 지금 실험임 / current experiment
      if (e.id === "E1") return ["학습 표본으로 일반 AI 학습", "같은 표본으로 2큐비트 회로를 에뮬레이터로 실행해 겹침 점수 6개 계산, 양자 특징 AI 학습", "해석 대조군(cos 수식) 학습", "기준 표본에서 오경보 10% 경보 기준을 각각 정함", "시험 표본에서 탐지율, AUC 비교와 판정"];
      if (e.id === "E2") return ["샷 1000번 측정 + 잡음으로 학습, 시험", "샷 100번", "샷 20번", "샷 5번", "정확 판독(무한 샷)과 비교해 판정"];
      return ["가상 산행자 4명씩 묶어 메타 학습 " + st.metaN + "회", "처음 보는 12명에게 기록 10개로 0~10걸음 적응", "같은 12명에게 무작위 시작점으로 적응", "1걸음, 5걸음 정확도 비교와 판정"];
    }
    function progress(k, n, msg) { const bar = $("#lBar", el); if (bar) bar.style.width = (k / n * 100) + "%"; const li = el.querySelectorAll("#lPlan li"); li.forEach(function (x, i) { x.className = i < k ? "done" : i === k ? "on" : ""; }); if ($("#lRunMsg", el)) $("#lRunMsg", el).textContent = msg || ""; } // 진행 표시임 / progress display
    function run() {                                 // ⑤ 실행: 단계별로 나누어 계산하며 진행 막대를 움직임 / ⑤ run: computes stage by stage while moving the progress bar
      st.step = 5; st.out = null; render(); const e = E(), ds = QP.Datasets.list.find(function (d) { return d.id === st.data; }) || QP.Datasets.list[0], tasks = []; // 준비임 / prepare
      say("실행합니다. 진행 막대와 목록에서 지금 계산 중인 단계를 확인하실 수 있습니다.");
      if (e.id === "E1") { let r = null; tasks.push(function () { r = M.experiment({ data: ds.split, methods: ["linear"] }).concat(M.experiment({ data: ds.split, methods: ["quantum"] })); }, function () { r = r.concat(M.experiment({ data: ds.split, methods: ["analytic"] })); }, function () { }, function () { }, function () { st.out = { kind: "E1", res: r, ds: ds }; }); } // 세 방식을 차례로 학습함 / train the three methods in turn
      else if (e.id === "E2") { const pts = []; let exact = null; [1000, 100, 20, 5].forEach(function (s) { tasks.push(function () { const r = M.experiment({ data: ds.split, methods: ["quantum"], shots: s, noise: st.noise, seed: st.seed }); exact = r[0]; pts.push({ shots: s, recall: r[1].recall, auc: r[1].auc }); }); }); tasks.push(function () { st.out = { kind: "E2", pts: pts, exact: exact, ds: ds }; }); } // 샷 수별로 실행함 / run for each shot count
      else { const m = QP.Meta.create(st.seed * 11 + 3); tasks.push(function () { for (let k = 0; k < st.metaN; k++) QP.Meta.metaStep(m, 4); }, function () { }, function () { }, function () { st.out = { kind: "E3", m: m, ev: QP.Meta.evaluate(m, st.seed * 7 + 1) }; }); } // 메타 학습과 평가임 / meta-learning and evaluation
      let k = 0; const msgs = plan();                // 진행 번호와 설명임 / progress index and description
      (function nextTask() { if (!alive) return; progress(k, tasks.length, msgs[k] || ""); runT = setTimeout(function () { if (!alive) return; tasks[k](); k++; if (k < tasks.length) nextTask(); else { progress(k, tasks.length, "완료"); render(); } }, 900); })(); // 0.9초 간격으로 한 단계씩 계산함(무엇을 하는지 보이게) / compute one stage every 0.9 s (so what happens is visible)
    }
    function verdictOf(o) {                          // 사전 등록한 기준으로 판정함 / judge by the pre-registered criteria
      if (o.kind === "E1") { const L = o.res.find(function (x) { return x.key === "linear"; }), Q = o.res.find(function (x) { return x.key === "quantum"; }), A = o.res.find(function (x) { return x.key === "analytic"; }), d = Q.recall - L.recall; return { ok: d >= .03, d: d, L: L, Q: Q, A: A, key: "탐지율 일반 " + pct(L.recall) + ", 양자 " + pct(Q.recall) + " (차이 " + (d * 100).toFixed(1) + "%p), AUC " + L.auc.toFixed(3) + " → " + Q.auc.toFixed(3) }; }
      if (o.kind === "E2") { const p100 = o.pts.find(function (p) { return p.shots === 100; }), d = o.exact.recall - p100.recall; return { ok: d <= .02, d: d, key: "정확 판독 " + pct(o.exact.recall) + ", 샷 100 " + pct(p100.recall) + " (하락 " + (d * 100).toFixed(1) + "%p), 샷 5 " + pct(o.pts[3].recall) }; }
      const d = o.ev.meta[1] - o.ev.rand[5]; return { ok: d >= .10, d: d, key: "메타 1걸음 " + pct(o.ev.meta[1]) + ", 무작위 5걸음 " + pct(o.ev.rand[5]) + " (차이 " + (d * 100).toFixed(1) + "%p)" };
    }
    function showResult(b) {                         // ⑥ 결과 표, 그래프, 판정, 해석을 보여 줌 / ⑥ shows the result table, graph, verdict and interpretation
      const o = st.out, e = E(), v = verdictOf(o);   // 결과와 판정임 / results and verdict
      let left = "", meaning = "";                   // 표와 해석 글임 / table and interpretation text
      if (o.kind === "E1") {
        left = '<table class="labtbl"><tr><th>방식</th><th>탐지율' + B.info("탐지율") + '</th><th>오경보' + B.info("오경보율") + '</th><th>F1' + B.info("F1") + '</th><th>AUC' + B.info("AUC") + "</th></tr>" + [["일반 AI", v.L], ["양자 특징 AI", v.Q], ["해석 대조군(cos)", v.A]].map(function (x) { return "<tr><td>" + x[0] + "</td><td><b>" + pct(x[1].recall) + "</b></td><td>" + pct(x[1].falseAlarm) + "</td><td>" + x[1].f1.toFixed(3) + "</td><td>" + x[1].auc.toFixed(3) + "</td></tr>"; }).join("") + "</table>";
        meaning = "같은 오경보 " + pct(v.L.falseAlarm) + " 수준에서 양자 특징 AI는 위험 순간을 " + (v.d * 100).toFixed(1) + "%p 더 잡았습니다. 해석 대조군과 양자 결과가 " + (Math.abs(v.Q.recall - v.A.recall) < .005 ? "같으므로" : "거의 같으므로") + ", 좋아진 이유는 '두 위험의 겹침을 함께 보는 특징'에 있다고 이해하시면 좋을 듯합니다. 이 크기의 회로는 일반 컴퓨터로도 같은 값을 만들 수 있습니다.";
      } else if (o.kind === "E2") {
        left = '<table class="labtbl"><tr><th>샷 수</th><th>탐지율</th><th>정확 판독 대비</th><th>AUC</th></tr><tr><td>정확 판독(∞)</td><td><b>' + pct(o.exact.recall) + "</b></td><td>-</td><td>" + o.exact.auc.toFixed(3) + "</td></tr>" + o.pts.map(function (p) { return "<tr><td>" + p.shots + "</td><td><b>" + pct(p.recall) + "</b></td><td>" + ((p.recall - o.exact.recall) * 100).toFixed(1) + "%p</td><td>" + p.auc.toFixed(3) + "</td></tr>"; }).join("") + "</table>";
        meaning = "잡음 " + pct(st.noise) + "에서 샷 100번이면 정확 판독 대비 " + (v.d * 100).toFixed(1) + "%p 차이입니다. 샷이 적을수록 겹침 점수의 추정 오차가 커져 경보가 흔들립니다. 실제 장비에 올릴 때 필요한 최소 측정 횟수를 정하는 근거로 활용하실 수 있습니다.";
      } else {
        left = '<table class="labtbl"><tr><th>적응 걸음</th><th>0</th><th>1</th><th>2</th><th>5</th><th>10</th></tr><tr><td>메타 시작점</td>' + [0, 1, 2, 5, 10].map(function (k) { return "<td><b>" + pct(o.ev.meta[k]) + "</b></td>"; }).join("") + "</tr><tr><td>무작위 시작점</td>" + [0, 1, 2, 5, 10].map(function (k) { return "<td>" + pct(o.ev.rand[k]) + "</td>"; }).join("") + "</tr></table><p class='small'>메타 손실 " + o.m.loss[0].toFixed(3) + " → " + o.m.loss[o.m.loss.length - 1].toFixed(3) + "</p>";
        meaning = "메타 시작점은 처음 보는 사람의 기록 10개로 한 걸음만 적응해도 " + pct(o.ev.meta[1]) + "에 도달했습니다. 무작위 시작점은 다섯 걸음 뒤에도 " + pct(o.ev.rand[5]) + "입니다. 양자 겹침 점수를 받아 사람마다 그 신호의 무게를 빠르게 조정하는 구조로 이해하시면 좋을 듯합니다.";
      }
      b.innerHTML = '<div class="labres"><div class="stack">' + left + '<canvas id="lCv"></canvas></div><div class="stack"><div class="card ' + (v.ok ? "tint-plum" : "tint-ochre") + ' labverdict"><b>판정: ' + (v.ok ? "가설 채택(H1)" : "가설 기각(H0 유지)") + "</b><p>기준: " + e.hyp + "</p><p>결과: " + v.key + '</p></div><div class="card"><b>결과의 의미</b><p>' + meaning + '</p></div><div id="lBasis"></div></div></div>';
      if (o.kind === "E1") C.bars($("#lCv", el), [{ label: "탐지율", values: [v.L.recall, v.Q.recall, v.A.recall] }, { label: "AUC", values: [v.L.auc, v.Q.auc, v.A.auc] }], [{ color: "#003087" }, { color: "#6e4c82" }, { color: "#c38a2b" }], { height: 170, max: 1 }); // 막대임 / bars
      else if (o.kind === "E2") C.line($("#lCv", el), [{ values: o.pts.map(function (p) { return p.recall; }), color: "#6e4c82" }, { values: o.pts.map(function () { return o.exact.recall; }), color: "#8892ad" }], { height: 170, min: 0, max: 1, xLabel: "샷 1000 → 100 → 20 → 5 (자두: 샷 측정, 회색: 정확 판독)" }); // 선임 / line
      else C.line($("#lCv", el), [{ values: o.ev.meta, color: "#a9482a" }, { values: o.ev.rand, color: "#8892ad" }], { height: 170, min: .4, max: 1, xLabel: "적응 걸음 0~10 (주황: 메타, 회색: 무작위)" }); // 적응 곡선임 / adaptation curve
      $("#lBasis", el).innerHTML = B.box({ data: o.ds ? o.ds.id + " " + o.ds.name + " (" + o.ds.stats.n + "행, 등급 " + o.ds.grade + ")" : "가상 산행자(씨앗 " + st.seed + ")", method: plan().join(" → "), formula: e.id === "E1" ? "같은 오경보 10% 기준, ⟨Z⟩ = cos(πa)cos(πb)" : e.id === "E2" ? "샷 추정 p̂ = k/N, 잡음은 판독값 축소와 흔들림" : "θ′ = θ − α∇L(θ), θ ← θ − β·평균∇L(θ′)", code: "views_lab.js run(), models.js experiment(), meta.js", note: "가상 데이터 기준 결과임. 아이나비 실측 자료로 같은 절차를 반복해야 확정됨" }, "실험 근거");
      if (!st.logged) { st.logged = true; LOG.push({ at: new Date().toLocaleTimeString("ko-KR"), id: e.id, cond: o.ds ? o.ds.id + (e.id === "E2" ? ", 잡음 " + pct(st.noise) : "") : "씨앗 " + st.seed + ", 반복 " + st.metaN, key: v.key, verdict: v.ok ? "채택" : "기각", ok: v.ok }); mini(); } // 기록함 / record
      guide("판정은 <b>" + (v.ok ? "가설 채택" : "가설 기각") + "</b>입니다. 표의 굵은 숫자와 판정 상자를 먼저 보시고, 아래 '결과의 의미'를 확인하시기 바랍니다.");
      say("결과가 나왔습니다. 판정은 " + (v.ok ? "가설 채택" : "가설 기각") + "입니다. " + meaning); aim(".labverdict");
    }
    $("#lPrev", el).onclick = function () { if (st.step > 0) { st.step = st.step === 5 ? 4 : st.step - 1; render(); } }; // 이전 단계임 / previous step
    $("#lNext", el).onclick = function () { if (st.step === 4) { st.logged = false; run(); return; } if (st.step === 6) { st.step = 0; st.out = null; st.exp = (st.exp + 1) % EXPS.length; render(); return; } st.step++; render(); }; // 다음 단계, 실행, 새 실험임 / next step, run, new experiment
    $("#lAuto", el).onclick = function () {          // 눈송이와 자동 실험: 기본값으로 단계를 차례로 진행함 / auto experiment with Snowflake: proceeds through the steps with defaults
      if (autoT) { clearInterval(autoT); autoT = null; this.textContent = "▶ 눈송이와 자동 실험"; return; } this.textContent = "■ 자동 실험 멈춤"; // 켜고 끔 / toggle on and off
      autoT = setInterval(function () { if (!alive) return; if (QP.Voice.isActive() && !QP.State.touring) return; if (st.step === 5 && !st.out) return; $("#lNext", el).onclick(); }, QP.State.touring ? 6500 : 2500); // 말이 끝나면 다음 단계로 감 / go to the next step after speaking
    };
    render();                                       // 처음 화면임 / first screen
    return function () { alive = false; clearInterval(autoT); clearTimeout(runT); }; // 떠날 때 정리함 / clean up when leaving
  }

  QP.ViewDefs = (QP.ViewDefs || []).concat([{ id: "lab", group: "양자AI 실험실", title: "눈송이와 함께하는 안내형 실험", render: lab }]); // 화면을 등록함 / register the screen
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
