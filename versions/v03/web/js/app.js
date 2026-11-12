/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Application shell: menu, screen switching, narration sync, Snowflake pointer, full guide (tour), data panel, live band, settings, language switch, data store auto-save. */
/* =====================================================================
 * app.js : 프로그램 시작점 (v03)
 * ---------------------------------------------------------------------
 * 하는 일 : (1) 기본 데이터 생성 + AI 학습  (2) 왼쪽 아코디언(펼침) 메뉴
 *          (3) 숙명 브랜드 머리, 서명 꼬리  (4) 데이터 빠른 관리 패널
 *          (5) 음성 막대, 자동 해설, 전체 자동 투어  (6) 계절 장식 입자
 *          (7) 파일 내려받기, 서버 저장 API 연결
 * 제작   : 숙명여자대학교 AGI연구실 (지도교수 박영호)
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 앱을 붙임 / attaches the app to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const $ = function (id) { return document.getElementById(id); }; // id로 요소 찾기임 / find an element by id
  const State = QP.State = QP.State || {};          // 공용 상태임 / shared state
  const BR = QP.Brand, DS = QP.Datasets;            // 브랜드, 데이터 모듈임 / brand and data modules
  State.season = State.season != null ? State.season : 2; // 기본 계절(가을)임 / default season (autumn)
  let current = null, sub = null, cleanup = null, interacted = false, tourOn = false; // 현재 화면, 하위 번호, 정리 함수, 첫 조작 여부, 투어 상태임 / current screen, sub number, cleanup, first interaction, tour state

  /* ---------- 1. 브랜드 머리와 서명 꼬리 / 1. Brand header and signature footer  ---------- */
  const beaker = '<svg class="beaker" viewBox="0 0 48 48" aria-hidden="true"><path d="M18 6h12M20 6v12L9 38a4 4 0 0 0 3.5 6h23a4 4 0 0 0 3.5-6L28 18V6" fill="none" stroke="#ffb500" stroke-width="2.6" stroke-linejoin="round"/><path d="M13 32h22l3.6 6.4A2.5 2.5 0 0 1 36.4 42H11.6A2.5 2.5 0 0 1 9.4 38.4Z" fill="#7aa7ff" opacity=".85"/><circle cx="19" cy="36" r="2" fill="#fff"/><circle cx="27" cy="34" r="1.4" fill="#fff"/><path class="smoke" d="M24 4c-3-3 3-5 0-8M30 2c-2-2 2-4 0-6M18 2c-2-2 2-4 0-6" fill="none" stroke="#cfe0ff" stroke-width="1.6" stroke-linecap="round"/></svg>'; // 직접 그린 실험용 비커와 연기 아이콘임 / hand-drawn beaker and smoke lab icon
  $("brandTop").innerHTML = '<div class="banner-card"><img class="banner" src="' + BR.local("banner") + '" alt="단풍 든 산을 함께 오르는 숙명 눈송이 친구들(사용자 제공 그림)"><div class="univ-strip">' + BR.img("symbol", "u-sym", "숙명여자대학교 심볼마크") + '<span class="brand-text">Sookmyung AGI Lab.</span></div></div><div class="lab-title">' + beaker + '<div><b>숙명 AGI 산행안전<br>양자 실험실</b><small>' + BR.labEn + ", " + BR.version + '</small></div></div>'; // 왼쪽 위 머리임 / top-left header
  /* 한영 전환 / Korean-English switch: 왼쪽 위 버튼으로 화면 글자, 그림 글자, 음성을 한 번에 바꿈 */
  function langUI() { const en = QP.I18N.lang() === "en"; $("langKo").classList.toggle("on", !en); $("langEn").classList.toggle("on", en); } // 버튼 표시 / button state
  QP.I18N.onChange = function () { QP.Voice.stop(); langUI(); if (QP.Voice.onVoices) QP.Voice.onVoices(); if (typeof current !== "undefined" && current) { menu(); show(location.hash.slice(1) || current.id); } }; // 바꾸면 음성 멈추고 화면을 다시 그림 / stop voice and re-render
  $("langKo").onclick = function () { QP.I18N.set("ko"); }; $("langEn").onclick = function () { QP.I18N.set("en"); }; // 버튼 / buttons
  QP.I18N.init(); langUI();                         // 지난 선택으로 시작 / start with the last choice
  $("sign").innerHTML = '<details class="sigd"><summary>' + BR.img("snow", "sig-char", "숙명여대 캐릭터 눈송이") + '<span><b>Nov. 2026 숙명여자대학교 AGI연구실</b><br>' + BR.version + ', 과제 정보 ▾</span></summary><div class="sig-body"><p><b>' + BR.maker + '</b><br>제작 ' + BR.built + ", 배포 " + BR.version + " (" + BR.released + ')</p><p>' + BR.funding + '</p><p>과제: ' + BR.project + '<br>' + BR.partner + '</p><p>© 2025-2026 Sookmyung Women\'s University AGI Lab. (Prof. Young-ho Park). All rights reserved. 숙명여대 CI, 눈송이 캐릭터는 숙명여자대학교 공식 원본을 규정대로 사용함.</p></div></details>'; // 아래 서명: 평소엔 한 줄로 접고, 누르면 과제 정보를 모두 펼침 / bottom signature: folded to one line, expands to all project info on click

  /* ---------- 2. 기본 데이터와 AI 학습 / 2. Default data and AI training  ---------- */
  function boot() {                                 // 준비 화면이 먼저 보이도록 잠시 뒤에 무거운 계산을 함 / do heavy computation a bit later so the loading screen shows first
    DS.makeRule(901, 2750);                         // D001: 규칙 균일 합성(기준선)임 / D001: rule-based uniform synthetic (baseline)
    const g0 = DS.makeGrounded(2026, 40); State.bootIds = DS.list.map(function (d) { return d.id; }); // 시작 때 만든 기본 데이터는 보관함 자동 저장에서 뺌 / boot datasets are not auto-saved           // D002: 근거 기반 산행 40회(기본 학습 데이터)임 / D002: evidence-based hikes 40 runs (default training data)
    DS.retrain(g0.id);                              // 다섯 방식 + DNN을 학습함 / train the five methods + DNN
    quick(); badge(); show(location.hash.slice(1) || "home"); // 첫 화면을 그림 / draw the first screen
    $("loading").remove();                          // 준비 화면을 지움 / remove the loading screen
    $("stImg").src = BR.local("cheer"); $("starter").hidden = false; // 첫 화면: 자동 시연과 설명을 기본으로 권함(브라우저는 첫 클릭 전에는 소리를 낼 수 없음) / start screen: recommends auto demo and explanation (browsers cannot play sound before the first click)
    $("stGo").onclick = function () {               // 시연 시작: 환영 인사를 먼저 하고, 끝나면 양자 기초부터 전체 자동 안내를 반드시 시작함 / start demo: welcome first, then always start the full guide from quantum basics
      $("starter").hidden = true; QP.Voice.wake(); interacted = true; // 시작 화면을 닫고 오디오를 깨움 / close the start screen and wake the audio
      const W = "안녕하세요? 숙명여자대학교 AGI연구실에서 개발 중인 산행안전을 위한 양자 특성 AI 에뮬레이팅 실험실에 오신 것을 환영합니다. 자동 시연을 누르셨으니, 양자의 기본 설명부터 시작해서 실험실에 대해 잘 안내하도록 하겠습니다."; // 환영 인사임 / welcome message
      QP.Voice.speak(W, true, true); alert0("환영합니다. 잠시 후 양자의 기본 설명부터 자동 안내를 시작합니다."); // 인사를 읽고 알림을 띄움 / read the greeting and show a toast
      const dl = Date.now() + estimate(W) + 2000, t0 = Date.now(), wt = TB.token = (TB.token || 0) + 1; // 음성이 멈춰도 반드시 넘어가도록 정한 최대 대기 시각임 / latest wait time so it moves on even if the voice stalls
      (function waitW() { if (TB.token !== wt) return; if ((QP.Voice.isActive() || Date.now() - t0 < 1500) && Date.now() < dl) { setTimeout(waitW, 400); return; } setTimeout(function () { if (TB.token !== wt) return; TB.steps = tourSteps(); tourGo(0); }, 600); })(); // 인사가 끝나면 첫 단계(① 양자와 양자AI 기초)부터 시작함 / after the greeting, start from step 1 (① quantum and quantum AI basics)
    }; // 한 번 누르면 환영 인사 뒤 전체 자동 안내가 시작됨 / one click starts the full guide after the welcome
    $("stSkip").onclick = function () { $("starter").hidden = true; interacted = true; QP.Voice.wake(); readShort(); }; // 직접 둘러보기(그래도 화면마다 자동 해설, 자동 시연은 켜짐) / explore myself (auto narration and auto demos stay on per screen)
  }

  /* ---------- 3. 아코디언 메뉴 / 3. Accordion menu  ---------- */
  /* 메뉴 구조: 큰 목적 2개(A 양자AI 이해, B 에뮬레이팅 실험) 아래 4개 묶음으로 사람이 이해하는 순서대로 정리함 */
  const SECTIONS = [["A. 양자AI 이해하기", ["① 양자와 양자AI 기초", "② 실험실 투어"]], ["B. 에뮬레이팅 실험", ["③ 합성 데이터 생성과 실험 관제", "④ 실측 데이터 입력 준비"]]]; // 큰 목적과 묶음임 / main purposes and groups
  const PLAN = {                                    // 묶음별 화면 순서(이해 흐름: 개념 → 비교 → 학습 방식 → 참고)임 / screen order per group (understanding flow: concept → comparison → learning → reference)
    "① 양자와 양자AI 기초": ["kid", "entangle", "basics", "lab2q", "compare", "overlap", "same", "vqc", "scale", "glossary"],
    "② 실험실 투어": ["home", "howto", "sim", "stamp", "zone4q", "persona"],
    "③ 합성 데이터 생성과 실험 관제": ["ecolab", "lab", "datamgr", "store", "grounded", "bench", "dnn", "meta", "eco"],
    "④ 실측 데이터 입력 준비": ["realdata", "dev"]
  };
  (function regroup() { const order = []; Object.keys(PLAN).forEach(function (g) { PLAN[g].forEach(function (id) { const v = QP.ViewDefs.find(function (x) { return x.id === id; }); if (v) { v.group = g; order.push(v); } }); }); QP.ViewDefs.forEach(function (v) { if (order.indexOf(v) < 0) { v.group = "④ 실측 데이터 입력 준비"; order.push(v); } }); QP.ViewDefs.length = 0; order.forEach(function (v) { QP.ViewDefs.push(v); }); })(); // 화면 목록을 새 묶음과 순서로 다시 정렬함 / reorder the screen list into the new groups and order
  const groups = Object.keys(PLAN);                 // 메뉴 묶음 순서임 / menu group order
  const icons = { "① 양자와 양자AI 기초": "🪙", "② 실험실 투어": "🧭", "③ 합성 데이터 생성과 실험 관제": "🧪", "④ 실측 데이터 입력 준비": "🗂" }; // 묶음 아이콘임 / group icons
  State.open = State.open || {}; State.secOpen = State.secOpen || {}; // 처음에는 모두 접힘(사용자가 눌러 한 단계씩 펼침) / everything collapsed at first (the user expands one level at a time)
  function menu() {                                 // 메뉴를 그림 / draw the menu
    $("menu").innerHTML = groups.map(function (g) {  // 그룹마다 / for each group
      const si = SECTIONS.findIndex(function (x) { return x[1].indexOf(g) >= 0; }), sop = !!State.secOpen[si]; // 이 묶음이 속한 큰 목적과 펼침 여부 / main section of this group and whether it is open
      const sec = SECTIONS.find(function (x) { return x[1][0] === g; }), head = sec ? '<button class="msec msec-h' + (sop ? " open" : "") + '" data-s="' + si + '"><span>' + sec[0] + "</span><i>" + (sop ? "▾" : "▸") + "</i></button>" + (sec[0].indexOf("B.") === 0 && sop ? '<button class="tour-btn tour-b" id="tourB">▶ 에뮬레이팅 실험 자동 안내<small>데이터 생성 → 학습 → 배포, 경보 → 재학습을 차례로 보여 드림</small></button>' : "") : ""; // 큰 목적 제목(묶음 앞에 한 번)임 / main-purpose title (once before its groups)
      const items = QP.ViewDefs.filter(function (v) { return v.group === g; }); // 그룹의 화면들임 / screens of the group
      const open = State.open[g] || (current && current.group === g); // 펼침 여부임 / expanded or not
      if (!sop) return head;                         // 큰 목적이 접혀 있으면 제목만 보임(왼쪽을 깔끔하게) / when the section is collapsed, show only its title (keeps the left clean)
      return head + '<div class="grp' + (open ? " open" : "") + '"><button class="grp-h" data-g="' + g + '"><span>' + icons[g] + " " + g + '</span><i>' + (open ? "▾" : "▸") + '</i></button><div class="grp-b">' + items.map(function (v) { // 그룹 머리와 몸통임 / group header and body
        return '<a href="#' + v.id + '" class="' + (current && current.id === v.id && !sub ? "cur" : "") + '">' + v.title + "</a>" + (v.subs ? '<div class="subs">' + v.subs.map(function (s, i) { return '<a href="#' + v.id + "-" + (i + 1) + '" class="sub' + (current && current.id === v.id && Number(sub) === i + 1 ? " cur" : "") + '">' + s + "</a>"; }).join("") + "</div>" : ""); // 항목과 하위 항목임 / items and sub-items
      }).join("") + "</div></div>";
    }).join("");
    const tb = $("tourB"); if (tb) tb.onclick = tourB; // B 묶음 자동 안내 버튼 / auto-guide button for part B
    document.querySelectorAll("#menu a[href]").forEach(function (a) { a.addEventListener("click", function () { // 왼쪽 메뉴가 우선: 누르면 진행 중인 안내와 음성을 즉시 끊고, 누른 화면의 설명만 나오게 함 / the left menu wins: a click stops any running guide and voice, so only the chosen screen is narrated
      State.basicsAuto = false; if (tourOn) tourEnd(true, true); else TB.token = (TB.token || 0) + 1; QP.Voice.stop(); QP.Voice.hush(false); interacted = true;
      if (location.hash === a.getAttribute("href")) setTimeout(readShort, 200); // 같은 화면을 다시 누르면 그 화면 설명만 다시 읽음 / clicking the same screen again re-reads only its guide
    }); });
    document.querySelectorAll("#menu .msec-h").forEach(function (b) { b.onclick = function () { const k = Number(b.dataset.s); State.secOpen[k] = !State.secOpen[k]; menu(); }; }); // 큰 목적을 누르면 한 단계 펼치거나 접음 / click a section to expand or collapse one level
    document.querySelectorAll("#menu .grp-h").forEach(function (b) { b.onclick = function () { State.open[b.dataset.g] = !b.parentNode.classList.contains("open"); menu(); }; }); // 그룹을 누르면 펼치거나 접음 / click a group to expand or collapse
  }

  /* ---------- 4. 데이터 빠른 관리 패널 / 4. Quick data panel  ---------- */
  function quick() {                                // 왼쪽 데이터 패널을 그림 / draw the left data panel
    const d = DS.get(State.dataId);                 // 사용 중 데이터임 / data in use
    const open = !!State.quickOpen, Q = [["center", "📂 데이터 관리 센터 열기", ""], ["gen", "⚡ 근거 데이터 생성", "#gGo"], ["stream", "▶ 연속 생성", "#gStream"], ["train", "🧠 이 데이터로 AI 학습", "#gT"], ["export", "⬇ 데이터 내보내기", "#gX"], ["list", "📋 데이터 목록 보기", "#gL"]]; // 항목: 누르면 오른쪽 관리 센터에서 해당 버튼을 가리킴 / items: clicking points at the matching control on the right
    $("quick").innerHTML = '<div class="grp quickgrp' + (open ? " open" : "") + '"><button class="grp-h" id="qHead"><span>🗂 데이터 빠른 관리</span><i>' + (open ? "▾" : "▸") + '</i></button><div class="grp-b"><p class="qcur">사용 중: <b>' + (d ? d.id : "-") + "</b> " + (d ? d.stats.n.toLocaleString("ko-KR") + "행, 등급 " + d.grade : "") + ", 등록 " + DS.list.length + "개</p>" + Q.map(function (q, k) { return k === 0 ? '<a class="qmain" data-q="">' + q[1] + ' ›</a><p class="qhint">아래 항목도 모두 오른쪽 <b>데이터 관리 센터</b>를 열고, 그 버튼을 눌러 결과를 크게 보여 드립니다.</p>' : '<a data-q="' + q[2] + '">' + q[1] + "</a>"; }).join("") + '<p class="qsub">데이터로 학습하는 흐름(선순환)</p><a data-v="dnn">🧠 AI DNN 학습</a><a data-v="meta">🧬 AI 메타 학습</a><a data-v="eco" class="qcyc">🔄 양자와 AI 학습 선순환 ›</a><p class="qhint">데이터 생성 → 양자 특징 → AI DNN 학습 → 배포, 경보 → 피드백 → AI 메타 학습 → 다시 데이터로 돌아가는 고리입니다.</p></div></div>'; // 왼쪽 메뉴와 같은 풀다운 / pull-down like the left menu
    $("qHead").onclick = function () { State.quickOpen = !State.quickOpen; quick(); }; // 펼치기, 접기 / expand, collapse
    $("quick").querySelectorAll("[data-v]").forEach(function (a) { a.onclick = function () { if (tourOn) tourEnd(true, true); QP.Voice.stop(); QP.Voice.hush(false); go(a.dataset.v); }; }); // 학습 화면 바로가기 / shortcuts to the learning screens
    $("quick").querySelectorAll("[data-q]").forEach(function (a) { a.onclick = function () { const sel = a.dataset.q; if (tourOn) tourEnd(true, true); QP.Voice.stop(); go("datamgr"); if (!sel) return; setTimeout(function () { const t = document.querySelector(sel); if (!t) return; t.scrollIntoView({ block: "center" }); t.classList.add("labtype"); setTimeout(function () { t.classList.remove("labtype"); }, 3000); const r = t.getBoundingClientRect(); pointAt(r.left + Math.min(30, r.width / 2), r.top + r.height / 2); if (QP.DataNote) QP.DataNote("👉", "왼쪽에서 고른 ‘" + a.textContent.replace(/^\S+\s/, "") + "’을 이 화면에서 실행합니다", sel === "#gL" ? "가운데 목록에서 데이터를 누르면 오른쪽에 검사 결과가 열립니다." : "노란 테두리의 버튼이 실제로 눌립니다. 결과는 바로 이 자리에 크게 표시됩니다."); if (sel !== "#gL") setTimeout(function () { if (document.body.contains(t)) t.click(); }, 1300); }, 700); }; }); // 가리킨 뒤 1.3초 후 오른쪽 버튼을 실제로 누르고, 결과를 오른쪽에 알림 / after pointing, actually press the right-side button 1.3 s later and announce the result on the right // 오른쪽 관리 센터를 열고 그 버튼을 가리킴(실행은 오른쪽에서 직접) / open the data center on the right and point at that control (run it there)
  }
  let shownChange = 0;                              // 마지막으로 알린 변화 시각임 / time of the last change notice
  function badge() {                                // 위쪽에 "지금 에뮬레이팅 중인 데이터"와 변화를 표시함 / shows "data being emulated now" and its changes at the top
    const d = DS.get(State.dataId), c = State.lastChange; if (!d) return; // 사용 중 데이터와 변화 기록임 / data in use and change log
    const pp = function (v) { return v == null ? "-" : (v * 100).toFixed(1) + "%"; }; // 백분율임 / percentage
    $("dataBadge").innerHTML = "에뮬레이팅 데이터 <b>" + d.id + "</b> " + d.name + " (" + d.stats.n.toLocaleString("ko-KR") + "행, 위험 " + (d.stats.rate * 100).toFixed(1) + "%, 등급 " + d.grade + ")" + (c && c.from.Q != null ? ", 변화: 양자 " + pp(c.from.Q) + "→" + pp(c.to.Q) + ", 일반 " + pp(c.from.L) + "→" + pp(c.to.L) : ""); // 데이터와 성적 변화를 한 줄로 보임 / show data and score changes in one line
    if (c && c.at !== shownChange && c.from.Q != null) { shownChange = c.at; const dq = (c.to.Q - c.from.Q) * 100, dl = (c.to.L - c.from.L) * 100; alert0("데이터 변경: " + c.from.name + " → " + c.to.name + " | 양자 탐지율 " + (dq >= 0 ? "+" : "") + dq.toFixed(1) + "%p, 일반 " + (dl >= 0 ? "+" : "") + dl.toFixed(1) + "%p"); $("dataBadge").classList.remove("pulse"); void $("dataBadge").offsetWidth; $("dataBadge").classList.add("pulse"); } // 바뀌면 알림 띠와 깜빡임으로 알림 / notify changes with a toast and a flash
  }
  DS.onChange(quick); DS.onChange(badge);           // 데이터가 바뀌면 패널과 데이터 표시를 갱신함 / update the panel and data badge when data changes

  /* ---------- 5. 화면 전환 / 5. Screen switching  ---------- */
  function show(hash) {                             // #id 또는 #id-번호로 화면을 그림 / draws a screen from #id or #id-number
    if (!tourOn && QP.Voice.isHushed() && userNav) QP.Voice.hush(false); userNav = true; // 사용자가 직접 다른 화면으로 옮기면 다시 말하기를 허용함 / allow speech again when the user moves to another screen
    const m = /^(.*?)(?:-(\d+))?$/.exec(hash || "home"); // id와 하위 번호를 나눔 / split id and sub number
    const v = QP.ViewDefs.find(function (x) { return x.id === m[1]; }) || QP.ViewDefs.find(function (x) { return x.id === "home"; }); // 화면 정의임 / screen definition
    if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; } if ($("view")._cleanup) { try { $("view")._cleanup(); } catch (e) { } $("view")._cleanup = null; } QP.Anim.stopAll(); // 이전 화면 정리임 / clean up the previous screen
    if (!tourOn) QP.Voice.stop();                   // 투어가 아니면 음성을 멈춤 / stop the voice unless touring
    if (State.basicsAuto && m[1] !== "basics") State.basicsAuto = false; // 다른 화면으로 가면 자동 수업을 끝냄 / leaving the screen ends the auto class
    current = v; sub = m[2] || null;                // 현재 화면 기록임 / record the current screen
    $("viewGroup").textContent = icons[v.group] + " " + v.group; $("viewTitle").textContent = v.title + (sub && v.subs ? ", " + v.subs[sub - 1] : ""); // 제목임 / title
    const el = $("view"); el.innerHTML = ""; el.scrollTop = 0; // 내용 영역을 비움 / clear the content area
    try { cleanup = v.render(el, sub) || null; } catch (e) { el.innerHTML = '<div class="banner">화면 오류: ' + e.message + "</div>"; console.error(e); } // 화면을 그림 / draw the screen
    setTimeout(function () { QP.Basis.attachReaders(el); if (!tourOn) { const a = el.querySelector("[data-autoplay]"); if (a && !/멈춤|❚❚|■/.test(a.textContent)) a.click(); } }, 400); // 카드마다 읽기 버튼을 붙이고, 움직이는 시연을 자동으로 켬(멈춘 화면이 없도록) / add read buttons to each card and start moving demos automatically (no static screens)
    document.title = v.title + ", 숙명 AGI 산행안전 양자 실험실"; menu(); // 탭 제목과 메뉴 강조임 / tab title and menu highlight
    if ($("autoVoice").checked && interacted && !tourOn && !(v.id === "basics" && State.basicsAuto)) setTimeout(readShort, 300); // 자동 해설이면 짧은 안내를 읽음(자동 수업 중에는 수업이 직접 읽음) / with auto narration, read the short guide (during the auto class the class reads itself)
  }
  function go(id) { location.hash = id; }           // 화면 이동임 / navigate to a screen
  window.addEventListener("hashchange", function () { show(location.hash.slice(1)); }); // 주소가 바뀌면 화면을 바꿈 / switch screens when the address changes

  /* ---------- 6. 음성 / 6. Voice  ---------- */
  function script() { return QP.Narration.get(current.id); } // 현재 대본임 / current script
  function readShort() { const t = current.subs && sub ? QP.Narration.sub(current.id, Number(sub)) : script().short; QP.Voice.speak(t, true, true); } // 짧은 안내 읽기(하위 과에서는 그 과의 설명)임 / read the short guide (or the lesson's explanation in sub-lessons)
  function readLong() { const sc = script(); if (current.subs && sub) { QP.Voice.speak(QP.Narration.sub(current.id, Number(sub)), true, true); return; } if (State.dataId === "D002" && current.id !== "sim") QP.Voice.play(current.id + "_long", sc.long); else QP.Voice.speak(sc.long, true); } // 긴 설명(녹음이 있으면 녹음)임 / long explanation (recording if available)
  $("btnShort").onclick = function () { QP.Voice.hush(false); readShort(); }; $("btnLong").onclick = function () { QP.Voice.hush(false); readLong(); }; // 위쪽 버튼임 / top buttons

  $("vPause").onclick = function () { if (tourOn) { TB.paused = true; tourDraw(); } QP.Voice.pause(); }; $("vStop").onclick = function () { if (tourOn) { TB.paused = true; QP.Voice.pause(); tourDraw(); return; } QP.Voice.stop(); }; // 안내 중에는 멈춤으로만 동작(종료는 ✕ 버튼) / during the guide it only pauses (✕ ends)
  $("vPlay").onclick = function () { QP.Voice.hush(false); if (tourOn && TB.paused) { TB.paused = false; QP.Voice.resume(); if (!QP.Voice.isActive()) tourGo(TB.i); tourDraw(); return; } if ($("vPlay").dataset.state === "paused") QP.Voice.resume(); else readLong(); }; // 재생: 안내 중이면 이어 듣기 / play: resume if guiding
  $("vRate").onchange = function (e) { QP.Voice.setRate(Number(e.target.value)); }; // 속도임 / speed
  $("vVoice").onchange = function (e) { QP.Voice.setVoice(e.target.value); $("vAlt").value = "0"; QP.Voice.setAlternate(0); quality(); }; // 목소리를 직접 고르면 그 목소리로 고정(교대 끔) / choosing a voice fixes it (alternation off)
  $("vAlt").onchange = function (e) { QP.Voice.setVoice(null); QP.Voice.setAlternate(Number(e.target.value)); quality(); }; // 남녀 교대 간격을 바꿈 / change the alternation interval
  QP.Voice.setAlternate(99); QP.Voice.setRate(1);  // 기본: 주제(설명)마다 남녀 교대, 보통(1배) 속도 / default: alternate male/female per topic, normal (1×) speed
  /* ---------- 6-2. 설명과 화면 맞추기(싱크 스포트라이트) / 6-2. Syncing narration with the screen (spotlight)  ---------- */
  // 지금 읽는 문장에 나오는 낱말로 화면의 해당 부분을 찾아 노란 테두리와 손가락 표시로 가리킴 / finds the screen part matching words in the current sentence and points at it with a yellow outline and pointer
  const CUES = {                                    // 화면별 [문장 낱말 규칙, 가리킬 요소] 목록임 / list of [sentence word rule, element to point at] per screen
    home: [[/눈송이|백대 명산|오를 때/, ".hero2"], [/탐지율|퍼센트/, ".cards4 .tint-plum"], [/일반 수식|정직/, ".cards4 .tint-ochre"], [/연구실|재난안전/, ".cards4 .tint-rose"], [/관제실/, ".hero-copy .primary"]],
    howto: [[/셋업|설치/, ".steps-ol li:nth-child(1)"], [/런 배치|포트/, ".steps-ol li:nth-child(2)"], [/엣지|목소리/, ".steps-ol li:nth-child(3)"], [/메뉴|펼쳐/, ".card:nth-child(2) li:nth-child(1)"], [/근거/, ".card:nth-child(2) li:nth-child(4)"]],
    sim: [[/미터 남았|감지를 시작|도착|돌계단|낙석|절벽|야생동물|음영|능선|출발/, ".mtn"], [/양자 특징 AI가 경보|일반 AI는 아직/, ".ch2"], [/위험 사건|먼저 알렸|놓쳤/, ".ch2"], [/지금 .*이에요\. .*순간/, ".meaning"], [/산 그림|눈송이|등산로|움직/, ".mtn"], [/감지 거리|위험 지점|앞쪽/, ".mtn"], [/다이얼|큐비트 회전|씨낫|노란 연결선|겹침 점수/, ".qub"], [/분홍 띠|자두색 선|청색 선|삼각형|점수예요/, ".ch2"], [/그래프/, ".ch1"], [/의미 상자|이 순간|권고/, ".meaning"], [/신경망|DNN/, ".nn"]],
    stamp: [[/여권|스탬프/, ".passport"], [/자두색 점|청색 점|그림/, "#sCv"], [/몇 분|비교/, "#sRes"], [/관제실에서/, "#sGo"]],
    zone4q: [[/산길|걸어가|거리/, ".z4in"], [/신뢰도|헛경보/, ".zwhy"], [/씨낫|보조 큐비트|한 번에/, ".z4c"], [/안심|통제|갈림길/, "#zAct"]],
    kid: [[/탁자|비트|돌고 있는 동전|큐비트/, "#kc"], [/기울/, "#kDial"], [/만 번|점 하나/, "#kGrid"], [/노란 점의 비율|가까워/, "#kConv"], [/산행|비의 세기/, "#kT"]],
    entangle: [[/뒤집|씨낫/, ".ent-stage"], [/같았는지|달랐는지|표/, "#eT"], [/겹침 점수|인공지능은/, ".tint-plum"], [/자동 시연/, "#eAuto"]],
    basics: [[/일과|비트와 큐비트|화살표/, ".bbody canvas"], [/진폭|그림자|제곱/, ".bbody canvas"], [/게이트|엑스|하다마드/, ".bbody .gates"], [/상태벡터|목록/, ".bbody table"], [/회로도|가로선|계기판/, ".bbody canvas"]],
    lab2q: [[/회전|화살표/, "#lD"], [/얽기|연결선|뒤집/, "#lD"], [/측정|겹침 점수/, "#lZ"], [/샷|흔들/, "#lH"]],
    compare: [[/돌계단|떠올려/, ".steps4 .card:nth-child(1)"], [/일반 인공지능은|따로 더|판단 지도|가로는|진한 색|흰 동그라미가 진한/, "#cML"], [/흰 동그라미는/, "#cMQ"], [/양자 특징 인공지능은|엮어|휘어/, "#cMQ"], [/탐지율|퍼센트/, ".v-cmp table"], [/산행 따라/, "#cWalk"]],
    overlap: [[/한 가지/, ".lesson3 .card:nth-child(1)"], [/같은 순간|겹칠 때/, ".lesson3 .card:nth-child(2)"], [/시간에 따라|쌓이는/, ".lesson3 .card:nth-child(3)"], [/표는|스물네/, "#oT"]],
    same: [[/항상 같아요|코사인/, ".proof"], [/대조군은/, ".qa"], [/샷|잡음|다른 회로/, ".tint-plum"], [/지지 특징|탐지율/, "#yC"]],
    bench: [[/탐지율|오경보|정밀도|에프원|에이유씨/, ".metric-desc"], [/에프원은/, "#bT"]],
    persona: [[/심박 백사십|서른한|예순여덟/, "#pCards"], [/최대심박|여성/, "#pCards .card:nth-child(1)"], [/인공지능이라도|경보가 달라/, "#pC"]],
    meta: [[/관계도|워치|씨낫|겹침 점수를 만듭니다|고정/, "#mFlow"], [/신경망 그림|노란 선/, "#mNet"], [/가중치 공간|금색|주황 선/, "#mPar"], [/적응 곡선|무작위 시작점/, "#mAd"]],
    ecolab: [[/풀다운|왼쪽/, ".ecoctl"], [/여덟 단계 상자|차례로 켜/, "#xPipe"], [/배포|실시간 채점|현장 경보/, "#xRun2"], [/재학습|메타러너|피드백/, "#xRe"], [/로지스틱|심층/, "#xT"]],
    lab: [[/일곱 단계|왼쪽/, "#lSteps"], [/자동 실험/, "#lAuto"], [/다음 단계/, "#lNext"]],
    dnn: [[/입력 신호|은닉|위험 점수/, "#dNet"], [/노란 선|굵기/, "#dNet"], [/문제 풀기|여덟|막대|체크|맞힌/, "#dQuiz"], [/손실이|손실/, "#dCur"], [/사백사십일|가중치/, "#dW"]],
    vqc: [[/다이얼|각도/, "#vC"], [/기울기|측정하면/, ".qa"]],
    eco: [[/수집|신호화|양자 특징|학습|배포|경보|피드백|메타/, "#eC"], [/자두색|장밋빛|안전 규칙/, "#eC"]],
    datamgr: [[/교과서|하는 일/, ".dmflow"], [/근거 기반 산행 시계열|생성할 때/, ".dmv>.card:nth-child(2)"], [/등급|검사/, "#gD"], [/연속 생성|학습 곡선/, "#gC"]],
    grounded: [[/생성 규칙|그래프의 점/, ".g2"], [/실측|현실/, ".qa"]],
    scale: [[/메모리|진폭/, ".card:nth-child(1)"], [/장비|큰 회로/, ".card:nth-child(2)"]],
    dev: [[/레고|파일/, ".card:nth-child(2)"]],
    glossary: [[/검색/, "#gq"]],
    realdata: [[/정답 기록|사고/, ".spec tr:last-child"], [/심박과 지피에스|워치/, ".spec tr:nth-child(2)"], [/스탬프/, ".spec tr:nth-last-child(2)"]]
  };
  let spotEl = null;                                // 지금 강조 중인 요소임 / element currently highlighted
  function spotlight(sentence) {                    // 문장에 맞는 화면 요소를 강조함 / highlights the screen element matching the sentence
    const view = $("view"); if (!sentence || !current) { if (spotEl) spotEl.classList.remove("spot"); hidePointer(); return; } // 문장이 없으면 강조를 끔 / turn off highlighting if there is no sentence
    let target = null;                              // 가리킬 요소임 / element to point at
    (CUES[current.id] || []).some(function (c) { if (c[0].test(sentence)) { target = view.querySelector(c[1]); return !!target; } return false; }); // 규칙표에서 먼저 찾음 / look in the rule table first
    if (!target) { const words = sentence.replace(/[.,?!]/g, " ").split(/\s+/).filter(function (w) { return w.length >= 2; }); target = Array.prototype.find.call(view.querySelectorAll("h3,.eyebrow,b"), function (h) { const t = h.textContent; return words.some(function (w) { return t.indexOf(w.slice(0, 3)) >= 0 && w.length >= 3; }); }); if (target) target = target.closest(".card") || target; } // 없으면 제목 낱말이 겹치는 카드를 찾음 / otherwise find a card whose title shares a word
    if (spotEl && spotEl !== target) spotEl.classList.remove("spot"); // 이전 강조를 끔 / remove the previous highlight
    if (!target) { hidePointer(); return; }         // 찾지 못하면 눈송이를 숨김 / hide Snowflake if nothing is found
    spotEl = target; target.classList.add("spot");  // 새 요소를 강조함 / highlight the new element
    const vr = view.getBoundingClientRect(), tr = target.getBoundingClientRect(); if (tr.top < vr.top || tr.bottom > vr.bottom) view.scrollTop += tr.top - vr.top - 10; window.scrollTo(0, 0); document.documentElement.scrollLeft = 0; // 내용 영역 안에서만 세로로 맞춰 보이게 함(문서 전체가 밀리지 않게) / scroll vertically only inside the content area (the page itself does not shift)
    setTimeout(function () { if (spotEl === target) walkTo(target); }, 450); // 스크롤이 끝난 뒤 위치를 한 번 더 맞춤 / adjust the position once more after scrolling
    walkTo(target);                                 // 눈송이가 걸어가서 지시봉으로 가리킴 / Snowflake walks over and points with the stick
  }
  /* 눈송이 지시봉 안내원: 설명하는 곳 옆으로 걸어가 지시봉 끝을 그 부분에 댐 */
  let aim = null;                                   // 지시봉이 가리킬 화면 좌표임 / screen coordinate the stick points at
  function walkTo(target) {                         // 대상 요소 옆으로 이동함 / move next to the target element
    const r = target.getBoundingClientRect(), pt = $("pointer"), W = window.innerWidth, H = window.innerHeight; // 대상 위치와 화면 크기임 / target position and screen size
    pt.hidden = false; $("stick").style.display = "block"; // 눈송이와 지시봉을 보임 / show Snowflake and the stick
    if (!$("pImg").getAttribute("src")) { $("pImg").src = BR.local("guide"); $("pImg").onerror = function () { this.onerror = null; this.src = BR.files.guide; }; } // 안내 자세 이미지를 씀 / use the guide pose image
    let left = r.left > 360, gx, gy;                // 대상 왼쪽에 설 자리가 있는지임 / whether there is room to the left of the target
    if (r.width > W * .45 && r.top > 150) { left = true; gx = Math.max(265, r.left + 20); gy = r.top - 74; } // 넓은 대상은 위쪽 바깥에 서서 내용을 가리지 않음 / for wide targets stand above so the content is not covered
    else if (left) { gx = Math.max(265, r.left - 70); gy = Math.min(H - 140, Math.max(60, r.top + 6)); } // 왼쪽 바깥에 섬 / stand outside on the left
    else if (W - r.right > 80) { gx = r.right + 8; gy = Math.min(H - 140, Math.max(60, r.top + 6)); } // 오른쪽 바깥에 섬 / stand outside on the right
    else { gx = Math.max(265, r.left + 6); gy = Math.min(H - 140, r.bottom - 70); } // 자리가 없으면 대상 왼쪽 아래 귀퉁이에 섬 / if there is no room, stand at the target's lower-left corner
    pt.style.left = gx + "px"; pt.style.top = gy + "px"; pt.classList.toggle("flip", gx > r.left + r.width / 2); // 위치를 옮기고 방향을 정함(CSS로 걸어가듯 이동) / move and set direction (walks via CSS)
    aim = { el: target }; // 지시봉 끝은 대상 안쪽이 아니라 테두리에 닿게 함(내용과 답을 가리지 않음), 위치는 매 프레임 다시 계산 / the tip touches the target's border, not its inside (never covers content or answers); recomputed every frame
  }
  (function stickLoop() {                           // 매 프레임 지시봉을 눈송이 손에서 대상까지 이음 / each frame, connect the stick from Snowflake's hand to the target
    const pt = $("pointer");                        // 눈송이 요소임 / Snowflake element
    if (!pt.hidden && aim) { const r = pt.getBoundingClientRect(), flip = pt.classList.contains("flip"); const hx = flip ? r.left + r.width * .12 : r.left + r.width * .88, hy = r.top + r.height * .5; const L = $("stickL"), T = $("stickT"); const wob = Math.sin(performance.now() / 700) * 2; let ax = aim.x, ay = aim.y; // 가리킬 점임 / point to touch
      if (aim.el) { const q = aim.el.getBoundingClientRect(); ax = Math.min(q.right, Math.max(q.left, hx)); ay = Math.min(q.bottom, Math.max(q.top, hy)); // 손에서 가장 가까운 테두리 점 / nearest border point to the hand
        if (ax > q.left && ax < q.right && ay > q.top && ay < q.bottom) { const cxq = (q.left + q.right) / 2, cyq = (q.top + q.bottom) / 2, vx = cxq - hx, vy = cyq - hy, dv = Math.hypot(vx, vy) || 1, L2 = Math.min(70, dv); ax = hx + vx / dv * L2; ay = hy + vy / dv * L2; } // 눈송이가 대상 안에 서 있으면 대상 가운데 쪽으로 짧게(최대 70px) 가리킴 / if Snowflake stands inside the target, point a short way (max 70 px) toward its center
        else { const dx0 = ax - hx, dy0 = ay - hy, d0 = Math.hypot(dx0, dy0) || 1; ax -= dx0 / d0 * 4; ay -= dy0 / d0 * 4; } } // 바깥이면 테두리 바로 바깥에 닿게 함 / if outside, touch just outside the border
      const dist = Math.hypot(ax - hx, ay - hy); $("stick").style.opacity = dist > 170 ? 0 : 1; // 걸어가는 중이라 멀면 지시봉을 숨김(지나치게 긴 화살표 방지) / hide the stick while far away during the walk (no overly long arrow)
      const tx = ax + wob, ty = ay + wob / 2, ang = Math.atan2(ty - hy, tx - hx), len = 24, half = 11; // 화살촉 끝 위치, 방향, 길이, 반폭임 / arrowhead tip position, direction, length, half-width
      const bx = tx - Math.cos(ang) * len, by = ty - Math.sin(ang) * len; // 화살촉 밑변 가운데임 / center of the arrowhead base
      const C0 = $("stickC"); if (C0) { C0.setAttribute("cx", tx); C0.setAttribute("cy", ty); } // 끝 지점에 퍼지는 고리로 정확한 위치를 표시 / a pulsing ring marks the exact tip point
      L.setAttribute("x1", hx); L.setAttribute("y1", hy); L.setAttribute("x2", bx); L.setAttribute("y2", by); // 지시봉 막대는 화살촉 밑변까지 그림 / draw the stick shaft up to the arrowhead base
      T.setAttribute("points", tx + "," + ty + " " + (bx + Math.sin(ang) * half) + "," + (by - Math.cos(ang) * half) + " " + (bx - Math.sin(ang) * half) + "," + (by + Math.cos(ang) * half)); } // 끝을 뾰족한 화살촉(삼각형)으로 그려 정확한 지점을 가리킴(살짝 흔들며 가리킴) / draw the tip as a sharp arrowhead (triangle) to point precisely (with a slight wiggle)
    requestAnimationFrame(stickLoop);               // 다음 프레임임 / next frame
  })();
  function pointAt(x, y) {                          // 화면의 한 점(예: 산 그림 속 위험 지점)을 눈송이가 직접 가리킴 / Snowflake points directly at a screen point (e.g. a risk point on the mountain)
    const pt = $("pointer"), W = window.innerWidth, H = window.innerHeight; pt.hidden = false; $("stick").style.display = "block"; // 보이게 함 / make visible
    if (!$("pImg").getAttribute("src")) $("pImg").src = BR.local("guide"); // 안내 자세 이미지임 / guide pose image
    const gx = Math.min(W - 70, Math.max(265, x - 150)), gy = Math.min(H - 140, Math.max(60, y - 120)); pt.style.left = gx + "px"; pt.style.top = gy + "px"; pt.classList.toggle("flip", gx > x); aim = { x: x, y: y }; // 점의 왼쪽 위에 서서 지시봉을 댐 / stand at the upper left of the point and touch it with the stick
  }
  function hidePointer() { $("pointer").hidden = true; $("stick").style.display = "none"; } // 눈송이와 지시봉을 숨김 / hide Snowflake and the stick
  /* 눈송이 안내원: 말하는 중이면 메가폰 자세 + 말풍선에 같은 문장, 쉬면 안내 자세 */
  const mascot = { idle: "leaf", talk: "alert", tour: "cheer", think: "magic" }; // 상태별 자세임 / pose per state
  function pose(k) { const im = $("mImg"); const src = BR.local(mascot[k] || k); if (im.getAttribute("src") !== src) { im.src = src; im.onerror = function () { im.onerror = null; im.src = BR.files.guide; }; } } // 자세 이미지를 바꿈(실패하면 공식 주소) / change the pose image (official URL on failure)
  pose("idle");                                     // 처음 자세임 / initial pose
  // 음성 재생 막대: 지금 몇 번째 문장인지 보여 주고, 끌면 그 문장(또는 MP3 시간)으로 바로 이동함 / voice seek bar: shows the current sentence; dragging jumps to that sentence (or MP3 time)
  let seeking = false;                              // 사용자가 막대를 끄는 중인지임 / whether the user is dragging the bar
  $("vSeek").addEventListener("input", function () { seeking = true; const p = QP.Voice.progress(); $("vPos").textContent = p.mp3 ? Math.round(this.value / 10) + "%" : (Number(this.value) + 1) + "/" + p.n + " 문장"; }); // 끄는 동안 위치를 미리 보여 줌 / preview the position while dragging
  $("vSeek").addEventListener("change", function () { seeking = false; QP.Voice.seek(Number(this.value)); }); // 놓으면 그 위치로 이동함 / jump there on release
  setInterval(function () { if (seeking) return; const p = QP.Voice.progress(); $("vSeek").max = Math.max(0, p.n - (p.mp3 ? 0 : 1)); $("vSeek").value = p.i; $("vPos").textContent = p.n ? (p.mp3 ? Math.round(p.i / 10) + "%" : (p.i + 1) + "/" + p.n + " 문장") : "0/0"; }, 300); // 0.3초마다 막대를 갱신함 / update the bar every 0.3 s
  QP.Voice.onSubtitle(function (t) { $("sub").textContent = t || "▶ 또는 🔊를 누르면 목소리와 자막으로 설명해 드립니다."; spotlight(t); if (t) { $("mBub").textContent = t; $("mascot").classList.add("talk"); pose(tourOn ? "tour" : "talk"); } else { $("mascot").classList.remove("talk"); pose("idle"); } }); // 자막, 화면 가리킴, 눈송이 말풍선을 함께 맞춤 / sync subtitles, pointing and Snowflake's speech bubble
  QP.Voice.onStateChange(function (s) { $("vPlay").dataset.state = s; document.querySelector(".voicebar").classList.toggle("playing", s === "playing"); }); // 상태 표시임 / status display
  function quality() { const q = QP.Voice.quality(), g = QP.Voice.genders(); $("vQ").textContent = q.text + (Number($("vAlt").value) > 0 ? (g.f && g.m ? ", 남녀 신경망 음성 교대" : ", 남녀 교대(같은 음성 높낮이 변환, Edge에서 열면 진짜 남성 음성)") : ""); $("vQ").className = "vq q" + q.level; } // 음성 품질과 교대 가능 여부 표시임 / show voice quality and whether alternation is possible
  setInterval(function () { const sp = QP.Voice.speaker(); if (QP.Voice.isActive() && sp) $("vQ").textContent = "🎙 " + sp; }, 500); // 읽는 동안 지금 말하는 목소리를 보여 줌 / show the voice currently speaking
  function voices() { const list = QP.Voice.koreanVoices(), best = QP.Voice.bestVoice(); $("vVoice").innerHTML = list.length ? list.map(function (v) { return "<option" + (best && v.name === best.name ? " selected" : "") + ">" + v.name + "</option>"; }).join("") : "<option>한국어 음성 없음</option>"; quality(); } // 목소리 목록임 / voice list
  QP.Voice.onVoices = voices; voices();             // 목록을 채움 / fill the list
  document.addEventListener("pointerdown", function () { if (!interacted) { interacted = true; QP.Voice.wake(); } }, { once: false }); // 첫 클릭 때 오디오 장치를 깨움(브라우저 자동재생 정책) / wake the audio device on the first click (browser autoplay policy)

  /* ---------- 7. 전체 자동 안내(평가용 원클릭) / 7. Full automatic guide (one click for evaluation)  ---------- */
  // 단계 목록은 ViewDefs(메뉴)에서 자동으로 만들어지므로, 화면을 추가, 수정하면 안내도 저절로 갱신됨 / the step list is built automatically from ViewDefs (menu), so adding or editing screens updates the guide by itself
  function tourSteps() {
    const out = [];                                 // 단계 목록임 / step list
    groups.forEach(function (g) { QP.ViewDefs.filter(function (v) { return v.group === g; }).forEach(function (v) { // 메뉴 순서대로 / in menu order
      if (v.subs) v.subs.forEach(function (sname, k) { out.push({ hash: v.id + "-" + (k + 1), title: v.title + ", " + sname, id: v.id, sub: k + 1 }); }); // 하위 항목도 단계로 넣음 / sub-items become steps too
      else out.push({ hash: v.id, title: v.title, id: v.id }); // 화면 하나 = 단계 하나임 / one screen = one step
    }); });
    return out;                                     // 단계 목록을 돌려줌 / return the step list
  }
  const TB = { steps: [], i: 0, paused: false, timer: null }; // 안내 상태임 / guide state
  let userNav = true;                               // 화면 이동이 사용자 조작인지임 / whether navigation was a user action
  function tourDraw() {                             // 진행 막대를 그림(안내 중이 아니어도 항상 보이고 누를 수 있음) / draws the progress bar (always visible and clickable even when not guiding)
    if (!TB.steps.length) TB.steps = tourSteps();   // 단계 목록을 준비함 / prepare the step list
    $("tProg").innerHTML = TB.steps.map(function (st, k) { return '<i class="' + (tourOn && k < TB.i ? "done" : tourOn && k === TB.i ? "cur" : "") + '" data-k="' + k + '" title="' + (k + 1) + ". " + st.title + '"></i>'; }).join(""); // 단계마다 칸 하나임 / one cell per step
    $("tLabel").textContent = tourOn ? (TB.i + 1) + "/" + TB.steps.length + " " + TB.steps[TB.i].title : "칸을 누르면 그 단계부터 자동 안내(" + TB.steps.length + "단계)"; // 현재 단계 이름 또는 안내 문구임 / current step name or hint text
    $("tProg").querySelectorAll("i").forEach(function (c) { c.onclick = function () { QP.Voice.wake(); interacted = true; tourGo(Number(c.dataset.k)); }; }); // 칸을 누르면 언제든 그 단계로 이동함 / clicking a cell moves to that step anytime
    $("tPause").textContent = tourOn && !TB.paused ? "❚❚ 멈춤" : "▶ 재생"; // 멈춤, 재생 버튼 모양임 / pause and play button labels
  }
  function estimate(text) { return 6000 + 270 * text.length / QP.Voice.getRate(); } // 한 단계 예상 낭독 시간(감시용)임 / expected reading time of a step (watchdog)
  function tourGo(k) {                              // k번째 단계를 실행함 / runs step k
    QP.Voice.hush(false); clearTimeout(TB.timer); TB.i = (k + TB.steps.length) % TB.steps.length; TB.paused = false; TB.token = (TB.token || 0) + 1; const tok = TB.token; // 위치를 정함(이전 단계의 기다림은 무효화) / set the position (cancels waiting of the previous step)
    const st = TB.steps[TB.i]; State.touring = true; tourOn = true; // 안내 중 표시임 / mark as guiding
    const v = QP.ViewDefs.find(function (x) { return x.id === st.id; }); State.open[v.group] = true; State.secOpen[SECTIONS.findIndex(function (x) { return x[1].indexOf(v.group) >= 0; })] = true; // 메뉴 그룹을 자동으로 펼침 / expand the menu group automatically
    go(st.hash); tourDraw();                        // 화면을 열고 막대를 갱신함 / open the screen and update the bar
    setTimeout(function () {                        // 화면이 그려진 뒤 / after the screen is drawn
      if (tok !== TB.token) return;                 // 그 사이 다른 단계로 이동했으면 무시함 / ignore if moved to another step meanwhile
      const auto = $("view").querySelector("[data-autoplay]"); if (auto && !/멈춤|❚❚/.test(auto.textContent)) auto.click(); // 자동 시연 버튼이 있으면 눌러 움직이게 함 / click the auto-demo button if there is one
      const sc = QP.Narration.get(st.id), text = "단계 " + (TB.i + 1) + ". " + st.title + ". " + (st.sub ? QP.Narration.sub(st.id, st.sub) : sc.long); // 이 단계의 설명임 / explanation of this step
      if (State.dataId === "D002" && !st.sub && st.id !== "sim") QP.Voice.play("tour_" + st.id, text); else QP.Voice.speak(text, true, true); // 녹음이 있으면 사람 목소리 녹음으로 읽음 / read with a human-voice recording if available
      const deadline = Date.now() + estimate(text); // 감시 장치: 이 시간이 지나면 음성이 끊겨도 다음으로 감 / watchdog: move on after this time even if the voice stalls
      const wait = function () {                    // 다 읽었는지 확인함 / check whether reading is finished
        if (tok !== TB.token || !tourOn) return;    // 다른 단계로 옮겼거나 종료했으면 끝냄 / stop if moved to another step or ended
        if (TB.paused) { TB.timer = setTimeout(wait, 500); return; } // 멈춤 중이면 기다림(사용자가 멈춘 경우만 멈춤) / wait while paused (only when the user paused)
        if (QP.Voice.isActive() && Date.now() < deadline) { TB.timer = setTimeout(wait, 500); return; } // 아직 읽는 중이면 기다림 / wait while still reading
        TB.timer = setTimeout(function () { if (tok !== TB.token) return; if (TB.i < TB.steps.length - 1) tourGo(TB.i + 1); else if ($("tLoop").checked) tourGo(0); else tourEnd(true); }, 1500); // 다음 단계(마지막이면 반복 설정에 따라 처음으로)로 감 / go to the next step (at the end, to the start if looping)
      };
      TB.timer = setTimeout(wait, 1500);            // 기다리기 시작함 / start waiting
    }, 700);
  }
  function tourB() {                                // B. 에뮬레이팅 실험만 처음부터 안내함(소개를 먼저 말한 뒤 ③ 첫 화면부터) / guides part B only (introduction first, then from the first screen of ③)
    QP.Voice.wake(); interacted = true; TB.steps = tourSteps(); const k = TB.steps.findIndex(function (st) { const v = QP.ViewDefs.find(function (x) { return x.id === st.id; }); return v && v.group === groups[2]; }); if (k < 0) return;
    tourEnd(true, true); QP.Voice.hush(false); const W = "에뮬레이팅 실험 자동 안내를 시작합니다. 이 부분은 실제 실험을 하는 곳입니다. 먼저 요인을 결합한 합성 데이터를 만들고, 일반 인공지능과 양자 특징 인공지능을 같은 조건으로 학습시킨 뒤, 가상 산행에 배포해 위험 경보가 얼마나 일찍 울리는지 확인합니다. 이어서 사용자 피드백으로 다시 학습하고, 메타학습으로 사람마다 빠르게 맞추는 과정까지 차례로 보여 드립니다. 마지막에는 실측 데이터를 받기 위한 준비 화면을 안내합니다.";
    QP.Voice.speak(W, true, true); alert0("에뮬레이팅 실험 자동 안내: 소개 뒤 ③ 첫 화면부터 시작합니다."); const dl = Date.now() + estimate(W), t0 = Date.now(), wt = TB.token = (TB.token || 0) + 1;
    (function waitB() { if (TB.token !== wt) return; if ((QP.Voice.isActive() || Date.now() - t0 < 1500) && Date.now() < dl) { setTimeout(waitB, 400); return; } setTimeout(function () { if (TB.token === wt) tourGo(k); }, 600); })(); // 소개가 끝나면 B의 첫 단계로 / after the intro, go to the first step of B
  }
  function tour() { QP.Voice.wake(); interacted = true; TB.steps = tourSteps(); tourGo(tourOn ? TB.i : 0); } // 처음부터(또는 진행 중인 단계부터) 시작함 / start from the beginning (or the step in progress)
  function tourEnd(done, silent) { if (silent) { clearTimeout(TB.timer); TB.token = (TB.token || 0) + 1; tourOn = false; State.touring = false; QP.Voice.stop(); tourDraw(); return; } clearTimeout(TB.timer); TB.token = (TB.token || 0) + 1; tourOn = false; State.touring = false; QP.Voice.stop(); if (!done) { QP.Voice.hush(true); hidePointer(); alert0("전체 안내를 종료했습니다. 다른 화면을 고르시거나 설명 듣기를 누르면 다시 말합니다."); } tourDraw(); if (done) QP.Voice.speak("전체 자동 안내를 마쳤습니다. 들어 주셔서 감사합니다. 숙명여자대학교 에이지아이 연구실이었습니다.", true, true); } // 끝냄(막대는 계속 보임) / end (the bar stays visible)
  $("tourBtn").onclick = tour;                      // 왼쪽 위 원클릭 버튼임 / one-click button at the top left
  $("tPrev").onclick = function () { QP.Voice.wake(); tourGo(TB.i - 1); }; $("tNext").onclick = function () { QP.Voice.wake(); tourGo(TB.i + 1); }; // 이전, 다음임 / previous and next
  $("tPause").onclick = function () { if (!tourOn) { tour(); return; } if (TB.paused) { TB.paused = false; QP.Voice.resume(); if (!QP.Voice.isActive()) tourGo(TB.i); tourDraw(); } else { TB.paused = true; QP.Voice.pause(); tourDraw(); } }; // 멈춤과 이어 듣기(안내 중이 아니면 시작)임 / pause and resume (start if not guiding)
  $("tEnd").onclick = function () { tourEnd(false); }; // 종료(이 버튼을 눌러야만 멈춤)임 / end (only this button stops it)
  document.addEventListener("visibilitychange", function () { // 창을 내리거나 다른 탭으로 가면 소리를 끄고 안내를 멈춤(돌아오면 재생 버튼으로 이어 듣기) / minimizing the window or switching tabs silences the voice and pauses the guide (resume with play)
    if (document.hidden) { QP.Voice.hush(true); if (tourOn) { TB.paused = true; tourDraw(); } } else { QP.Voice.hush(false); }
  });
  if (/^https?:$/.test(location.protocol) && location.port) { let miss = 0; const hb = setInterval(function () { fetch("data/narration_ko.json", { method: "HEAD", cache: "no-store" }).then(function () { miss = 0; }).catch(function () { if (++miss >= 2) { clearInterval(hb); tourOn && tourEnd(false); QP.Voice.shutdown(); QP.Anim.stopAll && QP.Anim.stopAll(); alert0("실행 창(run)이 종료되어 실험실을 멈췄습니다. 다시 쓰려면 run을 실행하시기 바랍니다."); document.body.classList.add("srv-off"); } }); }, 4000); } // 로컬 서버로 연 경우: 실행 창을 닫으면 페이지의 소리와 안내도 완전히 멈춤 / when served locally: closing the run window stops the page's voice and guide completely
  TB.steps = tourSteps(); $("tourBar").hidden = false; tourDraw(); // 진행 막대를 처음부터 항상 보이고 누를 수 있게 함 / keep the progress bar always visible and clickable from the start
  /* 생성 데이터 자동 보관 / auto-save generated data to data_store when running with run.bat (server) */
  if (/^https?:$/.test(location.protocol) && location.port) fetch("api/datasets", { cache: "no-store" }).then(function (r) { if (r.ok) { State.autoStore = State.autoStore !== false; State.storeOK = true; State.storedIds = State.storedIds || {}; QP.Datasets.list.forEach(function (d) { State.storedIds[d.id] = true; }); } }).catch(function () { }); // 서버가 있으면 자동 저장을 켬 / enable when server exists
  QP.Datasets.onChange(function () { if (!State.autoStore || !State.storeOK) return; State.storedIds = State.storedIds || {}; QP.Datasets.list.forEach(function (d) { if (State.storedIds[d.id] || !State.bootIds || State.bootIds.indexOf(d.id) >= 0 || d.kind === "stream" || d.kind === "csv" || !d.stats || !d.stats.n) return; State.storedIds[d.id] = true; post("api/save-dataset", { id: d.id, name: d.name, kind: d.kind, grade: d.grade, checks: d.checks, refs: d.refs, params: d.params, factors: d.factors || null, csv: QP.Datasets.toCSV(d.id) }).catch(function () { State.storedIds[d.id] = false; }); }); }); // 새 데이터가 생기면 보관함에 저장 / save new datasets
  /* ---------- 8. 파일, 서버 / 8. Files and server  ---------- */
  function download(name, text) {                   // 파일 내려받기임 / file download
    if (window.claude && window.claude.use) { window.claude.use("downloads").then(function (d) { if (d) d.save({ filename: name, data: text }); }); return; } // claude.ai 게시판에서는 플랫폼 저장 기능을 씀 / on claude.ai pages use the platform save feature
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: /\.json$/i.test(name) ? "application/json" : "text/csv" })); a.download = name; a.click(); // 일반 내려받기임 / normal download
  }
  function post(url, body) { return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); } // 서버에 JSON을 보냄 / send JSON to the server
  function saveServer(d) { post("api/save-dataset", { id: d.id, name: d.name, kind: d.kind, grade: d.grade, checks: d.checks, refs: d.refs, params: d.params, csv: QP.Datasets.toCSV(d.id) }).then(function (r) { alert0("저장됨: " + r.path); }).catch(function () { alert0("서버 저장은 run.bat으로 연 화면에서만 됨(지금은 CSV 내보내기를 쓰시기 바랍니다)."); }); } // 데이터셋을 PC 폴더에 저장함 / save a dataset to a PC folder
  function logRequest(req) { req.at = new Date().toISOString(); State.requests = (State.requests || []).concat([req]); post("api/request", req).catch(function () { }); } // 생성 요청을 서버에 기록함(서버 없으면 화면에만) / log generation requests on the server (on screen only without a server)
  function alert0(t) { const m = $("toast"); m.textContent = t; m.classList.add("on"); setTimeout(function () { m.classList.remove("on"); }, 3500); } // 짧은 알림 띠임 / short toast

  /* ---------- 8-2. 실시간 관제 미니 띠(모든 화면 위쪽에서 항상 움직임) / 8-2. Live control mini band (always moving on every screen)  ---------- */
  let live = null, li = 0;                          // 배경 산행과 위치임 / background hike and position
  function liveTick() {                             // 배경 산행을 한 걸음씩 진행하며 그림 / advances the background hike step by step and draws it
    if (!State.results) return;                     // 학습 전이면 건너뜀 / skip before training
    if (!live || li >= live.steps.length) { const G = QP.Mountain, k = Math.floor(Math.random() * 16); live = G.score(G.simulate(G.makeCourse(k, 1000 + Math.floor(Math.random() * 999)), G.personas[k % 3], G.weathers[1 + k % 4]), State.results); li = 0; } // 산행이 끝나면 다른 산으로 새로 시작함 / start a new mountain when the hike ends
    li += 2; const st = live.steps, n = st.length, i = Math.min(n - 1, li), s0 = st[i]; // 진행과 현재 상태임 / progress and current state
    const cv = $("liveCv"), P = QP.Charts.prep(cv, 40), g = P.g; // 작은 캔버스임 / small canvas
    const lo = Math.max(0, i - 160); g.strokeStyle = "#4d6b8c"; g.lineWidth = 1.4; g.beginPath(); for (let t = lo; t <= i; t++) { const x = (t - lo) / 160 * P.w, y = 38 - st[t].lin * 36; if (t === lo) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); // 일반 AI 점수 흐름임 / classical AI score trace
    g.strokeStyle = "#6e4c82"; g.lineWidth = 1.8; g.beginPath(); for (let t = lo; t <= i; t++) { const x = (t - lo) / 160 * P.w, y = 38 - st[t].qf * 36; if (t === lo) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); // 양자 특징 AI 점수 흐름임 / quantum-feature AI score trace
    const al = s0.qf >= live.thrQ, risk = s0.truth; // 경보와 실제 위험임 / alarm and actual risk
    const mc = $("liveMtn"), M2 = QP.Charts.prep(mc, 58), h = M2.g, c = live.course; // 산 단면 미니 그림임 / mini mountain profile
    const X = function (d) { return 4 + d / c.L * (M2.w - 8); }, Y = function (e) { return 55 - (e - c.start) / Math.max(1, c.summit - c.start) * 50; }; // 거리, 고도 → 좌표임(높이를 꽉 채워 경사가 잘 보이게) / distance, altitude → coordinates (fills the height so slopes show clearly)
    h.fillStyle = "#9db3dd"; h.beginPath(); h.moveTo(X(0), 58); for (let k = 0; k <= c.n; k++) h.lineTo(X(k / c.n * c.L), Y(c.elev[k])); h.lineTo(X(c.L), 58); h.fill(); // 산 단면을 칠함 / fill the mountain profile
    h.strokeStyle = "#c62828"; h.lineWidth = 3; for (let k = 0; k < c.n; k++) if (c.grades[k] > .34) { h.beginPath(); h.moveTo(X(k / c.n * c.L), Y(c.elev[k])); h.lineTo(X((k + 1) / c.n * c.L), Y(c.elev[k + 1])); h.stroke(); } // 급경사(34% 이상)를 굵은 빨강으로 표시함 / mark steep sections (34% or more) in thick red
    h.fillStyle = "#c62828"; h.font = "bold 9.5px Times New Roman, Batang, BatangChe, AppleMyungjo, Noto Serif KR, serif"; h.fillText("━ 급경사", M2.w - 52, 10); // 범례임 / legend
    c.pois.forEach(function (q) { if (q.type === "stamp") return; h.fillStyle = "#c76b67"; h.fillRect(X(q.x) - 1.5, Y(QP.Mountain.elevAt(c, q.x)) - 5, 3, 3); }); // 위험 지점을 빨간 점으로 표시함 / mark risk points with red dots
    h.fillStyle = risk ? "#c62828" : al ? "#6e4c82" : "#ffb500"; h.beginPath(); h.arc(X(s0.x), Y(s0.elev) - 2, 4, 0, 7); h.fill(); h.strokeStyle = "#003087"; h.stroke(); // 산행자 위치(위험이면 빨강, 경보면 자두)임 / hiker position (red if risk, plum if alarm)
    h.fillStyle = "#003087"; h.font = "bold 10px Times New Roman, Batang, BatangChe, AppleMyungjo, Noto Serif KR, serif"; h.fillText(s0.up ? "↗" : "↘", X(s0.x) + 6, Y(s0.elev) - 4); // 오르막, 내리막 방향임 / uphill or downhill direction
    $("liveTag").innerHTML = "<b>" + live.course.name + " " + live.course.peak + "</b> 고도 " + Math.round(s0.elev) + "m, 경사 " + Math.round(s0.grade * 100) + "%, <b>심박 " + Math.round(s0.hr) + " bpm</b>(%HRR " + Math.round(s0.pHRR * 100) + "), 기온 " + s0.T.toFixed(1) + "°C, 비 " + s0.rain.toFixed(1) + " mm/h | <span class='c-dusk'>일반 " + Math.round(s0.lin * 100) + "%</span> <span class='c-plum'>양자 " + Math.round(s0.qf * 100) + "%</span> " + (risk ? "<b class='c-rose'>⚠ 위험 구간</b>" : al ? "<b class='c-plum'>⚠ 양자 경보</b>" : "정상"); // 상태 글자(크게, 자세히)임 / status text (large and detailed)
    $("live").className = "live" + (risk ? " risk" : al ? " warn" : ""); // 위험이면 깜빡임 / flash if risky
  }
  setInterval(liveTick, 260);                       // 0.12초마다 갱신함 / update every 0.12 s

  /* ---------- 9. 설정: 자동 해설, 시험관 모드, 계절 장식 / 9. Settings: auto narration, examiner mode, seasonal decor  ---------- */
  $("examiner").onchange = function (e) { State.examiner = e.target.checked; show(location.hash.slice(1)); }; // 시험관 모드면 근거를 모두 펼침 / examiner mode opens all evidence
  State.animSpeed = .5; $("animSel").onchange = function (e) { State.animSpeed = Number(e.target.value); }; // 애니메이션 속도(기본 느리게)임 / animation speed (default slow)
  $("decoSel").onchange = function (e) { QP.Decor.season(Number(e.target.value)); }; // 장식 바꾸기임 / change decoration
  QP.Decor = (function () {                         // 계절 장식 입자(벚꽃, 비, 낙엽, 눈)임 / seasonal particles (cherry blossom, rain, leaves, snow)
    const cv = $("decor"), g = cv.getContext("2d"); let kind = 2, parts = []; // 캔버스와 입자임 / canvas and particles
    const make = function () { parts = Array.from({ length: 26 }, function () { return { x: Math.random(), y: Math.random(), s: .4 + Math.random() * .8, r: Math.random() * 6 }; }); }; make(); // 입자를 만듦 / create particles
    function frame(now) {                           // 한 프레임 그리기임 / draw one frame
      cv.width = cv.clientWidth; cv.height = cv.clientHeight; g.clearRect(0, 0, cv.width, cv.height); // 크기 맞추고 지움 / resize and clear
      if (kind >= 0) parts.forEach(function (p) {  // 입자마다 / for each particle
        p.y += .0004 * p.s * (kind === 1 ? 3 : 1); p.x += Math.sin(now / 1500 + p.r) * .0004; if (p.y > 1.02) { p.y = -.03; p.x = Math.random(); } // 떨어지고 흔들림 / fall and sway
        const x = p.x * cv.width, y = p.y * cv.height; g.save(); g.translate(x, y); g.rotate(now / 2600 * p.s + p.r); // 위치와 회전임 / position and rotation
        if (kind === 0) { g.fillStyle = "rgba(247,190,205,.8)"; g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, 7); g.fill(); } // 벚꽃잎임 / cherry petal
        else if (kind === 1) { g.strokeStyle = "rgba(120,150,200,.5)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke(); } // 빗줄기임 / rain streak
        else if (kind === 2) { g.fillStyle = ["rgba(200,114,46,.8)", "rgba(169,72,42,.75)", "rgba(222,170,60,.8)"][Math.floor(p.r) % 3]; g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(6, 0, 0, 6); g.quadraticCurveTo(-6, 0, 0, -6); g.fill(); } // 낙엽임 / leaf
        else { g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(0, 0, 2.4, 0, 7); g.fill(); g.strokeStyle = "rgba(160,190,230,.6)"; g.stroke(); } // 눈임 / snow
        g.restore();                                // 설정 복원임 / restore settings
      });
      requestAnimationFrame(frame);                 // 다음 프레임임 / next frame
    }
    requestAnimationFrame(frame);                   // 시작함 / start
    return { season: function (k) { kind = k; $("decoSel").value = k; document.body.dataset.theme = ["spring", "rain", "autumn", "winter"][k] || "base"; } }; // 계절 바꾸기: 입자와 함께 화면 전체 색 분위기(data-theme)를 바꿈 / change season: changes the whole screen color mood (data-theme) along with the particles
  })();
  QP.Decor.season(State.season);                    // 처음 장식(가을 낙엽)임 / initial decoration (autumn leaves)

  QP.App = { pointAt: pointAt, go: go, readLong: readLong, readShort: readShort, tour: tour, download: download, saveServer: saveServer, logRequest: logRequest, toast: alert0 }; // 공개함 / make public
  setTimeout(boot, 40);                             // 준비 화면을 그린 뒤 시작함 / start after drawing the loading screen
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
