/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* =====================================================================
 * charts.js : 캔버스 그림 도구 (외부 라이브러리 없이)
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 인터넷 없이도(file://) 그래프가 그려지도록 직접 그림.
 * 하는 일   : 결정 지도(열지도), 막대그래프, 꺾은선그래프를 그림.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 그림 기능을 붙임
  "use strict";                                     // 엄격 모드를 켬

  function prep(cv, h) {                            // 캔버스를 화면 배율에 맞게 준비함
    const dpr = window.devicePixelRatio || 1;       // 고해상도 화면 배율임
    const w = cv.clientWidth || 300;                // 화면에 보이는 폭임
    const hh = h || cv.clientHeight || 200;         // 높이를 정함
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); // 실제 픽셀 수를 배율만큼 늘림
    cv.style.height = hh + "px";                    // 화면 높이를 고정함
    const g = cv.getContext("2d");                  // 그리기 도구를 얻음
    g.setTransform(dpr, 0, 0, dpr, 0, 0);           // 이후 좌표를 화면 픽셀 기준으로 씀
    g.font = "11px Malgun Gothic, sans-serif";      // 글꼴을 정함
    return { g: g, w: w, h: hh };                   // 도구와 크기를 돌려줌
  }
  function mix(a, b, t) {                           // 두 색(RGB 배열)을 t 비율로 섞음
    return "rgb(" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(",") + ")"; // 각 채널을 선형 보간함
  }
  const LOW = [251, 246, 236], MID = [233, 196, 140], HIGH = [169, 72, 42]; // 낮음=종이색, 중간=황토, 높음=단풍색

  // 결정 지도: grid(점수 2차원), thr(경보 기준), opts.truth(정답 경계 함수), opts.mark([x,y] 현재 위치)
  function heatmap(cv, grid, thr, opts) {
    const o = opts || {}, P = prep(cv, o.height), g = P.g; // 옵션과 도구를 준비함
    const pad = 26, W = P.w - pad - 6, H = P.h - pad - 6, n = grid.length; // 여백과 그림 크기임
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { // 모든 칸을 칠함
      const v = grid[r][c];                         // 칸의 점수임
      const t = v < thr ? .5 * v / thr : .5 + .5 * (v - thr) / Math.max(1e-6, 1 - thr); // 경보 기준을 색의 한가운데(황토)에 맞춤 → 경보 영역이 뚜렷이 보임
      g.fillStyle = t < .5 ? mix(LOW, MID, t * 2) : mix(MID, HIGH, (t - .5) * 2); // 기준 아래는 종이색→황토, 위는 황토→단풍색
      g.fillRect(pad + c * W / n, 4 + r * H / n, W / n + 1, H / n + 1); // 칸을 칠함
    }
    g.strokeStyle = o.color || "#6e4c82"; g.lineWidth = 2.4; // 경보 경계선 색과 굵기임
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) { // 가로 이웃 칸 사이를 검사함
      if ((grid[r][c] >= thr) !== (grid[r][c + 1] >= thr)) { // 기준을 넘고 안 넘는 경계면
        g.beginPath(); g.arc(pad + (c + 1) * W / n, 4 + (r + .5) * H / n, 1.5, 0, 7); g.stroke(); // 경계점에 점을 찍음
      }
    }
    for (let c = 0; c < n; c++) for (let r = 0; r < n - 1; r++) { // 세로 이웃 칸 사이도 검사함
      if ((grid[r][c] >= thr) !== (grid[r + 1][c] >= thr)) { // 경계면
        g.beginPath(); g.arc(pad + (c + .5) * W / n, 4 + (r + 1) * H / n, 1.5, 0, 7); g.stroke(); // 점을 찍음
      }
    }
    if (o.truth) {                                  // 정답 위험 경계(점선)를 그림
      g.setLineDash([5, 4]); g.strokeStyle = "#2e2420"; g.lineWidth = 1.5; g.beginPath(); // 점선 설정임
      let first = true;                             // 첫 점 여부임
      for (let k = 0; k <= 60; k++) {               // 가로축을 60등분해서 따라감
        const a = k / 60, b = o.truth(a);           // a에서 정답 경계의 b 값을 구함
        if (b == null || b > 1 || b < 0) continue;  // 그림 밖이면 건너뜀
        const px = pad + a * W, py = 4 + (1 - b) * H; // 화면 좌표로 바꿈
        if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py); // 선을 이어 그림
      }
      g.stroke(); g.setLineDash([]);                // 선을 그리고 점선을 끔
    }
    if (o.mark) {                                   // 현재 상황 위치를 표시함
      const px = pad + o.mark[0] * W, py = 4 + (1 - o.mark[1]) * H; // 화면 좌표임
      g.fillStyle = "#fff"; g.strokeStyle = "#2e2420"; g.lineWidth = 2; // 흰 원에 검은 테두리임
      g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.stroke(); // 원을 그림
    }
    g.fillStyle = "#6d5e55";                        // 축 글씨 색임
    g.fillText(o.xLabel || "x →", pad, P.h - 6);    // 가로축 이름임
    g.save(); g.translate(11, 4 + H); g.rotate(-Math.PI / 2); g.fillText(o.yLabel || "y →", 0, 0); g.restore(); // 세로축 이름(세워서)임
  }

  // 막대그래프: groups=[{label, values:[...]}], series=[{name,color}]
  function bars(cv, groups, series, opts) {
    const o = opts || {}, P = prep(cv, o.height), g = P.g; // 도구를 준비함
    const left = 34, bottom = 22, W = P.w - left - 8, H = P.h - bottom - 8; // 여백과 크기임
    const max = o.max || 1;                         // 세로축 최댓값임
    g.strokeStyle = "#e8d7bd"; g.fillStyle = "#6d5e55"; // 눈금선과 글씨 색임
    for (let t = 0; t <= 4; t++) {                  // 눈금 5개를 그림
      const y = 8 + H - H * t / 4;                  // 눈금 높이임
      g.beginPath(); g.moveTo(left, y); g.lineTo(left + W, y); g.stroke(); // 가로 눈금선임
      g.fillText(o.fmt ? o.fmt(max * t / 4) : (max * t / 4).toFixed(2), 2, y + 4); // 눈금 숫자임
    }
    const gw = W / groups.length, bw = Math.min(28, (gw - 16) / series.length); // 묶음 폭과 막대 폭임
    groups.forEach(function (gr, i) {               // 묶음마다
      gr.values.forEach(function (v, j) {           // 막대마다
        const x = left + i * gw + (gw - bw * series.length) / 2 + j * bw, h = H * Math.max(0, v) / max; // 막대 위치와 높이임
        g.fillStyle = series[j].color; g.fillRect(x, 8 + H - h, bw - 3, h); // 막대를 칠함
        g.fillStyle = "#2e2420"; g.fillText(o.fmt ? o.fmt(v) : v.toFixed(2), x - 2, 8 + H - h - 3); // 막대 위 숫자임
      });
      g.fillStyle = "#6d5e55"; g.fillText(gr.label, left + i * gw + 6, P.h - 6); // 묶음 이름임
    });
  }

  // 꺾은선그래프: lines=[{values, color}]
  function line(cv, lines, opts) {
    const o = opts || {}, P = prep(cv, o.height), g = P.g; // 도구를 준비함
    const left = 36, W = P.w - left - 8, H = P.h - 26; // 여백과 크기임
    let max = o.max != null ? o.max : 0, min = o.min != null ? o.min : Infinity, len = 1; // 축 범위를 구할 변수임
    lines.forEach(function (l) { l.values.forEach(function (v) { if (o.max == null) max = Math.max(max, v); if (o.min == null) min = Math.min(min, v); }); len = Math.max(len, l.values.length); }); // 범위를 계산함
    if (!isFinite(min)) min = 0; if (max === min) max = min + 1; // 빈 자료와 평평한 자료를 처리함
    g.strokeStyle = "#e8d7bd"; g.fillStyle = "#6d5e55"; // 눈금 색임
    for (let t = 0; t <= 3; t++) { const v = min + (max - min) * t / 3, y = 6 + H - H * t / 3; g.beginPath(); g.moveTo(left, y); g.lineTo(left + W, y); g.stroke(); g.fillText(o.fmt ? o.fmt(v) : v.toFixed(2), 2, y + 4); } // 눈금 4개를 그림
    lines.forEach(function (l) {                    // 선마다
      g.strokeStyle = l.color; g.lineWidth = 2.2; g.beginPath(); // 선 색과 굵기임
      l.values.forEach(function (v, i) { const x = left + W * i / Math.max(1, len - 1), y = 6 + H - H * (v - min) / (max - min); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); // 점을 이어 그림
      g.stroke();                                   // 선을 그림
    });
    if (o.xLabel) g.fillText(o.xLabel, left, P.h - 4); // 가로축 이름임
  }

  QP.Charts = { heatmap: heatmap, bars: bars, line: line, prep: prep }; // 그림 기능을 공개함
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김
