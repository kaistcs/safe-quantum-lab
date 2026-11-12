/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Voice guide (TTS) and subtitles: voice choice, male/female alternation, speed, seek, repeat suppression, stop on close. */
/* =====================================================================
 * voice.js : 음성 안내(TTS) + 자막 관리자 (v03 개선판)
 * ---------------------------------------------------------------------
 * 개선 1) 첫 음절이 잘리는 문제
 *   원인: 스피커(특히 블루투스, 노트북 절전 오디오)가 말이 시작될 때에야
 *         깨어나서 앞 0.2~0.5초가 잘림.
 *   해결: (a) 안내를 켜면 Web Audio로 들리지 않는 아주 작은 소리를 계속
 *         흘려 오디오 장치를 깨어 있게 함(keep-alive)
 *         (b) 첫 문장 앞에 짧은 쉼(250ms)을 두고 시작함
 * 개선 2) 목소리 품질
 *   - Microsoft Edge의 "Microsoft SunHi/InJoon/Hyunsu Online (Natural)"
 *     신경망 음성을 최우선으로 고름(Edge에서 열면 자동). 다음 Google 한국의.
 *   - 품질 등급을 화면에 표시하고, 낮으면 Edge 사용을 안내함.
 *   - tools/make_voice.py 로 만든 MP3(Azure 신경망 음성)가 있으면 그것을 씀.
 * 개선 3) 속도: 기본 보통(1배), 화면에서 조절 가능.
 * 개선 5) 남녀 교대: 남성 신경망 음성(InJoon, Hyunsu)이 있으면 그 음성으로 교대함.
 *   크롬, 클로드 앱처럼 한국어 음성이 여성(Heami) 하나뿐인 환경에서도 교대가 들리도록
 *   같은 음성의 높이를 크게 낮춘(0.55) '저음 남성 목소리'로 바꿔 읽음(실측: 이 PC의 크롬 계열은 Heami 1개뿐).
 * 개선 4) 사건 알림: 중요한 경보는 읽던 문장을 끊고 먼저 읽음(priority).
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 음성 기능을 붙임 / attaches voice functions to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const synth = window.speechSynthesis;             // 브라우저 표준 음성 합성기임 / browser standard speech synthesizer
  const prefer = [/SunHi.*Natural/i, /InJoon.*Natural/i, /Hyunsu.*Natural/i, /Aria.*Natural/i, /Jenny.*Natural/i, /Guy.*Natural/i, /Natural/i, /Online/i, /Google/i, /Yuna/i, /Heami/i, /Zira/i]; // 좋은 목소리 우선순위임 / preferred voice order
  let gen = 0; const DONE = { done: true }; // 설명 표식: 세대 번호(멈출 때마다 증가) / narration marks: generation number
  let paused = false, cur = null, queue = [], idx = 0, active = false, audio = null, rate = 1, chosen = null, alt = 4, pitch = 1.03, log = [], hushed = false, spoken = 0, speaker = "", onSub = null, onState = null, timer = null, ctx = null, keep = null; // 상태 변수임 / state variables

  function wake() {                                 // 오디오 장치를 깨워 두는 keep-alive를 시작함 / starts a keep-alive that keeps the audio device awake
    try {                                           // 지원하지 않는 환경에서도 멈추지 않게 함 / does not stop even in unsupported environments
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); // 오디오 엔진을 만듦 / create the audio engine
      if (ctx.state === "suspended") ctx.resume();  // 멈춰 있으면 깨움 / wake it if suspended
      if (keep) return;                             // 이미 돌고 있으면 그대로 둠 / leave it if already running
      const osc = ctx.createOscillator(), g = ctx.createGain(); // 소리 발생기와 볼륨 조절기임 / tone generator and volume control
      osc.frequency.value = 30; g.gain.value = .0006; // 들리지 않는 낮은 주파수, 아주 작은 볼륨임 / inaudible low frequency, very low volume
      osc.connect(g).connect(ctx.destination); osc.start(); keep = osc; // 스피커로 계속 흘려보냄 / keep streaming to the speaker
    } catch (e) { }                                 // 실패해도 음성은 계속 진행함 / voice continues even on failure
  }
  function koreanVoices() { const en = QP.I18N && QP.I18N.lang() === "en"; return synth ? synth.getVoices().filter(function (v) { return en ? /^en/i.test(v.lang) : /^ko/i.test(v.lang); }) : []; } // 현재 언어(한국어 또는 영어)의 음성 목록임 / voices for the current language
  const MALE = /InJoon|Hyunsu|BongJin|GookMin|Guy|Christopher|Eric|Andrew|Brian|Davis|Roger|Steffan|David|Mark|Daniel|Male|남/i, FEMALE = /SunHi|Heami|JiMin|SeoHyeon|SoonBok|YuJin|Yuna|Aria|Jenny|Michelle|Ana|Emma|Ava|Zira|Hazel|Susan|Samantha|Google|Female|여/i; // 이름으로 남녀 음성 구분(한국어, 영어) / gender by voice name (Korean, English) // 이름으로 남성, 여성 음성을 구분하는 규칙임 / rule telling male and female voices apart by name
  function genderVoice(male) {                      // 원하는 성별의 가장 좋은 음성을 고름(없으면 null) / picks the best voice of the wanted gender (null if none)
    const list = koreanVoices().filter(function (v) { return male ? MALE.test(v.name) : (FEMALE.test(v.name) && !MALE.test(v.name)); }); // 성별에 맞는 목록임 / list matching the gender
    for (let k = 0; k < prefer.length; k++) { const v = list.find(function (x) { return prefer[k].test(x.name); }); if (v) return v; } // 품질 우선순위대로 고름 / pick by quality preference
    return list[0] || null;                         // 없으면 null임 / null if none
  }
  function pickVoice() {                            // 이번 문장을 읽을 목소리임(남녀 교대 설정 반영) / voice for this sentence (reflects male/female alternation)
    if (alt > 0 && !chosen) {                       // 교대가 켜져 있고 사용자가 목소리를 고정하지 않았으면 / if alternation is on and the user has not fixed a voice
      const f = genderVoice(false), m = genderVoice(true); // 여성, 남성 음성임 / female and male voices
      const male = Math.floor(spoken / alt) % 2 === 1; // 이번 문장이 남성 차례인지임(문장 alt개마다 바뀜) / whether this sentence is the male turn (switches every alt sentences)
      if (f && m) { const v = male ? m : f; pitch = 1.03; speaker = (male ? "남성 " : "여성 ") + short(v.name); return v; } // 진짜 남성, 여성 음성이 모두 있으면 그대로 교대함 / alternate as is if real male and female voices both exist
      const one = f || m || bestVoice();            // 한쪽 성별만 있으면 그 음성 하나로 / if only one gender exists, use that one voice
      if (one) { pitch = f ? (male ? .55 : 1.08) : (male ? .95 : 1.45); speaker = (male ? (f ? "남성(저음 변환) " : "남성 ") : (f ? "여성 " : "여성(고음 변환) ")) + short(one.name); return one; } // 한쪽 성별만 있으면 높이를 크게 바꿔 남녀를 구분함(여성 음성만 있으면 낮춰서 남성, 남성 음성만 있으면 높여서 여성) / with only one gender, shift pitch strongly to tell them apart (lower for male with a female voice, higher for female with a male voice)
    }
    const b = bestVoice(); pitch = 1.03; speaker = b ? short(b.name) : ""; return b; // 교대를 껐으면 가장 좋은 음성임 / best voice if alternation is off
  }
  function short(n) { return n.replace(/Microsoft |Online \(Natural\)| - Korean \(Kore(a|an)\)/g, "").trim(); } // 음성 이름을 짧게 줄임 / shorten the voice name
  function bestVoice() {                            // 가장 좋은 한국어 음성을 고름 / picks the best Korean voice
    const list = koreanVoices();                    // 목록임 / list
    if (chosen) { const c = list.find(function (v) { return v.name === chosen; }); if (c) return c; } // 사용자가 고른 것을 우선함 / prefer the user's choice
    for (let k = 0; k < prefer.length; k++) { const v = list.find(function (x) { return prefer[k].test(x.name); }); if (v) return v; } // 우선순위대로 찾음 / search in priority order
    return list[0] || null;                         // 없으면 첫 음성임 / otherwise the first voice
  }
  function quality() {                              // 현재 목소리 품질 등급임 / quality grade of the current voice
    const v = bestVoice();                          // 현재 목소리임 / current voice
    if (!v) return { level: 0, text: "한국어 음성 없음(자막만 표시)" }; // 음성이 없음 / no voice
    if (/Natural/i.test(v.name)) return { level: 3, text: "신경망 음성(자연스러움)" }; // Edge 신경망 음성임 / Edge neural voice
    if (/Google|Online/i.test(v.name)) return { level: 2, text: "온라인 음성(보통)" }; // 구글 온라인 음성임 / Google online voice
    return { level: 1, text: "기본 음성(딱딱함) → Microsoft Edge로 열면 좋아짐" }; // 운영체제 기본 음성임 / operating-system default voice
  }
  function split(text) {                            // 문장 단위로 자름 / split into sentences
    return text.replace(/\s+/g, " ").split(/(?<=[.?!요다임함])\s+/).filter(function (s) { return s.trim().length; }); // 마침표, ~요, ~다, ~임, ~함 뒤에서 자름 / split after periods and Korean sentence endings
  }
  function setSub(t) { if (onSub) onSub(t); }       // 자막을 표시함 / show the subtitle
  function setState(s) { if (onState) onState(s); } // 상태를 알림 / report the state
  function stop() {                                 // 모든 음성을 멈춤 / stop all speech
    gen++; active = false; queue = []; idx = 0; clearTimeout(timer); // 대기열과 타이머를 비움 / clear the queue and timer
    if (audio) { audio.pause(); audio = null; }     // MP3를 멈춤 / stop the MP3
    if (synth) synth.cancel();                      // 합성 음성을 취소함 / cancel synthesized speech
    setSub(""); setState("stopped");                // 자막과 상태를 되돌림 / reset subtitles and state
  }
  function next() {                                 // 다음 문장을 읽음 / read the next sentence
    if (!active || idx >= queue.length) { active = false; setState("done"); setSub(""); return; } // 끝났으면 정리함 / clean up when finished
    const sentence = queue[idx++]; setSub(sentence); // 문장을 꺼내 자막에 표시함 / take the sentence and show it as a subtitle
    const v = pickVoice(); spoken++;               // 목소리를 고름(남녀 교대 반영)하고 읽은 문장 수를 셈 / pick the voice (male/female alternation) and count sentences read
    if (!v || !window.SpeechSynthesisUtterance) { timer = setTimeout(next, 210 * sentence.length / rate); return; } // 음성이 없으면 자막만 넘김 / only advance subtitles if there is no voice
    const u = new SpeechSynthesisUtterance(sentence); // 한 문장 음성 요청임 / speech request for one sentence
    u.voice = v; u.lang = v.lang; u.rate = rate; u.pitch = pitch; u.volume = 1; // 목소리, 속도, 높이를 정함 / set voice, rate and pitch
    u.onend = function () { clearTimeout(u._guard); if (u._skip) return; next(); }; u.onerror = function () { clearTimeout(u._guard); if (u._skip) return; timer = setTimeout(next, 120); }; cur = u; log.push({ t: Date.now(), who: speaker, pitch: pitch, voice: v.name, text: sentence.slice(0, 20) }); if (log.length > 60) log.shift(); // 끝나면 다음 문장으로 감(검증용 기록을 남김) / go to the next sentence when done (keeps a log for checks)
    u._guard = setTimeout(function () { if (cur === u && active && !paused) { u._skip = true; synth.cancel(); next(); } }, 4000 + 260 * sentence.length / rate); // 감시 장치: 브라우저가 끝 신호를 빠뜨려도 예상 시간 뒤 다음 문장으로 넘어가 멈추지 않게 함 // 끝나면 다음으로, 오류여도 진행함 / next when done, continue even on errors
    synth.speak(u);                                 // 읽기 시작함 / start reading
  }
  const recent = {};                               // 최근에 읽은 문장 틀(숫자를 뺀 모양)과 시각임 / recently read sentence templates (numbers removed) and times
  function repeated(text) {                         // 같은 틀의 문장을 2분 안에 또 읽으려 하면 참(숫자만 바뀐 단순 반복 방지) / true if the same template would be read again within 2 minutes (prevents simple repeats with only numbers changed)
    const key = String(text).replace(/[0-9.,%]+/g, "#").replace(/\s+/g, " ").slice(0, 80), now = Date.now(); // 숫자를 지운 문장 틀임 / sentence template with numbers removed
    Object.keys(recent).forEach(function (k) { if (now - recent[k] > 120000) delete recent[k]; }); // 오래된 기록을 지움 / remove old records
    if (recent[key] && now - recent[key] < 120000) return true; recent[key] = now; return false; // 2분 안 반복이면 참임 / true if repeated within 2 minutes
  }
  function speak(text, priority, force) {           // 글을 읽음(force=true는 이전 설명을 끊고 새로 읽음, 그 밖에는 읽는 중이면 끝난 뒤 이어 읽음: 설명이 중간에 끊기지 않게 함) / reads text; only force cuts, otherwise it queues after the current speech
    if (!text || hushed) return DONE;               // 사용자가 종료를 눌러 조용히 하기로 했으면 화면의 자동 해설도 읽지 않음 / quiet when hushed
    if (QP.I18N && QP.I18N.lang() === "en") { text = String(QP.I18N.tr(text)).split(/(?<=[.?!])\s+/).filter(function (x) { return !/[가-힣]/.test(x); }).join(" "); if (!text) return DONE; } // 영문 모드면 영어로 바꿔 읽음 / English mode
    if (!force && repeated(text)) { if (!active) setSub(String(text).split(/(?<=[.?!])\s/)[0]); return DONE; } // 같은 말 반복은 소리 없이 자막만 / skip simple repeats
    if (active && !force) {                         // 읽는 중이면 끊지 않고 뒤에 이어 붙임(2026-11-12: 설명이 끝나기 전에 다음 설명으로 넘어가지 않게) / never cut: append after the current speech
      const add = split(text); if (queue.length - idx > 30) { return DONE; } // 밀린 설명이 너무 많으면 새 자동 설명은 생략 / skip if the backlog is too long
      queue = queue.concat(add); return { g: gen, e: queue.length };
    }
    stop(); wake(); paused = false; if (alt === 99) spoken = (Math.floor(spoken / 99) + 1) * 99; // 이전 음성을 멈추고 오디오 장치를 깨움 / stop previous speech and wake the audio
    queue = split(text); idx = 0; active = true; setState("playing"); // 대기열을 만들고 재생 상태로 바꿈 / build the queue and set playing
    timer = setTimeout(next, 250);                  // 첫 음절 잘림을 막으려고 250ms 쉬고 시작함 / wait 250 ms before starting
    return { g: gen, e: queue.length };             // 이 설명이 끝나는 위치 표식 / mark where this narration ends
  }
  function finished(m) {                            // 표식의 설명을 다 읽었는지(멈춤, 교체도 끝난 것으로 봄) / whether the marked narration is finished
    if (!m) return !active; if (m.done) return true; if (m.pending) return false;
    if (m.mp3) return m.g !== gen || !active; return m.g !== gen || !active || idx > m.e;
  }
  function play(id, text) {                         // 녹음 MP3가 있으면 MP3로, 없으면 TTS로 읽음 / plays the recorded MP3 if available, otherwise TTS
    if (hushed) return DONE;                         // 조용히 상태면 읽지 않음 / do not read while hushed
    if (QP.I18N && QP.I18N.lang() === "en") { return speak(text, true, true); } // 영문이면 한국어 녹음 대신 영어 음성 / English mode uses English TTS
    stop(); wake(); const mk = { g: gen, mp3: true };  // 정리하고 장치를 깨움 / clean up and wake the device
    const a = new Audio("audio/" + id + ".mp3"); a.playbackRate = rate / 1.1; let started = false; // 녹음 파일(이미 약간 빠르게 녹음됨)임 / recording (already recorded slightly fast)
    a.onerror = function () { if (!started) speak(text, true, true); }; // 파일이 없으면 TTS로 대신함 / fall back to TTS if the file is missing
    a.onplaying = function () {                     // 재생이 시작되면 / when playback starts
      started = true; active = true; setState("playing"); // 상태를 바꿈 / change the state
      const sents = split(text), total = text.length, dur = (a.duration || total / 8) * 1000 / a.playbackRate; let acc = 0; // 자막 시간 배분임 / subtitle time allocation
      sents.forEach(function (s) { const at = dur * acc / total; acc += s.length; setTimeout(function () { if (audio === a) setSub(s); }, at); }); // 문장별 자막 시각을 예약함 / schedule subtitle times per sentence
    };
    a.onended = function () { active = false; setSub(""); setState("done"); }; // 끝나면 정리함 / clean up when finished
    active = true; audio = a; setTimeout(function () { a.play().catch(function () { if (!started) speak(text, true, true); }); }, 200); return mk; // 장치가 깨어난 뒤 재생함(재생 준비 중에도 읽는 중으로 봄) / play after the device wakes
  }
  function progress() {                            // 재생 위치(문장 번호, 전체 문장 수)임 / playback position (sentence index, total sentences)
    if (audio && audio.duration) return { i: Math.round(audio.currentTime / audio.duration * 1000), n: 1000, mp3: true }; // MP3는 1000분율로 알려 줌 / MP3 reports per mille
    return { i: Math.max(0, idx - 1), n: queue.length, mp3: false }; // TTS는 지금 읽는 문장 번호임 / TTS reports the current sentence index
  }
  function seek(k) {                                // 원하는 위치로 바로 이동함(재생 막대) / jumps to the wanted position (seek bar)
    if (audio && audio.duration) { audio.currentTime = audio.duration * k / 1000; return; } // MP3는 시간 위치로 이동함 / MP3 jumps by time
    if (!queue.length) return;                      // 읽을 글이 없으면 무시함 / ignore if there is nothing to read
    if (cur) cur._skip = true; if (synth) synth.cancel(); // 지금 문장을 끊고(끊긴 문장이 다음으로 넘기지 않게 표시) / cut the current sentence (marked so it does not advance)
    clearTimeout(timer); idx = Math.max(0, Math.min(queue.length - 1, k)); active = true; setState("playing"); // 위치를 바꾸고 / change the position
    timer = setTimeout(next, 150);                  // 그 문장부터 다시 읽음 / read again from that sentence
  }
  function pause() { paused = true; if (audio) audio.pause(); if (synth) synth.pause(); setState("paused"); } // 일시정지임 / pause
  function resume() { paused = false; wake(); if (audio) { audio.play(); setState("playing"); return; } if (synth && synth.paused) synth.resume(); if (active && cur && !synth.speaking) { cur._skip = true; idx = Math.max(0, idx - 1); next(); } setState("playing"); } // 이어 재생(멈춘 문장부터 다시 읽음)임 / resume (re-read from the paused sentence)
  setInterval(function () { if (active && !paused && synth && synth.speaking) { synth.pause(); synth.resume(); } }, 9000); // 크롬이 긴 낭독 중 스스로 멈추는 문제를 막는 주기적 깨우기임 / periodic nudge preventing Chrome from stopping during long speech
  function shutdown() { hushed = true; queue = []; active = false; clearTimeout(timer); try { if (audio) audio.pause(); if (synth) synth.cancel(); if (keep) { keep.stop(); keep = null; } if (ctx) ctx.suspend(); } catch (e) { } } // 창을 닫거나 떠날 때 소리를 완전히 끔(브라우저가 남은 문장을 계속 읽는 문제 방지) / turn sound off completely on close or leave (prevents the browser reading leftover sentences)
  window.addEventListener("pagehide", shutdown); window.addEventListener("beforeunload", shutdown); // 탭, 창을 닫을 때임 / when a tab or window closes
  if (synth) synth.onvoiceschanged = function () { if (QP.Voice.onVoices) QP.Voice.onVoices(); }; // 음성 목록이 늦게 와도 알림 / notify even if the voice list arrives late

  QP.Voice = { isPaused: function () { return paused; }, progress: progress, seek: seek, play: play, speak: speak, stop: stop, pause: pause, resume: resume, wake: wake, koreanVoices: koreanVoices, bestVoice: bestVoice, quality: quality,
    setRate: function (r) { rate = r; if (audio) { audio.playbackRate = r / 1.1; return; } if (active && cur && synth && synth.speaking && !paused) seek(Math.max(0, idx - 1)); }, getRate: function () { return rate; }, // 속도 조절(읽던 문장을 새 속도로 바로 다시 읽어 차이가 즉시 느껴짐) / speed control (re-reads the current sentence at the new rate so the change is immediate)
    hush: function (b) { hushed = !!b; if (b) { stop(); try { if (keep) { keep.stop(); keep = null; } } catch (e) { } } }, shutdown: shutdown, isHushed: function () { return hushed; }, setAlternate: function (n) { alt = n; spoken = 0; }, speaker: function () { return speaker; }, log: function () { return log; }, // 남녀 교대(문장 n개마다, 0은 끄기)와 현재 화자임 / male/female alternation (every n sentences, 0 = off) and current speaker
    genders: function () { return { f: genderVoice(false), m: genderVoice(true) }; }, // 사용 가능한 여성, 남성 음성임 / available female and male voices
    setVoice: function (n) { chosen = n; }, onSubtitle: function (f) { onSub = f; }, onStateChange: function (f) { onState = f; }, // 설정 함수임 / setter functions
    isActive: function () { return active; }, finished: finished, onVoices: null }; // 상태 확인 함수임 / state query functions
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
