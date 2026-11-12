/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Korean-English switching engine for DOM text, canvas text and speech. */
/* =====================================================================
 * i18n.js : 한글, 영문 전환 엔진 / Korean-English switching engine
 * ---------------------------------------------------------------------
 * 하는 일 / What it does
 *  - 화면 글자(텍스트 노드, title, placeholder, alt)를 사전으로 바꿈 / translates DOM text and attributes by dictionary
 *  - 캔버스 글자(fillText, measureText)도 바꿈 / translates canvas text as well
 *  - 음성 문장도 바꿈(voice.js가 tr()을 부름) / voice.js calls tr() so narration is spoken in English
 *  - 숫자는 #으로 바꾼 틀로 찾고 원래 숫자를 다시 끼움 / looks up number-free templates and re-inserts the numbers
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간 / QP namespace
  "use strict";                                     // 엄격 모드 / strict mode
  const D = window.QP_I18N_EN || {};                // 영문 사전 / English dictionary
  const NUM = /\d+(?:[.,]\d+)*/g, KO = /[가-힣]/;    // 숫자 틀, 한글 판별 / number pattern, Hangul test
  let lang = "ko";                                  // 현재 언어 / current language
  try { lang = localStorage.getItem("qp_lang") || "ko"; } catch (e) { } // 지난 선택을 기억함 / remember last choice
  const orig = new WeakMap(), done = new WeakMap(), misses = new Set(); // 번역 못 한 문장 기록(사전 보강용) / misses for dictionary upkeep // 원문과 번역문 기록 / original and translated text per node
  const glossary = Object.keys(D).filter(function (k) { return k.indexOf("#") < 0 && k.length >= 3 && k.length <= 14 && KO.test(k) && !/[.?!]$/.test(k); }).sort(function (a, b) { return b.length - a.length; }); // 낱말 대체용 짧은 항목 / short entries for word fallback
  const FRAG = [["근거 기반 산행", "evidence-based hikes"], ["규칙 균일 합성", "rule-based uniform synthetic"], ["연속 생성 누적", "continuous generation"], ["(보관함)", "(store)"], ["회 seed", " runs seed"], ["행, 위험", " rows, risk"], ["행, 등급", " rows, grade"], ["행)", " rows)"], ["등급", "grade"], ["위험", "risk"], ["정상", "normal"], ["칠불봉", "Chilbulbong"], ["백운대", "Baegundae"], ["자운봉", "Jaunbong"], ["연주대", "Yeonjudae"], ["대청봉", "Daecheongbong"], ["비로봉", "Birobong"], ["장군봉", "Janggunbong"], ["천왕봉", "Cheonwangbong"], ["향적봉", "Hyangjeokbong"], ["천황봉", "Cheonhwangbong"], ["신선봉", "Sinseonbong"], ["백록담", "Baengnokdam"], ["서울, 경기", "Seoul, Gyeonggi"], ["강원", "Gangwon"], ["충북, 경북", "Chungbuk, Gyeongbuk"], ["경북", "Gyeongbuk"], ["경남", "Gyeongnam"], ["전남", "Jeonnam"], ["전북", "Jeonbuk"], ["제주", "Jeju"], ["양자 안전 코스 분석", "quantum safety course analysis"], ["인증 지점", "checkpoint"], ["데이터 변경", "Data changed"], ["시험 표본", "test samples"], ["건(위험)", " (risk)"], ["건(정상)", " (normal)"], ["학습", "training"], ["시험", "test"], ["변화", "change"], ["양자", "quantum"], ["일반", "classical"], ["행", " rows"], ["건", ""], ["회", " runs"], ["님", ""], ["여 ", "F "], ["남 ", "M "], ["세", ""]]; // 이름, 지명 같은 조각 번역(사전에 없을 때 마지막에 씀) / fragment fallback for names and places
  function fill(t, nums) { let i = 0; return t.replace(/#/g, function () { return i < nums.length ? nums[i++] : "#"; }); } // 숫자 다시 끼우기 / re-insert numbers
  function one(s) {                                 // 한 덩어리 번역 / translate one chunk
    const nums = s.match(NUM) || [], key = s.replace(NUM, "#"); // 숫자 틀 / template key
    if (D[key] != null) return fill(D[key], nums);  // 사전에 있으면 / dictionary hit
    return null;                                    // 없으면 null / miss
  }
  function tr(text) {                               // 글 번역 / translate text
    if (lang !== "en" || text == null) return text; const s = String(text); if (!KO.test(s)) return s; // 한글이 없으면 그대로 / no Hangul → unchanged
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], core = s.trim(); // 앞뒤 공백 보존 / keep surrounding spaces
    let r = one(core);                              // 통째로 / whole
    if (r == null && core.indexOf("\n") >= 0) r = core.split("\n").map(function (l) { return tr(l); }).join("\n"); // 줄 단위 / by line
    if (r == null) { const parts = core.split(/(?<=[.?!])\s+/); if (parts.length > 1) r = parts.map(function (p) { return tr(p); }).join(" "); } // 문장 단위 / by sentence
    if (r == null) { misses.add(core.replace(NUM, "#")); r = core; glossary.forEach(function (g) { if (r.indexOf(g) >= 0) r = r.split(g).join(D[g]); }); FRAG.forEach(function (f) { if (r.indexOf(f[0]) >= 0) r = r.split(f[0]).join(f[1]); }); } // 낱말 대체 / word fallback
    return lead + r + tail;                         // 결과 / result
  }
  function node(n) {                                // 텍스트 노드 하나 / one text node
    const v = n.nodeValue;                          // 지금 글자 / current text
    if (lang === "en") { if (done.get(n) === v) return; if (!KO.test(v)) return; /* 이미 번역한 것은 건너뜀(한국어로 돌아갈 때는 이 검사를 하지 않아야 되돌려짐) / skip if already translated (not checked when going back to Korean) */ orig.set(n, v); const t = tr(v); done.set(n, t); if (t !== v) n.nodeValue = t; } // 영문으로 / to English
    else if (orig.has(n)) { const o = orig.get(n); orig.delete(n); done.delete(n); n.nodeValue = o; } // 한글로 되돌림 / back to Korean
  }
  function attrs(el) {                              // 속성 번역 / attributes
    ["title", "placeholder", "alt", "aria-label"].forEach(function (a) { const v = el.getAttribute && el.getAttribute(a); if (!v) return; const key = "__ko_" + a; if (lang === "en") { if (KO.test(v)) { if (el[key + "_t"] === v) return; el[key] = v; const t = tr(v); el[key + "_t"] = t; if (t !== v) el.setAttribute(a, t); } } /* 2026-11-13: 번역이 안 되는 속성을 같은 값으로 다시 쓰면 감시기가 끝없이 되돌아 화면이 멈추던 문제 해결 / fixed an infinite observer loop */ else if (el[key]) { el.setAttribute(a, el[key]); el[key] = null; el[key + "_t"] = null; } });
  }
  function apply(root) {                            // 아래 모든 것을 번역 / translate a subtree
    const r = root || document.body; if (!r) return;
    if (r.nodeType === 3) { node(r); return; }      // 텍스트 노드 / text node
    if (r.nodeType !== 1 || r.tagName === "SCRIPT" || r.tagName === "STYLE") return; // 요소만 / elements only
    attrs(r); const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n; // 걷기 / walk
    while ((n = w.nextNode())) { if (n.nodeType === 3) { const p = n.parentNode; if (p && (p.tagName === "SCRIPT" || p.tagName === "STYLE")) continue; node(n); } else attrs(n); }
  }
  let mo = null;                                    // 변화 감시기 / mutation observer
  function watch() {                                // 새로 그려지는 글자도 번역 / translate newly rendered text
    if (mo) mo.disconnect(); if (lang !== "en") return;
    mo = new MutationObserver(function (list) { list.forEach(function (m) { if (m.type === "characterData") node(m.target); else m.addedNodes.forEach(function (a) { apply(a); }); if (m.type === "attributes") attrs(m.target); }); });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["title", "placeholder", "alt"] });
  }
  /* 캔버스 글자 / canvas text */
  const C2 = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2) { const f = C2.fillText, m = C2.measureText, s = C2.strokeText; C2.fillText = function (t) { const a = Array.prototype.slice.call(arguments); a[0] = lang === "en" ? tr(t) : t; return f.apply(this, a); }; C2.measureText = function (t) { return m.call(this, lang === "en" ? tr(t) : t); }; if (s) C2.strokeText = function (t) { const a = Array.prototype.slice.call(arguments); a[0] = lang === "en" ? tr(t) : t; return s.apply(this, a); }; }
  function set(l) {                                 // 언어 바꾸기 / switch language
    lang = l === "en" ? "en" : "ko"; try { localStorage.setItem("qp_lang", lang); } catch (e) { } // 기억 / remember
    document.documentElement.lang = lang; document.body.classList.toggle("lang-en", lang === "en"); // 표시 / mark
    apply(document.body); watch();                  // 전체 번역과 감시 / translate all and watch
    if (QP.I18N.onChange) QP.I18N.onChange(lang);  // 화면 다시 그리기 등 / re-render hooks
  }
  QP.I18N = { misses: misses, tr: tr, apply: apply, set: set, lang: function () { return lang; }, onChange: null, init: function () { document.documentElement.lang = lang; document.body.classList.toggle("lang-en", lang === "en"); if (lang === "en") { apply(document.body); watch(); } } }; // 공개 / public API
})(window.QP = window.QP || {});                    // QP 이름공간 / QP namespace
