/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] 20 monitored signals, virtual hiking scenarios, synthetic label rule, safety rules and CSV I/O. */
/* =====================================================================
 * data.js : 산행 신호, 가상 시나리오, 합성 데이터, CSV 입출력
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 실측 사고 데이터가 아직 없으므로, 규칙으로 만든 합성
 *            데이터와 사용자가 올린 공개 데이터(CSV)를 같은 형식으로
 *            다루기 위함임.
 * 하는 일   : 20개 감시 신호 정의, 5개 가상 산행 시나리오, 즉시 안전
 *            규칙, 씨앗(seed) 고정 합성 표본 생성, CSV 읽기/쓰기.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 데이터 기능을 붙이는 즉시 실행 함수임 / IIFE attaching data functions to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode

  /* ---------- 1. 20개 감시 신호 (그룹, 이름, CSV 열 이름) / 1. 20 monitored signals (group, name, CSV column)  ---------- */
  const signals = [                                 // 각 신호는 0(낮음)~1(높음)로 정규화된 값을 받음 / each signal takes a value normalized to 0 (low)~1 (high)
    ["몸 상태", "심박 부담", "hr_load"], ["몸 상태", "피로", "fatigue"], ["몸 상태", "증상 신고", "symptom"],
    ["기상과 시간", "강수", "rain"], ["기상과 시간", "강풍", "wind"], ["기상과 시간", "낙뢰 경보", "lightning"],
    ["기상과 시간", "폭염", "heat"], ["기상과 시간", "결빙", "ice"], ["기상과 시간", "일몰 여유 부족", "sunset"],
    ["경로와 지형", "급경사", "slope"], ["경로와 지형", "경로 이탈", "offroute"], ["경로와 지형", "하산 지연", "delay"],
    ["경로와 지형", "낙석 접근", "rockfall"], ["경로와 지형", "야생동물 신고 지역", "wildlife"], ["경로와 지형", "절벽 접근", "cliff"],
    ["장치와 구조", "위치 품질 저하", "gps_bad"], ["장치와 구조", "통신 불안정", "net_bad"], ["장치와 구조", "배터리 부족", "battery"],
    ["장치와 구조", "낙상과 미응답", "fall"], ["장치와 구조", "공식 출입 통제", "closed"]
  ];
  const exclusions = new Set([2, 5, 18, 19]);       // 규칙으로 즉시 처리하는 신호 번호(학습 입력에서 제외)임 / signal numbers handled immediately by rules (excluded from training inputs)
  const pairs = [[3, 9], [0, 1], [8, 11], [16, 17], [7, 9], [10, 14]]; // 회로가 함께 묶어 볼 "겹치는 위험" 신호 쌍임 / "overlapping risk" signal pairs bound together by the circuit

  /* ---------- 2. 가상 산행 시나리오 (v01에서 이어받음) / 2. Virtual hiking scenarios (inherited from v01)  ---------- */
  const routes = [                                  // 각 단계는 [이름, 설명, {신호번호: 값}] 형식임 / each step has the form [name, description, {signal: value}]
    { name: "비 오는 하산길", image: "steps.jpg", steps: [
      ["출발 준비", "맑은 날씨와 충분한 하산 여유로 출발합니다.", {}],
      ["젖은 돌계단 접근", "비가 내리고 내리막이 가팔라집니다.", { 3: .65, 9: .65, 12: .35 }],
      ["비와 급경사 중첩", "젖은 급경사와 낙석 구간이 함께 나타납니다.", { 3: .85, 9: .83, 12: .68 }],
      ["하산 지연", "걸음이 느려지고 해 질 때까지 여유가 줄어듭니다.", { 3: .78, 9: .8, 8: .72, 11: .8, 12: .7 }],
      ["통제 확인", "공식 출입 통제 정보가 들어온 가상 장면입니다.", { 3: .65, 9: .7, 19: 1 }]] },
    { name: "심박과 피로", image: "watch.jpg", steps: [
      ["평탄한 구간", "심박과 걸음이 평소 범위에 있습니다.", { 0: .23, 1: .24 }],
      ["긴 오르막", "심박 부담이 높아지고 걸음이 느려집니다.", { 0: .69, 1: .65, 9: .55 }],
      ["복합 부담", "평소보다 높은 심박과 피로가 겹칩니다.", { 0: .85, 1: .83, 9: .59 }],
      ["증상 신고", "몸 상태 확인이 필요하다고 응답했습니다.", { 0: .85, 1: .8, 2: 1 }]] },
    { name: "일몰과 통신 음영", image: "dusk.jpg", steps: [
      ["하산 시작", "하산 계획과 오프라인 지도를 확인합니다.", { 8: .32, 11: .35 }],
      ["하산 여유 감소", "해 질 때까지 남은 시간이 줄고 하산이 늦어집니다.", { 8: .7, 11: .72 }],
      ["통신 약화", "통신이 약해지고 배터리가 줄어듭니다.", { 8: .8, 11: .8, 15: .45, 16: .7, 17: .76 }],
      ["통신 음영", "위치 공유가 대기 상태입니다.", { 8: .88, 11: .84, 15: .64, 16: .95, 17: .9 }]] },
    { name: "갈림길과 절벽", image: "fork.jpg", steps: [
      ["갈림길 접근", "야생동물 신고 이력이 있는 구간을 지납니다.", { 13: .42 }],
      ["갈림길 도착", "오른쪽에 절벽 위험 구간이 있습니다.", { 13: .7, 14: .65 }],
      ["오른쪽 경로 선택", "절벽 쪽으로 다가가며 등산로에서 멀어집니다.", { 10: .76, 14: .86 }],
      ["출입 통제", "오른쪽 길에 공식 출입 통제가 있습니다.", { 10: .8, 14: .95, 19: 1 }]] },
    { name: "기상 악화와 구조", image: "ridge.jpg", steps: [
      ["노출된 능선", "강풍과 더위로 몸이 힘들어지는 장면입니다.", { 4: .65, 6: .79, 9: .55 }],
      ["결빙 구간", "얼음과 경사가 겹치는 가상 계절 조건입니다.", { 7: .85, 9: .74 }],
      ["낙뢰 경보", "가상 낙뢰 경보가 들어옵니다.", { 3: .78, 4: .8, 5: 1 }],
      ["낙상과 미응답", "넘어진 뒤 응답이 없는 구조 상황입니다.", { 15: .55, 16: .81, 17: .6, 18: 1 }]] }
  ];

  /* ---------- 3. 즉시 안전 규칙 (AI보다 항상 먼저) / 3. Immediate safety rules (always before the AI)  ---------- */
  function policy(x) {                              // 점수와 상관없이 바로 처리해야 하는 상황을 판정함 / judges situations that must be handled at once regardless of score
    if (x[19] >= .9) return "공식 출입 통제 구간입니다. 이 길은 후보에서 바로 뺍니다."; // 통제 구간은 무조건 제외함 / closed sections are always excluded
    if (x[18] >= .9) return "넘어진 뒤 응답이 없습니다. 구조 절차가 가장 먼저입니다.";   // 낙상+미응답은 구조 우선임 / fall + no response puts rescue first
    if (x[5] >= .9) return "낙뢰 경보입니다. 점수와 상관없이 산행 중단 안내가 먼저입니다."; // 낙뢰는 즉시 중단 안내임 / lightning means stop immediately
    if (x[2] >= .9) return "몸이 안 좋다는 신고가 있습니다. 상태 확인이 먼저입니다.";     // 증상 신고는 확인 우선임 / symptom reports put confirmation first
    return "";                                      // 해당 없으면 빈 문자열(규칙 없음)을 돌려줌 / return an empty string (no rule) otherwise
  }
  function vector(values) {                         // {번호: 값} 묶음을 20칸 배열로 펼침 / expand a {number: value} bundle into a 20-cell array
    return signals.map(function (_, i) { return values[i] != null ? values[i] : 0; }); // 값이 없으면 0으로 채움 / fill missing values with 0
  }

  /* ---------- 4. 합성 데이터 / 4. Synthetic data  ---------- */
  // 합성 정답 규칙: 묶어 둔 신호 쌍 중 하나라도 "둘 다 높음"(곱>기준)이면 위험 사건으로 정의함 / synthetic label rule: a risk event if any bound signal pair is "both high" (product > threshold)
  function syntheticLabel(x, cut) {
    const c = cut == null ? .46 : cut;              // 기준값이 없으면 0.46을 씀(v01과 동일) / use 0.46 if no threshold is given (same as v01)
    return pairs.some(function (p) { return x[p[0]] * x[p[1]] > c; }); // 한 쌍이라도 넘으면 참임 / true if any pair exceeds it
  }
  function sampleSet(seed, count, opts) {           // 씨앗 고정 합성 표본을 count개 만듦 / makes count seeded synthetic samples
    const o = opts || {};                           // 옵션이 없으면 빈 객체를 씀 / use an empty object if no options
    const rand = QP.Sim.rng(seed);                  // 같은 씨앗이면 항상 같은 표본이 나오게 함 / the same seed always gives the same samples
    const power = o.power || 2;                     // 값^power로 "대부분 낮고 가끔 높은" 분포를 만듦 / value^power gives a "mostly low, sometimes high" distribution
    const flip = o.labelNoise || 0;                 // 정답을 일부러 뒤집는 비율(현실의 기록 오류 흉내)임 / share of labels flipped on purpose (imitates real recording errors)
    const out = [];                                 // 결과 목록임 / result list
    for (let k = 0; k < count; k++) {               // 표본 수만큼 반복함 / repeat for the number of samples
      const x = signals.map(function () { return Math.pow(rand(), power); }); // 20개 신호를 무작위로 만듦 / make 20 random signals
      let y = syntheticLabel(x, o.cut) ? 1 : 0;     // 규칙으로 정답(1=위험, 0=정상)을 붙임 / attach the label by rule (1 = risk, 0 = normal)
      if (flip && rand() < flip) y = 1 - y;         // 지정 비율만큼 정답을 뒤집어 잡음을 넣음 / flip labels by the given share to add noise
      out.push({ x: x, label: y });                 // 관측과 정답을 한 묶음으로 저장함 / store observation and label together
    }
    return out;                                     // 표본 목록을 돌려줌 / return the sample list
  }

  /* ---------- 5. CSV 입출력 / 5. CSV input/output  ---------- */
  function toCSV(rows) {                            // 표본 목록을 CSV 글자로 바꿈 / converts a sample list to CSV text
    const head = signals.map(function (s) { return s[2]; }).concat(["label"]).join(","); // 첫 줄(열 이름)을 만듦 / build the first line (column names)
    const body = rows.map(function (r) {            // 각 표본을 한 줄로 만듦 / one line per sample
      return r.x.map(function (v) { return v.toFixed(4); }).concat([r.label]).join(","); // 소수 4자리로 기록함 / record with 4 decimals
    });
    return [head].concat(body).join("\n");          // 줄바꿈으로 이어 붙여 돌려줌 / join with line breaks and return
  }
  function fromCSV(text) {                          // CSV 글자를 표본 목록으로 바꿈(공개 데이터 가져오기) / converts CSV text into a sample list (public data import)
    const lines = text.trim().split(/\r?\n/);       // 줄 단위로 자름(윈도우 줄바꿈도 처리) / split into lines (handles Windows line breaks)
    const head = lines[0].split(",").map(function (h) { return h.trim(); }); // 열 이름 목록임 / column names
    const idx = signals.map(function (s) { return head.indexOf(s[2]); }); // 신호별로 CSV의 몇 번째 열인지 찾음 / find the CSV column index of each signal
    const li = head.indexOf("label");               // 정답 열 위치를 찾음(없으면 -1) / find the label column (-1 if none)
    const missing = signals.filter(function (_, i) { return idx[i] < 0; }).map(function (s) { return s[2]; }); // 없는 열 이름 목록임 / names of missing columns
    const rows = [];                                // 결과 목록임 / result list
    for (let k = 1; k < lines.length; k++) {        // 둘째 줄부터 자료를 읽음 / read data from the second line
      const c = lines[k].split(",");                // 쉼표로 칸을 나눔 / split cells by comma
      const x = idx.map(function (j) {              // 신호 20개를 순서대로 채움 / fill the 20 signals in order
        const v = j < 0 ? 0 : parseFloat(c[j]);     // 열이 없으면 0, 있으면 숫자로 바꿈 / 0 if the column is missing, else a number
        return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; // 0~1 밖의 값과 빈칸을 정리함 / clean values outside 0~1 and blanks
      });
      const y = li >= 0 ? (Number(c[li]) ? 1 : 0) : (syntheticLabel(x) ? 1 : 0); // 정답이 없으면 합성 규칙으로 붙임 / attach labels by the synthetic rule if missing
      rows.push({ x: x, label: y });                // 한 줄을 표본으로 저장함 / store the line as a sample
    }
    return { rows: rows, missing: missing, hasLabel: li >= 0 }; // 표본과 함께 누락 정보를 돌려줌 / return samples with missing-column info
  }

  // 위 기능을 QP.Data로 공개함 / publish the above as QP.Data
  QP.Data = { signals, exclusions, pairs, routes, policy, vector, syntheticLabel, sampleSet, toCSV, fromCSV };
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
