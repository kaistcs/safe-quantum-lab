/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved. */
/* [English] Live summit weather and hiking score for the top-100 mountains, rotating in the bottom live bar. */
/**
 * liveweather.js : 100대 명산(대표 16곳) 정상의 "지금" 날씨와 산행 점수를 아래 실시간 관제 띠에 산별로 돌아가며 보여 줌
 *
 * 자료 출처 : Open-Meteo 예보 API(무료, 키 없음, 기상청 KMA 등 여러 수치모델을 합친 값), 정상 표고로 기온을 보정함.
 *             기상청 공공데이터포털(단기예보, 산악기상) API는 서비스 키가 필요하므로, 키를 받으면 fetchKMA()로 바꾸어 끼울 수 있음.
 * 산행 점수 : 100점에서 기온, 체감온도, 바람, 강수, 뇌우/눈, 일몰까지 남은 시간에 따라 감점(규칙 기반, 학습 안 함).
 * 인터넷이 없거나 단일 HTML(claude.ai 게시본)처럼 외부 접속이 막히면 "연결 안 됨"을 표시하고 가상 관제만 계속함.
 */
(function () {
  "use strict";
  const QP = window.QP = window.QP || {};
  // [이름, 대표 봉우리, 표고 m, 위도, 경도] (봉우리 좌표, 공개 지도 기준 근삿값) / [name, peak, elevation, lat, lon]
  const MT = [
    ["북한산", "백운대", 836, 37.6588, 126.9779], ["도봉산", "자운봉", 740, 37.6987, 127.0154], ["관악산", "연주대", 632, 37.4446, 126.9637],
    ["설악산", "대청봉", 1708, 38.1192, 128.4654], ["오대산", "비로봉", 1563, 37.7949, 128.5434], ["치악산", "비로봉", 1288, 37.3653, 128.0553],
    ["태백산", "장군봉", 1567, 37.0951, 128.9155], ["소백산", "비로봉", 1439, 36.9573, 128.4847], ["속리산", "천왕봉", 1058, 36.5434, 127.8706],
    ["덕유산", "향적봉", 1614, 35.8604, 127.7464], ["지리산", "천왕봉", 1915, 35.3369, 127.7307], ["가야산", "칠불봉", 1433, 35.8226, 128.1185],
    ["무등산", "천왕봉", 1187, 35.1342, 126.9884], ["월출산", "천황봉", 809, 34.7684, 126.7116], ["내장산", "신선봉", 763, 35.4793, 126.8907], ["한라산", "백록담", 1947, 33.3617, 126.5292]
  ];
  const WX = function (c) {                         // 날씨 코드(WMO) → 한글 / WMO weather code → Korean
    if (c === 0) return "맑음"; if (c <= 2) return "구름 조금"; if (c === 3) return "흐림"; if (c <= 48) return "안개";
    if (c <= 57) return "이슬비"; if (c <= 67) return "비"; if (c <= 77) return "눈"; if (c <= 82) return "소나기"; if (c <= 86) return "눈보라"; return "뇌우";
  };
  function score(w, now) {                          // 산행 점수(0~100)와 감점 이유 / hiking score and reasons
    let s = 100; const why = [];
    const t = w.t, a = w.at, wd = w.wind, p = w.p, c = w.code;
    if (a < -15) { s -= 35; why.push("혹한(체감 " + Math.round(a) + "°C)"); } else if (a < -5) { s -= 15; why.push("추위"); } else if (t > 30) { s -= 25; why.push("폭염"); } else if (t > 27) { s -= 10; why.push("더위"); }
    if (wd > 14) { s -= 35; why.push("강풍 " + wd.toFixed(0) + "m/s"); } else if (wd > 9) { s -= 15; why.push("바람 " + wd.toFixed(0) + "m/s"); }
    if (p > 5) { s -= 30; why.push("강한 비, 눈"); } else if (p > 0.2) { s -= 12; why.push("강수"); }
    if (c >= 95) { s -= 50; why.push("뇌우(낙뢰)"); } else if ((c >= 71 && c <= 77) || c >= 85) { s -= 15; why.push("눈"); } else if (c >= 45 && c <= 48) { s -= 8; why.push("안개(시야)"); }
    if (t <= 0 && p > 0) { s -= 10; why.push("결빙 우려"); }
    if (w.sunset) { const h = (w.sunset - now) / 3.6e6; if (h < 0) { s -= 30; why.push("일몰 후"); } else if (h < 2) { s -= 15; why.push("일몰 " + Math.round(h * 60) + "분 전"); } }
    s = Math.max(0, Math.min(100, Math.round(s)));
    return { s: s, why: why, grade: s >= 80 ? "좋음" : s >= 60 ? "보통" : s >= 40 ? "주의" : "위험", cls: s >= 80 ? "ok" : s >= 60 ? "mid" : s >= 40 ? "warn" : "bad" };
  }
  const st = { data: null, err: null, at: null, i: 0 };
  function fetchAll() {                             // 16곳을 한 번에 요청함 / request all 16 at once
    const q = function (k) { return MT.map(function (m) { return m[k]; }).join(","); };
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + q(3) + "&longitude=" + q(4) + "&elevation=" + q(2) +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=sunset&timezone=Asia%2FSeoul&wind_speed_unit=ms&forecast_days=1";
    if (!window.fetch) { st.err = "브라우저 미지원"; return; }
    fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
      const arr = Array.isArray(j) ? j : [j];
      st.data = arr.map(function (x, k) { const c = x.current || {}; const ss = x.daily && x.daily.sunset ? new Date(x.daily.sunset[0] + ":00+09:00") : null;
        return { m: MT[k], t: c.temperature_2m, at: c.apparent_temperature, rh: c.relative_humidity_2m, p: c.precipitation || 0, code: c.weather_code || 0, wind: c.wind_speed_10m || 0, sunset: ss }; });
      st.err = null; st.at = new Date(); show();
    }).catch(function (e) { st.err = "실시간 날씨 연결 안 됨(오프라인 또는 외부 접속 차단)"; show(); });
  }
  function el() {                                   // 표시 칸을 만들거나 찾음 / create or find the display slot
    let e = document.getElementById("wxTag"); if (e) return e;
    const live = document.getElementById("live"); if (!live) return null;
    e = document.createElement("div"); e.id = "wxTag"; e.className = "wxtag"; e.title = "100대 명산 정상의 지금 날씨와 산행 점수(Open-Meteo, 정상 표고 보정). 클릭하면 다음 산"; e.onclick = function () { st.i++; show(); };
    live.appendChild(e); return e;
  }
  function show() {
    const e = el(); if (!e) return;
    if (!st.data) { e.innerHTML = '<span class="wxh">⛰ 지금 명산 날씨</span> ' + (st.err || "불러오는 중…"); e.className = "wxtag"; return; }
    const d = st.data[st.i % st.data.length], now = new Date(), r = score(d, now), m = d.m;
    const hm = function (x) { return String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0"); };
    e.className = "wxtag " + r.cls;
    const no = st.i % st.data.length + 1; e.innerHTML = '<span class="wxh">⛰ 지금 날씨 ' + no + "/" + st.data.length + "</span> <b>No." + no + " " + m[0] + " " + m[1] + "(" + m[2] + "m)</b> " + WX(d.code) + ", " +
      "<b>" + (d.t != null ? d.t.toFixed(1) : "?") + "°C</b>(체감 " + (d.at != null ? d.at.toFixed(0) : "?") + "°C), 바람 " + d.wind.toFixed(1) + "m/s, 강수 " + d.p.toFixed(1) + "mm, 습도 " + (d.rh != null ? d.rh : "?") + "%" +
      (d.sunset ? ", 일몰 " + hm(d.sunset) : "") + ' | <b class="wxs">산행 점수 ' + r.s + "점, " + r.grade + "</b>" + (r.why.length ? " (" + r.why.join(", ") + ")" : "") +
      ' <small>' + hm(st.at) + " 기준</small>";
  }
  function start() { el(); show(); fetchAll(); setInterval(fetchAll, 15 * 60 * 1000); setInterval(function () { if (st.data) { st.i++; show(); } }, 7000); }
  QP.LiveWx = { MT: MT, score: score, state: st, refresh: fetchAll };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 1500); }); else setTimeout(start, 1500);
})();
