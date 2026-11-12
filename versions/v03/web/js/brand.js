/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Sookmyung branding (images, names, credits) and shared state. */
/* =====================================================================
 * brand.js : 제작 기관, 과제 표기, 숙명여대 CI 이미지 설정
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 제작자(숙명여자대학교 AGI연구실, 지도교수 박영호)와 과제
 *            출처(행정안전부 재난안전연구개발사업) 표기를 한곳에서 관리함.
 * 이미지    : 숙명여대 공식 홈페이지(UI, 캐릭터 페이지)에 공개된 원본 파일을
 *            tools/fetch_brand.py 가 web/brand/ 폴더로 내려받아 그대로(정비례
 *            크기 조정만) 사용함. 숙명여대 규정상 임의 변형 금지임.
 *            로컬 파일이 없으면 공식 홈페이지 주소에서 직접 불러오고,
 *            그것도 안 되면(인터넷 차단 등) 글자 표기로 대신함.
 * ===================================================================== */
(function () { window.QP = window.QP || {}; window.QP.State = window.QP.State || {}; })(); // 공용 상태 저장소를 가장 먼저 만듦 / create the shared state store first
(function (QP) {                                    // QP 이름공간에 브랜드 정보를 붙임 / attaches brand info to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const UI = "https://www.sookmyung.ac.kr/_res/sookmyung/kr/img/intro/ui/";        // 공식 UI 이미지 주소임 / official UI image URL
  const CH = "https://www.sookmyung.ac.kr/_res/sookmyung/kr/img/intro/symbol/";    // 공식 캐릭터 이미지 주소임 / official character image URL
  const files = {                                   // 화면에서 쓰는 이름 → 공식 파일 이름임 / screen name → official file name
    symbol: UI + "img-ui-symbol01.png",             // 심볼마크(눈 결정체)임 / symbol mark (snow crystal)
    logoH: UI + "img-horizontal-logo02.png",        // 가로형 국문+영문 시그니처임 / horizontal Korean+English signature
    emblem: UI + "img-emblem01.png",                // 엠블럼임 / emblem
    slogan: UI + "img-slogan-horizontal03.png",     // 슬로건(세상을 바꾸는 부드러운 힘)임 / slogan (gentle power that changes the world)
    snow: CH + "img-character01.png",               // 눈송이 Ver2.0 기본형임 / Snowflake Ver2.0 basic
    guide: CH + "img-character-var01.png",          // 눈송이 안내임 / Snowflake guide
    joy: CH + "img-character-var02.png",            // 눈송이 기쁨임 / Snowflake joy
    welcome: CH + "img-character-var03.png",        // 눈송이 환영임 / Snowflake welcome
    magic: CH + "img-character-var04.png",          // 눈송이 Magic임 / Snowflake magic
    cheer: CH + "img-character-var05.png",          // 눈송이 응원임 / Snowflake cheer
    go: CH + "img-character-var06.png",             // 눈송이 등교임 / Snowflake going to school
    alert: CH + "img-character-var07.png",          // 눈송이 알림임 / Snowflake notice
    grad: CH + "img-character-var08.png",           // 눈송이 졸업임 / Snowflake graduation
    read: CH + "img-character-var09-01.png"         // 눈송이 독서임 / Snowflake reading
  };
  // 눈송이 캐릭터는 사용자가 제공한 공식 캐릭터 모음 이미지(12종)를 자세별로 잘라 brand/snow_XX.png로 둠(색, 모양 변형 없음) / Snowflake images are cut by pose from the user-provided official sheet (12 poses) into brand/snow_XX.png (no color or shape changes)
  const SNOW = { snow: "snow_01.png", guide: "snow_02.png", cheer: "snow_03.png", welcome: "snow_04.png", read: "snow_05.png", read2: "snow_06.png", joy: "snow_07.png", magic: "snow_08.png", book: "snow_09.png", go: "snow_10.png", alert: "snow_11.png", leaf: "snow_leaf.png", banner: "hike_banner.png" }; // leaf: 단풍잎을 든 눈송이(사용자 요청으로 잎 소품 색만 단풍 빨강으로 바꿈) // 화면 이름 → 잘라 둔 파일 이름임 / screen name → cut file name
  function local(key) {                             // 로컬 이미지 경로(묶음본이면 내장 data 주소)임 / local image path (embedded data URL in the bundle)
    const f = "brand/" + (SNOW[key] || files[key].split("/").pop()); // 눈송이는 snow_XX, 그 밖은 공식 파일 이름임 / Snowflake uses snow_XX, others the official file name
    return (window.QP_IMG && window.QP_IMG[f]) || f; // 내장 이미지가 있으면 그것을 씀 / use the embedded image if there is one
  }
  function img(key, cls, alt) {                     // 이미지 태그 글자를 만듦(로컬 → 공식 주소 → 글자 순서로 시도) / builds the image tag (tries local → official URL → text)
    const remote = files[key] || files.snow, l = local(key); // 공식 주소와 로컬 경로임 / official URL and local path
    const src = l;                                  // 로컬(또는 내장) 이미지를 먼저 씀 / use the local (or embedded) image first
    return '<img class="' + (cls || "") + '" src="' + src + '" data-remote="' + remote + '" alt="' + (alt || "숙명여자대학교") + '" onerror="QP.Brand.fallback(this)">'; // 실패 시 대체 처리 함수를 부름 / call the fallback on failure
  }
  function fallback(el) {                           // 이미지가 안 열릴 때의 대체 처리임 / fallback when an image fails to load
    if (el.dataset.remote && el.src !== el.dataset.remote) { el.src = el.dataset.remote; return; } // 처음 실패면 공식 주소로 다시 시도함 / on the first failure, retry with the official URL
    el.onerror = null; el.style.display = "none";   // 그래도 실패면 이미지를 숨김 / hide the image if it still fails
    el.insertAdjacentHTML("afterend", el.classList.contains("u-logo") ? '<span class="brand-text">숙명여자대학교</span>' : '<span class="brand-fallback" title="' + el.alt + '">❄</span>'); // 로고는 글자로, 그 밖은 눈 결정 기호로 자리를 표시함 / mark the spot with text for the logo, a snow symbol otherwise
  }
  QP.Brand = {                                      // 공개할 정보임 / info to make public
    univ: "숙명여자대학교", univEn: "SOOKMYUNG WOMEN'S UNIVERSITY",
    lab: "AGI 연구실", labEn: "Artificial General Intelligence Lab", prof: "지도교수 박영호",
    maker: "숙명여자대학교 AGI연구실 (지도교수 박영호)",
    version: "v03", built: "2026-11-12", released: "2026-11-12",
    project: "등산로 위험정보 공유를 위한 사용자 참여형 스마트 안전 등산로 플랫폼 및 관리시스템 개발",
    funding: "본 결과물은 행정안전부, 한국산업기술기획평가원에서 시행한 재난안전연구개발사업의 결과임",
    partner: "주관 아이나비시스템즈, 공동연구 숙명여자대학교",
    files: files, img: img, local: local, fallback: fallback, SNOW: SNOW
  };
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
