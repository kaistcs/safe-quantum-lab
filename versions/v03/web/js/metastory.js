/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Meta-learning for everyone: a 5-step picture story and an honest 3-way comparison experiment (meta vs pooled vs random). */
/* =====================================================================
 * metastory.js (2026-11-17)
 *  1. QP.MetaStory : 메타학습을 "과녁과 출발점" 그림 5단계로 설명함. 단계마다 설명을 다 읽은 뒤에만 다음 그림으로 넘어감
 *     과녁 = 그 사람에게 딱 맞는 위험 기준(가중치), 별 = 인공지능의 출발점 θ, 분홍 점선 = 기록 10개로 고치는 걸음(안쪽 루프),
 *     남색 선 = 여러 사람 결과로 출발점을 옮긴 길(바깥 루프). 그림은 개념 설명용이며 실제 수치는 비교 실험에서 계산함
 *  2. QP.MetaCompare : 같은 사람, 같은 기록, 같은 Adam 0.05로 세 방법을 학습해 처음 보는 사람 12명 × 시험 묶음 3개 × 시작 씨앗 3개으로 비교함
 *     ① 메타(FOMAML) ② 모두 섞어 학습(pooled, 사람 구분 없이 한 번에 학습한 뒤 미세 조정) ③ 무작위 시작
 *     개인차 크기(1배, 3배, 6배)를 바꿔 어느 방법이 언제 유리한지 객관적으로 봄
 *  근거 : Finn 등 ICML 2017(MAML), Nichol 등 2018(1차 근사), Chen 등 ICLR 2019와 Tian 등 ECCV 2020(함께 학습 후 미세 조정이 강한 기준선임)
 * ===================================================================== */
