/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved. */
/* [English] Live summit weather, estimated difficulty and real hiking feasibility (now / tomorrow) for the official top-100 mountains. */
/**
 * liveweather.js (v03, 2026-11-12 개정) : 산림청 100대 명산 100곳 정상의 지금 날씨, 산 난이도, "진짜 산행 가능성"을
 *   (가) 우측 상단 박스(#wxBox, 펼침 패널 #wxPanel)와 (나) 아래 실시간 띠(#wxTag)에 보여 줌.
 *
 * 근거와 출처(번호는 화면 패널의 근거 번호와 같음)
 *  1. 목록, 번호 : 산림청 「한국의 100대 명산」 전자책(일러두기 "게재 순서는 가나다순"), forest.go.kr/images/data/fonDown/100_mountain_ebook.pdf
 *  2. 정상 좌표 : Wikidata 각 산 항목의 P625(좌표), QID를 목록에 함께 적음(2026-11-12 조회). 사량도 지리산(No.78)은 섬 중심 좌표 근삿값.
 *     공식 점 좌표는 한국임업진흥원 「100대명산_전국」(SHP, EPSG:5179, 공공데이터포털 95530)로 교체 가능.
 *  3. 날씨 : Open-Meteo 예보 API(키 없음, 여러 수치모델 합성), 정상 표고로 기온 보정. 30분마다 갱신(무료 하루 10,000회 한도 안).
 *  4. 난이도(추정) : Naismith 규칙(1892; Scarf 2007, J. Sports Sci. 25(6)) 상행시간 = 수평거리/4km/h + 오르막/600m/h,
 *     하행 = 상행의 0.7배, 휴식 0.5시간. 들머리 표고 = 정상의 30%(30~750m), 평균 경사 18%로 거리를 추정함(실제 GPX로 교체 예정).
 *     등급 이름은 한국등산트레킹지원센터 숲길 난이도 등급 이름을 따름(쉬움, 보통, 어려움, 매우 어려움).
 *  5. 통제 기준 : 기상청 강풍주의보(육상 풍속 14m/s 이상), 뇌우(낙뢰), 시간당 10mm 이상 강한 비, 체감 -28°C 이하(캐나다 환경부 체감온도표: 30분 안 동상 위험),
 *     국립공원공단은 기상특보 때 탐방로를 통제함. 일몰 전 하산이 안 되면 그날 산행은 "불가"로 판단함.
 */
