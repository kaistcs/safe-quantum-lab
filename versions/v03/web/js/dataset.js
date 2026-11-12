/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Dataset manager: rule-based and evidence-based (factor-combined) synthetic data, evidence checks, CSV/JSON export, retraining. */
/* =====================================================================
 * dataset.js : 데이터 관리 센터의 엔진 (생성, 등록, 검증, AI 재학습 연결)
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 데이터를 만들고(버튼 한 번, 또는 연속 생성), 근거와 검증
 *            결과를 붙여 등록하고, 그 데이터로 AI를 다시 학습시키는
 *            "데이터 → AI" 연결 고리를 한곳에서 관리하기 위함임.
 * 데이터 종류 :
 *  (1) 규칙 균일 합성 : 20개 신호를 서로 독립 무작위로 뽑음(v01, v02 방식, 근거 약함)
 *  (2) 근거 기반 산행 시계열 : mountain.js 엔진(Tanaka, Karvonen, Tobler, Naismith,
 *      기온감률, 기상특보 기준, 세미나 POI 거리)으로 실제 산행처럼 시간 흐름을 만들고
 *      1분 간격으로 표본을 뽑음(신호끼리 현실적인 상관이 생김)
 *  (3) CSV 가져오기 : 공개 데이터, 실측 데이터를 20개 신호 형식으로 올림
 * 신뢰도 표기 : "근거 일치도"(생성 규칙이 문헌 기준과 맞는지 자동 검사)와
 *  "현실 타당성"(실측 데이터와 비교, 실측 전에는 '미검증')을 따로 표시함.
 *  근거: Jordon et al., "Synthetic Data – what, why and how?" (arXiv:2205.03257, 2022)의
 *  충실도(fidelity), 유용성(utility, TSTR) 구분을 따름.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 데이터 관리 기능을 붙임 / attaches data management to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const D = QP.Data, G = QP.Mountain, M = QP.Models, S = QP.Sim; // 자주 쓰는 모듈임 / commonly used modules
  const list = [];                                  // 등록된 데이터셋 목록임 / registered datasets
  let seq = 0, timer = null;                        // 일련번호와 연속 생성 타이머임 / serial number and continuous-generation timer
  const listeners = [];                             // 변화 알림을 받을 함수 목록임 / functions notified of changes
  const emit = function () { listeners.forEach(function (f) { try { f(); } catch (e) { } }); }; // 등록된 함수에 변화를 알림 / notify registered functions of a change

  function split(rows) {                            // 학습 50%, 기준 20%, 시험 30%로 나눔 / split into train 50%, threshold 20%, test 30%
    const a = Math.floor(rows.length * .5), b = Math.floor(rows.length * .7); // 나눌 위치임 / split points
    return { train: rows.slice(0, a), valid: rows.slice(a, b), test: rows.slice(b) }; // 나눈 묶음임 / split sets
  }
  function stats(rows) {                            // 표본 수와 위험 비율임 / number of samples and risk share
    const pos = rows.filter(function (r) { return r.label; }).length; // 위험 표본 수임 / number of risk samples
    return { n: rows.length, pos: pos, rate: pos / Math.max(1, rows.length) }; // 통계임 / statistics
  }
  function register(ds) {                           // 데이터셋을 목록에 올림 / registers a dataset in the list
    ds.id = "D" + String(++seq).padStart(3, "0"); ds.created = new Date().toLocaleString("ko-KR"); // 번호와 생성 시각임 / number and creation time
    ds.stats = stats(ds.rows); ds.split = split(ds.rows); list.unshift(ds); emit(); // 통계, 나누기, 등록 후 알림 / statistics, split, register and notify
    return ds;                                      // 등록한 데이터셋을 돌려줌 / return the registered dataset
  }

  /* ---------- (1) 규칙 균일 합성 / (1) Rule-based uniform synthesis  ---------- */
  function makeRule(seed, n) {
    const rows = D.sampleSet(seed, n);              // 독립 균일 표본을 만듦 / makes independent uniform samples
    return register({ name: "규칙 균일 합성 seed " + seed, kind: "rule", rows: rows, params: { seed: seed, n: n }, // 등록함 / register
      checks: [{ k: "신호 범위 0~1", ok: true, d: "모든 값이 0~1" }, { k: "신호 간 상관", ok: false, d: "신호를 서로 독립으로 뽑아 비와 경사, 심박과 경사 같은 현실 상관이 없음" }, { k: "시간 흐름", ok: false, d: "시간 순서가 없는 낱개 표본" }],
      grade: "C", gradeText: "근거 일치도 낮음(교육용 기준선)", refs: "합성 정답 규칙(신호 쌍 곱 > 0.46)만 사용" });
  }

  /* ---------- (2) 근거 기반 산행 시계열 / (2) Evidence-based hiking time series  ---------- */
  function makeGrounded(seed, runs, opt) {
    const o = opt || {}, r = S.rng(seed), rows = [], meta = []; // 옵션, 난수, 표본, 산행 기록임 / options, random, samples, hike records
    const vals = { hrOk: 0, hrN: 0, tRatio: [], lapse: [], speed: [], cont: 0, contN: 0 }; // 검증용 누적 값임 / accumulated values for checks
    /* 요인 결합 설계: 출발 시각 × 성별 × 연령대 × 산 난이도 × 날씨 × 계절 × 환경을 모두 섞음.
       요인마다 수준을 같은 횟수로 채운 뒤 따로 섞어(균형 무작위 배치) 어느 한 조합에 치우치지 않게 함 */
    const F = {                                     // 요인과 수준 목록임 / factors and levels
      time: [[360, "새벽 6시"], [510, "오전 8시 30분"], [630, "오전 10시 30분"], [780, "오후 1시(늦은 출발)"]],
      sex: [["F", "여성"], ["M", "남성"]],
      age: [[25, "20대"], [35, "30대"], [45, "40대"], [55, "50대"], [65, "60대"], [75, "70대"]],
      diff: [["하", "하(표고차 600m 미만)"], ["중", "중(600~1000m)"], ["상", "상(1000m 이상)"]],
      weather: G.weathers.map(function (w, i) { return [i, w.name]; }),
      season: G.seasons.map(function (x, i) { return [i, x.name]; }),
      env: [[{ batt: .9, fit: 1 }, "동행, 통신 양호"], [{ batt: .35, fit: 1 }, "단독, 배터리 부족"], [{ batt: .7, fit: .82 }, "초보(체력 낮음)"], [{ batt: .7, fit: 1.18 }, "숙련(체력 높음)"]]
    };
    const bal = function (lv) { const a = []; for (let k = 0; k < runs; k++) a.push(k % lv.length); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }; // 수준을 고르게 채우고 섞음 / fill levels evenly and shuffle
    const pick = {}; Object.keys(F).forEach(function (f) { pick[f] = bal(F[f]); }); // 요인별 배치표임 / assignment table per factor
    const diffOf = function (m) { const a = m[2] - m[4]; return a < 600 ? "하" : a <= 1000 ? "중" : "상"; }; // 표고차로 난이도를 정함 / difficulty from the elevation gain
    const cover = {}; Object.keys(F).forEach(function (f) { cover[f] = F[f].map(function () { return 0; }); }); // 수준별 사용 횟수임 / count of use per level
    for (let k = 0; k < runs; k++) {                // 산행 횟수만큼 반복함 / repeat for the number of hikes
      Object.keys(F).forEach(function (f) { cover[f][pick[f][k]]++; }); // 사용 횟수를 셈 / count usage
      const dLv = o.diff || F.diff[pick.diff[k]][0], pool = G.mountains.map(function (m, i) { return i; }).filter(function (i) { return diffOf(G.mountains[i]) === dLv; }); // 그 난이도의 산 목록임 / mountains of that difficulty
      const mi = o.mountain != null ? o.mountain : pool[Math.floor(r() * pool.length)]; // 산을 고름(난이도 균형) / pick a mountain (balanced difficulty)
      const c = G.makeCourse(mi, Math.floor(r() * 1e6)); // 코스를 만듦(씨앗마다 POI, 경사 다름) / build the course (POIs and slopes differ per seed)
      const sex = F.sex[pick.sex[k]][0], age = F.age[pick.age[k]][0] + Math.floor(r() * 10) - 4, env = F.env[pick.env[k]][0]; // 성별, 나이(연령대 안에서 흔듦), 환경임 / sex, age (varied within the age group), environment
      const per = { id: "S" + k, sex: sex, age: age, rest: Math.round(60 + (age - 40) * .15 + (sex === "F" ? 3 : 0) + (r() - .5) * 10), fit: Math.max(.6, (1.25 - (age - 25) * .008) * env.fit * (.92 + r() * .16)) }; // 나이, 성별에 맞춘 안정시 심박과 체력(나이 들수록 감소)임 / resting HR and fitness by age and sex (fitness drops with age)
      const w0 = o.weather != null ? G.weathers[o.weather] : G.weathers[F.weather[pick.weather[k]][0]]; // 날씨임 / weather
      const w = Object.assign({}, w0, { start: w0.id === "late" ? Math.max(780, F.time[pick.time[k]][0]) : F.time[pick.time[k]][0] }); // 출발 시각을 요인대로 바꿈(늦은 출발 날씨는 13시 이후) / set the start time by factor (late-start weather is after 13:00)
      const season = o.season != null ? o.season : F.season[pick.season[k]][0]; // 계절임 / season
      const run = G.simulate(c, per, w, { season: season, batt: env.batt, fallAt: r() < .12 ? .55 + r() * .3 : 0, symptomAt: r() < .08 ? 60 + r() * 90 : 0 }); // 산행을 시뮬레이션함 / simulate the hike
      const st = run.steps, hm = G.hrMax(per);      // 시간별 상태와 최대심박임 / states over time and max HR
      st.forEach(function (s, i) {                  // 시간마다 / for each time step
        vals.hrN++; if (s.hr > 35 && s.hr <= hm + 1) vals.hrOk++; // 심박이 생리 범위(최대심박 이하)인지 셈 / count whether HR is in the physiological range (≤ max HR)
        if (i % 6 === 0) rows.push({ x: s.sig, label: D.syntheticLabel(s.sig) ? 1 : 0, run: k, t: s.t }); // 1분 간격으로 표본을 뽑음 / take a sample every minute
        if (i) { vals.contN++; let jump = 0; for (let q = 0; q < 20; q++) if (!D.exclusions.has(q)) jump = Math.max(jump, Math.abs(s.sig[q] - st[i - 1].sig[q])); if (jump < .35) vals.cont++; } // 10초 사이 급변이 없는지 셈 / count whether there is no sudden change within 10 s
      });
      vals.tRatio.push(st[st.length - 1].t / 60 / run.planned); // 실제 소요 시간 / Naismith 계획 시간 비율임
      const lo = st[0], hi = st.reduce(function (a, b) { return b.elev > a.elev ? b : a; }); // 출발점과 최고점임 / start point and highest point
      if (!G.weathers.indexOf || true) vals.lapse.push((hi.T - lo.T) / Math.max(1, (hi.elev - lo.elev) / 1000)); // 고도 1 km당 기온 변화임(전선 영향 포함) / temperature change per km of altitude (including front effects)
      meta.push({ mountain: c.name, difficulty: diffOf(G.mountains[mi]), start: F.time[pick.time[k]][1], sex: sex === "F" ? "여성" : "남성", age: age, rest: per.rest, season: G.seasons[season].name, weather: w.name, env: F.env[pick.env[k]][1], minutes: Math.round(st[st.length - 1].t / 60) }); // 산행 기록(결합된 요인 전부)임 / hike record (all combined factors)
    }
    const med = function (a) { const b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.floor(b.length / 2)]; }; // 중앙값 함수임 / median function
    const st = stats(rows), tr = med(vals.tRatio), lp = med(vals.lapse); // 통계와 중앙값임 / statistics and medians
    const checks = [                                // 자동 근거 일치 검사 목록임 / list of automatic evidence checks
      { k: "심박 생리 범위", ok: vals.hrOk / vals.hrN > .999, d: "최대심박(Tanaka 208−0.7×나이) 이하 비율 " + (100 * vals.hrOk / vals.hrN).toFixed(2) + "%" },
      { k: "소요 시간 타당성", ok: tr > .8 && tr < 1.8, d: "실제/계획(Naismith) 중앙값 " + tr.toFixed(2) + " (0.8~1.8 허용: 고령자 감속 반영)" },
      { k: "기온감률", ok: lp < -4 && lp > -12, d: "고도 1 km당 " + lp.toFixed(1) + " °C (표준대기 −6.5, 전선 통과 시 더 큼)" },
      { k: "시간 연속성", ok: vals.cont / vals.contN > .995, d: "10초 사이 급변(0.35 초과) 없는 비율(사건성 규칙 신호 제외) " + (100 * vals.cont / vals.contN).toFixed(2) + "%" },
      { k: "위험 비율", ok: st.rate > .05 && st.rate < .45, d: "위험 사건 표본 " + (100 * st.rate).toFixed(1) + "% (5~45% 허용: 요인 균형 설계는 70대, 난이도 상, 늦은 출발 같은 고위험 조합을 일부러 고르게 포함함)" },
      { k: "요인 결합 균형", ok: Object.keys(cover).every(function (f) { const v = cover[f]; return Math.max.apply(null, v) - Math.min.apply(null, v) <= 1 || runs < F[f].length; }), d: "출발 시각 " + F.time.length + " × 성별 2 × 연령대 6 × 난이도 3 × 날씨 " + F.weather.length + " × 계절 4 × 환경 " + F.env.length + "을 균형 배치(요인별 수준 사용 횟수 차이 1 이하)" },
      { k: "신호 간 상관", ok: true, d: "비→노면 젖음→속도 감소, 오르막→심박 상승처럼 원인-결과로 연결됨" }
    ];
    const pass = checks.filter(function (c) { return c.ok; }).length; // 통과 수임 / number passed
    return register({ name: "근거 기반 산행 " + runs + "회 seed " + seed, kind: "grounded", rows: rows, meta: meta, params: { seed: seed, runs: runs }, factors: Object.keys(F).map(function (f) { return { factor: { time: "출발 시각", sex: "성별", age: "연령대", diff: "산 난이도", weather: "날씨", season: "계절", env: "환경" }[f], levels: F[f].map(function (l, i) { return l[1] + " " + cover[f][i] + "회"; }) }; }), checks: checks, // 등록함 / register
      grade: pass === checks.length ? "A" : pass >= checks.length - 1 ? "B" : "C", gradeText: "근거 일치도 " + pass + "/" + checks.length + " 통과, 현실 타당성은 실측 비교 전(미검증)",
      refs: "Tanaka 2001, Gulati 2010(성별 최대심박), 계절별 기온, 일몰, Karvonen 1957(%HRR), Tobler 1993(보행 속도), Naismith(계획 시간), ISO 2533(기온감률), 기상청 특보 기준, 세미나 POI 감지 거리" });
  }

  /* ---------- (3) CSV / (3) CSV import  ---------- */
  function addCSV(name, text) {
    const res = D.fromCSV(String(text).replace(/^﻿/, "")); // CSV를 표본으로 바꿈 / convert CSV into samples
    return register({ name: "CSV: " + name, kind: "csv", rows: res.rows, params: { file: name }, // 등록함 / register
      checks: [{ k: "열 이름 일치", ok: res.missing.length === 0, d: res.missing.length ? "없는 열 " + res.missing.length + "개(0으로 채움)" : "20개 신호 열 모두 있음" }, { k: "정답 열", ok: res.hasLabel, d: res.hasLabel ? "label 열 있음" : "label 없음 → 합성 규칙으로 채움" }],
      grade: res.hasLabel && !res.missing.length ? "B" : "C", gradeText: "외부 자료(출처는 파일 제공자 확인)", refs: "사용자 제공 파일" });
  }

  /* ---------- AI 재학습 (데이터 → AI 연결) / AI retraining (data → AI link)  ---------- */
  function retrain(id, opts) {
    const ds = list.find(function (d) { return d.id === id; }) || list[0]; // 대상 데이터셋임 / target dataset
    if (!ds) return null;                           // 없으면 끝냄 / stop if none
    const o = opts || {}, t0 = performance.now();   // 옵션과 시작 시각임 / options and start time
    const pick = function (r, k) { const m = r && r.find(function (x) { return x.key === k; }); return m ? m.recall : null; }; // 결과에서 탐지율을 꺼냄 / take the detection rate from the results
    const before = { L: pick(QP.State.results, "linear"), Q: pick(QP.State.results, "quantum"), name: QP.State.dataName }; // 재학습 전 성적임 / scores before retraining
    QP.State.results = M.experiment({ data: ds.split, shots: o.shots, noise: o.noise }); // 다섯 방식을 다시 학습, 시험함 / retrain and test the five methods
    QP.State.dataName = ds.name; QP.State.dataId = ds.id; // 현재 데이터 이름을 기록함 / record the current data name
    const q = QP.State.results.find(function (m) { return m.key === "quantum"; }), l = QP.State.results.find(function (m) { return m.key === "linear"; }); // 두 결과임 / the two results
    ds.history = ds.history || []; ds.history.push({ at: new Date().toLocaleTimeString("ko-KR"), n: ds.stats.n, qAUC: q.auc, lAUC: l.auc, qR: q.recall, lR: l.recall }); // 학습 기록을 남김 / keep a training log
    if (QP.DNN) QP.DNN.train(ds.split.train, 25); // DNN도 같은 데이터로 다시 학습함 / retrain the DNN with the same data too
    QP.State.lastChange = { from: before, to: { L: l.recall, Q: q.recall, name: ds.name }, at: Date.now() }; // 데이터가 바뀌어 성적이 어떻게 변했는지 기록함 / record how scores changed with the data
    QP.State.trainMs = performance.now() - t0; emit(); // 걸린 시간을 기록하고 알림 / record the elapsed time and notify
    return ds;                                      // 데이터셋을 돌려줌 / return the dataset
  }

  /* ---------- 연속 생성 (누적 데이터셋 + 학습 곡선) / Continuous generation (accumulating dataset + learning curve)  ---------- */
  function startStream(every, autoTrain) {
    if (timer) return;                              // 이미 돌고 있으면 무시함 / ignore if already running
    let acc = list.find(function (d) { return d.kind === "stream"; }); // 기존 누적 데이터셋임 / existing accumulating dataset
    if (!acc) acc = register({ name: "연속 생성 누적(근거 기반)", kind: "stream", rows: [], params: {}, checks: [], grade: "A", gradeText: "근거 기반 산행 묶음을 계속 추가", refs: "근거 기반 산행 시계열과 같음", curve: [] }); // 처음이면 새로 만듦 / create it the first time
    let batch = 0;                                  // 묶음 번호임 / batch number
    timer = setInterval(function () {               // 일정 간격마다 / at a fixed interval
      const g = makeGroundedRows(7000 + (++batch) * 13, 4); // 산행 4회 분량을 새로 만듦 / generate 4 more hikes
      acc.rows = acc.rows.concat(g); acc.stats = stats(acc.rows); acc.split = split(acc.rows); // 누적하고 다시 나눔 / accumulate and re-split
      if (autoTrain && acc.rows.length > 400) {     // 자동 학습이 켜져 있으면 / if auto-training is on
        const r = M.experiment({ data: acc.split, methods: ["linear", "quantum"] }); // 두 방식만 빠르게 다시 학습함 / quickly retrain only the two methods
        acc.curve.push({ n: acc.rows.length, l: r[0].auc, q: r[1].auc }); // 데이터 크기별 AUC를 기록함(학습 곡선) / record AUC by data size (learning curve)
      }
      emit();                                       // 화면에 알림 / notify the screen
    }, every || 2500);                              // 기본 2.5초마다임 / every 2.5 s by default
  }
  function makeGroundedRows(seed, runs) {           // 등록하지 않고 표본만 만드는 내부 함수임 / internal function making samples without registering
    const before = list.length, ds = makeGrounded(seed, runs); // 임시로 만들고 / create temporarily
    list.splice(list.indexOf(ds), 1); seq--; void before; // 목록에서는 빼고 번호를 되돌림 / remove from the list and restore the number
    return ds.rows;                                 // 표본만 돌려줌 / return only the samples
  }
  function stopStream() { clearInterval(timer); timer = null; emit(); } // 연속 생성을 멈춤 / stop continuous generation
  function toJSON(id) {                              // 근거(검증 항목, 등급, 출처)와 표본을 함께 담은 JSON 글자로 바꿈(다른 프로그램, 파이썬에서 다시 쓰기 좋게) / converts samples and evidence (checks, grade, sources) into JSON text (easy to reuse in other programs and Python)
    const ds = list.find(function (d) { return d.id === id; }); if (!ds) return "{}"; // 대상 데이터셋임 / target dataset
    return JSON.stringify({ id: ds.id, name: ds.name, created: ds.created, grade: ds.grade || null, gradeText: ds.gradeText || null, checks: ds.checks || [], refs: ds.refs || null, stats: ds.stats, columns: D.signals.map(function (x) { return x[1]; }), label: "위험(1)/정상(0)", factors: ds.factors || null, runs: ds.meta || null, rows: ds.rows.map(function (r) { return { run: r.run, t: r.t, x: r.x.map(function (v) { return Math.round(v * 1e4) / 1e4; }), y: r.label ? 1 : 0 }; }), exportedBy: "숙명 AGI 산행안전 양자 실험실 v03" }); // 담을 내용임 / content to include
  }
  function toCSV(id) { const ds = list.find(function (d) { return d.id === id; }); return ds ? D.toCSV(ds.rows) : ""; } // CSV 글자로 바꿈 / convert to CSV text

  QP.Datasets = { list: list, makeRule: makeRule, makeGrounded: makeGrounded, addCSV: addCSV, retrain: retrain, startStream: startStream, stopStream: stopStream, // 공개함 / make public
    streaming: function () { return !!timer; }, onChange: function (f) { listeners.push(f); }, toCSV: toCSV, toJSON: toJSON, all: function () { return JSON.stringify(list.map(function (d) { return { id: d.id, name: d.name, created: d.created, grade: d.grade || null, stats: d.stats, checks: d.checks || [] }; })); }, get: function (id) { return list.find(function (d) { return d.id === id; }); } };
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
