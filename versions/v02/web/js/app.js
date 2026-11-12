/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* =====================================================================
 * app.js : 프로그램 시작점 — 메뉴, 화면 전환, 음성 막대 연결
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 왼쪽 메뉴를 누르면 오른쪽 한 화면만 바꿔 그리고,
 *            어느 화면에서든 같은 음성 막대로 설명을 듣게 하기 위함임.
 * 하는 일   : (1) 기본 비교 실험을 한 번 실행 (2) 메뉴 생성
 *            (3) 주소의 #화면id로 화면 이동 (4) 음성 버튼, 자막 연결
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 앱 기능을 붙임
  "use strict";                                     // 엄격 모드를 켬
  const $ = function (id) { return document.getElementById(id); }; // id로 요소를 찾는 짧은 함수임
  const State = QP.State = QP.State || {};          // 화면들이 함께 쓰는 상태임
  State.results = QP.Models.experiment();           // 페이지를 열면 같은 합성 데이터로 세 방식을 학습, 시험함
  State.dataName = "기본 합성";                     // 현재 데이터 이름임
  let current = null, cleanup = null;               // 현재 화면과, 떠날 때 실행할 정리 함수임

  /* ---------- 1. 메뉴 만들기 ---------- */
  const menu = $("menu");                           // 메뉴 자리를 찾음
  let lastGroup = "";                               // 직전 그룹 이름임
  QP.Views.forEach(function (v) {                   // 화면마다 메뉴 항목을 만듦
    if (v.group !== lastGroup) {                    // 그룹이 바뀌면
      const h = document.createElement("h4"); h.textContent = v.group; menu.appendChild(h); lastGroup = v.group; // 그룹 이름을 씀
    }
    const a = document.createElement("a");          // 메뉴 링크를 만듦
    a.href = "#" + v.id; a.dataset.id = v.id;       // 주소 끝을 #화면id로 정함(뒤로가기 지원)
    a.innerHTML = '<i style="background:' + v.color + '"></i>' + v.title; // 색 점과 제목을 넣음
    menu.appendChild(a);                            // 메뉴에 추가함
  });

  /* ---------- 2. 화면 전환 ---------- */
  function show(id) {                               // 화면 id로 오른쪽을 다시 그림
    const v = QP.Views.find(function (x) { return x.id === id; }) || QP.Views[0]; // 없는 id면 첫 화면을 씀
    if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; } // 이전 화면의 타이머 등을 정리함
    QP.Voice.stop();                                // 이전 화면의 음성을 멈춤
    current = v;                                    // 현재 화면으로 기록함
    $("viewGroup").textContent = v.group;           // 그룹 이름을 씀
    $("viewTitle").textContent = v.title;           // 제목을 씀
    document.querySelectorAll("#menu a").forEach(function (a) { a.classList.toggle("cur", a.dataset.id === v.id); }); // 현재 메뉴를 강조함
    const el = $("view");                           // 내용 자리임
    el.innerHTML = ""; el.scrollTop = 0;            // 비우고 맨 위로 올림
    cleanup = v.render(el) || null;                 // 화면을 그리고 정리 함수를 받아 둠
    document.title = v.title + ", 산행안전 양자 실험실 v02"; // 탭 제목을 바꿈
    if ($("autoVoice").checked) readShort();        // 자동 안내를 켰으면 짧은 안내를 읽음
  }
  function route() { show((location.hash || "#home").slice(1)); } // 주소의 #뒤를 읽어 화면을 고름
  window.addEventListener("hashchange", route);     // 메뉴를 누르거나 뒤로가기하면 화면을 바꿈

  /* ---------- 3. 음성 ---------- */
  function script() { return QP.Narration.get(current.id, State.results); } // 현재 화면의 대본을 얻음
  function canUseMp3() { return State.dataName === "기본 합성"; } // 녹음 파일의 숫자는 기본 데이터 기준이므로 그때만 MP3를 씀
  function readShort() {                            // 짧은 안내를 읽음
    const t = current.id === "sim" && State.simNarr ? State.simNarr : script().short; // 시뮬레이션 화면은 현재 단계 설명을 읽음
    if (canUseMp3() && current.id !== "sim") QP.Voice.play(current.id + "_short", t); else QP.Voice.speak(t); // 녹음이 있으면 녹음으로, 없으면 TTS로 읽음
  }
  function readLong() {                             // 긴 설명을 읽음
    const t = script().long;                        // 긴 대본임
    if (canUseMp3()) QP.Voice.play(current.id + "_long", t); else QP.Voice.speak(t); // 같은 원칙으로 읽음
  }
  $("btnShort").onclick = readShort;                // 짧은 안내 버튼임
  $("btnLong").onclick = readLong;                  // 긴 설명 버튼임
  $("vPlay").onclick = function () { if ($("vPlay").dataset.state === "paused") QP.Voice.resume(); else readLong(); }; // 멈춘 상태면 이어서, 아니면 긴 설명을 처음부터 읽음
  $("vPause").onclick = QP.Voice.pause;             // 일시정지 버튼임
  $("vStop").onclick = QP.Voice.stop;               // 정지 버튼임
  $("vRate").onchange = function (e) { QP.Voice.setRate(Number(e.target.value)); }; // 속도를 바꿈
  $("vVoice").onchange = function (e) { QP.Voice.setVoice(e.target.value); }; // 목소리를 바꿈
  QP.Voice.onSubtitle(function (t) { $("sub").textContent = t || "▶를 누르면 이 화면을 목소리와 자막으로 설명해 드려요."; }); // 자막 줄에 현재 문장을 표시함
  QP.Voice.onStateChange(function (s) {             // 재생 상태가 바뀌면
    $("vPlay").dataset.state = s;                   // 재생 버튼에 상태를 기록함
    document.querySelector(".voicebar").classList.toggle("playing", s === "playing"); // 읽는 중에는 자막을 강조함
  });
  function fillVoices() {                           // 한국어 목소리 목록을 채움
    const list = QP.Voice.koreanVoices(), best = QP.Voice.bestVoice(); // 목록과 추천 목소리임
    $("vVoice").innerHTML = list.length ? list.map(function (v) { return '<option' + (best && v.name === best.name ? " selected" : "") + '>' + v.name + '</option>'; }).join("") : "<option>한국어 음성 없음(자막만)</option>"; // 선택 상자를 채움
  }
  QP.Voice.onVoices = fillVoices;                   // 목록이 늦게 와도 다시 채움
  fillVoices();                                     // 처음에 한 번 채움

  QP.App = { go: function (id) { location.hash = id; }, readLong: readLong, readShort: readShort }; // 다른 파일에서 쓸 기능을 공개함
  route();                                          // 첫 화면을 그림
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김
