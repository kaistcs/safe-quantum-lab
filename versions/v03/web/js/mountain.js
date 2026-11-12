/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Mountain hiking simulator: courses with steep sections, hikers, seasons, weather, 10-second time series and alarm scoring. */
/* =====================================================================
 * mountain.js : 산행 시뮬레이션 엔진(근거 기반 합성 시계열)
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 산 모양(고도), 등산로 위 위험 지점(POI), 날씨, 사람의 몸
 *            상태가 시간에 따라 어떻게 변하고, 그것이 20개 신호와 큐비트
 *            회전으로 어떻게 이어지는지 한 줄로 연결해 보이기 위함임.
 * 근거      :
 *  - 최대심박 HRmax = 208 − 0.7 × 나이  (Tanaka et al., JACC 37:153, 2001, 남성 및 기본)
 *    여성 HRmax = 206 − 0.88 × 나이 (Gulati et al., Circulation 122:130, 2010)
 *  - 계절: 서울 기준 계절별 평년 기온, 일몰 시각(한국천문연구원 일출몰 자료 기준 근사)
 *  - 심박예비율 %HRR = (HR − 안정시 HR)/(HRmax − 안정시 HR) (Karvonen 1957)
 *  - 보행 속도 v = 6, exp(−3.5, |경사 + 0.05|) km/h (Tobler 1993 등산 함수)
 *  - 계획 시간: 수평 5 km/h + 오르막 600 m당 1시간 (Naismith 규칙)
 *  - 기온감률 6.5 °C/km (ICAO 표준대기, ISO 2533)
 *  - 심박 표류(시간이 지날수록 같은 강도에서 심박 상승) (Coyle & González-Alonso, ESSR 2001)
 *  - POI 감지 기준 거리: 위험구역 120 m, 야생동물 180 m, 낙석 100 m (세미나 자료 부록 코드)
 *  - 강풍 기준 산지 17 m/s, 강수 10 mm/h 이상을 최고로 정규화(기상청 특보 기준 참고)
 * 주의      : 코스 모양과 POI 위치는 가상임. 실측 GPX, 위험 정보로 바꿔 끼울 수 있게 함수로 분리함.
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 산행 엔진을 붙임 / attaches the hiking engine to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const clip = function (v) { return Math.max(0, Math.min(1, v)); }; // 0~1로 자르는 함수임 / clips to 0~1

  /* ---------- 1. 100대 명산 일부(산림청 2002 선정 100대 명산 중 대표 산, 표고는 공개 자료 기준) / 1. Selected top-100 mountains (Korea Forest Service 2002; elevations from open data)  ---------- */
  const mountains = [                               // [이름, 대표 봉우리, 표고 m, 지역, 가상 출발 고도 m] / [name, main peak, elevation m, region, virtual start altitude m]
    ["북한산", "백운대", 836, "서울, 경기", 120], ["도봉산", "자운봉", 740, "서울, 경기", 110], ["관악산", "연주대", 632, "서울, 경기", 80],
    ["설악산", "대청봉", 1708, "강원", 400], ["오대산", "비로봉", 1563, "강원", 700], ["치악산", "비로봉", 1288, "강원", 350],
    ["태백산", "장군봉", 1567, "강원", 900], ["소백산", "비로봉", 1439, "충북, 경북", 500], ["속리산", "천왕봉", 1058, "충북, 경북", 300],
    ["덕유산", "향적봉", 1614, "전북, 경남", 700], ["지리산", "천왕봉", 1915, "경남, 전남, 전북", 600], ["가야산", "칠불봉", 1433, "경남, 경북", 500],
    ["무등산", "천왕봉", 1187, "광주, 전남", 300], ["월출산", "천황봉", 809, "전남", 100], ["내장산", "신선봉", 763, "전북", 150], ["한라산", "백록담", 1947, "제주", 750]
  ];

  /* ---------- 2. 산행자(초개인화) 예시 / 2. Hiker (hyper-personalization) examples  ---------- */
  const personas = [                                // 이름, 나이, 안정시 심박, 체력 계수(1=보통) / name, age, resting HR, fitness factor (1 = normal)
    { id: "A", name: "A님 (여 68세, 안정시 72)", age: 68, sex: "F", rest: 72, fit: .85 },
    { id: "B", name: "B님 (남 52세, 안정시 64)", age: 52, sex: "M", rest: 64, fit: 1.0 },
    { id: "C", name: "C님 (여 31세, 안정시 58)", age: 31, sex: "F", rest: 58, fit: 1.2 }
  ];
  function hrMax(p) { return p.maxMeasured || (p.sex === "F" ? 206 - .88 * p.age : 208 - .7 * p.age); } // 측정값 → 여성 Gulati 공식 → Tanaka 공식 순서임 / measured value → Gulati formula for women → Tanaka formula
  /* ---------- 계절 (서울 기준 평년 출발 기온, 일몰 시각) / Seasons (Seoul normal start temperature, sunset time)  ---------- */
  const seasons = [                                 // 이름, 출발 기온 기준(°C), 일몰(분), 대표 월임 / name, base start temperature (°C), sunset (min), typical month
    { id: "spring", name: "봄(4월)", base: 13, sunset: 19 * 60 + 10, petals: "벚꽃" },
    { id: "summer", name: "여름(7월)", base: 27, sunset: 19 * 60 + 50, petals: "비" },
    { id: "autumn", name: "가을(11월)", base: 11, sunset: 17 * 60 + 20, petals: "낙엽" },
    { id: "winter", name: "겨울(12월)", base: 0, sunset: 17 * 60 + 17, petals: "눈" }
  ];

  /* ---------- 3. 날씨 시나리오 / 3. Weather scenarios  ---------- */
  const weathers = [                                // 시작 기온, 비(mm/h) 시간표, 기온 급강하, 출발 시각(분) / start temperature, rain (mm/h) schedule, temperature drop, start time (min)
    { id: "clear", name: "맑음", t0: 14, rain: [], drop: null, start: 600 },
    { id: "shower", name: "하산길 소나기(젖은 내리막)", t0: 16, rain: [[95, 185, 13]], drop: null, start: 600 },
    { id: "front", name: "한랭전선 통과(기온 급강하)", t0: 9, rain: [[90, 150, 6]], drop: [100, 8], start: 600 },
    { id: "late", name: "늦은 출발(일몰 압박)", t0: 12, rain: [], drop: null, start: 780 },
    { id: "winter", name: "찬비(겨울이면 결빙)", t0: 14, rain: [[30, 170, 5]], drop: [80, 3], start: 600 } // 겨울에 고르면 비 + 0 °C 근처 → 노면 결빙 + 경사 = 세 위험 겹침 / in winter: rain + about 0 °C → icy surface + slope = three overlapping risks
  ];
  const SUNSET = 17 * 60 + 20;                      // 11월 서울 일몰 약 17시 20분(분 단위)임 / November sunset in Seoul about 17:20 (in minutes)

  /* ---------- 4. 코스 만들기 (가상 고도 단면 + POI) / 4. Building courses (virtual elevation profile + POIs)  ---------- */
  function makeCourse(mi, seed) {
    const m = mountains[mi], r = QP.Sim.rng(Math.imul((seed || mi + 11) ^ 0x9e3779b9, 2654435761) >>> 0); for (let w = 0; w < 5; w++) r(); // 산마다 충분히 다른 고정 난수(씨앗을 섞고 앞부분을 버림)임 / a fixed random generator different enough per mountain (seed mixed, first values discarded)
    const ascent = m[2] - m[4];                     // 올라가야 할 높이임 / height to climb
    const L = Math.max(2500, Math.min(7000, ascent / .16)); // 평균 경사 약 16%가 되도록 편도 거리(m)를 정함 / one-way distance (m) chosen so the mean grade is about 16%
    const n = 80, grades = [];                      // 구간 수와 구간별 경사 목록임 / number of segments and grade per segment
    const shape = ["steady", "false", "ridge", "steep", "saddle"][Math.floor(r() * 5)]; // 산마다 다른 모양(꾸준함, 가짜 정상, 능선길, 급한 마무리, 안부 내리막)임 / a different shape per mountain (steady, false summit, ridge, steep finish, saddle descent)
    const steep = new Array(n).fill(false);         // 급경사 구간 표시(돌계단, 암릉, 절벽 옆)임 / marks steep segments (stone steps, rocky ridges, beside cliffs)
    for (let k = 0; k < n; k++) {                   // 구간마다 경사를 정함 / set the grade per segment
      const f = k / n; let g = .02 + r() * .22;     // 기본 2~24% 흙길 경사임(구간마다 크게 달라 오르내림이 보이게 함, 실제 100대 명산 일반 등산로 평균 10~20%) / base dirt-path grade 2~24% (varies a lot per segment to show ups and downs; typical top-100 trails average 10~20%)
      if (shape === "false" && f > .5 && f < .6) g = -.06 - r() * .08; // 가짜 정상 뒤 내리막임 / descent after a false summit
      if (shape === "ridge" && f > .7) g = .01 + r() * .05; // 정상 가까이 완만한 능선길임 / gentle ridge path near the summit
      if (shape === "saddle" && f > .3 && f < .38) g = -.1 - r() * .06; // 중간 안부로 내려갔다 다시 오름임 / descend to a saddle midway and climb again
      if (r() < .1) g = -.04 - r() * .1;           // 짧은 내리막(오르내림)을 자주 섞어 단조롭지 않게 함 / mix in short descents often so it is not monotonous
      grades.push(g);                               // 목록에 넣음 / add to the list
    }
    const steepAt = shape === "steep" ? [[.33, 4], [.70, 4], [.86, 6]] : [[.18, 4], [.33, 5], [.70, 6]]; // 급경사 위치(시작 비율, 구간 수)임: 깔딱고개, 젖은 돌계단, 절벽 옆 암릉("급한 마무리" 산은 정상 직전에 긴 급경사) / steep positions (start ratio, number of segments): steep pass, wet stone steps, rocky ridge by a cliff (a "steep finish" mountain gets a long steep part just before the summit)
    steepAt.forEach(function (sa) { const k0 = Math.floor(n * sa[0]); for (let j = k0; j < Math.min(n, k0 + sa[1]); j++) { grades[j] = .45 + r() * .2; steep[j] = true; } }); // 45~65% 급경사(계단, 암릉, 로프 구간 수준)를 만듦 / make 45~65% steep sections (stairs, rocky ridges, rope sections)
    const steepSum = grades.reduce(function (a, g, k) { return a + (steep[k] ? g : 0); }, 0) * (L / n); // 급경사가 오르는 높이(고정)임 / height climbed by steep parts (fixed)
    const restSum = grades.reduce(function (a, g, k) { return a + (!steep[k] && g > 0 ? g : 0); }, 0) * (L / n); // 나머지 오르막 높이임 / height of the remaining climbs
    const downSum = grades.reduce(function (a, g, k) { return a + (!steep[k] && g < 0 ? g : 0); }, 0) * (L / n); // 내리막 높이(음수)임 / height of descents (negative)
    const need = ascent - steepSum - downSum;       // 나머지 오르막이 채워야 할 높이임 / height the remaining climbs must fill
    let sc = Math.max(.15, need / Math.max(1, restSum)); // 완만한 구간만 늘이거나 줄임(급경사는 그대로 둬 가파름이 유지됨) / stretch or shrink only gentle parts (steep parts stay steep)
    for (let k = 0; k < n; k++) if (!steep[k] && grades[k] > 0) grades[k] *= sc; // 비율을 적용함 / apply the ratio
    const sum = grades.reduce(function (a, b) { return a + b; }, 0) * (L / n); // 전체 오르는 높이임 / total height climbed
    const scale = ascent / sum;                     // 남은 오차만 아주 작게 보정함 / correct only the tiny remaining error
    const elev = [m[4]];                            // 고도 배열(출발 고도부터)임 / altitude array (from the start altitude)
    for (let k = 0; k < n; k++) elev.push(elev[k] + grades[k] * scale * (L / n)); // 구간마다 고도를 쌓음 / stack altitude per segment
    const at = function (f) { return Math.round(L * f); }; // 편도 거리의 비율을 m로 바꿈 / convert a fraction of the one-way distance to m
    const pois = [                                  // 위험 지점 목록(가상 위치)임 / risk points (virtual positions)
      { type: "stairs", name: "젖은 돌계단", x: at(.36), R: 80, icon: "▦" },
      { type: "rock", name: "낙석 구간", x: at(.5), R: 100, icon: "◆" },
      { type: "wild", name: "야생동물 신고 지역", x: at(.6), R: 180, icon: "●" },
      { type: "cliff", name: "절벽 접근(갈림길)", x: at(.74), R: 120, icon: "▲" },
      { type: "shadow", name: "통신 음영", x: at(.82), R: 150, icon: "◌" },
      { type: "ridge", name: "바람 노출 능선", x: at(.92), R: 150, icon: "≋" },
      { type: "stamp", name: m[1] + " 인증 지점", x: L, R: 30, icon: "★" }
    ];
    return { shape: shape, mi: mi, name: m[0], peak: m[1], summit: m[2], start: m[4], region: m[3], L: L, n: n, elev: elev, grades: grades.map(function (g) { return g * scale; }), steep: steep, pois: pois }; // 코스 정보를 돌려줌 / return the course info
  }
  function elevAt(c, x) {                           // 편도 거리 x(m)의 고도를 보간함 / interpolates the altitude at one-way distance x (m)
    const f = Math.max(0, Math.min(c.n, x / c.L * c.n)), k = Math.min(c.n - 1, Math.floor(f)); // 구간 번호와 비율임 / segment index and fraction
    return c.elev[k] + (c.elev[k + 1] - c.elev[k]) * (f - k); // 직선 보간한 고도임 / linearly interpolated altitude
  }
  function gradeAt(c, x) {                          // 편도 거리 x의 오르막 경사(구간 중심 사이를 부드럽게 보간)임 / uphill grade at one-way distance x (smoothly interpolated between segment centers)
    const f = Math.max(0, Math.min(c.n - 1, x / c.L * c.n - .5)), k = Math.floor(f), t = f - k; // 구간 중심 기준 위치임 / position relative to segment centers
    const g0 = c.grades[k], g1 = c.grades[Math.min(c.n - 1, k + 1)]; // 이웃 두 구간 경사임 / grades of two neighboring segments
    return g0 + (g1 - g0) * t * t * (3 - 2 * t);    // 부드러운 곡선으로 이어 갑작스러운 경사 변화를 없앰 / joined by a smooth curve to avoid sudden grade changes
  }

  /* ---------- 5. 시간 흐름 시뮬레이션 (10초 간격) / 5. Time-flow simulation (10-second steps)  ---------- */
  function simulate(c, person, w, opts) {
    const o = opts || {}, dt = 10;                  // 옵션과 시간 간격(초)임 / options and time step (s)
    const se = seasons[o.season != null ? o.season : (QP.State && QP.State.season != null ? QP.State.season : 2)]; // 계절(기본 가을)임 / season (default autumn)
    const SUN = se.sunset, T0 = se.base + (w.t0 - 12); // 계절 일몰과 출발 기온(날씨는 기준 12 °C 대비 차이로 반영)임 / seasonal sunset and start temperature (weather applied as a difference from 12 °C)
    const HRmax = hrMax(person);                    // 개인 최대심박임 / personal max HR
    const out = [];                                 // 시간별 상태 목록임 / states over time
    let p = 0, t = 0, hr = person.rest + 10, cumUp = 0, batt = o.batt != null ? o.batt : .7; // 이동 거리(왕복), 경과 시간, 심박, 누적 상승, 배터리임 / distance (round trip), elapsed time, heart rate, total ascent, battery
    const planned = (2 * c.L / 1000) / 5 * 60 + (c.summit - c.start) / 600 * 60; // Naismith 계획 시간(분)임 / Naismith planned time (min)
    while (p < 2 * c.L && t < 9 * 3600) {           // 왕복을 마치거나 9시간이 지나면 끝냄 / end after the round trip or 9 hours
      const up = p < c.L, x = up ? p : 2 * c.L - p; // 오르는 중인지와 편도 기준 위치임 / whether climbing and the one-way position
      const gr = gradeAt(c, x), signed = up ? gr : -gr; // 경사와 진행 방향 기준 경사임 / grade and grade along the direction of travel
      const min = w.start + t / 60;                 // 현재 시각(분)임 / current time (min)
      let rain = 0; w.rain.forEach(function (rr) { if (t / 60 >= rr[0] && t / 60 <= rr[1]) rain = rr[2] * Math.sin(Math.PI * (t / 60 - rr[0]) / (rr[1] - rr[0])); }); // 비 시간표에 따라 강수 강도(mm/h)를 정함 / rain intensity (mm/h) from the rain schedule
      const near = c.pois.map(function (q) { const d = up ? q.x - x : x - q.x; return { q: q, d: d, s: d >= 0 && d <= q.R ? clip(1 - d / q.R) : d < 0 && d > -40 ? clip(1 + d / 40) : 0 }; }); // 앞쪽 R m부터 1까지 오르고, 지나간 뒤 40 m에 걸쳐 0으로 내려감(급변 방지) / rises to 1 from R m ahead and decays to 0 over 40 m after passing (no jumps)
      const nearOf = function (type) { return near.filter(function (n) { return n.q.type === type; })[0]; }; // 유형별 POI 접근 정보를 꺼냄 / get POI approach info by type
      const elev = elevAt(c, x);                    // 현재 고도임 / current altitude
      let T = T0 - 6.5 * (elev - c.start) / 1000;   // 기온감률로 고도에 따른 기온을 계산함 / temperature by altitude via the lapse rate
      if (w.drop && t / 60 > w.drop[0]) T -= w.drop[1] * clip((t / 60 - w.drop[0]) / 30); // 한랭전선이면 30분에 걸쳐 기온이 떨어짐 / with a cold front, temperature drops over 30 minutes
      const wet = clip(rain / 6);                   // 노면 젖음 정도임 / how wet the surface is
      let v = 6 * Math.exp(-3.5 * Math.abs(signed + .05)) * person.fit * (1 - .25 * wet); // Tobler 속도에 체력과 젖은 노면 감속을 반영함(km/h) / Tobler speed adjusted for fitness and wet surfaces (km/h)
      if (nearOf("stairs").s > .3) v *= .7;         // 돌계단에서는 더 천천히 걸음 / walk slower on stone steps
      const drift = .06 * t / 3600;                 // 시간당 6%p씩 심박 표류를 더함 / add cardiac drift of 6%p per hour
      const effort = clip(.25 + 1.9 * Math.max(signed, 0) + .25 * Math.max(-signed, 0) + drift + .02 * Math.max(0, T - 25)) / person.fit; // 운동 강도(%HRR 목표)임 / exercise intensity (target %HRR)
      const target = person.rest + Math.min(1, effort) * (HRmax - person.rest); // 목표 심박임 / target heart rate
      hr += (target - hr) * (1 - Math.exp(-dt / 45)); // 45초 시간상수로 심박이 목표를 따라감 / heart rate follows the target with a 45 s time constant
      const pHRR = (hr - person.rest) / (HRmax - person.rest); // 개인 심박예비율임 / personal heart-rate reserve
      if (up) cumUp += Math.max(0, gr) * v / 3.6 * dt; // 오르막 누적 상승 높이를 더함 / add the uphill ascent
      batt -= dt / 3600 * (nearOf("shadow").s > .2 ? .2 : .1); // 배터리가 시간당 10%(음영에서는 20%) 줄어듦 / battery drops 10% per hour (20% in signal shadow)
      const remain = (2 * c.L - p) / 1000 / Math.max(1.5, v) * 60; // 남은 시간 추정(분)임 / estimated remaining time (min)
      const x20 = new Array(20).fill(0);            // 20개 신호 배열임 / array of 20 signals
      x20[0] = clip((pHRR - .35) / .55);            // 심박 부담: 개인 %HRR 35%부터 오르기 시작해 90%에서 최고임 / heart-rate load: rises from 35% personal %HRR and peaks at 90%
      x20[1] = clip(cumUp / (1000 * person.fit) * .7 + t / 3600 / 6 * .3); // 피로: 누적 상승과 경과 시간의 합임 / fatigue: sum of accumulated ascent and elapsed time
      x20[3] = clip(rain / 10);                     // 강수: 10 mm/h에서 최고임 / rain: peaks at 10 mm/h
      x20[4] = clip((3 + 9 * (elev - c.start) / Math.max(1, c.summit - c.start) + (w.drop && t / 60 > w.drop[0] ? 6 : 0) + 6 * nearOf("ridge").s) / 17); // 강풍: 산지 강풍주의보 17 m/s 기준임 / strong wind: mountain strong-wind advisory 17 m/s
      x20[6] = clip((T - 28) / 7);                  // 폭염: 28 °C부터 35 °C까지임 / heat wave: from 28 °C to 35 °C
      x20[7] = clip((2 - T) / 6) * Math.max(wet, .3); // 결빙: 영상 2 °C 아래이고 젖었을수록 큼 / ice: below +2 °C and larger when wet
      x20[8] = clip(1 - (SUN - min - remain) / 90); // 일몰 여유 부족: 남은 여유가 90분 아래로 줄면 오름(계절 일몰 기준) / short sunset margin: rises as the margin drops below 90 minutes (seasonal sunset)
      const downWet = up ? 1 : 1.25 * (1 + .45 * wet); // 내리막은 미끄러짐 위험이 커지고, 젖은 노면이면 더 커짐(모델 가정: 실측 사고 자료로 검증할 항목) / downhill increases slipping risk, more so on wet surfaces (model assumption to verify with real accident data)
      x20[9] = clip(Math.max(0, gr) / .4 * downWet * (nearOf("stairs").s > 0 ? 1.1 : .9)); // 급경사 신호: 40% 경사에서 최고, 젖은 내리막과 돌계단에서 더 큼 / steep signal: peaks at 40% grade, larger on wet descents and stone steps
      x20[10] = nearOf("cliff").s * .8;             // 경로 이탈: 갈림길 접근에 따라 오름 / off-route: rises when approaching junctions
      x20[11] = clip((t / 60 - planned * clip(p / (2 * c.L)) * 1.0) / 60); // 하산 지연: 계획보다 늦은 분 / 60분임 / descent delay: minutes behind plan / 60
      x20[12] = nearOf("rock").s;                   // 낙석 접근임 / rockfall approach
      x20[13] = nearOf("wild").s;                   // 야생동물 신고 지역 접근임 / wildlife report area approach
      x20[14] = nearOf("cliff").s;                  // 절벽 접근임 / cliff approach
      x20[15] = nearOf("shadow").s * .7;            // 위치 품질 저하임 / poor location quality
      x20[16] = nearOf("shadow").s;                 // 통신 불안정임 / unstable signal
      x20[17] = clip((.5 - batt) / .4);             // 배터리 50% 아래부터 오름 / rises below 50% battery
      const prevSig = out.length ? out[out.length - 1].sig : null; if (prevSig) [4, 8, 9, 10, 12, 13, 14, 15, 16].forEach(function (q) { x20[q] = prevSig[q] + (x20[q] - prevSig[q]) * .45; }); // 센서 평활(실제 워치도 GPS 경사, 위치 신호를 약 20~30초 이동평균함): 10초 사이 급변을 줄임 / sensor smoothing (real watches average GPS slope and position over ~20~30 s): reduces jumps within 10 s
      if (o.fallAt && !up && Math.abs(x - c.L * o.fallAt) < 25) x20[18] = 1; // 낙상 시나리오면 정해진 내리막 지점에서 낙상 신호를 넣음 / in the fall scenario, put the fall signal at the set downhill point
      if (o.symptomAt && Math.abs(t / 60 - o.symptomAt) < 2) x20[2] = 1; // 증상 신고 시나리오임 / symptom report scenario
      out.push({ t: t, p: p, x: x, up: up, elev: elev, grade: signed, v: v, hr: hr, pHRR: pHRR, T: T, rain: rain, batt: batt, min: min, near: near, sig: x20 }); // 이 순간의 상태를 저장함 / store the state at this moment
      p += v / 3.6 * dt; t += dt;                   // 거리와 시간을 진행함 / advance distance and time
    }
    return { course: c, person: person, weather: w, season: se, sunset: SUN, steps: out, HRmax: HRmax, planned: planned }; // 시뮬레이션 결과를 돌려줌 / return the simulation result
  }

  /* ---------- 6. AI 점수, 경보, 선행 시간 / 6. AI scores, alarms, lead time  ---------- */
  function score(run, models, extra) {
    const L = models.find(function (m) { return m.key === "linear"; }), Q = models.find(function (m) { return m.key === "quantum"; }); // 두 모델임 / the two models
    run.steps.forEach(function (s) {                // 시간마다 / for each time step
      s.lin = L.predict(s.sig); s.qf = Q.predict(s.sig); // 두 점수를 계산함 / compute both scores
      s.truth = QP.Data.syntheticLabel(s.sig);      // 같은 규칙의 합성 정답(위험 사건)임 / synthetic label by the same rule (risk event)
      s.policy = QP.Data.policy(s.sig);             // 즉시 안전 규칙임 / immediate safety rules
      if (extra) s.dnn = extra(s.sig);              // DNN 점수(있으면)임 / DNN score (if any)
    });
    const events = []; let cur = null;              // 위험 사건 구간 목록임 / list of risk event intervals
    run.steps.forEach(function (s, i) { if (s.truth && !cur) cur = { s: i, e: i }; else if (s.truth) cur.e = i; else if (cur) { events.push(cur); cur = null; } }); // 연속된 위험 구간을 묶음 / group consecutive risk steps
    if (cur) events.push(cur);                      // 마지막 구간을 닫음 / close the last interval
    events.forEach(function (ev) {                  // 사건마다 두 AI의 첫 경보 시점을 찾음 / find each AI's first alarm per event
      const look = Math.max(0, ev.s - 90);          // 사건 15분 전부터 살펴봄 / look from 15 minutes before the event
      const first = function (key, thr) { for (let i = look; i <= ev.e; i++) if (run.steps[i][key] >= thr) return i; return -1; }; // 기준을 처음 넘은 시점임 / first time the threshold is crossed
      ev.lin = first("lin", L.threshold); ev.q = first("qf", Q.threshold); // 두 AI의 첫 경보 위치임 / first alarm position of each AI
      const near = run.steps[ev.s].near.filter(function (n) { return n.s > 0 && n.q.type !== "stamp"; }).map(function (n) { return n.q.name; }); // 사건 시작 때 가까운 POI 이름임 / names of POIs near the event start
      const sg = run.steps[ev.s].sig, PN = ["비×경사", "심박×피로", "일몰×하산 지연", "통신×배터리", "결빙×경사", "이탈×절벽"]; let bk = 0, bv = -1; QP.Data.pairs.forEach(function (p, j) { const v = sg[p[0]] * sg[p[1]]; if (v > bv) { bv = v; bk = j; } }); // 사건을 만든 신호 쌍을 찾음 / find the signal pair that caused the event
      ev.pair = bk; ev.where = PN[bk] + (near.length ? "(" + near.join(", ") + ")" : ""); // 사건 설명(신호 쌍 + 근처 지점)임 / event description (signal pair + nearby point)
    });
    run.events = events; run.thrL = L.threshold; run.thrQ = Q.threshold; // 결과를 저장함 / store the results
    return run;                                     // 점수가 붙은 결과를 돌려줌 / return the scored result
  }

  QP.Mountain = { seasons: seasons, mountains: mountains, personas: personas, weathers: weathers, makeCourse: makeCourse, elevAt: elevAt, simulate: simulate, score: score, hrMax: hrMax, SUNSET: SUNSET }; // 공개함 / make public
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
