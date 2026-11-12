/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
 * [English] Training internals viewer: when the AI is trained on a dataset, shows every inner step with graphics:
 *           features (classical 16 vs quantum 22, qubit animation), logistic learning curves and weights, alarm threshold,
 *           DNN epoch-by-epoch weights, meta-learning adaptation, and final test results.
 *
 * trainviz.js : "이 데이터로 AI 학습"을 누르면 학습의 내부 과정을 단계별 그림과 애니메이션으로 모두 보여 줌
 *   Ⓐ 특징 만들기(일반 16개 vs 양자 22개, 큐비트 회전과 CNOT)  Ⓑ 로지스틱 학습 곡선과 가중치  Ⓒ 경보 문턱 정하기
 *   Ⓓ DNN 반복 학습(층별 가중치 변화)  Ⓔ 메타학습(사람마다 빠른 적응)  Ⓕ 시험 결과(일반 vs 양자)
 */
(function (QP) {
  const M = QP.Models, D = QP.Data, A = QP.Anim;     // 모듈 / modules
  const FONT = "Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif";
  const CL = "#4d6b8c", CQ = "#6e4c82";             // 일반, 양자 색 / classical and quantum colors
  const pct = function (v) { return (v * 100).toFixed(1) + "%"; };
  function names() {                                // 특징 이름 22개 / names of the 22 features
    const base = D.signals.map(function (s, i) { return [i, s[1]]; }).filter(function (x) { return !D.exclusions.has(x[0]); }).map(function (x) { return x[1]; });
    return base.concat(D.pairs.map(function (p) { return "⟨Z⟩ " + D.signals[p[0]][1] + "×" + D.signals[p[1]][1]; }));
  }
  function canvas(c, h) { return A.canvas(c, h); }
  function open(ds) {                               // 학습 과정 창 열기 / open the training process window
    const old = document.getElementById("tvx"); if (old) old.remove();
    const R = QP.State.results, L = R.find(function (m) { return m.key === "linear"; }), Q = R.find(function (m) { return m.key === "quantum"; });
    const w = document.createElement("div"); w.id = "tvx"; w.className = "tvx";
    w.innerHTML = '<div class="tvbox"><div class="tvh"><b>AI 학습의 내부 과정: ' + ds.id + " " + ds.name + '</b><span class="small">왼쪽(청) = 일반 AI, 오른쪽(자두) = 양자 특징 AI</span><button id="tvClose">✕ 닫기</button></div><div class="tvsteps" id="tvSteps"></div><div id="tvBody"></div></div>';
    document.body.appendChild(w);
    const STEPS = ["Ⓐ 특징 만들기", "Ⓑ 로지스틱 학습", "Ⓒ 경보 문턱", "Ⓓ DNN 반복 학습", "Ⓔ 메타학습", "Ⓕ 시험 결과"];
    document.getElementById("tvSteps").innerHTML = STEPS.map(function (s, i) { return '<span id="tvs' + i + '">' + s + "</span>"; }).join("");
    let alive = true, stops = []; document.getElementById("tvClose").onclick = function () { alive = false; stops.forEach(function (f) { try { f(); } catch (e) { } }); w.remove(); QP.Voice.stop(); };
    const body = document.getElementById("tvBody"), live = function () { return alive; };
    const sec = function (i, title, html) { document.getElementById("tvs" + i).className = "on"; for (let k = 0; k < i; k++) document.getElementById("tvs" + k).className = "done"; body.insertAdjacentHTML("beforeend", '<div class="tvsec" id="tvx' + i + '"><h3>' + STEPS[i] + ": " + title + "</h3>" + html + "</div>"); const e = document.getElementById("tvx" + i); e.scrollIntoView({ block: "nearest", behavior: "smooth" }); return e; };
    const tr = ds.split.train, va = ds.split.valid, te = ds.split.test, NM = names();
    const sample = (tr.find(function (r) { return r.label; }) || tr[0]).x;
    const steps = [
      function (next) {                             // Ⓐ 특징 만들기 / features
        const fl = M.features(sample, "linear"), fq = M.features(sample, "quantum");
        const e = sec(0, "같은 1분 기록을 두 AI의 입력으로 바꿈", '<div class="tv2"><div class="tvc"><b>일반 AI 입력 16개</b><canvas id="tvA1"></canvas></div><div class="tvq"><b>양자 특징 AI 입력 22개 = 같은 16개 + 큐비트 회로 6개</b><canvas id="tvA2"></canvas></div></div><p class="small">위험 정답이 붙은 학습 행 하나를 예로 들었습니다. 오른쪽 아래 6개 원은 신호 쌍을 큐비트 두 개로 돌리고(RY) CNOT으로 엮어 읽은 겹침 점수 ⟨Z⟩입니다.</p>');
        const bars = function (c, f, col, extra) { const P = canvas(c, extra ? 300 : 230), g = P.g, n = f.length, bh = (P.h - 10) / n; f.forEach(function (v, i) { const y = 5 + i * bh, isQ = i >= 16; g.fillStyle = "#1d2a4d"; g.font = "10.5px " + FONT; g.textAlign = "right"; g.fillText(NM[i].slice(0, 14), 150, y + bh * .7); g.fillStyle = "#eef0f6"; g.fillRect(156, y + 1, P.w - 200, bh - 2); g.fillStyle = isQ ? CQ : col; const val = isQ ? (v + 1) / 2 : v; g.fillRect(156, y + 1, (P.w - 200) * val, bh - 2); g.textAlign = "left"; g.fillStyle = "#1d2a4d"; g.fillText((+v).toFixed(2), P.w - 40, y + bh * .7); }); };
        bars(document.getElementById("tvA1"), fl, CL, false);
        let t = 0; const stop = A.loop(function (dt) { t += dt; const c = document.getElementById("tvA2"); if (!c) return; bars(c, fq.map(function (v, i) { return i < 16 ? v : (t > 1.5 + (i - 16) * .5 ? v : 1); }), CL, true);
          const P = c.getContext("2d"); }); stops.push(stop);
        QP.Pace.say("먼저 특징 만들기입니다. 같은 1분 기록을 일반 인공지능은 신호 열여섯 개로, 양자 특징 인공지능은 같은 열여섯 개에 큐비트 회로 여섯 개의 겹침 점수를 더한 스물두 개로 받습니다. 아래 겹침 점수가 하나씩 채워지는 것이 큐비트 두 개를 돌리고 씨낫으로 엮어 읽는 과정입니다.");
        QP.Pace.wait(7000, next, live);
      },
      function (next) {                             // Ⓑ 로지스틱 / logistic
        const e = sec(1, "경사하강법 160번 반복: 손실이 줄고 가중치가 자람", '<div class="tv2"><div><b>손실 곡선(낮을수록 잘 맞춤)</b><canvas id="tvB1"></canvas></div><div><b>가장 크게 학습된 가중치 10개</b><canvas id="tvB2"></canvas></div></div>');
        let k = 0; const stop = A.loop(function (dt) { k = Math.min(L.loss.length, k + dt * 60); const c1 = document.getElementById("tvB1"); if (!c1) return; QP.Charts.line(c1, [{ values: L.loss.slice(0, Math.max(2, Math.floor(k))), color: CL }, { values: Q.loss.slice(0, Math.max(2, Math.floor(k))), color: CQ }, { values: new Array(L.loss.length).fill(L.loss[L.loss.length - 1] * .9), color: "rgba(0,0,0,0)" }], { height: 220, min: 0, xLabel: "반복 " + Math.floor(k) + " / " + L.loss.length + "  (청 일반, 자두 양자)" });
          const c2 = document.getElementById("tvB2"), P = canvas(c2, 220), g = P.g, fr = k / L.loss.length; const top = Q.w.slice(1).map(function (v, i) { return [i, v, i < 16 ? L.w[i + 1] : null]; }).sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); }).slice(0, 10), mx = Math.max.apply(null, top.map(function (x) { return Math.abs(x[1]); }).concat([1e-6])), mid = 190 + (P.w - 200) / 2, half = (P.w - 210) / 2;
          top.forEach(function (x, j) { const y = 6 + j * 21; g.fillStyle = "#1d2a4d"; g.font = "11px " + FONT; g.textAlign = "right"; g.fillText(NM[x[0]].slice(0, 18), 185, y + 13); g.fillStyle = "#c9cfe0"; g.fillRect(mid, y, 1, 18); g.fillStyle = CQ; g.fillRect(x[1] >= 0 ? mid : mid - half * Math.abs(x[1]) / mx * fr, y + 1, half * Math.abs(x[1]) / mx * fr, 8); if (x[2] != null) { g.fillStyle = CL; g.fillRect(x[2] >= 0 ? mid : mid - half * Math.abs(x[2]) / mx * fr, y + 10, half * Math.abs(x[2]) / mx * fr, 7); } else { g.fillStyle = "#6d5e55"; g.font = "10px " + FONT; g.textAlign = "left"; g.fillText("일반 AI에는 없는 입력", mid + 4, y + 17); } }); });
        stops.push(stop); QP.Pace.say("두 번째는 로지스틱 학습입니다. 두 인공지능이 같은 학습률로 백육십 번 반복하며 손실을 줄입니다. 오른쪽은 가장 크게 학습된 가중치 열 개이며, 위 막대가 양자, 아래 막대가 일반입니다. 겹침 점수 가중치는 일반 인공지능에는 없는 입력입니다.");
        QP.Pace.wait(9000, next, live);
      },
      function (next) {                             // Ⓒ 문턱 / threshold
        const e = sec(2, "기준 표본으로 오경보 10% 경보 문턱 정하기", '<div class="tv2"><div class="tvc"><b>일반 AI 점수 분포</b><canvas id="tvC1"></canvas></div><div class="tvq"><b>양자 특징 AI 점수 분포</b><canvas id="tvC2"></canvas></div></div><p class="small">청록 = 정상 표본, 붉은색 = 위험 표본, 세로 점선 = 경보 문턱(정상 표본의 90%가 그 아래). 붉은 막대가 점선 오른쪽에 많을수록 위험을 잘 잡습니다.</p>');
        const hist = function (c, m, col) { const P = canvas(c, 190), g = P.g, nb = 30, pos = new Array(nb).fill(0), neg = new Array(nb).fill(0); va.forEach(function (r) { const s = m.predict(r.x), b = Math.min(nb - 1, Math.floor(s * nb)); (r.label ? pos : neg)[b]++; }); const mx = Math.max.apply(null, pos.concat(neg)), bw = (P.w - 20) / nb; for (let b = 0; b < nb; b++) { g.fillStyle = "rgba(38,166,154,.6)"; g.fillRect(10 + b * bw, P.h - 20 - neg[b] / mx * (P.h - 40), bw * .48, neg[b] / mx * (P.h - 40)); g.fillStyle = "rgba(198,40,40,.7)"; g.fillRect(10 + b * bw + bw * .5, P.h - 20 - pos[b] / mx * (P.h - 40), bw * .48, pos[b] / mx * (P.h - 40)); } const tx = 10 + m.threshold * (P.w - 20); g.strokeStyle = col; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(tx, 6); g.lineTo(tx, P.h - 18); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.font = "bold 12px " + FONT; g.textAlign = "left"; g.fillText("문턱 " + m.threshold.toFixed(3), Math.min(P.w - 90, tx + 4), 16); g.fillStyle = "#6d5e55"; g.font = "11px " + FONT; g.fillText("0 점수 →", 10, P.h - 4); g.textAlign = "right"; g.fillText("1", P.w - 10, P.h - 4); };
        hist(document.getElementById("tvC1"), L, CL); hist(document.getElementById("tvC2"), Q, CQ);
        QP.Pace.say("세 번째는 경보 문턱입니다. 학습에 쓰지 않은 기준 표본에서, 정상 표본의 열 퍼센트만 경보가 울리도록 문턱을 정합니다. 두 인공지능에 똑같은 오경보 예산을 주는 공정한 비교입니다.");
        QP.Pace.wait(7000, next, live);
      },
      function (next) {                             // Ⓓ DNN
        const e = sec(3, "심층 신경망 22 → 12 → 8 → 6 → 1, 반복마다 가중치가 바뀜", '<div class="tv2w"><canvas id="tvD1"></canvas><div><canvas id="tvD2"></canvas><p id="tvD3" class="small"></p></div></div><p class="small">선 색: 청 = 양의 가중치, 장밋빛 = 음의 가중치, 노랑 = 이번 반복에 크게 바뀐 연결. 같은 씨앗으로 다시 학습하므로 실험실이 실제로 쓰는 신경망과 같은 결과입니다.</p>');
        const DN = QP.DNN; DN.method = "quantum"; DN.reset("quantum"); DN.setData(tr, te); const lin = M.mlpCreate(16, 10, 5), linRows = M.mlpRows(tr, "linear"); let ep = 0;
        const draw = function () { const c = document.getElementById("tvD1"); if (!c) return; const P = canvas(c, 330), g = P.g, m = DN.model; A.deepNet(g, m, { x0: 130, x1: P.w - 40, y0: 14, y1: P.h - 24, labels: NM, deltas: m.deltas }); g.fillStyle = "#1d2a4d"; g.font = "bold 13px " + FONT; g.textAlign = "left"; g.fillText("반복 " + ep + " / 25", 8, P.h - 6);
          QP.Charts.line(document.getElementById("tvD2"), [{ values: m.loss.length ? m.loss : [.7], color: "#a9482a" }, { values: m.acc.length ? m.acc : [.5], color: "#003087" }], { height: 200, min: 0, max: 1, xLabel: "반복 → 주황 손실, 청 학습 정확도" }); };
        draw(); const tick = function () { if (!alive) return; if (ep >= 25) { const ta = DN.testAcc(); let ok = 0, tp = 0, P2 = 0; const lt = M.mlpRows(te, "linear"); lt.forEach(function (r) { const o = M.mlpForward(lin, r.f).o; if ((o >= .5 ? 1 : 0) === r.label) ok++; if (r.label) { P2++; if (o >= .5) tp++; } }); document.getElementById("tvD3").innerHTML = "시험 결과(0.5 기준): <b style='color:" + CQ + "'>양자 특징 DNN 정확도 " + pct(ta.acc) + ", 탐지율 " + pct(ta.recall) + "</b>, <b style='color:" + CL + "'>일반 DNN(입력 16개) 정확도 " + pct(ok / lt.length) + ", 탐지율 " + pct(tp / Math.max(1, P2)) + "</b>"; QP.Pace.wait(4000, next, live); return; } DN.step(); M.mlpEpoch(lin, linRows, .3); ep++; draw(); setTimeout(tick, 450); };
        QP.Pace.say("네 번째는 심층 신경망 학습입니다. 입력 스물두 개가 은닉층 세 개를 지나 위험 점수가 됩니다. 반복할 때마다 역전파로 가중치를 고치며, 노란 선이 이번 반복에 크게 바뀐 연결입니다. 비교를 위해 입력 열여섯 개인 일반 신경망도 같은 방식으로 함께 학습합니다.");
        setTimeout(tick, 1500);
      },
      function (next) {                             // Ⓔ 메타 / meta
        const e = sec(4, "여러 사람에게서 공통 시작점 θ를 배우고, 새 사람은 몇 걸음 만에 맞춤", '<div class="tv2"><div><b>메타학습 바깥 루프(사람 4명씩)</b><canvas id="tvE1"></canvas></div><div><b>새 사람 적응 곡선: 메타 시작 vs 무작위 시작</b><canvas id="tvE2"></canvas></div></div>');
        const m = QP.Meta.create(77), hist = []; let it = 0;
        const tick = function () { if (!alive) return; for (let k = 0; k < 5; k++) { QP.Meta.metaStep(m, 4); it++; } const ev = QP.Meta.evaluate(m, 31); hist.push(ev.meta[1]); QP.Charts.line(document.getElementById("tvE1"), [{ values: hist.length > 1 ? hist : [hist[0], hist[0]], color: "#a9482a" }], { height: 190, min: 0, max: 1, xLabel: "바깥 루프 " + it + "회 → 새 사람 1걸음 정확도" }); QP.Charts.line(document.getElementById("tvE2"), [{ values: ev.meta, color: "#a9482a" }, { values: ev.rand, color: "#9aa3ba" }], { height: 190, min: 0, max: 1, xLabel: "적응 걸음 0~10 (주황 메타, 회색 무작위)" }); if (it < 150) setTimeout(tick, 250); else QP.Pace.wait(3000, next, live); };
        QP.Pace.say("다섯 번째는 메타학습입니다. 여러 산행자에게서 공통 시작점을 배우는 바깥 루프가 돌아가면서, 처음 보는 사람에게 한 걸음만 적응했을 때의 정확도가 올라갑니다. 오른쪽은 메타 시작점과 무작위 시작점의 적응 곡선 비교입니다.");
        tick();
      },
      function (next) {                             // Ⓕ 결과 / results
        const row = function (n, a, b, f, low) { const d = b - a, good = low ? d < 0 : d > 0; return "<tr><td>" + n + "</td><td>" + f(a) + "</td><td><b>" + f(b) + "</b></td><td class='" + (Math.abs(d) < 1e-9 ? "" : good ? "xgood" : "xbad") + "'>" + (d >= 0 ? "+" : "−") + f(Math.abs(d)) + "</td></tr>"; }, F3 = function (v) { return v.toFixed(3); };
        sec(5, "처음 보는 시험 표본 " + te.length + "개로 채점", '<table class="labtbl xcmpt"><tr><th>지표</th><th style="color:' + CL + '">일반 AI</th><th style="color:' + CQ + '">양자 특징 AI</th><th>차이(양자−일반)</th></tr>' + row("탐지율", L.recall, Q.recall, pct) + row("오경보율", L.falseAlarm, Q.falseAlarm, pct, true) + row("정밀도", L.precision, Q.precision, pct) + row("F1", L.f1, Q.f1, F3) + row("AUC", L.auc, Q.auc, F3) + '</table><p class="small">이 결과가 관제실, 성적표 등 모든 화면에 바로 쓰입니다. 지금의 2큐비트 회로는 정확 판독에서 cos×cos 대조군과 같은 값이므로, 차이는 겹침을 함께 보는 특징 덕분입니다.</p>');
        QP.Pace.say("마지막으로 처음 보는 시험 표본으로 채점했습니다. 탐지율은 일반 인공지능 " + Math.round(L.recall * 100) + "퍼센트, 양자 특징 인공지능 " + Math.round(Q.recall * 100) + "퍼센트입니다. 이 결과가 모든 화면에 바로 쓰입니다.");
        document.getElementById("tvs5").className = "done"; next && next();
      }
    ];
    let si = 0; (function go() { if (!alive || si >= steps.length) return; const f = steps[si++]; f(function () { go(); }); })();
  }
  QP.TrainViz = { open: open };
})(window.QP = window.QP || {});