(function (QP) {
  "use strict";
  const en = function () { return QP.I18N && QP.I18N.lang() === "en"; };
  const L = function (ko, e) { return en() ? e : ko; };
  const F = "Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif";
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; };
  // 설명 읽기: 투어 중이면 투어 순서를 지키고(Pace), 사용자가 직접 누른 재생이면 소리를 냄(끊지 않도록 앞 설명이 끝난 뒤에만 부름)
  function say(t, user) { if (QP.State && QP.State.touring) return QP.Pace.say(t); if (user) return QP.Voice.speak(t, true, true); return QP.Pace.say(t); }
  function after(mark, min, cb, alive) { const t0 = Date.now(); (function w() { if (alive && !alive()) return; if (Date.now() - t0 < min || (!QP.Voice.finished(mark) && Date.now() - t0 < 600000)) { setTimeout(w, 300); return; } cb(); })(); }

  // 눈송이 지시봉이 지금 설명하는 곳을 가리킴(보이는 곳만) / Snowflake points at what is being explained (only when visible)
  function point(e, f) { if (!e || !e.isConnected || !QP.App || !QP.App.pointAt) return; try { e.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (x) { } setTimeout(function () { if (!e.isConnected) return; const r = e.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) return; const q = f ? f(r) : [r.left + Math.min(40, r.width / 2), r.top + Math.min(r.height / 2, 30)]; QP.App.pointAt(q[0], q[1]); }, 500); }
  /* ---------- 1. 쉬운 이야기 5단계 / 5-step story ---------- */
  const STEP_C = ["#1e63c6", "#d81b60", "#e08a00", "#003087", "#2e7d32"];
  const CHIP = [["기록 모으기", "Collect records"], ["한 사람에게 맞춰 보기", "Fit one person"], ["맞췄는지 시험", "Test the fit"], ["출발점 옮기기", "Move the start"], ["새 사람은 금방", "New person, fast"]];
  const TXT = [
    ["1단계, 기록 모으기입니다. 여러 사람이 산을 오르며 남긴 기록을 모읍니다. 동그란 과녁은 그 사람에게 딱 맞는 위험 기준이고, 사람마다 위치가 다릅니다. 과녁 둘레의 파란 점은 연습용 기록 10개, 주황 점은 시험용 기록 30개입니다.",
     "Step 1, collect records. We gather the records people left while hiking. Each round target is the risk standard that fits that person exactly, and it sits in a different place for each person. Blue dots around a target are 10 practice records, and orange dots are 30 test records."],
    ["2단계, 한 사람에게 맞춰 보기입니다. 별은 인공지능의 출발점입니다. 연습 기록 10개로 다섯 번 고치며 그 사람의 과녁 쪽으로 다가갑니다. 분홍 점선이 한 걸음씩 늘어나는 것을 보시기 바랍니다.",
     "Step 2, fit one person. The star is the AI's starting point. Using the 10 practice records, it corrects itself five times and moves toward that person's target. Watch the pink dotted line grow one step at a time."],
    ["3단계, 맞췄는지 시험하기입니다. 다섯 걸음 뒤의 기준으로 시험 기록 30개를 풀어 봅니다. 과녁에서 떨어진 만큼 틀린 답이 생기며, 초록은 맞힌 기록, 빨강은 틀린 기록입니다. 이 틀린 정도가 다음 단계의 단서가 됩니다.",
     "Step 3, test the fit. With the standard after five steps, we answer the 30 test records. The farther from the target, the more wrong answers; green means correct and red means wrong. How wrong it is becomes the clue for the next step."],
    ["4단계, 출발점 옮기기입니다. 네 사람 모두에게 같은 시험을 한 뒤, 누구에게든 몇 걸음 만에 닿을 수 있는 자리로 출발점을 조금씩 옮깁니다. 남색 선이 출발점이 옮겨 간 길이며, 이것이 메타학습의 바깥 루프입니다.",
     "Step 4, move the start. After testing all four people the same way, we move the starting point little by little to a place from which anyone can be reached in a few steps. The navy line is the path of the start, and this is the outer loop of meta-learning."],
    ["5단계, 새 사람은 금방 맞춥니다. 처음 보는 사람이 와도, 잘 옮겨 둔 출발점에서는 한두 걸음이면 과녁 가까이 갑니다. 회색 별처럼 아무 데서나 출발하면 다섯 걸음 뒤에도 멉니다.",
     "Step 5, a new person is fitted quickly. Even for someone never seen before, one or two steps from the well-placed start get close to the target. Starting anywhere, like the gray star, is still far away after five steps."]];
  const TG = [[.16, .30, "A 여 62세", "A F 62"], [.84, .26, "B 남 31세", "B M 31"], [.22, .84, "C 여 45세", "C F 45"], [.80, .82, "D 남 70세", "D M 70"]];
  const NEW = [.64, .40, "E 처음 보는 사람", "E new person"], S0 = [.04, .08], SC = [.49, .55], FR = .35;
  const hop = function (a, b, k, fr) { const r = 1 - Math.pow(1 - (fr || FR), k); return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]; };

  function story(cv, opts) {
    opts = opts || {};
    const st = { s: 0, t0: performance.now(), on: false, tok: 0, done: [false, false, false, false, false] };
    function draw() {
      if (!cv.isConnected) return;
      const P = QP.Anim.canvas(cv, 280), g = P.g, W = P.w, H = P.h, now = performance.now(), el = Math.min(1, (now - st.t0) / (st.dur || 9000));
      // 위: 단계 칩 5개 / top: 5 step chips
      const cw = (W - 12) / 5;
      CHIP.forEach(function (c, i) { const x = 6 + i * cw, on = i === st.s, past = i < st.s; g.globalAlpha = on || past ? 1 : .45; g.fillStyle = on ? STEP_C[i] : "#fff"; g.strokeStyle = STEP_C[i]; g.lineWidth = on ? 2.5 : 1.4; g.beginPath(); g.roundRect ? g.roundRect(x + 2, 4, cw - 6, 26, 13) : g.rect(x + 2, 4, cw - 6, 26); g.fill(); g.stroke(); g.fillStyle = on ? "#fff" : STEP_C[i]; g.font = "bold " + (cw < 150 ? 10.5 : 12) + "px " + F; g.textAlign = "center"; g.fillText((i + 1) + ". " + L(c[0], c[1]) + (past ? " ✓" : ""), x + cw / 2, 22); g.globalAlpha = 1; });
      if (st.on) { g.fillStyle = STEP_C[st.s]; g.fillRect(6 + st.s * cw + 4, 32, (cw - 10) * el, 3); }   // 지금 단계 진행 막대 / progress bar of the current step
      // 장면 영역 / scene box
      const x0 = 8, y0 = 42, sw = W * .64, sh = H - 52, X = function (p) { return x0 + p[0] * sw; }, Y = function (p) { return y0 + p[1] * sh; };
      g.fillStyle = "#f6f8fc"; g.fillRect(x0, y0, sw, sh); g.strokeStyle = "#d5dae6"; g.strokeRect(x0, y0, sw, sh);
      const s = st.s;
      // 과녁 / targets
      const vis = s === 0 ? Math.floor(el * 4.999) + 1 : 4;
      TG.slice(0, vis).forEach(function (t, i) { const fade = s >= 4 ? .35 : 1; g.globalAlpha = fade; [16, 10, 4].forEach(function (r, k) { g.strokeStyle = k === 2 ? "#c62828" : "#8a6d3b"; g.lineWidth = 1.6; g.beginPath(); g.arc(X(t), Y(t), r, 0, 7); g.stroke(); });
        g.fillStyle = "#3a2a10"; g.font = "bold 11.5px " + F; const lft = t[0] < .5; g.textAlign = lft ? "left" : "right"; g.fillText(L(t[2], t[3]), X(t) + (lft ? 38 : -38), Y(t) + 4);
        if (s === 0) { const tt = now / 1400 + i; for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283 + tt * (k < 10 ? 1 : -.6), rr = k < 10 ? 24 : 32; g.fillStyle = k < 10 ? "#1e63c6" : "#e08a00"; g.beginPath(); g.arc(X(t) + Math.cos(a) * rr, Y(t) + Math.sin(a) * rr * .8, 2.3, 0, 7); g.fill(); } }
        g.globalAlpha = 1; });
      const star = function (p, col, lab) { const cx = X(p), cy = Y(p); g.fillStyle = col; g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 4.5 : 11, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); if (lab) { g.font = "bold 11px " + F; g.textAlign = "left"; g.fillText(lab, cx + 12, cy - 6); } };
      const path = function (a, b, k, col, fr) { g.strokeStyle = col; g.setLineDash([5, 4]); g.lineWidth = 2.2; g.beginPath(); for (let j = 0; j <= k; j++) { const q = hop(a, b, j, fr); if (j) g.lineTo(X(q), Y(q)); else g.moveTo(X(q), Y(q)); } g.stroke(); g.setLineDash([]); for (let j = 1; j <= k; j++) { const q = hop(a, b, j, fr); g.fillStyle = col; g.beginPath(); g.arc(X(q), Y(q), 3.4, 0, 7); g.fill(); } };
      let note = "";
      if (s === 0) { star(S0, "#8a8f9c", L("출발점 θ(아직 무작위)", "start θ (random)")); note = L("과녁 " + vis + "개: 사람마다 맞는 기준이 다름", vis + " targets: each person's standard differs"); }
      if (s === 1 || s === 2) { const k = s === 1 ? Math.min(5, Math.floor(el * 6.2)) : 5; star(S0, "#a9482a", L("출발점 θ", "start θ")); path(S0, TG[0], k, "#d81b60"); note = L("A에게 맞추기: " + k + "걸음째", "fitting A: step " + k);
        if (s === 2) { const e = hop(S0, TG[0], 5), d = Math.hypot(e[0] - TG[0][0], (e[1] - TG[0][1]) * sh / sw), d0 = Math.hypot(S0[0] - TG[0][0], (S0[1] - TG[0][1]) * sh / sw), acc = Math.max(.5, 1 - .55 * d / d0 - .08), ok = Math.round(30 * acc), shown = Math.min(30, Math.floor(el * 34));
          g.strokeStyle = "#c62828"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(e), Y(e)); g.lineTo(X(TG[0]), Y(TG[0])); g.stroke();
          for (let k2 = 0; k2 < shown; k2++) { const gx = X([.36, 0]) + (k2 % 10) * 15, gy = Y([0, .14]) + Math.floor(k2 / 10) * 16, good = k2 < ok; g.fillStyle = good ? "#2e7d32" : "#c62828"; g.font = "bold 13px " + F; g.textAlign = "center"; g.fillText(good ? "○" : "×", gx, gy); }
          note = L("시험 30개 중 " + Math.min(ok, shown) + "개 맞힘(그림 설명용)", Math.min(ok, shown) + " of 30 test records right (illustration)"); } }
      if (s === 3) { const R = 4, rr = Math.min(R - 1e-6, el * R), r0 = Math.floor(rr), fr = rr - r0; let c = S0; const trail = [S0];
        for (let r = 0; r < r0; r++) { c = hop(c, SC, 1, .55); trail.push(c); }
        TG.forEach(function (t, i) { path(c, t, Math.min(5, Math.floor(fr * 6)), "rgba(216,27,96," + (i === 0 ? .9 : .55) + ")"); });
        const nx = hop(c, SC, 1, .55 * fr * fr); trail.push(nx);
        g.strokeStyle = "#003087"; g.lineWidth = 3; g.beginPath(); trail.forEach(function (q, j) { if (j) g.lineTo(X(q), Y(q)); else g.moveTo(X(q), Y(q)); }); g.stroke();
        star(S0, "#c3c7d1"); star(nx, "#a9482a", L("출발점 θ", "start θ")); note = L("바깥 루프 " + (r0 + 1) + "회째: 네 사람 모두에게 가까운 쪽으로", "outer loop " + (r0 + 1) + ": toward all four people"); }
      if (s === 4) { const k = Math.min(5, Math.floor(el * 6.2)), k1 = Math.min(2, k), C0 = hop(S0, SC, 4, .55);
        [16, 10, 4].forEach(function (r, j) { g.strokeStyle = j === 2 ? "#2e7d32" : "#2e7d32"; g.setLineDash([3, 3]); g.lineWidth = 1.8; g.beginPath(); g.arc(X(NEW), Y(NEW), r, 0, 7); g.stroke(); }); g.setLineDash([]); g.fillStyle = "#1b5e20"; g.font = "bold 11px " + F; g.textAlign = "center"; g.fillText(L(NEW[2], NEW[3]), X(NEW), Y(NEW) - 22);
        path(C0, NEW, k1, "#2e7d32", .62); path(S0, NEW, k, "#8a8f9c"); star(S0, "#8a8f9c", L("무작위 출발점", "random start")); star(C0, "#a9482a", L("배운 출발점 θ", "learned start θ"));
        note = L("배운 출발점 " + k1 + "걸음, 무작위 출발점 " + k + "걸음", "learned start " + k1 + " steps, random start " + k + " steps"); }
      g.fillStyle = "#1d2a4d"; g.font = "bold 12px " + F; g.textAlign = "left"; g.fillText(note, x0 + 6, y0 + sh - 8);
      // 오른쪽: 범례와 이번 단계 한 줄 / right: legend and the one-line summary of this step
      const lx = x0 + sw + 12, lw = W - lx - 6; let ly = y0 + 14;
      const leg = [["◎", "#8a6d3b", L("과녁 = 그 사람에게 맞는 위험 기준", "target = the risk standard that fits the person")], ["★", "#a9482a", L("별 = 인공지능 출발점 θ", "star = AI start θ")], ["┄", "#d81b60", L("분홍 점선 = 기록 10개로 고치는 걸음", "pink dots = steps fitted with 10 records")], ["━", "#003087", L("남색 선 = 출발점이 옮겨 간 길", "navy line = path of the start")], ["★", "#8a8f9c", L("회색 별 = 무작위 출발점", "gray star = random start")], ["○×", "#2e7d32", L("초록 맞힘, 빨강 틀림", "green right, red wrong")]];
      g.font = "11.5px " + F; leg.forEach(function (r, i) { g.fillStyle = r[1]; g.font = "bold 13px " + F; g.fillText((i + 1) + ". " + r[0], lx, ly); g.fillStyle = "#1d2a4d"; g.font = "11.5px " + F; wrap(g, r[2], lx + 34, ly, lw - 34, 14); ly += 30; });
      const ev = opts.ev && opts.ev(); if (ev && s === 4) { g.fillStyle = "#1b5e20"; g.font = "bold 12px " + F; wrap(g, L("실제 실험(이 화면): 배운 출발점 1걸음 " + pct(ev.meta[1]) + ", 무작위 5걸음 " + pct(ev.rand[5]), "Real run on this screen: learned start 1 step " + pct(ev.meta[1]) + ", random 5 steps " + pct(ev.rand[5])), lx, ly + 4, lw, 15); }
    }
    function wrap(g, t, x, y, w, lh) { const words = t.split(" "); let line = "", yy = y; words.forEach(function (wd) { const tst = line ? line + " " + wd : wd; if (g.measureText(tst).width > w && line) { g.fillText(line, x, yy); line = wd; yy += lh; } else line = tst; }); if (line) g.fillText(line, x, yy); }
    const loop = setInterval(draw, 60);
    function go(i) { st.s = i; st.t0 = performance.now(); if (opts.onStep) opts.onStep(i); point(cv, function (r) { return [r.left + 6 + (i + .5) * (r.width - 12) / 5, r.top + 20]; }); }
    function play(user, done) {
      const my = ++st.tok, alive = function () { return my === st.tok && cv.isConnected; }; st.on = true;
      (function step(i) {
        if (!alive()) return; if (i >= 5) { st.on = false; if (done) done(); return; }
        go(i); const ev = opts.ev && opts.ev();
        let t = TXT[i][en() ? 1 : 0]; if (i === 4 && ev) t += L(" 이 화면의 실험에서는 배운 출발점에서 한 걸음 적응한 정확도가 " + Math.round(ev.meta[1] * 100) + "퍼센트, 무작위 출발점에서 다섯 걸음 적응한 정확도가 " + Math.round(ev.rand[5] * 100) + "퍼센트였습니다.", " In the run on this screen, one step from the learned start gave " + Math.round(ev.meta[1] * 100) + " percent accuracy, and five steps from a random start gave " + Math.round(ev.rand[5] * 100) + " percent.");
        st.dur = Math.max(9000, t.length * (en() ? 60 : 135)); const mk = say(t, user); after(mk, st.dur + 600, function () { step(i + 1); }, alive); /* 그림 진행 시간을 설명 길이에 맞춤 / match the picture timing to the narration length */
      })(0);
    }
    draw();
    return { play: play, go: go, stop: function () { st.tok++; st.on = false; }, destroy: function () { st.tok++; clearInterval(loop); } };
  }

  /* ---------- 2. 정직한 비교 실험 / honest comparison ---------- */
  const MC = [["메타(FOMAML)", "Meta (FOMAML)", "#003087"], ["모두 섞어 학습 후 미세 조정", "Pooled + fine-tune", "#2e7d32"], ["무작위 시작", "Random start", "#8a8f9c"]];
  function compare(box) {
    const rows = [], st = { tok: 0, prog: 0, stage: -1, res: null, het: 1, ml: [], pl: [], anim: 0 };
    box.innerHTML = '<div class="mc-ctl"><b>' + L("개인차 크기", "Size of personal differences") + '</b> ' + [1, 3, 6].map(function (h, i) { return '<label><input type="radio" name="mcH" value="' + h + '"' + (i ? "" : " checked") + "> " + (i + 1) + ". " + h + L("배", "×") + (i ? "" : L("(지금 자료)", " (current data)")) + "</label>"; }).join(" ") +
      ' <button class="primary" id="mcGo">▶ ' + L("세 방법 비교 실험", "Run 3-way comparison") + "</button></div>" +
      '<ol class="mc-st">' + [L("같은 사람, 같은 기록 준비", "Same people, same records"), L("메타 학습 150회(시작 씨앗 3개)", "Meta training 150 (3 seeds)"), L("모두 섞어 학습 150회(같은 자료, 같은 Adam)", "Pooled training 150 (same data, same Adam)"), L("처음 보는 사람 12명 × 시험 묶음 3개 × 시작 씨앗 3개로 0, 1, 5걸음 적응 시험", "Adapt 0, 1, 5 steps: 12 new people × 3 test sets × 3 seeds"), L("판정과 의미", "Verdict and meaning")].map(function (t, i) { return '<li data-i="' + i + '">' + t + "</li>"; }).join("") + "</ol>" +
      '<canvas class="mc-cv"></canvas><p class="small mc-w"></p><div class="mc-t"></div>';
    const cv = box.querySelector(".mc-cv");
    function stage(i) { st.stage = i; box.querySelectorAll(".mc-st li").forEach(function (li, k) { li.className = k < i ? "done" : k === i ? "on" : ""; }); const li = box.querySelectorAll(".mc-st li")[i]; point(i === 4 ? box.querySelector(".mc-w") : li || cv); }
    function draw() {
      if (!cv.isConnected) return;
      const P = QP.Anim.canvas(cv, 230), g = P.g, W = P.w, H = P.h;
      // 왼쪽: 학습 손실 두 줄 / left: two training-loss lines
      const lw = W * .36; g.strokeStyle = "#d5dae6"; g.strokeRect(6, 8, lw, H - 44); g.fillStyle = "#1d2a4d"; g.font = "bold 12px " + F; g.textAlign = "left"; g.fillText(L("학습 손실(낮을수록 잘 맞음)", "training loss (lower = better fit)"), 10, 22);
      const all = st.ml.concat(st.pl), mx = all.length ? Math.max.apply(null, all) : 1, mn = all.length ? Math.min.apply(null, all) : 0;
      [[st.ml, MC[0][2]], [st.pl, MC[1][2]]].forEach(function (s) { if (s[0].length < 2) return; g.strokeStyle = s[1]; g.lineWidth = 2; g.beginPath(); s[0].forEach(function (v, i) { const x = 10 + i / 149 * (lw - 10), y = 30 + (1 - (v - mn) / Math.max(1e-6, mx - mn)) * (H - 84); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); });
      g.font = "11px " + F; g.fillStyle = MC[0][2]; g.fillText("1. " + L("메타(적응 뒤 시험 손실)", "meta (test loss after adapting)") + (st.ml.length ? " " + st.ml[st.ml.length - 1].toFixed(3) : ""), 10, H - 18); g.fillStyle = MC[1][2]; g.fillText("2. " + L("섞어 학습(전체 손실)", "pooled (overall loss)") + (st.pl.length ? " " + st.pl[st.pl.length - 1].toFixed(3) : ""), 10, H - 5);
      if (st.stage >= 1 && st.stage <= 2) { g.fillStyle = "#e08a00"; g.fillRect(10, H - 36, (lw - 10) * st.prog, 5); }
      // 오른쪽: 적응 걸음별 막대 경주 / right: bar race by adaptation step
      const bx = lw + 24, bw = W - bx - 6; g.fillStyle = "#1d2a4d"; g.font = "bold 12px " + F; g.fillText(L("처음 보는 사람 정확도(적응 걸음별)", "accuracy on new people (by adaptation step)"), bx, 22);
      const steps = [0, 1, 5], gh = (H - 54) / 3, a = st.anim;
      steps.forEach(function (sp, r) { const y = 32 + r * gh; g.fillStyle = "#1d2a4d"; g.font = "bold 11.5px " + F; g.fillText(sp + L("걸음", " step" + (sp === 1 ? "" : "s")), bx, y + gh / 2 + 3);
        const x1 = bx + 52, ww = bw - 110; g.strokeStyle = "#e5e8f0"; [.5, .6, .7, .8, .9, 1].forEach(function (v) { const xx = x1 + (v - .5) / .5 * ww; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + gh - 6); g.stroke(); });
        if (!st.res) return; const vals = [st.res.meta[sp], st.res.pool[sp], st.res.rand[sp]], best = Math.max.apply(null, vals);
        vals.forEach(function (v, m) { const vv = .5 + (v - .5) * Math.min(1, a), bh = (gh - 10) / 3, yy = y + m * bh; g.fillStyle = MC[m][2]; g.fillRect(x1, yy, Math.max(0, (vv - .5) / .5 * ww), bh - 2); g.fillStyle = "#1d2a4d"; g.font = (v === best && a >= 1 ? "bold " : "") + "11px " + F; g.fillText(pct(v * Math.min(1, a) + (1 - Math.min(1, a)) * .5) + (v === best && a >= 1 ? L(" (1위)", " (best)") : ""), x1 + Math.max(0, (vv - .5) / .5 * ww) + 4, yy + bh - 4); }); });
      g.font = "11px " + F; const SH = [["메타", "meta"], ["섞어 학습", "pooled"], ["무작위", "random"]]; MC.forEach(function (m, i) { g.fillStyle = m[2]; g.fillRect(bx + i * bw / 3, H - 14, 10, 10); g.fillStyle = "#1d2a4d"; g.fillText((i + 1) + ". " + L(SH[i][0], SH[i][1]), bx + i * bw / 3 + 14, H - 5); });
    }
    const loop = setInterval(function () { if (st.res && st.anim < 1) st.anim = Math.min(1, st.anim + .03); draw(); }, 50);
    function verdict(r, het) {
      const d1 = r.meta[1] - r.pool[1], d5 = r.meta[5] - r.pool[5], dr = r.meta[1] - r.rand[5], p = function (v) { return (Math.abs(v) * 100).toFixed(1); };
      const who = Math.abs(d1) < .015 ? L("메타와 모두 섞어 학습은 사실상 비슷합니다(차이 " + p(d1) + "%p).", "Meta and pooled are practically equal (difference " + p(d1) + " pp).") : d1 > 0 ? L("메타가 모두 섞어 학습보다 " + p(d1) + "%p 높습니다.", "Meta is " + p(d1) + " pp higher than pooled.") : L("모두 섞어 학습이 메타보다 " + p(d1) + "%p 높습니다.", "Pooled is " + p(d1) + " pp higher than meta.");
      const why = d1 < -.015 ? L("지금 조건에서는 개인차가 작아, 사람을 구분하지 않고 함께 배운 모델도 이미 잘 맞습니다. 메타학습만의 이점은 개인차가 큰 실제 워치 기록에서 다시 확인해야 합니다(Chen 등 ICLR 2019, Tian 등 ECCV 2020도 함께 학습 후 미세 조정이 강한 기준선이라고 보고함).", "Under this condition personal differences are small, so a model trained on everyone together already fits well. Meta-learning's own benefit must be rechecked on real watch records with larger differences (Chen et al. ICLR 2019 and Tian et al. ECCV 2020 also report pooled training plus fine-tuning as a strong baseline).") : (d1 > .015 ? L("개인차가 큰 조건에서 사람마다 빨리 고치는 법을 배운 메타의 이점이 드러났습니다.", "With large personal differences, the benefit of meta, which learned how to adjust quickly per person, appeared.") : L("개인차가 커질수록 두 방법의 격차가 줄어듭니다. 메타가 분명히 앞선다고 말하려면 개인차가 큰 실제 워치 기록으로 다시 확인해야 합니다.", "As personal differences grow, the gap between the two methods shrinks. To claim that meta is clearly better, it must be rechecked on real watch records with larger personal differences."));
      return L("개인차 " + het + "배에서 한 걸음 적응 정확도는 메타 " + pct(r.meta[1]) + ", 모두 섞어 학습 " + pct(r.pool[1]) + ", 무작위 시작 " + pct(r.rand[1]) + "입니다. ", "With personal differences ×" + het + ", one-step accuracy is meta " + pct(r.meta[1]) + ", pooled " + pct(r.pool[1]) + ", random " + pct(r.rand[1]) + ". ") + who + L(" 다섯 걸음에서는 차이가 " + (d5 >= 0 ? "메타 +" : "섞어 학습 +") + p(d5) + "%p입니다. 무작위 시작의 다섯 걸음보다 메타 한 걸음이 " + p(dr) + "%p " + (dr >= 0 ? "높아" : "낮아") + ", 여러 사람에게서 배운 출발점 자체의 효과는 " + (dr >= 0 ? "분명합니다. " : "약합니다. "), " At five steps the gap is " + (d5 >= 0 ? "meta +" : "pooled +") + p(d5) + " pp. Meta after one step is " + p(dr) + " pp " + (dr >= 0 ? "above" : "below") + " random after five steps, so the value of a start learned from many people is " + (dr >= 0 ? "clear. " : "weak. ")) + why;
    }
    function table() { box.querySelector(".mc-t").innerHTML = rows.length ? '<table class="labtbl"><tr><th>' + L("번호", "No.") + "</th><th>" + L("개인차", "Differences") + "</th><th>" + L("메타 0/1/5걸음", "Meta 0/1/5") + "</th><th>" + L("섞어 학습 0/1/5걸음", "Pooled 0/1/5") + "</th><th>" + L("무작위 0/1/5걸음", "Random 0/1/5") + "</th><th>" + L("1걸음 1위", "Best at 1") + "</th></tr>" + rows.map(function (r, i) { const v = [r.r.meta[1], r.r.pool[1], r.r.rand[1]], b = v.indexOf(Math.max.apply(null, v)); return "<tr><td>" + (i + 1) + "</td><td>" + r.h + L("배", "×") + "</td>" + ["meta", "pool", "rand"].map(function (k, m) { return '<td style="color:' + MC[m][2] + '">' + [0, 1, 5].map(function (s) { return (r.r[k][s] * 100).toFixed(1); }).join(" / ") + "</td>"; }).join("") + '<td style="color:' + MC[b][2] + '"><b>' + L(MC[b][0], MC[b][1]) + "</b></td></tr>"; }).join("") + "</table>" : ""; }
    function run(user, done) {
      const my = ++st.tok, alive = function () { return my === st.tok && cv.isConnected; };
      const hEl = box.querySelector("input[name=mcH]:checked"), het = st.het = hEl ? +hEl.value : 1;
      st.res = null; st.anim = 0; st.ml = []; st.pl = []; st.prog = 0; box.querySelector(".mc-w").textContent = "";
      stage(0); const ms = [77, 5, 123].map(function (sd) { return QP.Meta.create(sd, het); }), m = ms[0]; /* 시작 씨앗 3개(평균으로 우연을 줄임) / 3 starting seeds */
      let mk = say(L("세 방법 비교 실험을 시작합니다. 개인차 " + het + "배 조건에서 같은 사람, 같은 기록, 같은 학습 설정으로 세 방법을 학습합니다. 1번 남색은 메타, 2번 초록은 사람 구분 없이 모두 섞어 학습한 뒤 미세 조정, 3번 회색은 무작위 시작입니다.", "Starting the three-way comparison. With personal differences ×" + het + ", the three methods learn from the same people, the same records and the same settings. 1, navy, is meta; 2, green, is pooled training plus fine-tuning; 3, gray, is a random start."), user);
      after({ done: true }, 1500, function () { stage(1); let k = 0;
        (function tr() { if (!alive()) return; for (let j = 0; j < 4 && k < 150; j++, k++) { ms.forEach(function (x) { QP.Meta.metaStep(x, 4); }); st.ml.push(m.loss[m.loss.length - 1]); st.pl.push(m.poolLoss[m.poolLoss.length - 1]); } st.prog = k / 150; if (k >= 75 && st.stage < 2) stage(2);
          if (k < 150) { setTimeout(tr, 90); return; }
          after(mk, 600, function () { stage(3); setTimeout(function () { if (!alive()) return; const R = { meta: new Array(11).fill(0), pool: new Array(11).fill(0), rand: new Array(11).fill(0) };
            ms.forEach(function (x) { [31, 999, 4242].forEach(function (sd) { const e = QP.Meta.evaluate(x, sd); ["meta", "pool", "rand"].forEach(function (key) { for (let s = 0; s <= 10; s++) R[key][s] += e[key][s] / 9; }); }); });
            st.res = R; st.anim = 0; rows.push({ h: het, r: R }); table();
            setTimeout(function () { if (!alive()) return; stage(4); const v = verdict(R, het); box.querySelector(".mc-w").textContent = v; const mk2 = say(v, user); after(mk2, 4000, function () { stage(5); if (done) done(R); }, alive); }, 1500); }, 60); }, alive); })(); }, alive);
    }
    box.querySelector("#mcGo").onclick = function () { run(true); };
    draw();
    return { run: run, destroy: function () { st.tok++; clearInterval(loop); } };
  }

  QP.MetaStory = { mount: story };
  QP.MetaCompare = { mount: compare };
})(window.QP = window.QP || {});
