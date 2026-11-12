/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Small chart library: line, bar and heat-map (decision map) on canvas. */
/* =====================================================================
 * charts.js : 캔버스 그림 도구 (외부 라이브러리 없이)
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 인터넷 없이도(file://) 그래프가 그려지도록 직접 그림.
 * 하는 일   : 결정 지도(열지도), 막대그래프, 꺾은선그래프를 그림.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 그림 기능을 붙임 / attaches drawing functions to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode

  function prep(cv, h) {                            // 캔버스를 화면 배율에 맞게 준비함 / prepares a canvas for the screen pixel ratio
    const dpr = window.devicePixelRatio || 1;       // 고해상도 화면 배율임 / high-resolution pixel ratio
    const w = cv.clientWidth || 300;                // 화면에 보이는 폭임 / visible width
    const hh = h || cv.clientHeight || 200;         // 높이를 정함 / decide the height
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); // 실제 픽셀 수를 배율만큼 늘림 / scale the real pixel count by the ratio
    cv.style.height = hh + "px";                    // 화면 높이를 고정함 / fix the displayed height
    const g = cv.getContext("2d");                  // 그리기 도구를 얻음 / get the drawing context
    g.setTransform(dpr, 0, 0, dpr, 0, 0);           // 이후 좌표를 화면 픽셀 기준으로 씀 / use screen-pixel coordinates from now on
    g.font = "12.5px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif, sans-serif";      // 글꼴을 정함 / set the font
    return { g: g, w: w, h: hh };                   // 도구와 크기를 돌려줌 / return the context and size
  }
  function mix(a, b, t) {                           // 두 색(RGB 배열)을 t 비율로 섞음 / mixes two colors (RGB arrays) by ratio t
    return "rgb(" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(",") + ")"; // 각 채널을 선형 보간함 / linear interpolation per channel
  }
  const LOW = [251, 246, 236], MID = [233, 196, 140], HIGH = [176, 70, 38], DEEP = [96, 8, 18]; // DEEP=가장 위험(검붉은색) / DEEP = most dangerous (dark crimson) // 낮음=종이색, 중간=황토, 높음=단풍색 / low = paper, middle = ochre, high = maple

  // 결정 지도: grid(점수 2차원), thr(경보 기준), opts.truth(정답 경계 함수), opts.mark([x,y] 현재 위치) / decision map: grid (2-D scores), thr (alarm threshold), opts.truth (true boundary function), opts.mark ([x,y] current position)
  // 등산객 배지 / hiker badge: 지금 산행자를 산과 함께 크게 그림(경사가 급할수록 산이 가파르고, 비가 셀수록 빗방울이 많음) / draws the current hiker large with a mountain (steeper mountain for higher slope, more drops for stronger rain)
  function hikerBadge(g, x, y, rain, slope) {
    const R = 26;                                   // 배지 반지름 / badge radius
    g.save();
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 6;
    g.fillStyle = "#eaf3ff"; g.strokeStyle = "#2e2420"; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); g.stroke(); g.shadowBlur = 0;
    g.beginPath(); g.arc(x, y, R - 1.5, 0, 7); g.clip();   // 안쪽만 그림 / draw inside only
    const ang = (12 + 48 * Math.max(0, Math.min(1, slope))) * Math.PI / 180, base = y + R * .78; // 산비탈 각도(12~60도) / mountainside angle (12-60 deg)
    const peakX = x + R * .55, peakY = Math.max(y - R * .9, base - Math.tan(ang) * (R * 1.6)); // 오른쪽 위 봉우리 / peak at the upper right
    g.fillStyle = "#6f8f5a"; g.beginPath(); g.moveTo(x - R - 2, base); g.lineTo(peakX, peakY); g.lineTo(x + R + 2, peakY + (base - peakY) * .35); g.lineTo(x + R + 2, y + R + 2); g.lineTo(x - R - 2, y + R + 2); g.closePath(); g.fill(); // 산 / mountain
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(peakX, peakY); g.lineTo(peakX - 5, peakY + 6); g.lineTo(peakX + 5, peakY + 6); g.closePath(); g.fill(); // 봉우리 눈 / snow cap
    const n = Math.round(Math.max(0, Math.min(1, rain)) * 9); g.strokeStyle = "#1f6fd1"; g.lineWidth = 1.6; // 빗방울 수 = 비 세기 / number of drops = rain
    for (let i = 0; i < n; i++) { const dx = x - R + 4 + ((i * 37) % (2 * R - 8)), dy = y - R + 4 + ((i * 23) % (R * .9)); g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx - 2, dy + 6); g.stroke(); }
    const t = .42, hx = x - R - 2 + (peakX - (x - R - 2)) * t, hy = base + (peakY - base) * t; // 비탈 위 등산객 발 위치 / hiker's foot position on the slope
    g.save(); g.translate(hx, hy); g.strokeStyle = "#2e2420"; g.lineWidth = 2.4; g.lineCap = "round";
    const lean = -ang * .45;                        // 오르막이라 앞으로 기울임 / lean forward uphill
    g.rotate(lean);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(3, -9); g.lineTo(7, -1); g.stroke(); // 다리 / legs
    g.beginPath(); g.moveTo(3, -9); g.lineTo(3, -19); g.stroke(); // 몸통 / body
    g.fillStyle = "#c62828"; g.fillRect(-3.5, -19, 5.5, 9); // 배낭 / backpack
    g.beginPath(); g.moveTo(3, -16); g.lineTo(10, -11); g.stroke(); g.strokeStyle = "#8a5a2b"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(10, -14); g.lineTo(13, 1); g.stroke(); // 팔과 스틱 / arm and pole
    g.fillStyle = "#2e2420"; g.beginPath(); g.arc(3.5, -23, 3.6, 0, 7); g.fill(); // 머리 / head
    g.fillStyle = "#ffb500"; g.fillRect(0, -27.5, 7, 2.4); // 모자 챙 / cap
    g.restore();
    g.restore();
  }

  function heatmap(cv, grid, thr, opts) {
    const o = opts || {}, P = prep(cv, o.height), g = P.g; // 옵션과 도구를 준비함 / prepare options and context
    const pad = 26, W = P.w - pad - 6, H = P.h - pad - 6, n = grid.length; // 여백과 그림 크기임 / margins and plot size
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { // 모든 칸을 칠함 / paint every cell
      const v = grid[r][c];                         // 칸의 점수임 / score of the cell
      const t = v < thr ? .5 * v / thr : .5 + .5 * (v - thr) / Math.max(1e-6, 1 - thr); // 경보 기준을 색의 한가운데(황토)에 맞춤 → 경보 영역이 뚜렷이 보임 / put the alarm threshold at the color midpoint (ochre) → alarm area stands out
      g.fillStyle = t < .5 ? mix(LOW, MID, t * 2) : t < .75 ? mix(MID, HIGH, (t - .5) * 4) : mix(HIGH, DEEP, (t - .75) * 4); // 기준 아래 종이색→황토, 위로 갈수록 단풍색→검붉은색(위험 구역이 가장 진함) / below: paper→ochre; above: maple→dark crimson (danger zone darkest) // 기준 아래는 종이색→황토, 위는 황토→단풍색 / below threshold paper→ochre, above ochre→maple
      g.fillRect(pad + c * W / n, 4 + r * H / n, W / n + 1, H / n + 1); // 칸을 칠함 / paint the cell
    }
    g.strokeStyle = o.color || "#6e4c82"; g.lineWidth = 2.4; // 경보 경계선 색과 굵기임 / color and width of the alarm boundary
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) { // 가로 이웃 칸 사이를 검사함 / check horizontally neighboring cells
      if ((grid[r][c] >= thr) !== (grid[r][c + 1] >= thr)) { // 기준을 넘고 안 넘는 경계면 / where one is above and the other below the threshold
        g.beginPath(); g.arc(pad + (c + 1) * W / n, 4 + (r + .5) * H / n, 1.5, 0, 7); g.stroke(); // 경계점에 점을 찍음 / put a dot on the boundary
      }
    }
    for (let c = 0; c < n; c++) for (let r = 0; r < n - 1; r++) { // 세로 이웃 칸 사이도 검사함 / also check vertical neighbors
      if ((grid[r][c] >= thr) !== (grid[r + 1][c] >= thr)) { // 경계면 / boundary
        g.beginPath(); g.arc(pad + (c + .5) * W / n, 4 + (r + 1) * H / n, 1.5, 0, 7); g.stroke(); // 점을 찍음 / put a dot
      }
    }
    if (o.danger != null) {                         // ‘위험!’ 구역 경계(빨간 실선 점)를 그림 / draw the 'danger!' zone boundary (red dots)
      g.fillStyle = "#ff3b30";
      for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) if ((grid[r][c] >= o.danger) !== (grid[r][c + 1] >= o.danger)) { g.beginPath(); g.arc(pad + (c + 1) * W / n, 4 + (r + .5) * H / n, 2.2, 0, 7); g.fill(); }
      for (let c = 0; c < n; c++) for (let r = 0; r < n - 1; r++) if ((grid[r][c] >= o.danger) !== (grid[r + 1][c] >= o.danger)) { g.beginPath(); g.arc(pad + (c + .5) * W / n, 4 + (r + 1) * H / n, 2.2, 0, 7); g.fill(); }
    }
    if (o.truth) {                                  // 정답 위험 경계(점선)를 그림 / draw the true risk boundary (dashed)
      g.setLineDash([5, 4]); g.strokeStyle = "#2e2420"; g.lineWidth = 1.5; g.beginPath(); // 점선 설정임 / dashed-line settings
      let first = true;                             // 첫 점 여부임 / whether first point
      for (let k = 0; k <= 60; k++) {               // 가로축을 60등분해서 따라감 / follow the x-axis in 60 steps
        const a = k / 60, b = o.truth(a);           // a에서 정답 경계의 b 값을 구함 / get the boundary value b at a
        if (b == null || b > 1 || b < 0) continue;  // 그림 밖이면 건너뜀 / skip if outside the plot
        const px = pad + a * W, py = 4 + (1 - b) * H; // 화면 좌표로 바꿈 / convert to screen coordinates
        if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py); // 선을 이어 그림 / connect the line
      }
      g.stroke(); g.setLineDash([]);                // 선을 그리고 점선을 끔 / draw the line and turn off dashes
    }
    if (o.mark) {                                   // 현재 상황 위치를 표시함 / mark the current situation
      const px = pad + o.mark[0] * W, py = 4 + (1 - o.mark[1]) * H; // 화면 좌표임 / screen coordinates
      if (o.markDanger) { const ph = (performance.now() % 900) / 900; g.save(); g.strokeStyle = "rgba(255,40,40," + (1 - ph).toFixed(2) + ")"; g.lineWidth = 5; g.beginPath(); g.arc(px, py, 28 + 18 * ph, 0, 7); g.stroke(); g.restore(); } // 위험!이면 붉은 고리가 퍼짐 / red ring expands when in danger
      hikerBadge(g, px, py, o.mark[0], o.mark[1]);  // 등산객 배지: 작은 산(기울기=경사) 위의 등산객, 빗방울 수=비 / hiker badge: a hiker on a small mountain (tilt = slope), raindrops = rain
      if (o.markLabel) { g.font = "bold 12px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; const tw = g.measureText(o.markLabel).width + 10, bx = Math.max(pad, Math.min(P.w - tw - 4, px - tw / 2)), by = py > 64 ? py - 58 : py + 32; const lv = o.markLevel || 0, BG = ["rgba(255,255,255,.93)", "#fff3c4", "#ffb74d", (performance.now() % 600 < 300) ? "#d50000" : "#7f0000"], FG = ["#2e2420", "#5d4300", "#3e1a00", "#fff"]; g.fillStyle = BG[lv]; g.strokeStyle = lv === 3 ? "#fff" : "#2e2420"; g.lineWidth = lv === 3 ? 2 : 1; g.fillRect(bx, by, tw, 20); g.strokeRect(bx, by, tw, 20); g.fillStyle = FG[lv]; g.fillText(o.markLabel, bx + 5, by + 14); /* 단계별 말풍선 색(위험!은 깜빡임) / bubble color per level (danger blinks) */ } // 말풍선: 지금 산행자의 상태와 판정임 / speech bubble: current hiker state and verdict
    }
    if (o.corners) { g.font = "bold 11.5px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.fillStyle = "rgba(46,36,32,.75)"; g.textAlign = "left"; g.fillText("맑고 완만(안전)", pad + 4, 4 + H - 6); g.textAlign = "right"; g.fillText("비 + 급경사(위험)", pad + W - 4, 18); g.fillText("비만 강함", pad + W - 4, 4 + H - 6); g.textAlign = "left"; g.fillText("경사만 급함", pad + 4, 18); } // 네 모서리의 뜻을 적음 / write the meaning of the four corners
    g.fillStyle = "#6d5e55";                        // 축 글씨 색임 / axis text color
    g.fillText(o.xLabel || "x →", pad, P.h - 6);    // 가로축 이름임 / x-axis name
    g.save(); g.translate(11, 4 + H); g.rotate(-Math.PI / 2); g.fillText(o.yLabel || "y →", 0, 0); g.restore(); // 세로축 이름(세워서)임 / y-axis name (rotated)
  }

  // 막대그래프: groups=[{label, values:[...]}], series=[{name,color}] / bar chart: groups=[{label, values:[...]}], series=[{name,color}]
  function bars(cv, groups, series, opts) {
    const o = opts || {}, P = prep(cv, o.height), g = P.g; // 도구를 준비함 / prepare the context
    const left = 34, bottom = 22, W = P.w - left - 8, H = P.h - bottom - 8; // 여백과 크기임 / margins and size
    const max = o.max || 1;                         // 세로축 최댓값임 / maximum of the y-axis
    g.strokeStyle = "#e8d7bd"; g.fillStyle = "#6d5e55"; // 눈금선과 글씨 색임 / grid line and text colors
    for (let t = 0; t <= 4; t++) {                  // 눈금 5개를 그림 / draw 5 ticks
      const y = 8 + H - H * t / 4;                  // 눈금 높이임 / tick height
      g.beginPath(); g.moveTo(left, y); g.lineTo(left + W, y); g.stroke(); // 가로 눈금선임 / horizontal grid line
      g.fillText(o.fmt ? o.fmt(max * t / 4) : (max * t / 4).toFixed(2), 2, y + 4); // 눈금 숫자임 / tick number
    }
    const gw = W / groups.length, bw = Math.min(28, (gw - 16) / series.length); // 묶음 폭과 막대 폭임 / group width and bar width
    groups.forEach(function (gr, i) {               // 묶음마다 / for each group
      gr.values.forEach(function (v, j) {           // 막대마다 / for each bar
        const x = left + i * gw + (gw - bw * series.length) / 2 + j * bw, h = H * Math.max(0, v) / max; // 막대 위치와 높이임 / bar position and height
        g.fillStyle = series[j].color; g.fillRect(x, 8 + H - h, bw - 3, h); // 막대를 칠함 / paint the bar
        if (bw >= 15) { g.save(); g.font = (bw >= 24 ? 10 : 8.5) + "px Times New Roman, Noto Serif KR, AppleMyungjo, Batang, serif"; g.textAlign = "center"; g.fillStyle = "#2e2420"; g.fillText(o.fmt ? o.fmt(v) : v.toFixed(2), x + (bw - 3) / 2, Math.max(9, 8 + H - h - 3)); g.restore(); } // 막대 위 숫자(막대 가운데 정렬, 좁으면 생략해 겹침 방지)임 / number above the bar (centered; omitted if too narrow to avoid overlap)
      });
      g.save(); g.fillStyle = "#6d5e55"; g.textAlign = "center"; let lb = gr.label; while (g.measureText(lb).width > gw - 4 && lb.length > 2) lb = lb.slice(0, -1); g.fillText(lb, left + i * gw + gw / 2, P.h - 6); g.restore(); // 묶음 이름(칸 가운데, 칸보다 길면 줄여 겹침 방지)임 / group name (centered; shortened if too long to avoid overlap)
    });
  }

  // 꺾은선그래프: lines=[{values, color}] / line chart: lines=[{values, color}]
  function line(cv, lines, opts) {
    const o = opts || {}, P = prep(cv, o.height), g = P.g; // 도구를 준비함 / prepare the context
    const left = 36, W = P.w - left - 8, H = P.h - 26; // 여백과 크기임 / margins and size
    let max = o.max != null ? o.max : 0, min = o.min != null ? o.min : Infinity, len = 1; // 축 범위를 구할 변수임 / variables for the axis range
    lines.forEach(function (l) { l.values.forEach(function (v) { if (o.max == null) max = Math.max(max, v); if (o.min == null) min = Math.min(min, v); }); len = Math.max(len, l.values.length); }); // 범위를 계산함 / compute the range
    if (!isFinite(min)) min = 0; if (max === min) max = min + 1; // 빈 자료와 평평한 자료를 처리함 / handle empty and flat data
    g.strokeStyle = "#e8d7bd"; g.fillStyle = "#6d5e55"; // 눈금 색임 / tick color
    for (let t = 0; t <= 3; t++) { const v = min + (max - min) * t / 3, y = 6 + H - H * t / 3; g.beginPath(); g.moveTo(left, y); g.lineTo(left + W, y); g.stroke(); g.fillText(o.fmt ? o.fmt(v) : v.toFixed(2), 2, y + 4); } // 눈금 4개를 그림 / draw 4 ticks
    lines.forEach(function (l) {                    // 선마다 / for each line
      g.strokeStyle = l.color; g.lineWidth = 2.2; g.beginPath(); // 선 색과 굵기임 / line color and width
      l.values.forEach(function (v, i) { const x = left + W * i / Math.max(1, len - 1), y = 6 + H - H * (v - min) / (max - min); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); // 점을 이어 그림 / connect the points
      g.stroke();                                   // 선을 그림 / draw the line
    });
    if (o.xLabel) g.fillText(o.xLabel, left, P.h - 4); // 가로축 이름임 / x-axis name
  }

  QP.Charts = { heatmap: heatmap, bars: bars, line: line, prep: prep }; // 그림 기능을 공개함 / make the drawing functions public
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
