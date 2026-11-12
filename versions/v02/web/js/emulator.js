/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* =====================================================================
 * emulator.js : 양자 회로 상태벡터 에뮬레이터 (브라우저용)
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 실제 양자컴퓨터 없이, 일반 PC 메모리에서 큐비트의 상태를
 *            숫자 목록(상태벡터)으로 저장하고 게이트를 행렬 계산으로
 *            흉내 내기 위함임.
 * 하는 일   : n개 큐비트의 2^n개 복소 진폭을 저장하고, RY, RX, RZ, H,
 *            X, CNOT, CZ 게이트를 적용하고, 확률을 읽거나(정확 판독)
 *            실제 장비처럼 여러 번 측정(샷)해서 결과를 셈.
 * 주의      : 일반 컴퓨터로 계산하므로 "양자 속도 이점"은 없음.
 *            큐비트가 1개 늘 때마다 메모리가 2배로 늘어남.
 * ===================================================================== */
(function (QP) {                                   // 전역 이름공간 QP 안에 기능을 넣기 위한 즉시 실행 함수임
  "use strict";                                     // 실수(선언 안 한 변수 등)를 오류로 잡아 주는 엄격 모드를 켬

  /* ---------- 1. 상태벡터 만들기 ---------- */
  function createState(n) {                         // n큐비트 상태벡터를 새로 만드는 함수임
    const size = 1 << n;                            // 가능한 결과의 수 2^n을 비트 이동으로 계산함
    const re = new Float64Array(size);              // 각 결과 진폭의 실수부를 저장할 배열임
    const im = new Float64Array(size);              // 각 결과 진폭의 허수부를 저장할 배열임
    re[0] = 1;                                      // 처음에는 모든 큐비트가 0인 |00..0> 상태에서 시작함
    return { n: n, size: size, re: re, im: im };    // 큐비트 수, 크기, 진폭 배열을 하나로 묶어 돌려줌
  }

  /* ---------- 2. 한 큐비트 게이트 공통 처리 ---------- */
  // 2x2 복소 행렬 [[a,b],[c,d]]를 큐비트 q에 적용하는 공통 함수임
  function apply1(s, q, ar, ai, br, bi, cr, ci, dr, di) {
    const bit = 1 << q;                             // q번 큐비트를 가리키는 비트 마스크를 만듦
    for (let i = 0; i < s.size; i++) {              // 모든 진폭 위치를 하나씩 살펴봄
      if (i & bit) continue;                        // q비트가 1인 위치는 짝(0인 위치)에서 함께 처리하므로 건너뜀
      const j = i | bit;                            // q비트만 1로 바꾼 짝 위치를 구함
      const xr = s.re[i], xi = s.im[i];             // q비트가 0인 쪽의 진폭(실수, 허수)을 꺼냄
      const yr = s.re[j], yi = s.im[j];             // q비트가 1인 쪽의 진폭(실수, 허수)을 꺼냄
      s.re[i] = ar * xr - ai * xi + br * yr - bi * yi; // 새 진폭(0쪽) 실수부 = a*x + b*y 의 실수부임
      s.im[i] = ar * xi + ai * xr + br * yi + bi * yr; // 새 진폭(0쪽) 허수부 = a*x + b*y 의 허수부임
      s.re[j] = cr * xr - ci * xi + dr * yr - di * yi; // 새 진폭(1쪽) 실수부 = c*x + d*y 의 실수부임
      s.im[j] = cr * xi + ci * xr + dr * yi + di * yr; // 새 진폭(1쪽) 허수부 = c*x + d*y 의 허수부임
    }
    return s;                                       // 연속 호출이 가능하도록 상태를 돌려줌
  }

  /* ---------- 3. 자주 쓰는 게이트 ---------- */
  function ry(s, q, angle) {                        // RY: y축 회전, 입력값을 확률로 바꾸는 데 씀
    const c = Math.cos(angle / 2), sn = Math.sin(angle / 2); // 회전 행렬의 코사인, 사인 성분임
    return apply1(s, q, c, 0, -sn, 0, sn, 0, c, 0); // [[c,-s],[s,c]] 행렬을 적용함
  }
  function rx(s, q, angle) {                        // RX: x축 회전 게이트임
    const c = Math.cos(angle / 2), sn = Math.sin(angle / 2); // 회전 성분을 구함
    return apply1(s, q, c, 0, 0, -sn, 0, -sn, c, 0); // [[c,-i s],[-i s,c]] 행렬을 적용함
  }
  function rz(s, q, angle) {                        // RZ: z축 회전(위상만 바꿈) 게이트임
    const c = Math.cos(angle / 2), sn = Math.sin(angle / 2); // e^{±iθ/2}의 성분을 구함
    return apply1(s, q, c, -sn, 0, 0, 0, 0, c, sn); // [[e^{-iθ/2},0],[0,e^{iθ/2}]] 행렬을 적용함
  }
  function h(s, q) {                                // H(하다마드): 0과 1을 반반 섞는 게이트임
    const r = Math.SQRT1_2;                         // 1/√2 값을 미리 구함
    return apply1(s, q, r, 0, r, 0, r, 0, -r, 0);   // [[1,1],[1,-1]]/√2 행렬을 적용함
  }
  function x(s, q) {                                // X(NOT): 0과 1을 맞바꾸는 게이트임
    return apply1(s, q, 0, 0, 1, 0, 1, 0, 0, 0);    // [[0,1],[1,0]] 행렬을 적용함
  }

  /* ---------- 4. 두 큐비트 게이트 ---------- */
  function cx(s, control, target) {                 // CNOT: 제어 큐비트가 1일 때만 대상 큐비트를 뒤집음
    const cb = 1 << control, tb = 1 << target;      // 제어, 대상 큐비트의 비트 마스크임
    for (let i = 0; i < s.size; i++) {              // 모든 진폭 위치를 살펴봄
      if ((i & cb) && !(i & tb)) {                  // 제어=1이고 대상=0인 위치만 골라 짝과 교환함
        const j = i | tb;                           // 대상 비트를 1로 바꾼 짝 위치임
        let t = s.re[i]; s.re[i] = s.re[j]; s.re[j] = t; // 실수부를 맞바꿈
        t = s.im[i]; s.im[i] = s.im[j]; s.im[j] = t;     // 허수부를 맞바꿈
      }
    }
    return s;                                       // 상태를 돌려줌
  }
  function cz(s, a, b) {                            // CZ: 두 큐비트가 모두 1일 때 부호(위상)를 뒤집음
    const m = (1 << a) | (1 << b);                  // 두 큐비트를 함께 가리키는 마스크임
    for (let i = 0; i < s.size; i++) {              // 모든 위치를 살펴봄
      if ((i & m) === m) { s.re[i] = -s.re[i]; s.im[i] = -s.im[i]; } // 둘 다 1이면 진폭에 -1을 곱함
    }
    return s;                                       // 상태를 돌려줌
  }

  /* ---------- 5. 판독(측정) ---------- */
  function probs(s) {                               // 각 결과가 나올 정확한 확률 목록을 계산함
    const p = new Float64Array(s.size);             // 확률을 담을 배열임
    for (let i = 0; i < s.size; i++) p[i] = s.re[i] * s.re[i] + s.im[i] * s.im[i]; // |진폭|^2 = 확률임
    return p;                                       // 확률 배열을 돌려줌
  }
  function probOne(s, q) {                          // q번 큐비트가 1로 읽힐 확률을 계산함
    const bit = 1 << q; let sum = 0;                // 마스크와 누적 합을 준비함
    for (let i = 0; i < s.size; i++) if (i & bit) sum += s.re[i] * s.re[i] + s.im[i] * s.im[i]; // q비트가 1인 결과의 확률을 모두 더함
    return sum;                                     // 합계가 곧 P(q=1)임
  }
  function expectZ(s, q) {                          // Z 기댓값 = P(0) - P(1), -1~+1 사이 숫자임
    return 1 - 2 * probOne(s, q);                   // P(0)=1-P(1) 이므로 1-2P(1)로 계산함
  }
  function norm(s) {                                // 확률의 총합(항상 1이어야 함)을 검사용으로 계산함
    let t = 0;                                      // 누적 변수임
    for (let i = 0; i < s.size; i++) t += s.re[i] * s.re[i] + s.im[i] * s.im[i]; // 모든 확률을 더함
    return t;                                       // 1에 가까우면 계산이 올바른 것임
  }

  /* ---------- 6. 샷(실제 장비처럼 여러 번 측정) ---------- */
  function rng(seed) {                              // 같은 씨앗이면 같은 난수열을 내는 간단한 난수 생성기임
    let x = seed >>> 0;                             // 32비트 부호 없는 정수로 시작값을 맞춤
    return function () {                            // 호출할 때마다 0~1 난수를 하나씩 돌려주는 함수임
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0; // 선형 합동 방식으로 다음 정수를 만듦
      return x / 4294967296;                        // 0 이상 1 미만의 실수로 바꿈
    };
  }
  // 정확한 확률 p를 shots번 측정했을 때 얻는 "추정 확률"을 흉내 냄
  function sampleProb(p, shots, rand) {
    if (!shots) return p;                           // 샷 0(무한대)이면 정확한 확률을 그대로 씀
    if (shots > 200) {                              // 샷이 많으면 정규분포 근사로 빠르게 계산함
      const sd = Math.sqrt(p * (1 - p) / shots);    // 이항분포 비율의 표준편차임
      const u1 = Math.max(rand(), 1e-12), u2 = rand(); // 박스-뮬러 변환에 쓸 난수 두 개임
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // 표준정규 난수를 만듦
      return Math.min(1, Math.max(0, p + sd * z));  // 0~1 범위로 자른 추정 확률을 돌려줌
    }
    let k = 0;                                      // 1이 나온 횟수를 셀 변수임
    for (let t = 0; t < shots; t++) if (rand() < p) k++; // 동전을 shots번 던지듯 직접 셈
    return k / shots;                               // 횟수 비율이 추정 확률임
  }
  function sampleCounts(s, shots, rand) {           // 전체 결과(00,01,...)별 측정 횟수를 셈
    const p = probs(s);                             // 정확한 확률 목록을 먼저 구함
    const counts = new Array(s.size).fill(0);       // 결과별 횟수를 0으로 초기화함
    for (let t = 0; t < shots; t++) {               // shots번 반복해서 측정함
      let r = rand(), i = 0;                        // 0~1 난수 하나와 위치 변수임
      while (i < s.size - 1 && r >= p[i]) { r -= p[i]; i++; } // 누적 확률 구간에 따라 결과 하나를 고름
      counts[i]++;                                  // 고른 결과의 횟수를 1 늘림
    }
    return counts;                                  // 결과별 횟수를 돌려줌
  }

  /* ---------- 7. 비트 문자열 표시 ---------- */
  function label(i, n) {                            // 위치 번호 i를 "q0q1.." 순서 비트 문자열로 바꿈
    let t = "";                                     // 결과 문자열임
    for (let q = 0; q < n; q++) t += (i >> q) & 1;  // q0부터 차례로 비트를 붙임(화면 읽기 순서)
    return t;                                       // 예: n=2, i=1 → "10"(q0=1, q1=0)
  }

  /* ---------- 8. 메모리 계산 ---------- */
  function memoryBytes(n) {                         // n큐비트 상태벡터 저장에 필요한 바이트 수임
    return Math.pow(2, n) * 16;                     // 복소수 1개 = 실수 8바이트 + 허수 8바이트 = 16바이트임
  }

  // 위 기능을 QP.Sim 아래에 모아 다른 파일에서 쓰도록 공개함
  QP.Sim = { createState, apply1, ry, rx, rz, h, x, cx, cz, probs, probOne, expectZ, norm,
             rng, sampleProb, sampleCounts, label, memoryBytes };
})(window.QP = window.QP || {});                    // QP 이름공간이 없으면 새로 만들어 넘김