(function () {
  "use strict";
  const QP = window.QP = window.QP || {};
  // [번호, 이름, 대표 봉우리, 높이 m(산림청 목록), 소재지, 위도, 경도, Wikidata QID] / [no, name, peak, height, region, lat, lon, QID]
  const MT = [
    [1,"가리산","",1051,"강원 춘천, 홍천",37.8714,127.9564,"Q626077"], [2,"가리왕산","",1561,"강원 정선, 평창",37.4614,128.5633,"Q5523374"], [3,"가야산","칠불봉",1430,"경북 성주, 경남 합천",35.8221,128.1179,"Q5528708"], [4,"가지산","",1240,"울산 울주, 경남 밀양",35.6203,129.0031,"Q5517618"],
    [5,"감악산","",675,"경기 파주, 양주",37.9421,126.9695,"Q27290854"], [6,"강천산","",584,"전북 순창",35.4042,127.0489,"Q5521102"], [7,"계룡산","",845,"충남 공주, 대전",36.3433,127.2061,"Q496427"], [8,"계방산","",1577,"강원 평창, 홍천",37.7283,128.4656,"Q623665"],
    [9,"공작산","",887,"강원 홍천",37.7156,128.0100,"Q626966"], [10,"관악산","연주대",629,"서울 관악, 경기 과천",37.4456,126.9636,"Q626275"], [11,"구병산","",877,"충북 보은",36.4694,127.8617,"Q5614460"], [12,"금산","",681,"경남 남해",34.7542,127.9828,"Q27279494"],
    [13,"금수산","",1016,"충북 제천, 단양",36.9850,128.2567,"Q27279507"], [14,"금오산","",977,"경북 구미",36.0925,128.3000,"Q27279491"], [15,"금정산","",802,"부산 금정",35.2831,129.0556,"Q482647"], [16,"깃대봉","",368,"전남 신안(홍도)",34.6950,125.2019,"Q5565075"],
    [17,"남산","",468,"경북 경주",35.7681,129.2256,"Q489229"], [18,"내연산","",710,"경북 포항",36.2661,129.2608,"Q6958140"], [19,"내장산","신선봉",763,"전북 정읍",35.4833,126.8833,"Q626648"], [20,"대둔산","",878,"충남 금산, 전북 완주",36.1200,127.3233,"Q5208179"],
    [21,"대암산","",1304,"강원 양구, 인제",37.9228,128.2344,"Q27290112"], [22,"대야산","",931,"경북 문경, 충북 괴산",36.6706,127.9325,"Q5208296"], [23,"덕숭산","",495,"충남 예산",36.6717,126.6181,"Q5259973"], [24,"덕유산","향적봉",1614,"전북 무주",35.8606,127.7464,"Q130821"],
    [25,"덕항산","",1071,"강원 삼척",37.3309,129.0097,"Q5259968"], [26,"도락산","",964,"충북 단양",36.8561,128.3117,"Q5297499"], [27,"도봉산","자운봉",740,"서울 도봉, 경기 의정부",37.7006,127.0156,"Q626000"], [28,"두륜산","",703,"전남 해남",34.4728,126.6378,"Q5316834"],
    [29,"두타산","",1353,"강원 동해, 삼척",37.4266,129.0039,"Q27266902"], [30,"마니산","",469,"인천 강화",37.6167,126.4333,"Q624003"], [31,"마이산","",686,"전북 진안",35.7611,127.4122,"Q562938"], [32,"명성산","",923,"강원 철원, 경기 포천",38.1069,127.3378,"Q6947377"],
    [33,"명지산","",1267,"경기 가평",37.9328,127.4308,"Q8528363"], [34,"모악산","",794,"전북 전주, 김제",35.7292,127.0853,"Q6886370"], [35,"무등산","천왕봉",1187,"광주, 전남 화순",35.1342,126.9889,"Q6931712"], [36,"무학산","",761,"경남 창원",35.2111,128.5358,"Q624473"],
    [37,"미륵산","",461,"경남 통영",34.8114,128.4164,"Q6873183"], [38,"민주지산","",1242,"충북 영동",36.0400,127.8492,"Q8533668"], [39,"방장산","",743,"전북 고창, 전남 장성",35.4478,126.7600,"Q4855183"], [40,"방태산","",1444,"강원 인제",37.8947,128.3556,"Q626912"],
    [41,"백덕산","",1350,"강원 평창, 영월",37.3967,128.2933,"Q4841252"], [42,"백암산","",741,"전남 장성",35.4611,126.8692,"Q27292863"], [43,"백운산(포천)","",904,"경기 포천, 강원 화천",38.0747,127.4442,"Q4841233"], [44,"백운산(광양)","",1218,"전남 광양",35.1064,127.6217,"Q625808"],
    [45,"백운산(정선)","",883,"강원 정선, 영월",37.2800,128.5958,"Q27304085"], [46,"변산","",508,"전북 부안",35.6808,126.5314,"Q483528"], [47,"북한산","백운대",837,"서울 강북, 경기 고양",37.6608,126.9933,"Q494652"], [48,"비슬산","",1084,"대구 달성",35.7167,128.5244,"Q4917297"],
    [49,"삼악산","",654,"강원 춘천",37.8385,127.6639,"Q7408508"], [50,"서대산","",904,"충남 금산",36.2200,127.5378,"Q7451509"], [51,"선운산","",336,"전북 고창",35.5081,126.5711,"Q7451618"], [52,"설악산","대청봉",1708,"강원 속초, 인제, 양양",38.1194,128.4656,"Q482644"],
    [53,"성인봉","",984,"경북 울릉",37.4950,130.8633,"Q7451593"], [54,"소백산","비로봉",1439,"충북 단양, 경북 영주",36.9600,128.4847,"Q625589"], [55,"소요산","",559,"경기 동두천",37.9419,127.0889,"Q623938"], [56,"속리산","천왕봉",1057,"충북 보은, 경북 상주",36.5333,127.9000,"Q482720"],
    [57,"신불산","",1209,"울산 울주, 경남 양산",35.5400,129.0560,"Q7521890"], [58,"연화산","",528,"경남 고성",35.0708,128.2650,"Q8052475"], [59,"오대산","비로봉",1563,"강원 평창, 강릉",37.7981,128.5431,"Q491028"], [60,"오봉산","",779,"강원 춘천, 화천",38.0008,127.8061,"Q7075287"],
    [61,"용문산","",1157,"경기 양평",37.5622,127.5520,"Q8055033"], [62,"용화산","",878,"강원 춘천, 화천",38.0372,127.7531,"Q8055011"], [63,"운문산","",1188,"경북 청도, 경남 밀양",35.6161,128.9589,"Q7897128"], [64,"운악산","",936,"경기 가평, 포천",37.8781,127.3250,"Q8528375"],
    [65,"운장산","",1126,"전북 진안",35.9108,127.3570,"Q7896931"], [66,"월악산","",1094,"충북 제천",36.8833,128.0833,"Q482709"], [67,"월출산","천황봉",809,"전남 영암",34.7678,126.7044,"Q482741"], [68,"유명산","",862,"경기 가평, 양평",37.5764,127.4875,"Q626674"],
    [69,"응봉산","",999,"경북 울진, 강원 삼척",37.0764,129.2308,"Q5409714"], [70,"장안산","",1237,"전북 장수",35.6300,127.5958,"Q6154017"], [71,"재약산","",1189,"경남 밀양, 울산 울주",35.5467,128.9806,"Q6121735"], [72,"적상산","",1034,"전북 무주",35.9478,127.6911,"Q8533740"],
    [73,"점봉산","",1424,"강원 인제, 양양",38.0489,128.4247,"Q27287347"], [74,"조계산","",884,"전남 순천",35.0025,127.3136,"Q6214838"], [75,"주왕산","",721,"경북 청송",36.3892,129.1626,"Q6319107"], [76,"주흘산","",1106,"경북 문경",36.7886,128.1006,"Q6305114"],
    [77,"지리산","천왕봉",1915,"경남 산청, 전남 구례, 전북 남원",35.3369,127.7306,"Q483204"], [78,"지리산(사량도)","",398,"경남 통영(사량도)",34.8256,128.2053,"Q22974041"], [79,"천관산","",723,"전남 장흥",34.5322,126.9158,"Q5091668"], [80,"천마산","",812,"경기 남양주",37.6806,127.2728,"Q5091679"],
    [81,"천성산","",922,"경남 양산",35.4203,129.1122,"Q5091685"], [82,"천태산","",715,"충북 영동, 충남 금산",36.1589,127.6000,"Q626656"], [83,"청량산","",870,"경북 봉화",36.7914,128.9269,"Q5091652"], [84,"추월산","",731,"전남 담양, 전북 순창",35.3992,126.9756,"Q5118414"],
    [85,"축령산","",879,"경기 남양주, 가평",37.7528,127.3331,"Q5116393"], [86,"치악산","비로봉",1288,"강원 원주, 횡성",37.3650,128.0553,"Q5095160"], [87,"칠갑산","",561,"충남 청양",36.4133,126.8842,"Q5098908"], [88,"태백산","장군봉",1567,"강원 태백, 경북 봉화",37.0957,128.9152,"Q625254"],
    [89,"태화산","",1027,"강원 영월, 충북 단양",37.1169,128.4850,"Q7674755"], [90,"팔공산","",1193,"대구, 경북 칠곡",36.0169,128.6953,"Q624313"], [91,"팔봉산","",302,"강원 홍천",37.6958,127.6967,"Q27307307"], [92,"팔영산","",609,"전남 고흥",34.6183,127.4342,"Q8533837"],
    [93,"한라산","백록담",1950,"제주",33.3617,126.5292,"Q494645"], [94,"화악산","",1468,"경기 가평, 강원 화천",37.9950,127.5031,"Q626975"], [95,"화왕산","",757,"경남 창녕",35.5478,128.5328,"Q5952091"], [96,"황매산","",1108,"경남 합천, 산청",35.4964,127.9744,"Q5952045"],
    [97,"황석산","",1190,"경남 함양",35.6581,127.7528,"Q5952055"], [98,"황악산","",1111,"충북 영동, 경북 김천",36.1192,127.9661,"Q5951990"], [99,"황장산","",1077,"경북 문경",36.8131,128.2761,"Q8533914"], [100,"희양산","",999,"충북 괴산, 경북 문경",36.7160,128.0050,"Q5701198"]
  ];
  const REG = { 서울: "수도권", 경기: "수도권", 인천: "수도권", 강원: "강원", 충북: "충청", 충남: "충청", 대전: "충청",
    전북: "전라", 전남: "전라", 광주: "전라", 경북: "경상", 경남: "경상", 대구: "경상", 부산: "경상", 울산: "경상", 제주: "제주" };
  const REGS = ["수도권", "강원", "충청", "전라", "경상", "제주"];
  const region = function (m) { return REG[m[4].split(/[ ,]/)[0]] || "기타"; };
  // 판정 4단계와 색(서로 확실히 구분되는 천연색) / four verdict levels and colors
  const LV = [
    { k: "ok", t: "산행 가능", c: "#2e7d32" },          // 초록
    { k: "mid", t: "주의하며 가능", c: "#1e63c6" },     // 파랑
    { k: "warn", t: "권장 안 함", c: "#e08a00" },       // 주황
    { k: "bad", t: "불가", c: "#c62828" }               // 빨강
  ];
  const WX = function (c) {                         // 날씨 코드(WMO) → 한글 / WMO weather code → Korean
    if (c === 0) return "맑음"; if (c <= 2) return "구름 조금"; if (c === 3) return "흐림"; if (c <= 48) return "안개";
    if (c <= 57) return "이슬비"; if (c <= 67) return "비"; if (c <= 77) return "눈"; if (c <= 82) return "소나기"; if (c <= 86) return "눈보라"; return "뇌우";
  };
  const DIFF = ["쉬움", "보통", "어려움", "매우 어려움"], DCOL = ["#2e7d32", "#1e63c6", "#e08a00", "#8e24aa"];
  function difficulty(m) {                          // 근거 4: Naismith 규칙 추정 / Naismith-rule estimate
    const H = m[3], trail = Math.max(30, Math.min(750, H * 0.3)), up = H - trail, dist = up / 1000 / 0.18;   // km
    const tUp = dist / 4 + up / 600, rt = tUp * 1.7 + 0.5;
    const g = rt < 3.5 ? 0 : rt < 5 ? 1 : rt < 6.5 ? 2 : 3;
    return { g: g, t: DIFF[g], c: DCOL[g], up: Math.round(up), dist: dist, rt: rt };
  }
  const hm = function (x) { return x ? String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0") : "?"; };
  const hrs = function (h) { const H = Math.floor(h), M = Math.round((h - H) * 60); return H + "시간" + (M ? " " + M + "분" : ""); };
  // 산행 가능성 판단: 날씨 감점 × 난이도 가중 + 일몰 전 하산 여부 / feasibility = weather penalty x difficulty weight + daylight check
  function judge(w, d, mode, now) {
    const why = [], stop = [];
    let pen = 0;
    const t = w.t, a = w.at, wd = w.wind, p = w.p, c = w.code;
    if (c >= 95) stop.push("뇌우(낙뢰)");
    if (wd >= 14) stop.push("강풍 " + wd.toFixed(0) + "m/s(강풍주의보 기준)"); else if (wd >= 9) { pen += 15; why.push("바람 " + wd.toFixed(0) + "m/s"); } else if (wd >= 6) { pen += 5; why.push("약한 바람"); }
    if (mode === "now") { if (p >= 10) stop.push("강한 비 " + p.toFixed(0) + "mm/h"); else if (p > 2) { pen += 20; why.push("비, 눈 " + p.toFixed(1) + "mm/h"); } else if (p > 0.1) { pen += 10; why.push("약한 강수"); } }
    else { if (p >= 30) stop.push("많은 비, 눈 " + p.toFixed(0) + "mm"); else if (p >= 10) { pen += 22; why.push("강수 " + p.toFixed(0) + "mm"); } else if (p >= 1) { pen += 10; why.push("강수 " + p.toFixed(0) + "mm"); } }
    if (a != null) { if (a <= -28) stop.push("체감 " + Math.round(a) + "°C(동상 위험)"); else if (a <= -15) { pen += 25; why.push("혹한(체감 " + Math.round(a) + "°C)"); } else if (a <= -5) { pen += 10; why.push("추위(체감 " + Math.round(a) + "°C)"); } }
    if (t != null) { if (t >= 33) { pen += 30; why.push("폭염"); } else if (t >= 28) { pen += 12; why.push("더위"); } }
    if ((c >= 71 && c <= 77) || (c >= 85 && c <= 86)) { pen += 15; why.push("눈(미끄럼)"); } else if (c >= 45 && c <= 48) { pen += 8; why.push("안개(시야)"); }
    if (t != null && t <= 1 && (p > 0 || (c >= 45 && c <= 48))) { pen += 10; why.push("결빙 우려"); }
    // 해 있는 동안 하산 가능 여부 / can the hiker be down before sunset?
    let back = null, dayOk = true;
    if (mode === "now") { back = new Date(now.getTime() + d.rt * 3.6e6); if (w.sunset && back > w.sunset) { dayOk = false; stop.push(now > w.sunset ? "일몰 후(야간 산행 불가)" : "지금 출발하면 일몰(" + hm(w.sunset) + ") 뒤 하산"); } }
    else if (w.sunrise && w.sunset) { const day = (w.sunset - w.sunrise) / 3.6e6; if (d.rt > day - 1) { dayOk = false; stop.push("낮 시간 부족"); } }
    const mult = [1, 1.15, 1.3, 1.5][d.g], base = [0, 4, 8, 12][d.g];
    let s = Math.round(100 - pen * mult - base); s = Math.max(0, Math.min(100, s));
    if (d.g >= 2 && pen > 0) why.push("난이도가 높아(" + d.t + ") 악천후 영향 큼");
    const lv = stop.length ? 3 : s >= 75 ? 0 : s >= 55 ? 1 : s >= 35 ? 2 : 3;
    return { s: stop.length ? Math.min(s, 20) : s, lv: lv, L: LV[lv], why: why, stop: stop, back: back, dayOk: dayOk };
  }
  const st = { data: null, err: null, at: null, i: 46, open: false, hold: false, src: "Open-Meteo" };   // 처음은 No.47 북한산 / start at No.47 Bukhansan
  function fetchAll() {                             // 100곳을 한 번에 요청함 / request all 100 at once
    const q = function (k, f) { return MT.map(function (m) { return f ? m[k].toFixed(4) : m[k]; }).join(","); };
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + q(5, 1) + "&longitude=" + q(6, 1) + "&elevation=" + q(3) +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_min,apparent_temperature_min,temperature_2m_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset" +
      "&timezone=Asia%2FSeoul&wind_speed_unit=ms&forecast_days=2";
    if (!window.fetch) { st.err = "브라우저 미지원"; return; }
    fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
      const arr = Array.isArray(j) ? j : [j], T = function (s) { return s ? new Date(s + ":00+09:00") : null; };
      st.data = arr.map(function (x, k) {
        const c = x.current || {}, D = x.daily || {}, g = function (n, i) { return D[n] ? D[n][i] : null; };
        const now = { t: c.temperature_2m, at: c.apparent_temperature, rh: c.relative_humidity_2m, p: c.precipitation || 0, code: c.weather_code || 0, wind: c.wind_speed_10m || 0, sunrise: T(g("sunrise", 0)), sunset: T(g("sunset", 0)) };
        const tm = { t: g("temperature_2m_max", 1), tmin: g("temperature_2m_min", 1), at: g("apparent_temperature_min", 1), p: g("precipitation_sum", 1) || 0, code: g("weather_code", 1) || 0, wind: g("wind_speed_10m_max", 1) || 0, sunrise: T(g("sunrise", 1)), sunset: T(g("sunset", 1)) };
        return { m: MT[k], now: now, tm: tm };
      });
      st.err = null; st.at = new Date(); evalAll(); show();
    }).catch(function () { st.err = "실시간 날씨 연결 안 됨(오프라인 또는 외부 접속 차단, claude.ai 게시본은 외부 접속이 막혀 있음)"; show(); });
  }
  function evalAll() {
    const now = new Date();
    st.data.forEach(function (x) { x.d = difficulty(x.m); x.jn = judge(x.now, x.d, "now", now); x.jt = judge(x.tm, x.d, "day", now); x.r = region(x.m); });
  }
  function summary() {                              // 권역별 판정 집계 / per-region verdict counts
    const S = {}; REGS.forEach(function (r) { S[r] = { now: [0, 0, 0, 0], tm: [0, 0, 0, 0], n: 0 }; });
    st.data.forEach(function (x) { const o = S[x.r]; if (!o) return; o.n++; o.now[x.jn.lv]++; o.tm[x.jt.lv]++; });
    return S;
  }
  const chip = function (j, lab) { return '<span class="wxv" style="background:' + j.L.c + '">' + lab + " " + j.L.t + (j.lv < 3 ? " " + j.s + "점" : "") + "</span>"; };
  const dchip = function (d) { return '<span class="wxd" style="border-color:' + d.c + ";color:" + d.c + '">난이도 ' + d.t + ", 왕복 약 " + hrs(d.rt) + "</span>"; };
  function line1(x) { const m = x.m; return "<b>No." + m[0] + " " + m[1] + (m[2] ? " " + m[2] : "") + "(" + m[3] + "m)</b> " + m[4] + " " + dchip(x.d); }
  function line2(x) {
    const w = x.now;
    return WX(w.code) + ", <b>" + (w.t != null ? w.t.toFixed(1) : "?") + "°C</b>(체감 " + (w.at != null ? w.at.toFixed(0) : "?") + "°C), 바람 " + w.wind.toFixed(1) + "m/s, 강수 " + w.p.toFixed(1) + "mm, 습도 " + (w.rh != null ? w.rh : "?") + "%, 일몰 " + hm(w.sunset);
  }
  function why(j) { const a = j.stop.concat(j.why); return a.length ? a.join(", ") : "감점 요인 없음"; }
  function render() {
    const box = document.getElementById("wxBox"), tag = document.getElementById("wxTag");
    if (!st.data) {
      const msg = st.err || "100대 명산 날씨 불러오는 중…";
      if (box) box.innerHTML = '<div class="wxb-h">⛰ 100대 명산 실시간 산행 가능성</div><div class="wxb-l">' + msg + "</div>";
      if (tag) { tag.className = "wxtag"; tag.innerHTML = '<span class="wxh">⛰ 지금 명산 날씨</span> ' + msg; }
      return;
    }
    const n = st.data.length, x = st.data[((st.i % n) + n) % n];
    if (box) {
      box.className = "wxbox lv" + x.jn.lv;
      box.innerHTML = '<div class="wxb-h"><span class="wxb-t">⛰ 100대 명산 산행 가능성 <small>' + (st.i % n + 1) + "/" + n + ", " + hm(st.at) + ' 기준</small></span><span class="wxb-l">' + line1(x) + '</span><span class="wxb-btn"><button data-a="prev" title="앞 산">◀</button><button data-a="next" title="다음 산">▶</button><button data-a="list" title="100곳 전체와 권역별 요약 펼치기">☰ 전체 100곳</button></span></div>' +
        '<div class="wxb-l">' + line2(x) + "</div>" +
        '<div class="wxb-l">' + chip(x.jn, "① 지금 출발") + ' <small>' + why(x.jn) + "</small> " + chip(x.jt, "② 내일") + " <small>" + why(x.jt) + "</small></div>";
    }
    if (tag) {
      tag.className = "wxtag " + x.jn.L.k;
      tag.innerHTML = '<span class="wxh">⛰ 지금 날씨 ' + (st.i % n + 1) + "/" + n + "</span> " + line1(x) + " " + line2(x) + ' | <b class="wxs">' + x.jn.L.t + "</b>(" + why(x.jn) + "), 내일 " + x.jt.L.t + " <small>" + hm(st.at) + " 기준</small>";
    }
    if (st.open) renderPanel();
  }
  function bar(arr, tot) { return '<span class="wxbar">' + arr.map(function (v, k) { return v ? '<i style="width:' + (100 * v / tot) + "%;background:" + LV[k].c + '" title="' + LV[k].t + " " + v + '곳">' + v + "</i>" : ""; }).join("") + "</span>"; }
  function renderPanel() {
    let p = document.getElementById("wxPanel"); if (!p) return;
    const S = summary(), n = st.data.length, cur = ((st.i % n) + n) % n;
    let h = '<div class="wxp-h"><b>⛰ 100대 명산 산행 가능성, 권역별 요약</b><button data-a="close">✕ 닫기</button></div>';
    h += '<div class="wxp-leg">' + LV.map(function (L, k) { return '<span><i style="background:' + L.c + '"></i>' + (k + 1) + ". " + L.t + (k === 0 ? "(75점 이상)" : k === 1 ? "(55~74점)" : k === 2 ? "(35~54점)" : "(34점 이하 또는 통제 조건)") + "</span>"; }).join("") +
      '<span class="wxp-dl">난이도 색: ' + DIFF.map(function (t, k) { return '<b style="color:' + DCOL[k] + '">' + t + "</b>"; }).join(", ") + "</span></div>";
    h += '<table class="wxp-r"><tr><th>권역</th><th>산 수</th><th>① 지금 출발 기준</th><th>② 내일 기준</th></tr>' + REGS.map(function (r, k) { const o = S[r]; return "<tr><td>" + (k + 1) + ". " + r + "</td><td>" + o.n + "</td><td>" + bar(o.now, o.n) + "</td><td>" + bar(o.tm, o.n) + "</td></tr>"; }).join("") + "</table>";
    h += '<div class="wxp-t"><table><tr><th>번호</th><th>산(높이)</th><th>권역</th><th>난이도(왕복)</th><th>지금 날씨</th><th>① 지금</th><th>② 내일(최저, 최고, 바람, 강수)</th></tr>';
    st.data.forEach(function (x, k) {
      const w = x.now, t = x.tm;
      h += '<tr data-i="' + k + '"' + (k === cur ? ' class="cur"' : "") + "><td>" + x.m[0] + "</td><td>" + x.m[1] + "(" + x.m[3] + "m)</td><td>" + x.r + '</td><td style="color:' + x.d.c + '">' + x.d.t + "(" + hrs(x.d.rt) + ")</td><td>" + WX(w.code) + " " + (w.t != null ? w.t.toFixed(0) : "?") + "°C, " + w.wind.toFixed(0) + "m/s</td>" +
        '<td title="' + why(x.jn) + '"><span class="wxdot" style="background:' + x.jn.L.c + '"></span>' + x.jn.L.t + '</td><td title="' + why(x.jt) + '"><span class="wxdot" style="background:' + x.jt.L.c + '"></span>' + x.jt.L.t + " <small>" + (t.tmin != null ? t.tmin.toFixed(0) : "?") + ", " + (t.t != null ? t.t.toFixed(0) : "?") + "°C, " + t.wind.toFixed(0) + "m/s, " + t.p.toFixed(0) + "mm</small></td></tr>";
    });
    h += "</table></div>";
    h += '<ol class="wxp-src"><li>목록과 번호: 산림청 「한국의 100대 명산」 전자책, 가나다순 번호</li><li>정상 좌표: Wikidata 각 산 항목 좌표(P625), 2026-11-12 조회(공식 SHP로 교체 가능)</li><li>날씨: Open-Meteo 예보 API, 정상 표고 보정, 30분마다 갱신</li><li>난이도: Naismith 규칙(수평 4km/h, 오르막 600m/h) 추정, 실제 등산로 GPX로 교체 예정</li><li>통제: 기상청 강풍주의보 14m/s, 뇌우, 시간당 10mm 비, 체감 -28°C, 일몰 전 하산 불가</li></ol>';
    p.innerHTML = h;
  }
  function ensure() {                               // 박스, 패널, 띠 칸을 만듦 / create box, panel, and band slot
    const top = document.querySelector(".main>.top");
    if (top && !document.getElementById("wxBox")) {
      const b = document.createElement("div"); b.id = "wxBox"; b.className = "wxbox";
      const btn = top.querySelector(".top-btn"); top.insertBefore(b, btn || null);
      b.addEventListener("click", function (e) { const a = e.target.closest("[data-a]"); if (!a) { st.open = !st.open; } else act(a.getAttribute("data-a")); panel(); render(); });
      b.addEventListener("mouseenter", function () { st.hold = true; }); b.addEventListener("mouseleave", function () { st.hold = false; });
      const p = document.createElement("div"); p.id = "wxPanel"; p.className = "wxpanel"; p.hidden = true; document.body.appendChild(p);
      p.addEventListener("click", function (e) { const a = e.target.closest("[data-a]"), r = e.target.closest("tr[data-i]"); if (a) act(a.getAttribute("data-a")); else if (r) st.i = +r.getAttribute("data-i"); panel(); render(); });
    }
    const live = document.getElementById("live");
    if (live && !document.getElementById("wxTag")) { const e = document.createElement("div"); e.id = "wxTag"; e.className = "wxtag"; e.title = "100대 명산 정상의 지금 날씨, 난이도, 산행 가능성. 클릭하면 다음 산"; e.onclick = function () { st.i++; render(); }; live.appendChild(e); }
  }
  function act(a) { if (a === "prev") st.i--; else if (a === "next") st.i++; else if (a === "list") st.open = !st.open; else if (a === "close") st.open = false; }
  function panel() { const p = document.getElementById("wxPanel"), b = document.getElementById("wxBox"); if (!p || !b) return; p.hidden = !st.open || !st.data; if (!p.hidden) { const r = b.getBoundingClientRect(); p.style.top = (r.bottom + 6) + "px"; p.style.right = Math.max(8, innerWidth - r.right) + "px"; } }
  function show() { ensure(); render(); panel(); }
  function start() { show(); fetchAll(); setInterval(fetchAll, 30 * 60 * 1000); setInterval(function () { if (st.data && !st.hold && !st.open) { st.i++; render(); } }, 7000); setInterval(function () { if (st.data) { evalAll(); render(); } }, 60000); }
  QP.LiveWx = { MT: MT, difficulty: difficulty, judge: judge, state: st, refresh: fetchAll, show: show, summary: function () { return st.data ? summary() : null; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 1500); }); else setTimeout(start, 1500);
})();
