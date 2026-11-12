/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Hiking control room, iNavi stamp tour and 4-qubit risk-zone circuit screens. */
/* =====================================================================
 * views_mountain.js : 산행 관제실(애니메이션), iNavi 100대 명산 스탬프 투어, 4큐비트 위험구역
 * ---------------------------------------------------------------------
 * 산행 관제실 흐름(한 화면에서 모두 움직임):
 *   산 단면 위를 눈송이 산행자가 이동 → 앞쪽 POI가 감지 거리(R m) 안에 들어오면
 *   해당 신호가 0→1로 오름 → 신호 쌍이 큐비트 다이얼 회전(RY)으로 바뀜 → CNOT으로
 *   얽혀 겹침 점수 ⟨Z⟩가 나옴 → 일반 AI, 양자 특징 AI, DNN이 점수를 냄 →
 *   경보 기준을 넘으면 경보, 사건 시작 몇 분 전에 알렸는지(선행 시간)를 기록함.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 화면을 추가함 / adds screens to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const D = QP.Data, M = QP.Models, G = QP.Mountain, C = QP.Charts, A = QP.Anim, B = QP.Basis; // 모듈 짧은 이름임 / short module names
  const $ = function (s, r) { return (r || document).querySelector(s); }; // 요소 찾기 함수임 / element lookup function
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; }; // 백분율 표기임 / percentage notation
  const hhmm = function (min) { const h = Math.floor(min / 60), m = Math.floor(min % 60); return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); }; // 분 → 시:분임 / minutes → hh:mm
  const PAIRN = [["강수", "급경사"], ["심박", "피로"], ["일몰", "지연"], ["통신", "배터리"], ["결빙", "급경사"], ["이탈", "절벽"]]; // 신호 쌍 짧은 이름임 / short names of signal pairs
  const hikerImg = new Image();                     // 산행자 그림(공식 눈송이 안내 이미지)임 / hiker picture (official Snowflake guide image)
  (function () { const f = QP.Brand.files.guide; hikerImg.src = QP.Brand.local("go"); hikerImg.onerror = function () { if (hikerImg.src !== f) hikerImg.src = f; }; })(); // 걷는 눈송이(로컬) → 공식 주소 순서로 불러옴 / load the walking Snowflake (local) → official URL
  QP.State.stamps = QP.State.stamps || {};          // 스탬프 투어 기록임 / stamp tour records

  // 매 순간의 "의미 해석": 상황 → 양자 표현 → 의미 → AI 판단 → 행동 권고 순서의 쉬운 문장을 만듦 / "meaning" at every moment: easy sentences in the order situation → quantum view → meaning → AI decision → advice
  const MEAN = [                                    // 신호 쌍별 [위험 이름, 행동 권고]임 / [risk name, advice] per signal pair
    ["젖은 경사면 미끄러짐", "보폭을 줄이고 난간, 스틱을 쓰시기 바랍니다. 돌계단은 옆으로 디디시기 바랍니다."],
    ["체력 고갈(탈진)", "5분 쉬고 물을 드시기 바랍니다. 속도를 낮추시기 바랍니다."],
    ["어두워지기 전 하산 실패", "정상 도전을 멈추고 가까운 하산로로 내려가시기 바랍니다."],
    ["구조 요청 불가(통신, 배터리)", "통신이 될 때 위치를 공유하고 화면 밝기를 낮추시기 바랍니다."],
    ["빙판 미끄러짐", "아이젠을 착용하거나 결빙 구간을 우회하시기 바랍니다."],
    ["길 잃음과 추락", "지정 등산로로 돌아가고 절벽 쪽 갈림길로 들어가지 마시기 바랍니다."]
  ];
  function meaning(s, run) {                        // 한 순간의 해석 묶음을 만듦 / builds the interpretation for one moment
    let k = 0, v = -1; QP.Data.pairs.forEach(function (p, j) { const t = s.sig[p[0]] * s.sig[p[1]]; if (t > v) { v = t; k = j; } }); // 가장 겹친 쌍을 찾음 / find the most overlapping pair
    const p = QP.Data.pairs[k], a = s.sig[p[0]], b = s.sig[p[1]], z = M.pairAnalytic(a, b); // 두 신호 값과 겹침 점수임 / the two signal values and the overlap score
    const names = [QP.Data.signals[p[0]][1], QP.Data.signals[p[1]][1]]; // 신호 이름임 / signal names
    const lvl = function (x) { return x > .7 ? "매우 높음" : x > .4 ? "높음" : x > .15 ? "조금" : "낮음"; }; // 수준 말로 바꾸기임 / turn a level into words
    const qa = s.qf >= run.thrQ, la = s.lin >= run.thrL; // 두 AI 경보 여부임 / whether each AI alarms
    const sit = names[0] + " " + lvl(a) + ", " + names[1] + " " + lvl(b) + (s.rain > .5 ? " (비 " + s.rain.toFixed(1) + " mm/h)" : "") + (s.T < 3 ? " (기온 " + s.T.toFixed(1) + "°C)" : ""); // 상황 문장임 / situation sentence
    const qxRest = names[0] + " 큐비트 " + Math.round(Math.pow(Math.sin(Math.PI * a / 2), 2) * 100) + "%, " + names[1] + " 큐비트 " + Math.round(Math.pow(Math.sin(Math.PI * b / 2), 2) * 100) + "% 기울어짐 → CNOT 뒤 겹침 점수 " + z.toFixed(2); const qxEN = QP.I18N && QP.I18N.lang() === "en"; const qx = (qxEN ? "pair " : "쌍 ") + "①②③④⑤⑥"[k] + ": " + (qxEN ? QP.I18N.tr(qxRest) : qxRest); // 쌍 번호 + 양자 표현 문장 / pair number + quantum-view sentence
    const both = a > .45 && b > .45, one = (a > .45) !== (b > .45); // 둘 다 높은지, 한쪽만 높은지임 / whether both are high or only one
    const mean = both ? "두 위험이 동시에 커져 ‘" + MEAN[k][0] + "’ 가능성이 따로일 때보다 크게 늘어나는 순간" : one ? "한 가지 위험만 커진 상태로, 아직 겹침은 아님" : "겹친 위험이 거의 없는 평온한 구간"; // 의미 문장임 / meaning sentence
    const eff = qa && !la ? "양자 특징 AI만 먼저 경보 → 일반 AI보다 앞서 알림(조기 확보)" : qa && la ? "두 AI 모두 경보" : !qa && la ? "일반 AI만 경보(양자 특징 AI는 겹침이 아니라고 판단)" : "두 AI 모두 조용(정상 범위)"; // AI 판단 문장임 / AI decision sentence
    return { sit: sit, qx: qx, mean: mean, eff: eff, act: both || qa ? MEAN[k][1] : "평소처럼 안전하게 걸으시기 바랍니다.", risk: MEAN[k][0], hot: both }; // 해석 묶음을 돌려줌 / return the interpretation
  }
  QP.Meaning = meaning;                             // 다른 화면에서도 쓰도록 공개함 / publish for use on other screens

  function runFor(cfg) {                            // 설정으로 산행을 시뮬레이션하고 점수를 붙임 / simulates a hike from settings and attaches scores
    const c = G.makeCourse(cfg.mountain);           // 코스를 만듦 / build the course
    const run = G.simulate(c, G.personas[cfg.persona], G.weathers[cfg.weather], { fallAt: cfg.fall ? .62 : 0 }); // 시뮬레이션함 / simulate
    return G.score(run, QP.State.results, QP.DNN && QP.DNN.model ? QP.DNN.predict : null); // 세 AI 점수를 붙임 / attach the three AI scores
  }

  /* ===== 산행 관제실 / Hiking control room  ===== */
  function sim(el) {
    const cfg = QP.State.simCfg = QP.State.simCfg || { mountain: 0, persona: 0, weather: 1, fall: false, speed: 120 }; // 관제 설정(기본: 북한산, A님, 오후 소나기)임 / control settings (default: Bukhansan, Hiker A, afternoon shower)
    el.innerHTML = '<div class="ctrl-room">' +
      '<div class="ctrl-bar card"><select id="mM">' + G.mountains.map(function (m, i) { return '<option value="' + i + '">' + m[0] + " " + m[1] + " " + m[2] + 'm</option>'; }).join("") + '</select>' +
      '<select id="mP">' + G.personas.map(function (p, i) { return '<option value="' + i + '">' + p.name + '</option>'; }).join("") + '</select>' +
      '<select id="mW">' + G.weathers.map(function (w, i) { return '<option value="' + i + '">' + w.name + '</option>'; }).join("") + '</select>' +
      '<select id="mSe">' + G.seasons.map(function (x, i) { return '<option value="' + i + '"' + (i === (QP.State.season != null ? QP.State.season : 2) ? " selected" : "") + '>' + x.name + '</option>'; }).join("") + '</select>' +
      '<label class="tog"><input type="checkbox" id="mF"> 낙상 사건 포함</label><button id="mPlay" data-autoplay="1" class="primary">▶ 출발</button><button id="mReset">처음</button>' +
      '<select id="mS"><option value="30">30배속</option><option value="60">60배속</option><option value="120">120배속</option><option value="240">240배속</option><option value="480">480배속</option></select>' +
      '<label class="tog"><input type="checkbox" id="mV" checked> 사건 음성</label><span id="mClock" class="clock"></span></div>' +
      '<div class="card mtn"><canvas id="mCv"></canvas><div id="mCap" class="mcap">▶ 출발을 누르면 눈송이가 정상까지 오르고 하산을 마칠 때까지 상황마다 멈춰 설명합니다.</div></div>' +
      '<div class="card stat" id="mStat"></div>' +
      '<div class="card qub"><canvas id="mQ"></canvas><div id="mQx" class="qx6"></div></div>' +
      '<div class="card nn"><canvas id="mN"></canvas></div>' +
      '<div class="card ch1"><canvas id="mSig"></canvas></div>' +
      '<div class="card ch2"><canvas id="mSc"></canvas></div></div>';
    ["mM", "mP", "mW", "mS"].forEach(function (id, k) { $("#" + id, el).value = [cfg.mountain, cfg.persona, cfg.weather, cfg.speed][k]; }); // 현재 설정을 선택 상자에 표시함 / show the current settings in the selects
    $("#mF", el).checked = cfg.fall; { const av = document.getElementById("autoVoice"); $("#mV", el).checked = !!(QP.State.touring || (av && av.checked)); } // 사건 음성은 자동 해설 설정을 따름(기본 끔, 전체 안내 중에는 켬) / event voice follows the auto-narration setting                // 낙상 체크 상태임 / fall checkbox state
    let run = runFor(cfg), simT = 0, playing = false, shownA = new Array(6).fill(0), shownB = new Array(6).fill(0), lastI = -1, frame = 0; // 결과, 시뮬 시각, 재생, 다이얼 표시값, 직전 위치임 / result, sim time, playing, dial values, previous position
    let said = {}, log = [], focus = null, focusT = 0, doneHold = false; // 이미 말한 사건, 사건 기록, 지금 설명 중인 지점과 그 시각임 / already-announced events, event log, point being explained and its time
    function flash(level) {                         // 위험 경보 번쩍임(화면 테두리 + 관제실 깜빡임 + 경고 띠) / risk alarm flash (screen border + control-room blink + warning band)
      const room = el.querySelector(".ctrl-room"); if (!room) return; room.classList.remove("flash-r", "flash-y"); void room.offsetWidth; room.classList.add(level === "red" ? "flash-r" : "flash-y"); // 애니메이션을 다시 시작함 / restart the animation
      const w = document.getElementById("warnflash"); if (w) { w.className = "warnflash on " + (level === "red" ? "r" : "y"); clearTimeout(w._t); w._t = setTimeout(function () { w.className = "warnflash"; }, 2600); } // 화면 전체 가장자리를 번쩍임 / flash the whole screen edge
    }
    const cv = $("#mCv", el), qv = $("#mQ", el), nv = $("#mN", el); // 캔버스들임 / canvases
    const drops = Array.from({ length: 140 }, function () { return [Math.random(), Math.random()]; }); // 빗방울 위치임 / raindrop positions
    function reset() { run = runFor(cfg); simT = 0; lastI = -1; said = {}; log = []; drawCharts(0); } // 처음으로 되돌림 / reset to the start
    // 단계 안내: 설명할 일이 생기면 시뮬레이션을 잠시 세우고, 설명을 끝까지 읽은 뒤 다시 걷게 함(정상, 하산까지 모든 상황) / guided steps: pause the sim for each explanation, resume after it is read (all the way to summit and descent)
    let gq = [], gcur = null, gno = 0;             // 설명 대기열, 지금 설명, 설명 번호 / queue, current item, step number
    const GN = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
    function kindText(key, text) {                  // 사건 종류별로 친절한 설명을 덧붙임 / add a kind, detailed explanation per kind
      if (QP.I18N && QP.I18N.lang() === "en") {      // 영어 모드: 고정 문장은 영어로, 이름은 사전으로 / English mode
        const T = QP.I18N.tr, mm = /^(.*?)까지 (\d+)미터/.exec(text), i0 = Math.min(run.steps.length - 1, Math.floor(simT / 10)), m0 = meaning(run.steps[i0], run);
        if (/^near/.test(key) && mm) return T(mm[1]) + " is " + mm[2] + " meters ahead. Detection starts. Among the qubit dials below, the pair for this risk starts to tilt toward 1, and the box at the top right explains what it means. Advice: " + T(m0.act);
        if (key === "stamp") return "We reached the summit and stamped the passport. The signals from the earlier risk points have all gone down. Now the descent begins. Going down, knee strain and slipping risk increase, so please watch how the signals change when Snowflake passes the same points again.";
        if (/^ev/.test(key)) return "A risk event has started. The pink band is the actual risk interval, and the triangles above mark when each AI first raised an alarm. Advice: " + T(m0.act);
        if (/^q/.test(key)) return "The quantum-feature AI raised an alarm. It read, through the overlap score, two signals rising together. Advice: " + T(m0.act);
        if (key === "done") return text.replace(/^.*$/, function () { const evs = run.events, qe = evs.filter(function (e) { return e.q >= 0 && e.q <= e.s; }).length, le = evs.filter(function (e) { return e.lin >= 0 && e.lin <= e.s; }).length; return "The descent is complete. There were " + evs.length + " risk events on this hike; the quantum-feature AI warned about " + qe + " of them in advance and the classical AI about " + le + ". The triangles in the lower right chart mark when each AI first raised an alarm. The stamp has been saved."; });
        return T(text);
      }
      const i = Math.min(run.steps.length - 1, Math.floor(simT / 10)), st0 = run.steps[i], mn = meaning(st0, run);
      if (/^near/.test(key)) return text + " 지금 상황은 " + mn.sit + "입니다. 아래 큐비트 다이얼 가운데 이 위험과 관련된 쌍이 1 쪽으로 기울기 시작하고, 오른쪽 위 상자에 그 의미가 나타납니다. " + mn.eff + ". 권고 드립니다. " + mn.act;
      if (key === "stamp") return text + " 여기까지 오르는 동안 지난 위험 지점들의 신호는 모두 내려갔습니다. 이제 하산을 시작합니다. 내려갈 때는 무릎 부담과 미끄러짐 위험이 커지므로, 눈송이가 같은 지점을 다시 지날 때 신호가 어떻게 바뀌는지 함께 보시기 바랍니다.";
      if (/^ev/.test(key)) return text + " 분홍 띠가 실제 위험 사건 구간이고, 위쪽 삼각형이 각 AI가 처음 경보한 시점입니다. " + mn.mean + "입니다. 권고 드립니다. " + mn.act;
      if (/^q/.test(key)) return text + " 양자 특징 AI는 " + mn.risk + " 쪽 두 신호가 함께 오르는 것을 겹침 점수로 읽었습니다. " + mn.act;
      return text;
    }
    function guideTick() {                          // 매 프레임: 설명을 하나씩 읽고, 다 읽으면 다음으로 / each frame: read one explanation at a time
      const talk = QP.Voice.isActive && QP.Voice.isActive();
      if (gcur) { const dt = performance.now() - gcur.t; if (dt > 5500 && QP.Voice.finished(gcur.m)) gcur = null; else return; }
      if (gq.length) { if (QP.Voice.busy()) return; gcur = gq.shift(); gcur.t = performance.now(); gno++; const c = $("#mCap", el); if (c) { c.innerHTML = "<b>" + (gno <= 20 ? GN[gno - 1] : gno + ".") + "</b> " + gcur.text; c.className = "mcap on"; } gcur.m = QP.Voice.speak(gcur.text, true, true); return; }
    }
    const gpaused = function () { return !!gcur || gq.length > 0; };
    function say(key, text) { if (said[key]) return; said[key] = 1; const poi = run.course.pois.find(function (q) { return text.indexOf(q.name) >= 0; }); if (poi) { focus = poi; focusT = performance.now(); } if (/사건|규칙|낙상/.test(text)) flash("red"); log.unshift(hhmm(run.steps[Math.min(run.steps.length - 1, Math.floor(simT / 10))].min) + " " + text); if ($("#mV", el).checked && playing) gq.push({ text: kindText(key, text) }); else if ($("#mV", el).checked && !QP.State.touring) QP.Voice.speak(text, true); } // 사건을 한 번만 기록하고, 재생 중이면 단계 안내 대기열에 넣음 / record once; while playing, queue for guided narration

    function drawMountain(i, frac) {                // 산 단면과 산행자를 그림 / draws the mountain profile and hiker
      const P = A.canvas(cv, cv.parentNode.clientHeight - 16), g = P.g, W = P.w, H = P.h; // 캔버스 준비임 / prepare the canvas
      const c = run.course, s = run.steps[i], s2 = run.steps[Math.min(i + 1, run.steps.length - 1)]; // 코스와 현재, 다음 상태임 / course and current and next states
      const x = s.x + (s2.x - s.x) * frac;          // 화면에 쓸 부드러운 위치임 / smooth position used on screen
      const dusk = Math.max(0, Math.min(1, (s.min - (run.sunset - 120)) / 140)); // 일몰이 가까울수록 1임 / 1 as sunset approaches
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, s.rain > 1 ? "#9aa6b8" : (dusk > .5 ? "#f2b48c" : "#cfe0f5")); sky.addColorStop(1, "#f7f9fd"); // 날씨, 시각에 따른 하늘색임 / sky color by weather and time
      g.fillStyle = sky; g.fillRect(0, 0, W, H);    // 하늘을 칠함 / paint the sky
      const pad = 34, top = 26, bot = H - 26;       // 여백임(아래에 경사 띠 자리) / margins (room for the slope band below)
      const X = function (d) { return pad + d / c.L * (W - pad - 12); }, Y = function (e) { return bot - (e - c.start) / (c.summit - c.start) * (bot - top - 18); }; // 거리, 고도 → 화면 좌표임 / distance, altitude → screen coordinates
      g.fillStyle = "rgba(0,48,135,.10)"; g.beginPath(); g.moveTo(0, bot); for (let k = 0; k <= 40; k++) g.lineTo(k / 40 * W, bot - 30 - 40 * Math.abs(Math.sin(k * .7 + c.mi))); g.lineTo(W, bot); g.fill(); // 뒤쪽 능선 장식임 / background ridge decoration
      const grd = g.createLinearGradient(0, top, 0, bot); grd.addColorStop(0, "#5f7fbf"); grd.addColorStop(1, "#c9d6ee"); // 산 몸통 색(숙명 블루 계열)임 / mountain body color (Sookmyung blue tones)
      g.fillStyle = grd; g.beginPath(); g.moveTo(X(0), bot); for (let k = 0; k <= c.n; k++) g.lineTo(X(k / c.n * c.L), Y(c.elev[k])); g.lineTo(X(c.L), bot); g.closePath(); g.fill(); // 산 단면을 칠함 / fill the mountain profile
      const se = run.season ? run.season.id : "autumn", tnow = performance.now() / 2500; // 계절과 시각(장식용)임 / season and time (for decoration)
      g.fillStyle = "rgba(255,255,255,.75)"; [0, 1, 2].forEach(function (k) { const cx = ((k * 0.37 + tnow * .01 * (k + 1)) % 1.2 - .1) * W, cy = 30 + k * 18; g.beginPath(); g.ellipse(cx, cy, 34, 10, 0, 0, 7); g.ellipse(cx + 20, cy - 6, 22, 9, 0, 0, 7); g.fill(); }); // 흘러가는 구름임 / drifting clouds
      for (let k = 2; k < c.n - 2; k += 3) { const d = k / c.n * c.L, px = X(d), py = Y(c.elev[k]); const frac = (c.elev[k] - c.start) / Math.max(1, c.summit - c.start); if (frac > .85) { g.fillStyle = "#7d7f8a"; g.beginPath(); g.moveTo(px - 6, py + 2); g.lineTo(px - 2, py - 7); g.lineTo(px + 5, py - 4); g.lineTo(px + 7, py + 2); g.fill(); continue; } // 정상 근처는 바위임 / rocks near the summit
        const col = se === "spring" ? (k % 2 ? "#f4b6c8" : "#7fae6a") : se === "summer" ? "#3f7d4a" : se === "autumn" ? ["#c0392b", "#e67e22", "#d4a017"][k % 3] : "#5b7a66"; // 계절별 나무 색(봄 벚꽃, 여름 초록, 가을 단풍, 겨울 상록)임 / tree color by season (spring blossoms, summer green, autumn leaves, winter evergreen)
        g.fillStyle = "#6b4a2b"; g.fillRect(px - 1, py + 4, 2, 6); g.fillStyle = col; g.beginPath(); g.moveTo(px, py - 10); g.lineTo(px - 6, py + 5); g.lineTo(px + 6, py + 5); g.fill(); // 나무 줄기와 잎임 / tree trunk and leaves
        if (se === "winter") { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(px, py - 10); g.lineTo(px - 3, py - 3); g.lineTo(px + 3, py - 3); g.fill(); } } // 겨울엔 나무 끝에 눈이 쌓임 / in winter snow sits on the treetops
      if (se === "winter") { g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); for (let k = Math.floor(c.n * .8); k <= c.n; k++) g.lineTo(X(k / c.n * c.L), Y(c.elev[k]) - 1); for (let k = c.n; k >= Math.floor(c.n * .8); k--) g.lineTo(X(k / c.n * c.L), Y(c.elev[k]) + 8); g.fill(); } // 겨울 정상부 설경임 / winter snow scene on the summit area
      if (!s.up && s.rain > .5) { g.strokeStyle = "rgba(199,40,40,.55)"; g.lineWidth = 9; g.beginPath(); for (let k = 0; k <= c.n; k++) { const d = k / c.n * c.L; if (d > x || c.grades[Math.min(c.n - 1, k)] < .25) { g.stroke(); g.beginPath(); continue; } g.lineTo(X(d), Y(c.elev[k])); } g.stroke(); g.fillStyle = "#b02a2a"; g.font = "bold 12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("⚠ 젖은 급경사 내리막: 미끄러짐 위험 ↑", X(Math.max(0, x - c.L * .35)), Y(G.elevAt(c, Math.max(0, x - c.L * .2))) + 28); } // 비 오는 하산길이면 앞으로 내려갈 급경사 구간을 붉게 표시함 / on a rainy descent, mark the steep sections ahead in red
      g.strokeStyle = "#8a5a2b"; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.beginPath(); for (let k = 0; k <= c.n; k++) { const px = X(k / c.n * c.L), py = Y(c.elev[k]); if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); g.setLineDash([]); // 등산로(점선)임 / trail (dashed)
      (function steepMarks() {                      // 급경사 구간을 한눈에 보이게 강조함(붉은 면, 굵은 선, 경사 % 표지, 아래 경사 띠) / highlights steep sections at a glance (red fill, thick line, grade label, slope band below)
        const blocks = []; let b0 = -1;             // 연속 급경사 묶음 목록임 / list of consecutive steep blocks
        for (let k = 0; k <= c.n; k++) { const st = k < c.n && c.grades[k] > .34; if (st && b0 < 0) b0 = k; if (!st && b0 >= 0) { blocks.push([b0, k]); b0 = -1; } } // 34% 넘는 구간을 묶음 / group segments over 34%
        const pulse = .55 + .45 * Math.sin(performance.now() / 380); // 깜박이는 세기임 / blink intensity
        blocks.forEach(function (bk, bi) {          // 급경사 묶음마다 / for each steep block
          g.fillStyle = "rgba(199,40,40," + (.18 + .14 * pulse) + ")"; g.beginPath(); g.moveTo(X(bk[0] / c.n * c.L), bot); for (let k = bk[0]; k <= bk[1]; k++) g.lineTo(X(k / c.n * c.L), Y(c.elev[k])); g.lineTo(X(bk[1] / c.n * c.L), bot); g.closePath(); g.fill(); // 급경사 아래를 붉게 칠함 / paint red below the steep section
          g.strokeStyle = "#c62828"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); for (let k = bk[0]; k <= bk[1]; k++) { const px = X(k / c.n * c.L), py = Y(c.elev[k]); if (k === bk[0]) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); g.lineCap = "butt"; // 굵은 붉은 등산로임 / thick red trail
          let mx = 0; for (let k = bk[0]; k < bk[1]; k++) mx = Math.max(mx, c.grades[k]); // 묶음의 최대 경사임 / maximum grade of the block
          const mk = Math.floor((bk[0] + bk[1]) / 2), lx = X(mk / c.n * c.L), ly = Y(c.elev[mk]) - 30 - (bi % 2) * 16; // 표지 위치(겹치지 않게 번갈아 높이를 바꿈)임 / label position (alternating heights to avoid overlap)
          const deg = Math.round(Math.atan(mx) * 180 / Math.PI), txt = "⚠ 급경사 " + Math.round(mx * 100) + "% (" + deg + "°)"; // 백분율과 각도임 / percentage and angle
          g.font = "bold 12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; const tw = g.measureText(txt).width + 10; // 글자 폭임 / text width
          const bx = Math.max(2, Math.min(W - tw - 2, lx - tw / 2)); g.fillStyle = "rgba(198,40,40,.92)"; g.fillRect(bx, ly - 13, tw, 18); g.fillStyle = "#fff"; g.textAlign = "left"; g.fillText(txt, bx + 5, ly + 1); // 붉은 표지판임 / red sign
        });
        const sy = H - 13;                          // 아래 경사 띠의 높이임 / height of the slope band below
        for (let k = 0; k < c.n; k++) { const gr = c.grades[k]; g.fillStyle = gr > .34 ? "#c62828" : gr > .2 ? "#f0a030" : gr > .08 ? "#f3d46b" : gr >= 0 ? "#9fd3a8" : "#8fb3dc"; g.fillRect(X(k / c.n * c.L), sy, X((k + 1) / c.n * c.L) - X(k / c.n * c.L) + .5, 9); } // 구간별 경사 색 띠임(빨강 34% 이상, 주황 20~34%, 노랑 8~20%, 초록 완만, 파랑 내리막) / color band of grade per segment (red ≥34%, orange 20~34%, yellow 8~20%, green gentle, blue downhill)
        g.fillStyle = "#1d2a4d"; g.font = "10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("경사", 4, sy + 8); // 띠 이름임 / band name
      })();
      c.pois.forEach(function (q) {                 // 위험 지점마다 / for each risk point
        const near = s.near.find(function (n) { return n.q === q; }), act = near && near.s > 0; // 현재 접근 정보임 / current approach info
        const px = X(q.x), py = Y(G.elevAt(c, q.x)); // 화면 좌표임 / screen coordinates
        const r0 = s.up ? X(q.x - q.R) : X(q.x), r1 = s.up ? X(q.x) : X(Math.min(c.L, q.x + q.R)); // 감지 구간(진행 방향 앞쪽)임 / detection range (ahead in the travel direction)
        if (q.type !== "stamp") { g.fillStyle = act ? "rgba(255,181,0,.35)" : "rgba(255,255,255,.18)"; g.fillRect(r0, py - 4, r1 - r0, 8); } // 감지 구간 띠를 칠함 / paint the detection band
        const pulse = act ? 4 + 3 * Math.sin(performance.now() / 450) : 0; // 감지 중이면 깜빡임 / blink while detecting
        g.fillStyle = q.type === "stamp" ? "#ffb500" : act ? "#c76b67" : "#ffffff"; g.strokeStyle = "#003087"; g.lineWidth = 1.5; // 핀 색임 / pin color
        g.beginPath(); g.arc(px, py - 22, 9 + pulse * .4, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(px, py - 13); g.lineTo(px, py); g.stroke(); // 핀 모양임 / pin shape
        g.fillStyle = "#003087"; g.font = "bold 10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillText(q.icon, px, py - 18); // 핀 기호임 / pin symbol
        const ki = c.pois.indexOf(q), ly = py - (ki % 2 ? 50 : 36); g.font = "12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; const tw = g.measureText(q.name).width, lx = Math.min(W - tw / 2 - 4, Math.max(tw / 2 + 4, px)); g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(lx - tw / 2 - 2, ly - 10, tw + 4, 13); g.fillStyle = "#1d2a4d"; g.fillText(q.name, lx, ly); // 지점 이름(번갈아 높이를 달리하고 흰 바탕을 깔아 겹침 방지, 화면 끝에서는 안쪽으로)임 / point name (alternating heights with white background to avoid overlap, kept inside at the edges)
        if (act && near.d >= 0) { const hx = X(x), hy = Y(G.elevAt(c, x)); g.strokeStyle = "rgba(199,107,103,.8)"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(hx, hy - 20); g.lineTo(px, py - 22); g.stroke(); g.setLineDash([]); g.fillStyle = "#7d2c22"; g.fillText(Math.round(near.d) + "m 앞 감지", (hx + px) / 2, Math.min(hy, py) - 30); } // 감지 연결선과 거리 표시임 / detection link and distance label
      });
      if (focus && performance.now() - focusT < 6000 && QP.App && QP.App.pointAt) { const cr = cv.getBoundingClientRect(); QP.App.pointAt(cr.left + X(focus.x), cr.top + Y(G.elevAt(c, focus.x)) - 22); } // 음성이 말하는 지점을 눈송이 지시봉이 직접 가리킴 / Snowflake's stick points directly at the point the voice is talking about
      if (s.truth) { const on = Math.floor(performance.now() / 900) % 2 === 0; if (on) { g.fillStyle = "rgba(199,40,40,.12)"; g.fillRect(0, 0, W, H); g.fillStyle = "#c62828"; g.fillRect(W / 2 - 92, 26, 184, 26); g.fillStyle = "#fff"; g.font = "bold 14px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillText("⚠ 위험 구간 진행 중", W / 2, 44); g.textAlign = "left"; } } // 실제 위험 구간이면 붉게 깜빡이는 경고를 띄움 / show a red blinking warning in a real risk section
      const hx = X(x), hy = Y(G.elevAt(c, x));      // 산행자 위치임 / hiker position
      const ring = 18 + 6 * Math.sin(performance.now() / 700); // 탐지 레이더 반지름(맥동)임 / detection radar radius (pulsing)
      g.strokeStyle = "rgba(255,181,0,.8)"; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy - 16, ring, 0, 7); g.stroke(); // 레이더 원임 / radar circle
      g.fillStyle = s.up ? "#003087" : "#a9482a"; g.font = "bold 12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillText(s.up ? "↗ 오르막 " + Math.round(s.grade * 100) + "%" : "↘ 내리막 " + Math.round(-s.grade * 100) + "%", hx, hy + 18); g.textAlign = "left"; // 진행 방향과 경사 표시임 / direction and grade display
      if (hikerImg.complete && hikerImg.naturalWidth) { const h = 44, w = h * hikerImg.naturalWidth / hikerImg.naturalHeight; g.save(); g.translate(hx, 0); if (!s.up) g.scale(-1, 1); g.drawImage(hikerImg, -w / 2, hy - h - 2 + Math.abs(Math.sin(performance.now() / 450)) * 2, w, h); g.restore(); } // 내려올 때는 좌우를 뒤집어 하산 방향을 보게 함 // 공식 눈송이 이미지를 정비례로 그림(걷는 듯 위아래로 살짝 움직임) / draw the official Snowflake image to scale (bobbing as if walking)
      else { g.fillStyle = "#003087"; g.beginPath(); g.arc(hx, hy - 30, 6, 0, 7); g.fill(); g.fillRect(hx - 3, hy - 24, 6, 14); g.strokeStyle = "#003087"; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy - 10); g.lineTo(hx - 5 + 4 * Math.sin(performance.now() / 120), hy); g.moveTo(hx, hy - 10); g.lineTo(hx + 5 - 4 * Math.sin(performance.now() / 120), hy); g.stroke(); } // 이미지가 없으면 간단한 사람 모양을 그림 / draw a simple figure if there is no image
      const qa = s.qf >= run.thrQ, la = s.lin >= run.thrL; // 두 AI 경보 여부임 / whether each AI alarms
      g.font = "bold 11px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "left"; // 말풍선 글씨임 / speech-bubble text
      if (qa) { g.fillStyle = "#6e4c82"; g.fillRect(hx + 22, hy - 62, 92, 18); g.fillStyle = "#fff"; g.fillText("양자 특징 AI 경보", hx + 26, hy - 49); } // 양자 경보 말풍선임 / quantum alarm bubble
      if (la) { g.fillStyle = "#4d6b8c"; g.fillRect(hx + 22, hy - 42, 70, 18); g.fillStyle = "#fff"; g.fillText("일반 AI 경보", hx + 26, hy - 29); } // 일반 경보 말풍선임 / classical alarm bubble
      if (s.rain > .3) { g.strokeStyle = "rgba(60,90,150,.45)"; g.lineWidth = 1; const n = Math.min(drops.length, Math.round(s.rain * 10)), tt = performance.now() / 2600; for (let k = 0; k < n; k++) { const dx = (drops[k][0] * W + tt * 30) % W, dy = (drops[k][1] * H + tt * 420) % H; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx - 3, dy + 10); g.stroke(); } } // 빗줄기 애니메이션임 / rain streak animation
      if (s.T < 2) { g.fillStyle = "rgba(180,215,255," + Math.min(.35, (2 - s.T) / 15) + ")"; g.fillRect(0, 0, W, H); g.fillStyle = "#1d3c70"; g.fillText("기온 " + s.T.toFixed(1) + "°C 결빙 주의", W - 150, 18); } // 저온이면 서리 빛을 덮음 / frost tint when cold
      if (s.policy) { g.fillStyle = "rgba(199,107,103,.92)"; g.fillRect(0, 0, W, 22); g.fillStyle = "#fff"; g.fillText("안전 규칙 우선: " + s.policy, 8, 15); } // 안전 규칙 띠임 / safety rule band
      g.fillStyle = "#1d2a4d"; g.font = "10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "left"; g.fillText(c.start + "m", 2, bot); g.fillText(c.summit + "m", 2, top + 4); g.fillText((c.L / 1000).toFixed(1) + " km(편도)", W - 70, bot + 14); // 축 글씨임 / axis labels
    }
    function drawQubits(i) {                        // 6개 신호 쌍 회로를 그림 / draws the six signal-pair circuits
      const qx = $("#mQx", el), P = A.canvas(qv, Math.max(90, qv.parentNode.clientHeight - 16 - (qx ? qx.offsetHeight + 4 : 0))), g = P.g, s = run.steps[i]; // 캔버스와 현재 상태임(아래 설명 줄 높이만큼 뺌) / canvas and current state (minus the explanation row)
      const EN = QP.I18N && QP.I18N.lang() === "en", tr = function (x) { return EN ? QP.I18N.tr(x) : x; }, NUM = "①②③④⑤⑥"; // 쌍 번호 / pair numbers
      let best = 0, bv = -1; D.pairs.forEach(function (p, k) { const v = s.sig[p[0]] * s.sig[p[1]]; if (v > bv) { bv = v; best = k; } }); // 가장 함께 높은 쌍임 / pair highest together
      const w = (P.w - 10) / 6;                     // 위젯 하나 폭임 / width of one widget
      D.pairs.forEach(function (p, k) {             // 쌍마다 / for each pair
        shownA[k] = A.lerp(shownA[k], s.sig[p[0]], .12); shownB[k] = A.lerp(shownB[k], s.sig[p[1]], .12); // 다이얼이 부드럽게 회전하도록 값을 천천히 따라감 / values follow slowly so the dials turn smoothly
        A.pair(g, 4 + k * w, 2, w - 6, P.h - 4, shownA[k], shownB[k], [NUM[k] + " " + tr(PAIRN[k][0]), tr(PAIRN[k][1])], k === best && bv > .1); // 회로 위젯을 그림(번호를 붙여 아래 설명과 연결) / draw the circuit widget (numbered to link with the explanation below)
      });
      if (qx && (frame % 15 === 0 || !qx.childElementCount)) {   // 아래 설명 줄: 같은 번호로 각 쌍의 뜻과 지금 값을 구체적으로 보임 / explanation row: each pair's meaning and current values, same numbers
        qx.innerHTML = D.pairs.map(function (p, k) { const a = s.sig[p[0]], b = s.sig[p[1]], z = M.pairAnalytic(a, b), hi = a > .45 && b > .45, one = (a > .45) !== (b > .45);
          const st = hi ? (EN ? "both high: overlapping risk" : "둘 다 높음: 겹친 위험") : one ? (EN ? "one high: not overlapping yet" : "한쪽만 높음: 아직 겹침 아님") : (EN ? "both low: calm" : "둘 다 낮음: 평온");
          return '<div class="qx' + (hi ? " hot" : one ? " warm" : "") + (k === best && bv > .1 ? " best" : "") + '"><b>' + NUM[k] + " " + tr(PAIRN[k][0]) + " × " + tr(PAIRN[k][1]) + '</b><span class="qr">' + (EN ? QP.I18N.tr(MEAN[k][0]) : MEAN[k][0]) + '</span><span>' + tr(PAIRN[k][0]) + " " + Math.round(a * 100) + "%, " + tr(PAIRN[k][1]) + " " + Math.round(b * 100) + "% → ⟨Z⟩ " + z.toFixed(2) + "</span><em>" + st + "</em></div>"; }).join("");
      }
    }
    function drawNet(i) {                           // DNN 안의 신호 흐름을 그림 / draws the signal flow inside the DNN
      const P = A.canvas(nv, nv.parentNode.clientHeight - 16), g = P.g; // 캔버스임 / canvas
      if (!QP.DNN || !QP.DNN.model) return;         // 신경망이 없으면 끝냄 / stop if there is no network
      const fw = QP.DNN.forward(run.steps[i].sig), m = QP.DNN.model; // 순전파 결과와 가중치임 / forward results and weights
      const xo = P.w - 22; A.deepNet(g, m, { x0: 10, x1: xo, y0: 16, y1: P.h - 14, acts: fw.acts, small: true }); // 지금 신호가 은닉층 3개를 지나 흐르는 모습을 그림 / draw signals flowing through the three hidden layers now
      g.fillStyle = "#1d2a4d"; g.font = "bold 10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillText((fw.o * 100).toFixed(0) + "%", xo, P.h / 2 + 26); g.textAlign = "left"; g.fillText("DNN 내부 흐름", 4, 9); // 글씨임 / text
    }
    function drawCharts(i) {                        // 아래 두 시계열 그래프를 그림 / draws the two time-series graphs below
      const st = run.steps, n = st.length;          // 전체 시간 단계임 / all time steps
      const pick = [[3, "강수", "#4d6b8c"], [9, "급경사", "#c76b67"], [0, "심박 부담", "#a9482a"], [12, "낙석", "#c38a2b"], [8, "일몰 압박", "#6e4c82"], [7, "결빙", "#7fb0d8"]]; // 보여 줄 신호임 / signals to show
      const cs = $("#mSig", el), P = A.canvas(cs, cs.parentNode.clientHeight - 16), g = P.g, L = 30, W = P.w - L - 6, H = P.h - 30; // 신호 그래프 준비임 / prepare the signal graph
      g.fillStyle = "#1d2a4d"; g.font = "bold 12.5px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("입력 신호(0~1) 시간 변화", L, 11); // 제목임 / title
      let lgx = L + 4; g.font = "10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; pick.forEach(function (p) { g.strokeStyle = p[2]; g.lineWidth = 1.6; g.beginPath(); for (let t = 0; t <= i; t += 2) { const px = L + W * t / n, py = 16 + H - H * st[t].sig[p[0]]; if (t) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); g.fillStyle = p[2]; g.fillRect(lgx, P.h - 9, 8, 6); g.fillText(p[1], lgx + 10, P.h - 2); lgx += g.measureText(p[1]).width + 18; }); // 신호마다 선을 그리고, 범례는 글자 폭만큼 띄워 겹치지 않게 배치함 / draw a line per signal; legend spaced by text width to avoid overlap
      g.strokeStyle = "#ccd3e4"; g.strokeRect(L, 16, W, H); // 테두리임 / border
      const cs2 = $("#mSc", el), Q = A.canvas(cs2, cs2.parentNode.clientHeight - 16), h = Q.g, W2 = Q.w - L - 6, H2 = Q.h - 30; // 점수 그래프 준비임 / prepare the score graph
      h.fillStyle = "#1d2a4d"; h.font = "bold 12.5px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; h.fillText("AI 위험 점수와 경보(분홍 띠 = 실제 위험 사건)", L, 11); // 제목임 / title
      run.events.forEach(function (ev) { h.fillStyle = "rgba(199,107,103,.18)"; h.fillRect(L + W2 * ev.s / n, 16, Math.max(2, W2 * (ev.e - ev.s) / n), H2); }); // 사건 구간 띠임 / event interval bands
      [["lin", "#4d6b8c", run.thrL], ["qf", "#6e4c82", run.thrQ], ["dnn", "#c38a2b", .5]].forEach(function (p) { if (st[0][p[0]] == null) return; h.strokeStyle = p[1]; h.lineWidth = 1.8; h.beginPath(); for (let t = 0; t <= i; t += 2) { const px = L + W2 * t / n, py = 16 + H2 - H2 * st[t][p[0]]; if (t) h.lineTo(px, py); else h.moveTo(px, py); } h.stroke(); h.setLineDash([4, 3]); h.beginPath(); h.moveTo(L, 16 + H2 - H2 * p[2]); h.lineTo(L + W2, 16 + H2 - H2 * p[2]); h.stroke(); h.setLineDash([]); }); // 세 점수 선과 기준 점선임 / three score lines and threshold dashes
      run.events.forEach(function (ev) { [["q", "#6e4c82"], ["lin", "#4d6b8c"]].forEach(function (p, k) { const at = ev[p[0]]; if (at >= 0 && at <= i) { h.fillStyle = p[1]; h.beginPath(); h.moveTo(L + W2 * at / n, 16 + k * 8); h.lineTo(L + W2 * at / n - 4, 8 + k * 8); h.lineTo(L + W2 * at / n + 4, 8 + k * 8); h.fill(); } }); }); // 첫 경보 시점을 삼각형으로 표시함 / mark first alarm times with triangles
      h.strokeStyle = "#ccd3e4"; h.strokeRect(L, 16, W2, H2); h.strokeStyle = "#ffb500"; h.lineWidth = 2; h.beginPath(); h.moveTo(L + W2 * i / n, 14); h.lineTo(L + W2 * i / n, 16 + H2); h.stroke(); // 테두리와 현재 시각선임 / border and current-time line
      h.font = "10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; let lx2 = L + 4; [["일반 AI", "#4d6b8c"], ["양자 특징 AI", "#6e4c82"], ["DNN", "#c38a2b"]].forEach(function (p) { h.fillStyle = p[1]; h.fillRect(lx2, Q.h - 9, 8, 6); h.fillText(p[0], lx2 + 10, Q.h - 2); lx2 += h.measureText(p[0]).width + 18; }); // 범례(글자 폭만큼 띄움)임 / legend (spaced by text width)
    }
    function drawStat(i) {                          // 오른쪽 상태판을 갱신함 / updates the right status panel
      const s = run.steps[i], c = run.course;        // 현재 상태와 코스임 / current state and course
      const near = s.near.filter(function (n) { return n.s > 0 && n.q.type !== "stamp"; }); // 감지 중인 지점임 / points being detected
      const ev = run.events.filter(function (e) { return e.s <= i; }); // 지금까지 일어난 사건임 / events so far
      const lead = function (e, k) { if (e[k] < 0) return "놓침"; const m = (e.s - e[k]) / 6; return m >= 0 ? m.toFixed(1) + "분 전" : (-m).toFixed(1) + "분 늦음"; }; // 선행 시간 글자임 / lead-time text
      const mn = meaning(s, run);                   // 이 순간의 의미 해석임 / interpretation of this moment
      $("#mStat", el).innerHTML = '<div class="meaning' + (mn.hot ? " hot" : "") + '"><b>지금 이 순간의 의미</b><p><i>상황</i> ' + mn.sit + '</p><p><i>양자 표현</i> ' + mn.qx + '</p><p><i>의미</i> ' + mn.mean + '</p><p><i>AI 판단</i> ' + mn.eff + '</p><p><i>권고</i> ' + mn.act + '</p></div>' +
        '<h3>' + c.name + " " + c.peak + ' 관제</h3><div class="kv">' +
        '<span>시각</span><b>' + hhmm(s.min) + '</b><span>진행</span><b>' + (s.up ? "오르는 중 " : "내려가는 중 ") + Math.round(s.p / (2 * c.L) * 100) + '%</b>' +
        '<span>고도, 경사</span><b>' + Math.round(s.elev) + 'm, ' + Math.round(s.grade * 100) + '%</b><span>속도</span><b>' + s.v.toFixed(1) + ' km/h</b>' +
        '<span>심박</span><b>' + Math.round(s.hr) + ' bpm (%HRR ' + Math.round(s.pHRR * 100) + ')</b><span>기온, 비</span><b>' + s.T.toFixed(1) + '°C, ' + s.rain.toFixed(1) + ' mm/h</b></div>' +
        '<h4>감지 중 ' + near.length + '곳</h4>' + (near.map(function (n) { return '<div class="det">' + n.q.icon + " " + n.q.name + " <b>" + Math.max(0, Math.round(n.d)) + "m</b> 신호 " + n.s.toFixed(2) + "</div>"; }).join("") || '<div class="small">감지 거리 안의 위험 지점 없음</div>') +
        '<h4>사건과 경보(' + ev.length + '/' + run.events.length + ')</h4>' + ev.slice(-3).reverse().map(function (e) { return '<div class="det">' + hhmm(run.steps[e.s].min) + " " + e.where + '<br><span class="c-plum">양자 ' + lead(e, "q") + '</span> / <span class="c-dusk">일반 ' + lead(e, "lin") + "</span></div>"; }).join("") +
        B.box({ data: "mountain.js 엔진이 만든 10초 간격 시계열(" + run.steps.length + "단계)", method: "POI까지 앞쪽 거리 d가 감지 거리 R 안이면 신호 = 1 − d/R → 신호 쌍을 RY(π, 값) 회전 → CNOT → ⟨Z⟩ → 로지스틱 점수 ≥ 기준이면 경보", formula: "선행 시간 = 사건 시작 시각 − 첫 경보 시각(사건 15분 전부터 탐색)", code: "mountain.js simulate(), score() / anim.js pair()", ref: "감지 거리: 세미나 부록(위험구역 120, 야생동물 180, 낙석 100 m), 심박: Tanaka 2001, Karvonen", note: "코스, POI 위치는 가상이며 실측 GPX와 위험 정보로 교체 예정" }, "관제 계산");
    }
    function events(i) {                            // 음성과 기록에 쓸 사건을 확인함 / checks events for voice and logging
      const s = run.steps[i];                       // 현재 상태임 / current state
      s.near.forEach(function (n) { if (n.s > 0 && n.q.type !== "stamp" && n.d > 0) say("near" + n.q.name + (s.up ? 1 : 0), n.q.name + "까지 " + Math.round(n.d) + "미터 남았습니다. 감지를 시작합니다."); if (n.q.type === "stamp" && n.s > .5) say("stamp", n.q.name + "에 도착했습니다. 스탬프를 찍었습니다."); }); // 지점 접근과 정상 도착을 알림 / announce point approach and summit arrival
      if (s.qf >= run.thrQ && !(run.steps[Math.max(0, i - 1)].qf >= run.thrQ)) say("q" + Math.floor(i / 30), "양자 특징 AI가 경보를 냈습니다. " + (s.lin >= run.thrL ? "일반 AI도 함께 경보입니다." : "일반 AI는 아직 조용합니다.")); // 양자 경보 시작을 알림 / announce the start of a quantum alarm
      run.events.forEach(function (e, k) { if (e.s === i) say("ev" + k, e.where + " 근처에서 위험 사건이 시작됐습니다. 양자 특징 AI는 " + (e.q < 0 ? "놓쳤고" : (e.s - e.q) / 6 > 0 ? ((e.s - e.q) / 6).toFixed(1) + "분 먼저 알렸고" : "동시에 알렸고") + ", 일반 AI는 " + (e.lin < 0 ? "놓쳤습니다." : (e.s - e.lin) / 6 > 0 ? ((e.s - e.lin) / 6).toFixed(1) + "분 먼저 알렸습니다." : "늦게 알렸습니다.")); }); // 사건 시작과 선행 시간을 알림 / announce event start and lead time
      if (s.policy) say("pol" + s.policy.slice(0, 6), "안전 규칙이 먼저입니다. " + s.policy); // 안전 규칙을 알림 / announce safety rules
      const mn = meaning(s, run); if (mn.hot) say("hot" + mn.risk + Math.floor(i / 90), "지금 " + mn.sit + "입니다. " + mn.mean + "입니다. " + mn.eff + ". " + mn.act); // 위험이 겹치는 순간의 의미를 읽어 줌 / read out the meaning of overlapping-risk moments
    }
    const stop = A.loop(function (dt) {             // 매 프레임 실행됨 / runs every frame
      guideTick(); if (playing && !gpaused()) simT += dt * cfg.speed;          // 재생 중이면(설명 중이 아닐 때) 시뮬레이션 시각을 진행함 / advance sim time while playing
      const maxT = (run.steps.length - 1) * 10;     // 마지막 시각임 / last time
      if (simT >= maxT) { simT = maxT; if (playing) { playing = false; $("#mPlay", el).textContent = "▶ 다시"; QP.State.stamps[run.course.mi] = new Date().toLocaleDateString("ko-KR"); playing = true; const evs = run.events, qe = evs.filter(function (e) { return e.q >= 0 && e.q <= e.s; }).length, le = evs.filter(function (e) { return e.lin >= 0 && e.lin <= e.s; }).length; say("done", "하산을 마쳤습니다. 이번 산행에서 위험 사건은 " + evs.length + "번 있었고, 양자 특징 AI는 그중 " + qe + "번, 일반 AI는 " + le + "번을 사건 전에 미리 알렸습니다. 아래 오른쪽 그래프의 삼각형이 각 AI가 처음 경보한 시점입니다. 스탬프 투어 기록에 저장했습니다."); playing = false; doneHold = true; } }
      if (doneHold && !gpaused()) { doneHold = false; QP.Pace.hold(false); } // 끝나면 멈추고 스탬프를 기록함 / stop at the end and record the stamp
      const i = Math.floor(simT / 10), frac = (simT / 10) - i; // 현재 단계와 단계 사이 비율임 / current step and fraction between steps
      drawMountain(i, frac); drawQubits(i);         // 산과 큐비트는 매 프레임 그림 / mountain and qubits drawn every frame
      if (++frame % 6 === 0 || i !== lastI) { if (frame % 6 === 0) { drawNet(i); drawCharts(i); drawStat(i); } if (i !== lastI) events(i); lastI = i; } // 나머지는 6프레임마다 그림 / the rest every 6 frames
      $("#mClock", el).textContent = hhmm(run.steps[i].min) + ", " + Math.round(simT / 60) + "분 경과";
    });
    $("#mPlay", el).onclick = function () { QP.Voice.wake(); if (simT >= (run.steps.length - 1) * 10) reset(); playing = !playing; this.textContent = playing ? "❚❚ 멈춤" : "▶ 계속"; QP.Pace.hold(playing); if (playing && simT < 1 && $("#mV", el).checked) { gno = 0; gq.push({ text: QP.I18N && QP.I18N.lang() === "en" ? "We set off on the " + QP.I18N.tr(run.course.name) + " course. Until Snowflake reaches the summit and completes the descent, it will pause at every risk point and explain in order what has changed. The yellow circle on the mountain is the detection radar, and the dials below show the risk signals turned into qubit rotations." : run.course.name + " " + run.course.peak + " 코스를 " + G.personas[cfg.persona].name.split(" ")[0] + "과 함께 출발합니다. 날씨는 " + G.weathers[cfg.weather].name + "입니다. 눈송이가 정상까지 올랐다가 하산을 마칠 때까지, 위험 지점이 나타날 때마다 잠시 멈춰 무엇이 바뀌었는지 차례로 설명해 드립니다. 왼쪽 산 그림의 노란 원은 감지 레이더이고, 아래 다이얼은 위험 신호를 큐비트 회전으로 바꾼 모습입니다." }); } }; // 출발, 멈춤 버튼(출발하면 끝까지 단계 안내, 전체 안내도 기다림) / start/stop (guided to the end; the tour waits)
    $("#mReset", el).onclick = function () { playing = false; $("#mPlay", el).textContent = "▶ 출발"; reset(); }; // 처음 버튼임 / reset button
    ["mM", "mP", "mW"].forEach(function (id) { $("#" + id, el).onchange = function (e) { cfg[{ mM: "mountain", mP: "persona", mW: "weather" }[id]] = Number(e.target.value); playing = false; $("#mPlay", el).textContent = "▶ 출발"; reset(); }; }); // 설정이 바뀌면 다시 계산함 / recompute when settings change
    $("#mF", el).onchange = function (e) { cfg.fall = e.target.checked; reset(); }; // 낙상 체크임 / fall checkbox
    $("#mSe", el).onchange = function (e) { QP.State.season = Number(e.target.value); if (QP.Decor) QP.Decor.season(QP.State.season); playing = false; $("#mPlay", el).textContent = "▶ 출발"; reset(); }; // 계절이 바뀌면 다시 계산하고 장식도 바꿈 / recompute and change the decor when the season changes
    $("#mS", el).onchange = function (e) { cfg.speed = Number(e.target.value); }; // 배속임 / playback speed
    requestAnimationFrame(function () { drawCharts(0); drawStat(0); drawNet(0); }); // 처음 그림임 / first drawing
    QP.State.simNarr = function () { return "지금 " + run.course.name + " " + run.course.peak + " 코스 관제 화면입니다. 산 그림 위의 눈송이가 등산로를 따라 움직이고, 앞쪽 위험 지점이 감지 거리 안에 들어오면 그 신호가 올라갑니다. 아래의 다이얼은 각 신호를 큐비트 회전으로 바꾼 모습이고, 노란 연결선은 씨낫 게이트가 작동하는 정도입니다. 오른쪽 끝의 막대가 겹침 점수입니다. 맨 아래 그래프에서 분홍 띠는 실제 위험 사건이고, 자두색 선이 양자 특징 인공지능, 청색 선이 일반 인공지능 점수입니다. 삼각형은 처음 경보를 낸 시점입니다."; }; // 이 화면의 설명 대본임 / narration script of this screen
    return function () { stop(); QP.Pace.hold(false); };                 // 화면을 떠나면 루프를 멈춤 / stop the loop when leaving the screen
  }

  /* ===== iNavi 100대 명산 스탬프 투어 / iNavi top-100 mountains stamp tour  ===== */
  function stamp(el) {
    let sel = QP.State.stampSel || 0, per = 0, wi = 1; // 선택한 산, 산행자, 날씨임 / selected mountain, hiker, weather
    el.innerHTML = '<div class="grid stamp"><div class="card stack passport"><h3>스탬프 여권 <span class="small">(관제실에서 하산까지 마치면 찍힘)</span></h3><div id="sP" class="stamps"></div></div>' +
      '<div class="card stack"><div class="row" style="justify-content:space-between"><h3 id="sTitle"></h3><div class="btns"><select id="sPer">' + G.personas.map(function (p, i) { return '<option value="' + i + '">' + p.name + '</option>'; }).join("") + '</select><select id="sW">' + G.weathers.map(function (w, i) { return '<option value="' + i + '">' + w.name + '</option>'; }).join("") + '</select><button id="sGo" class="primary">관제실에서 오르기 ▶</button><button id="sCyc" data-autoplay="1">▶ 산 순환</button></div></div>' +
      '<canvas id="sCv"></canvas><div id="sRes" class="cmp3"></div></div></div>';
    $("#sW", el).value = wi;                        // 기본 날씨(소나기)를 표시함 / show the default weather (shower)
    function draw() {                               // 선택한 산의 분석을 그림 / draws the analysis of the selected mountain
      const cfg = { mountain: sel, persona: per, weather: wi, fall: false }, run = runFor(cfg), c = run.course; // 즉시 시뮬레이션함 / simulate instantly
      $("#sP", el).innerHTML = G.mountains.map(function (m, i) { const got = QP.State.stamps[i]; return '<button class="stampc' + (i === sel ? " sel" : "") + (got ? " got" : "") + '" data-i="' + i + '"><b>' + m[0] + '</b><small>' + m[1] + " " + m[2] + 'm</small>' + (got ? '<i>✔ ' + got + '</i>' : '') + '</button>'; }).join(""); // 스탬프 칸 16개임 / 16 stamp cells
      $("#sP", el).querySelectorAll("button").forEach(function (b) { b.onclick = function () { sel = Number(b.dataset.i); QP.State.stampSel = sel; draw(); }; }); // 산을 고르면 다시 그림 / redraw on choosing a mountain
      $("#sTitle", el).textContent = c.name + " " + c.peak + " (" + c.summit + "m, " + c.region + ") 양자 안전 코스 분석"; // 제목임 / title
      const P = A.canvas($("#sCv", el), Math.max(190, Math.round(el.clientHeight * .5))), g = P.g, X = function (d) { return 30 + d / c.L * (P.w - 40); }, Y = function (e) { return P.h - 20 - (e - c.start) / (c.summit - c.start) * (P.h - 60); }; // 그림 준비임 / prepare the drawing
      g.fillStyle = "#dfe8f6"; g.beginPath(); g.moveTo(X(0), P.h - 20); for (let k = 0; k <= c.n; k++) g.lineTo(X(k / c.n * c.L), Y(c.elev[k])); g.lineTo(X(c.L), P.h - 20); g.fill(); // 산 단면임 / mountain profile
      (function () { let b0 = -1, bi = 0; for (let k = 0; k <= c.n; k++) { const on = k < c.n && c.grades[k] > .34; if (on && b0 < 0) b0 = k; if (!on && b0 >= 0) { let mx = 0; g.fillStyle = "rgba(198,40,40,.22)"; g.beginPath(); g.moveTo(X(b0 / c.n * c.L), P.h - 20); for (let j = b0; j <= k; j++) { g.lineTo(X(j / c.n * c.L), Y(c.elev[j])); if (j < k) mx = Math.max(mx, c.grades[j]); } g.lineTo(X(k / c.n * c.L), P.h - 20); g.fill(); g.strokeStyle = "#c62828"; g.lineWidth = 5; g.beginPath(); for (let j = b0; j <= k; j++) g.lineTo(X(j / c.n * c.L), Y(c.elev[j])); g.stroke(); const mk = (b0 + k) / 2 / c.n * c.L, t = "⚠ 급경사 " + Math.round(mx * 100) + "%"; g.font = "bold 11.5px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; const tw = g.measureText(t).width + 8, lx = Math.max(2, Math.min(P.w - tw - 2, X(mk) + 8)), ly = Y(G.elevAt(c, mk)) + 18 + (bi++ % 2) * 16; g.fillStyle = "#c62828"; g.fillRect(lx, ly - 12, tw, 16); g.fillStyle = "#fff"; g.textAlign = "left"; g.fillText(t, lx + 4, ly); b0 = -1; } } })(); // 급경사 구간을 붉은 면, 굵은 선, 표지로 강조함 / highlight steep sections with red fill, thick lines and labels
      const st = run.steps, half = st.findIndex(function (s) { return !s.up; }); // 오르는 구간 끝임 / end of the climbing part
      for (let k = 0; k < half; k += 3) { const s = st[k]; g.fillStyle = s.qf >= run.thrQ ? "#6e4c82" : s.lin >= run.thrL ? "#4d6b8c" : "rgba(0,0,0,.08)"; g.fillRect(X(s.x), Y(s.elev) - 4, 3, 4); } // 오르막에서 경보 위치를 색으로 표시함 / mark alarm positions on the climb by color
      c.pois.forEach(function (q) { g.fillStyle = q.type === "stamp" ? "#ffb500" : "#c76b67"; g.beginPath(); g.arc(X(q.x), Y(G.elevAt(c, q.x)) - 12, 6, 0, 7); g.fill(); g.fillStyle = "#1d2a4d"; g.font = "10px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; const py = Y(G.elevAt(c, q.x)), nw = g.measureText(q.name).width, px = Math.min(P.w - nw / 2 - 4, Math.max(nw / 2 + 4, X(q.x))); g.fillText(q.name, px, py - 22); // 오른쪽 끝에서 잘리지 않게 안쪽으로 당김 / pulled inward so it is not clipped at the edge // 지점 이름 / point name
        const tag = q.type === "stamp" ? "POI 스탬프" : "POI"; g.font = "bold 9px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; const tw = g.measureText(tag).width + 8; g.fillStyle = q.type === "stamp" ? "#b07a00" : "#003087"; g.fillRect(px - tw / 2, py - 44, tw, 13); g.fillStyle = "#fff"; g.fillText(tag, px, py - 34.5); }); // 등록된 POI임을 알리는 표지 / tag showing it is a registered POI
      g.textAlign = "left"; g.font = "11px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillStyle = "#1d2a4d"; g.fillText("POI = iNavi에 등록된 관심 지점(노란 점: 스탬프 인증 POI, 붉은 점: 위험 POI)", 34, 16); // 범례 / legend
      const ev = run.events, ql = ev.filter(function (e) { return e.q >= 0 && e.q <= e.s; }), ll = ev.filter(function (e) { return e.lin >= 0 && e.lin <= e.s; }); // 사건 전에 알린 사건들임 / events warned before they happened
      const avg = function (a, k) { return a.length ? (a.reduce(function (t, e) { return t + (e.s - e[k]) / 6; }, 0) / a.length).toFixed(1) : "-"; }; // 평균 선행 시간(분)임 / mean lead time (min)
      const fa = function (k, thr) { return run.steps.filter(function (s) { return !s.truth && s[k] >= thr; }).length / 6; }; // 위험 아닌데 울린 시간(분)임 / time rung without risk (min)
      $("#sRes", el).innerHTML = '<div class="card tint-dusk"><b>일반 AI</b><p class="kpi c-dusk">' + ll.length + '/' + ev.length + '</p><p class="small">사건 전 경보, 평균 ' + avg(ll, "lin") + '분 전, 불필요 경보 ' + fa("lin", run.thrL).toFixed(0) + '분</p></div>' +
        '<div class="card tint-plum"><b>양자 특징 AI</b><p class="kpi c-plum">' + ql.length + '/' + ev.length + '</p><p class="small">사건 전 경보, 평균 ' + avg(ql, "q") + '분 전, 불필요 경보 ' + fa("qf", run.thrQ).toFixed(0) + '분</p></div>' +
        '<div class="card"><b>산행 예상</b><p class="kpi">' + Math.round(st[st.length - 1].t / 60) + '분</p><p class="small">왕복 ' + (2 * c.L / 1000).toFixed(1) + ' km, 최대 심박 ' + Math.round(Math.max.apply(null, st.map(function (s) { return s.hr; }))) + ' bpm</p></div>' +
        '<div style="grid-column:1/-1">' + B.box({ data: "선택한 산의 가상 코스(표고: 산림청 100대 명산 공개 자료), " + G.personas[per].name + ", " + G.weathers[wi].name, method: "산행 전체를 즉시 시뮬레이션해 위험 사건 구간마다 두 AI의 첫 경보 시점을 비교함. 그림의 점 색: 자두=양자 경보, 청=일반 경보", formula: "평균 선행 시간 = Σ(사건 시작 − 첫 경보)/사건 수, 불필요 경보 = 위험 아닌 시간 중 경보 시간", code: "views_mountain.js stamp(), mountain.js score()", note: "코스 단면, POI 위치는 가상. 실제 스탬프 인증 지점, 등산로 GPX(아이나비 DTO-2, DTO-4)로 교체해야 함" }, "스탬프 코스 분석") + '</div>'; // 결과 카드 세 개와 근거임 / three result cards and evidence
    }
    $("#sPer", el).onchange = function (e) { per = Number(e.target.value); draw(); }; // 산행자 변경임 / change hiker
    $("#sW", el).onchange = function (e) { wi = Number(e.target.value); draw(); }; // 날씨 변경임 / change weather
    $("#sGo", el).onclick = function () { QP.State.simCfg = { mountain: sel, persona: per, weather: wi, fall: false, speed: 120 }; QP.App.go("sim"); }; // 관제실로 이동함 / go to the control room
    let cyc = null; $("#sCyc", el).onclick = function () { if (cyc) { clearInterval(cyc); cyc = null; this.textContent = "▶ 산 순환"; return; } this.textContent = "■ 순환 멈춤"; cyc = setInterval(function () { sel = (sel + 1) % G.mountains.length; QP.State.stampSel = sel; draw(); }, 7000); }; // 7초마다 다음 산을 분석해 계속 바뀌게 함 / analyze the next mountain every 7 s so it keeps changing
    requestAnimationFrame(draw);                    // 처음 그림임 / first drawing
    return function () { clearInterval(cyc); };     // 떠날 때 순환을 멈춤 / stop cycling when leaving
  }

  /* ===== 4큐비트 위험구역 회로 (세미나 부록) / 4-qubit risk-zone circuit (seminar appendix)  ===== */
  function zone4q(el) {
    el.innerHTML = '<div class="grid z4"><div class="z4left">' + // 왼쪽: 산행 장면+입력, 왜 측정하나 / 오른쪽: 큰 회로, 결과 박스 3개 / left: hiking scene + inputs, why measure / right: large circuit, three result boxes
      '<div class="card z4in"><h3>입력(거리 m): 산행자가 걸어가면 세 위험 지점까지 거리가 바뀜</h3><canvas id="zScene"></canvas><p id="zCap" class="zcap">▶ 산행 따라 걷기를 누르면 눈송이가 입구부터 끝까지 세 지점을 모두 지나며 설명합니다.</p><div class="z4sl">' + ['위험구역|z0|15', '야생동물 신고 지역|z1|260', '낙석 구간|z2|190'].map(function (t) { const p = t.split("|"); return '<div class="slider"><span>' + p[0] + '</span><input id="' + p[1] + '" type="range" min="0" max="300" value="' + p[2] + '"><output></output></div>'; }).join("") +
      '<div class="slider"><span>위치 신뢰도</span><input id="zq" type="range" min="0" max="100" value="95"><output></output></div></div><div class="row"><label class="tog"><input type="checkbox" id="zClosed"> 공식 출입 통제</label><label class="tog"><input type="checkbox" id="zMiss"> 위험구역 자료 없음</label><b>세미나 예시</b><div class="btns"><button data-f="15,260,190">위험구역</button><button data-f="220,20,170">야생동물</button><button data-f="240,300,12">낙석</button><button data-f="220,270,180">안전</button><button id="zAuto" data-autoplay="1">▶ 산행 따라 걷기</button></div></div></div>' + '<div class="card tint-plum zwhy"><h3>왜 이것을 측정하나</h3><ul class="why4"><li><b>q0~q2 = 세 위험까지의 거리</b>: 산행 앱이 GPS로 아는 거리를 각도로 넣어, 가까울수록 1 쪽으로 돎</li><li><b>q3 = 위치 신뢰도</b>: GPS 오차가 크면(숲, 계곡) 거리 자체를 믿을 수 없어 판독을 보류함 → 헛경보 방지</li><li><b>CNOT 3개</b>: 세 위험 상태를 보조 큐비트 하나에 모아 “위험 지점이 하나라도 가까운가”를 한 번에 읽음. q3 판독이 높으면 <b>안심 신호</b>(신뢰도 높고 가까운 위험 없음)</li><li><b>현실 쓰임</b>: 갈림길, 절벽 근처에서 위험 종류를 동시에 비교해 가장 가까운 것부터 안내</li></ul></div></div><div class="z4right">' +
      '<div class="card z4c"><h3>4큐비트 회로(진폭 16개): 회전 → CNOT 3개 → 보정 → 판독</h3><canvas id="zCv"></canvas></div>' +
      '<div class="z4out"><div class="card"><h3>상태벡터 16칸(진폭²)</h3><canvas id="zSv"></canvas></div><div class="card"><h3>고전 거리 점수 vs 양자 판독</h3><canvas id="zBars"></canvas><div class="legend"><span style="--c:#4d6b8c">고전</span><span style="--c:#6e4c82">양자 P(1)</span></div></div><div class="card"><h3>지금 판단(현실 의미)</h3><div id="zAct" class="banner info"></div><p id="zTxt"></p><div id="zB"></div></div></div></div></div></div>';
    const ids = ["z0", "z1", "z2", "zq"]; let shown = [0, 0, 0, 0], last = null, zH = 0; // 슬라이더, 다이얼 표시값, 회로 캔버스 높이임 / sliders, dial values, circuit canvas height
    function calc() {                               // 입력으로 판단을 다시 계산함 / recompute the decision from inputs
      ids.forEach(function (id) { const i = $("#" + id, el); i.nextSibling.value = id === "zq" ? (i.value / 100).toFixed(2) : i.value; }); // 숫자 표시임 / number display
      const dist = [Number($("#z0", el).value), Number($("#z1", el).value), Number($("#z2", el).value)]; if ($("#zMiss", el).checked) dist[0] = null; // 거리 입력임 / distance inputs
      last = M.zoneAssess(dist, $("#zq", el).value / 100, $("#zClosed", el).checked); // 세미나 절차 그대로 판단함 / decide exactly per the seminar procedure
      $("#zAct", el).textContent = { block_route: "block_route: 공식 통제 → 회로 없이 즉시 경로 후보에서 제외", check_sources: "check_sources: 신뢰도 0.6 미만 또는 자료 없음 → 판독 보류, 출처 확인", score_only: "score_only: 점수만 계산(안내 결정은 안전 정책, 사용자 확인과 함께)" }[last.action]; // 행동 설명임 / action explanation
      if (last.action === "score_only") { C.bars($("#zBars", el), ["위험구역", "야생동물", "낙석"].map(function (n, i) { return { label: n, values: [last.classical[i], last.quantum[i]] }; }).concat([{ label: "보조 q3", values: [0, last.ancilla] }]), [{ color: "#4d6b8c" }, { color: "#6e4c82" }], { height: 130, max: 1 }); const top = last.quantum.indexOf(Math.max.apply(null, last.quantum)), pv = last.quantum[top]; $("#zTxt", el).textContent = pv < .1 ? "세 위험 지점 모두 멉니다. 큐비트가 0 쪽에 머물러 경보 없이 계속 걸어도 됩니다." : "지금 산행자에게 가장 가까운 위험은 ‘" + ["위험구역", "야생동물 신고 지역", "낙석 구간"][top] + "’(판독 " + (pv * 100).toFixed(0) + "%)입니다. " + (pv > .6 ? "앞으로 그 구간을 지날 때 주의 안내를 띄웁니다." : "아직 멀어서 관찰만 합니다.") + " 고전 거리 점수와 순위가 같아서, 이 회로의 의미는 같은 거리 정보를 양자 형식으로 다루는 실험 틀이라는 점입니다."; } else { C.bars($("#zBars", el), [{ label: "판독 없음", values: [0] }], [{ color: "#ccc" }], { height: 130 }); $("#zTxt", el).textContent = "안전 정책이 회로보다 먼저 적용됨."; } // 결과 그래프임 / result graph
      $("#zB", el).innerHTML = B.box({ data: "거리 3개(m), 위치 신뢰도", method: "거리 → 1−d/기준거리(120, 180, 100 m) → RY(π, 값) → CNOT(q0,q1,q2 → q3) → RY(π, 신뢰도/12) 보정 → 큐비트별 P(1)", code: "models.js zoneAssess(), qp/models.py zone_assess()", ref: "2026 전문가 초청 세미나 부록 Python 코드(36~39쪽), tests/test_emulator.py 기대값 통과", note: "세미나 제안 회로이며 탐지 성능은 실측 시험으로 확인해야 함" }, "4큐비트 판독"); // 근거임 / evidence
    }
    const stop = A.loop(function () {               // 다이얼 애니메이션 루프임 / dial animation loop
      if (!zH) zH = Math.max(200, Math.round(el.clientHeight * .5)); // 처음 한 번만 카드 높이에 맞춰 캔버스 높이를 정함(늘어나는 되먹임 방지) / set the canvas height to the card only once (prevents growing feedback)
      const P = A.canvas($("#zCv", el), zH), H = P.h, g = P.g, x = last && last.x ? last.x : [0, 0, 0, 0]; // 회로 캔버스와 입력임 / circuit canvas and inputs
      const gap = (H - 44) / 3, R = Math.min(26, gap * .36), y0 = 24, X0 = 140, CX = X0 + 2 * R + 110, RX = CX + 3 * 64 + 40; // 줄 간격, 다이얼 크기, CNOT 위치, 판독 위치임 / row gap, dial size, CNOT positions, readout positions
      ["q0 위험구역", "q1 야생동물", "q2 낙석", "q3 신뢰도(보조)"].forEach(function (n, q) { shown[q] = A.lerp(shown[q], x[q], .1); const y = y0 + q * gap; g.strokeStyle = "#c9cfe0"; g.lineWidth = 2; g.beginPath(); g.moveTo(X0 - 16, y); g.lineTo(RX - 6, y); g.stroke(); g.fillStyle = "#1d2a4d"; g.font = "bold 13px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "left"; g.fillText(n, 4, y + 5); A.dial(g, X0 + R, y, R, Math.PI * shown[q], "", q === 3 ? "#c38a2b" : "#003087", shown[q] > .5 ? shown[q] : 0); g.fillStyle = "#4a5470"; g.font = "11px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("RY(π×" + shown[q].toFixed(2) + ")", X0 + 2 * R + 10, y - 6); }); // 입력 다이얼(회전 애니메이션)임 / input dials (rotation animation)
      [0, 1, 2].forEach(function (c, k) { const xx = CX + k * 64, y = y0 + c * gap, yt = y0 + 3 * gap; g.strokeStyle = "rgba(255,181,0," + (.35 + .65 * shown[c]) + ")"; g.lineWidth = 2 + 5 * shown[c]; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, yt); g.stroke(); g.fillStyle = "#003087"; g.beginPath(); g.arc(xx, y, 7, 0, 7); g.fill(); g.strokeStyle = "#003087"; g.lineWidth = 2; g.beginPath(); g.arc(xx, yt, 13, 0, 7); g.stroke(); g.beginPath(); g.moveTo(xx - 13, yt); g.lineTo(xx + 13, yt); g.moveTo(xx, yt - 13); g.lineTo(xx, yt + 13); g.stroke(); g.fillStyle = "#b07a00"; g.font = "bold 11px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("CNOT", xx - 15, y - 11); }); // CNOT 3개(제어가 1일 가능성만큼 굵고 진하게)임 / three CNOTs (thicker and darker by the chance the control is 1)
      g.fillStyle = "#1d2a4d"; g.font = "bold 12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("판독 P(1)", RX, 14); [0, 1, 2, 3].forEach(function (q) { const y = y0 + q * gap, p1 = last && last.state ? QP.Sim.probOne(last.state, q) : 0, bw = Math.max(80, P.w - RX - 70); g.fillStyle = "#eef0f6"; g.fillRect(RX, y - 10, bw, 20); g.fillStyle = q === 3 ? "#c38a2b" : "#6e4c82"; g.fillRect(RX, y - 10, bw * p1, 20); g.fillStyle = "#1d2a4d"; g.fillText((p1 * 100).toFixed(1) + "%", RX + bw + 6, y + 5); }); // 큐비트별 판독 막대임 / readout bar per qubit
      if (last && last.state) { const p = QP.Sim.probs(last.state), Q = A.canvas($("#zSv", el), 150), h = Q.g, bw = (Q.w - 10) / 16; for (let i = 0; i < 16; i++) { h.fillStyle = p[i] > .1 ? "#6e4c82" : "#b9a6c8"; h.fillRect(5 + i * bw, 112 - p[i] * 105, bw - 2, p[i] * 105); h.save(); h.translate(5 + i * bw + bw / 2, 116); h.rotate(-Math.PI / 2); h.textAlign = "right"; h.font = "9px monospace"; h.fillStyle = "#4a5470"; h.fillText(QP.Sim.label(i, 4), 0, 3); h.restore(); } } // 16개 결과 확률 막대임 / probability bars of the 16 outcomes
    });
    ids.concat(["zClosed", "zMiss"]).forEach(function (id) { $("#" + id, el).oninput = calc; $("#" + id, el).onchange = calc; }); // 입력 연결임 / wire up inputs
    el.querySelectorAll("[data-f]").forEach(function (b) { b.onclick = function () { const v = b.dataset.f.split(","); ["z0", "z1", "z2"].forEach(function (id, i) { $("#" + id, el).value = v[i]; }); $("#zq", el).value = 95; $("#zClosed", el).checked = false; $("#zMiss", el).checked = false; calc(); }; }); // 예시 버튼임 / example buttons
    // 산행 장면: 900 m 등산로 위 위험구역(250 m), 야생동물 신고 지역(520 m), 낙석 구간(760 m)을 눈송이가 지나감 / hiking scene: Snowflake passes a risk zone (250 m), wildlife report area (520 m) and rockfall section (760 m) on a 900 m trail
    const ZP = [250, 520, 760], ZN = ["위험구역", "야생동물", "낙석"], ZR = [120, 180, 100]; let walkX = 0, zt = null; // 지점 위치, 이름, 감지 기준 거리, 산행자 위치임 / point positions, names, detection distances, hiker position
    const walker = new Image(); walker.src = QP.Brand.local("go"); // 걷는 눈송이 이미지임 / walking Snowflake image
    function scene() {                              // 산행 장면과 거리를 그림 / draws the hiking scene and distances
      const P = A.canvas($("#zScene", el), 120), g = P.g, X = function (m) { return 10 + m / 900 * (P.w - 20); }, Y = function (m) { return 112 - m / 900 * 60; }; // 거리 → 화면 좌표(오르막)임 / distance → screen coordinates (uphill)
      g.fillStyle = "#dfe8f6"; g.beginPath(); g.moveTo(X(0), 120); for (let m = 0; m <= 900; m += 30) g.lineTo(X(m), Y(m) - 6 * Math.sin(m / 70)); g.lineTo(X(900), 120); g.fill(); // 산비탈임 / hillside
      ZP.forEach(function (p, k) { const d = Math.abs(p - walkX), on = d <= ZR[k]; g.fillStyle = on ? "rgba(199,40,40,.22)" : "rgba(255,181,0,.15)"; g.fillRect(X(p - ZR[k]), Y(p) - 18, X(p + ZR[k]) - X(p - ZR[k]), 10); g.fillStyle = on ? "#c62828" : "#003087"; g.beginPath(); g.arc(X(p), Y(p) - 22, on ? 7 + 2 * Math.sin(performance.now() / 450) : 6, 0, 7); g.fill(); g.font = "bold 11px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillText(ZN[k] + " " + Math.round(d) + "m", X(p), Y(p) - 33); }); // 위험 지점, 감지 범위 띠, 현재 거리임 / risk points, detection bands, current distances
      if (walker.complete && walker.naturalWidth) g.drawImage(walker, X(walkX) - 14, Y(walkX) - 44, 28, 36); else { g.fillStyle = "#003087"; g.beginPath(); g.arc(X(walkX), Y(walkX) - 20, 6, 0, 7); g.fill(); } // 걷는 눈송이임 / walking Snowflake
      g.textAlign = "left"; g.fillStyle = "#1d2a4d"; g.font = "11px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillText("가까울수록 큐비트가 1 쪽으로 돌아감 → 아래 회로", 8, 12); // 연결 설명임 / link explanation
    }
    // 눈송이가 입구(0 m)에서 끝(900 m)까지 걸으며 세 지점마다 멈춰 설명함(투어 중에도 끝까지 감) / Snowflake walks 0 → 900 m, stopping at all three points
    let TALK = [
      "① 출발: 눈송이가 등산로 입구에서 출발합니다. 앞에 위험구역(250 m), 야생동물 신고 지역(520 m), 낙석 구간(760 m)이 차례로 있습니다. 세 지점까지의 거리가 그대로 큐비트 세 개의 회전 각도가 됩니다.",
      "② 위험구역 도착(0 m): 위험구역까지 거리가 0 m가 되어 q0 화살표가 1 쪽으로 완전히 돌아갔습니다. 나머지 두 지점은 아직 멀어 q1, q2는 0 쪽에 머뭅니다. 첫 번째 CNOT이 이 상태를 보조 큐비트 q3에 모으고, 지금 판단 칸이 위험구역 안내로 바뀝니다.",
      "③ 야생동물 신고 지역 도착(0 m): 회로가 하는 일은 위험구역과 같아 반복처럼 보이지만, 이번에는 q1이 돌아가고 두 번째 CNOT이 쓰입니다. 위험구역은 이미 지나 거리가 다시 멀어졌으므로 q0은 0 쪽으로 돌아왔습니다. 감지 기준이 180 m로 가장 길어 더 멀리서부터 화살표가 기울기 시작한 점이 다릅니다.",
      "④ 낙석 구간 도착(0 m): 같은 원리의 세 번째 반복이며, 이번에는 q2와 세 번째 CNOT입니다. 낙석은 감지 기준이 100 m로 가장 짧아 가까이 와서야 화살표가 급하게 돕니다. 낙석은 위에서 떨어지는 위험이라 머무르지 말고 빨리 지나가라는 안내가 맞습니다.",
      "⑤ 끝 지점 도착: 세 위험 지점을 모두 지나 거리가 멀어졌으므로 q0, q1, q2가 모두 0 쪽으로 돌아왔고 경보가 꺼졌습니다. 정리하면 같은 회로가 세 번 반복되지만, 어느 큐비트가 도는지, 몇 m 앞부터 반응하는지, 현장 안내가 무엇인지가 지점마다 다릅니다."
    ];
    if (QP.I18N && QP.I18N.lang() === "en" && QP.NarrEN) TALK = QP.NarrEN.talk;   // 영어 모드 해설 / English narration
    let zT0 = 0;
    const ZN2 = ["위험구역", "야생동물 신고 지역", "낙석 구간"];
    function cap(k) { const c = $("#zCap", el); if (c) { c.innerHTML = TALK[k]; c.className = "zcap on"; } }
    function setD() { ["z0", "z1", "z2"].forEach(function (id, k) { $("#" + id, el).value = Math.min(300, Math.round(Math.abs(ZP[k] - walkX))); }); calc(); }
    function endWalk(done) { clearInterval(zt); zt = null; QP.Pace.hold(false); const b = $("#zAuto", el); if (b) b.textContent = done ? "▶ 처음부터 다시 걷기" : "▶ 산행 따라 걷기"; }
    $("#zAuto", el).onclick = function () {
      if (zt) { endWalk(false); return; }
      this.textContent = "■ 걷기 멈춤"; if (walkX >= 898) walkX = 0; QP.Pace.hold(true);
      let zPause = true, zLast = -1; setD(); cap(0); QP.Pace.say(TALK[0].replace(/^①\s*/, "")); QP.Pace.wait(6000, function () { zPause = false; }, function () { return document.body.contains(el); });
      zt = setInterval(function () {
        const now = performance.now(), dts = Math.min(1, (now - (zT0 || now)) / 1000); zT0 = now;
        if (zPause || !document.body.contains(el)) return;
        const near = ZP.some(function (zp) { return Math.abs(zp - walkX) < 40; }); walkX = Math.min(900, walkX + dts * (near ? 14 : 42)); setD();   // 시간 기준 속도: 멀 때 초속 42 m, 지점 근처 14 m / time-based speed
        ZP.forEach(function (zp, k) { if (walkX >= zp - .5 && zLast < k) { zLast = k; walkX = zp; setD(); zPause = true; cap(k + 1); QP.Pace.say(TALK[k + 1].replace(/^[②③④]\s*/, "")); QP.Pace.wait(8000, function () { zPause = false; }, function () { return document.body.contains(el); }); } });
        if (walkX >= 900) { zPause = true; cap(4); QP.Pace.say(TALK[4].replace(/^⑤\s*/, "")); QP.Pace.wait(7000, function () { endWalk(true); }, function () { return document.body.contains(el); }); }
      }, 100); zT0 = 0;
    };
    const sceneStop = A.loop(scene);                // 장면을 계속 그림 / keep drawing the scene
    calc();                                         // 처음 계산함 / first computation
    return function () { stop(); sceneStop(); clearInterval(zt); QP.Pace.hold(false); }; // 떠날 때 루프와 걷기를 멈춤 / stop the loop and walking when leaving
  }

  QP.ViewDefs = (QP.ViewDefs || []).concat([        // 화면 정의를 등록함 / register the screen definitions
    { id: "sim", group: "산행 관제실", title: "산행 관제 시뮬레이션", render: sim },
    { id: "stamp", group: "산행 관제실", title: "iNavi 100대 명산 스탬프 투어", render: stamp },
    { id: "zone4q", group: "산행 관제실", title: "4큐비트 위험구역 회로", render: zone4q }
  ]);
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
