/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* =====================================================================
 * voice.js : 음성 안내(TTS) + 자막 관리자
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 설명을 글과 목소리로 동시에, 친절하게 전달하기 위함임.
 * 검증된 방법 :
 *  1순위  미리 녹음한 MP3 (tools/make_voice.py, Microsoft Azure Neural
 *         음성 ko-KR-SunHiNeural 사용) → web/audio/<화면id>_<short|long>.mp3
 *  2순위  W3C Web Speech API(speechSynthesis) — 브라우저 표준 기능임.
 *         Edge의 "Microsoft SunHi/InJoon Online (Natural)" 신경망 음성,
 *         Chrome의 "Google 한국의" 음성을 우선 선택함.
 * 하는 일 : 문장 단위로 끊어 읽고, 지금 읽는 문장을 자막 줄에 표시함.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 음성 기능을 붙임
  "use strict";                                     // 엄격 모드를 켬
  const synth = window.speechSynthesis;             // 브라우저 표준 음성 합성기임(없을 수도 있음)
  const prefer = [/Natural/i, /Online/i, /Google/i, /SunHi/i, /InJoon/i, /Heami/i, /Yuna/i]; // 품질 좋은 음성 이름 우선순위임
  let queue = [], idx = 0, active = false, audio = null, rate = 1, chosen = null, onSub = null, onState = null, timer = null; // 재생 상태 변수들임

  function koreanVoices() {                         // 이 컴퓨터에 있는 한국어 음성 목록을 구함
    if (!synth) return [];                          // 음성 기능이 없는 브라우저면 빈 목록임
    return synth.getVoices().filter(function (v) { return /^ko/i.test(v.lang); }); // 언어 코드가 ko로 시작하는 것만 고름
  }
  function bestVoice() {                            // 가장 자연스러운 한국어 음성을 고름
    const list = koreanVoices();                    // 한국어 음성 목록임
    if (chosen) { const c = list.find(function (v) { return v.name === chosen; }); if (c) return c; } // 사용자가 고른 음성이 있으면 그것을 씀
    for (let k = 0; k < prefer.length; k++) {       // 우선순위 순서로 찾음
      const v = list.find(function (x) { return prefer[k].test(x.name); }); // 이름이 규칙에 맞는 음성을 찾음
      if (v) return v;                              // 찾으면 바로 돌려줌
    }
    return list[0] || null;                         // 없으면 첫 한국어 음성, 그것도 없으면 null임
  }
  function split(text) {                            // 긴 글을 문장 단위로 자름(자막과 끊김 방지용)
    return text.replace(/\s+/g, " ").split(/(?<=[.?!요다])\s+/).filter(function (s) { return s.trim().length; }); // 마침표, 물음표, ~요/~다 뒤에서 자름
  }
  function setSub(t) { if (onSub) onSub(t); }       // 자막 표시 함수(앱이 등록)를 호출함
  function setState(s) { if (onState) onState(s); } // 재생 상태(재생/정지)를 앱에 알림

  function stop() {                                 // 모든 음성을 멈춤
    active = false; queue = []; idx = 0;            // 대기열과 상태를 비움
    clearTimeout(timer);                            // 자막 넘김 타이머를 멈춤
    if (audio) { audio.pause(); audio = null; }     // MP3 재생 중이면 멈춤
    if (synth) synth.cancel();                      // 합성 음성도 취소함
    setSub("");                                     // 자막 줄을 기본 안내로 되돌림
    setState("stopped");                            // 정지 상태를 알림
  }
  function next() {                                 // 대기열의 다음 문장을 읽음
    if (!active || idx >= queue.length) { active = false; setState("done"); setSub(""); return; } // 다 읽었으면 끝냄
    const sentence = queue[idx++];                  // 다음 문장을 꺼냄
    setSub(sentence);                               // 자막 줄에 표시함
    const v = bestVoice();                          // 읽을 목소리를 고름
    if (!v || !window.SpeechSynthesisUtterance) {   // 음성이 없으면 자막만 시간에 맞춰 넘김
      timer = setTimeout(next, 260 * sentence.length / rate); // 글자 수에 비례해 잠시 기다림
      return;                                       // 음성 없이 진행함
    }
    const u = new SpeechSynthesisUtterance(sentence); // 한 문장짜리 음성 요청을 만듦
    u.voice = v; u.lang = v.lang; u.rate = .95 * rate; u.pitch = 1.02; // 목소리, 언어, 속도, 높이를 정함(살짝 느리고 밝게)
    u.onend = next;                                 // 다 읽으면 다음 문장으로 넘어감
    u.onerror = function () { timer = setTimeout(next, 200); }; // 오류가 나도 멈추지 않고 넘어감
    synth.speak(u);                                 // 읽기를 시작함
  }
  function speakTTS(text) {                         // 브라우저 TTS로 읽음
    stop();                                         // 이전 음성을 먼저 멈춤
    queue = split(text); idx = 0; active = true;    // 문장 대기열을 만들고 재생 상태로 바꿈
    setState("playing");                            // 재생 상태를 알림
    next();                                         // 첫 문장부터 읽기 시작함
  }
  // id의 MP3가 있으면 MP3로, 없으면 TTS로 읽음
  function play(id, text) {
    stop();                                         // 이전 음성을 멈춤
    const a = new Audio("audio/" + id + ".mp3");    // 미리 녹음한 파일을 열어 봄
    a.playbackRate = rate;                          // 재생 속도를 맞춤
    let started = false;                            // 실제 재생이 시작됐는지 기록함
    a.onerror = function () { if (!started) speakTTS(text); }; // 파일이 없으면 TTS로 대신 읽음
    a.onplaying = function () {                     // MP3 재생이 시작되면
      started = true; active = true; setState("playing"); // 상태를 바꿈
      const sents = split(text), total = text.length; let acc = 0; // 자막 시간 배분을 준비함
      const dur = (a.duration || total / 7) * 1000; // 파일 길이(초)를 밀리초로 바꿈
      sents.forEach(function (s) {                  // 문장마다 표시 시각을 예약함
        const at = dur * acc / total / rate; acc += s.length; // 글자 수 비율로 시작 시각을 정함
        setTimeout(function () { if (audio === a) setSub(s); }, at); // 그 시각에 자막을 바꿈
      });
    };
    a.onended = function () { active = false; setSub(""); setState("done"); }; // 끝나면 정리함
    audio = a;                                      // 현재 재생 중인 파일로 기록함
    a.play().catch(function () { if (!started) speakTTS(text); }); // 자동 재생이 막히면 TTS로 대신함
  }
  function pause() {                                // 일시정지함
    if (audio) audio.pause();                       // MP3를 멈춤
    if (synth) synth.pause();                       // TTS를 멈춤
    setState("paused");                             // 상태를 알림
  }
  function resume() {                               // 이어서 재생함
    if (audio) audio.play();                        // MP3를 이어감
    if (synth) synth.resume();                      // TTS를 이어감
    setState("playing");                            // 상태를 알림
  }

  if (synth) synth.onvoiceschanged = function () { if (QP.Voice.onVoices) QP.Voice.onVoices(); }; // 음성 목록이 늦게 오면 앱에 알림

  QP.Voice = {                                      // 다른 파일에서 쓸 기능을 공개함
    play: play, speak: speakTTS, stop: stop, pause: pause, resume: resume, koreanVoices: koreanVoices, bestVoice: bestVoice,
    setRate: function (r) { rate = r; if (audio) audio.playbackRate = r; }, // 속도를 바꿈
    setVoice: function (name) { chosen = name; },   // 사용자가 고른 음성 이름을 저장함
    onSubtitle: function (f) { onSub = f; },        // 자막 표시 함수를 등록함
    onStateChange: function (f) { onState = f; },   // 상태 표시 함수를 등록함
    isActive: function () { return active; },       // 지금 읽는 중인지 알려 줌
    onVoices: null                                  // 음성 목록 변경 알림 함수 자리임
  };
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김
