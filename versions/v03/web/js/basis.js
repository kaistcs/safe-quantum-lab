/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Evidence boxes ("basis"), card read-aloud buttons and term info (i) popups. */
/* =====================================================================
 * basis.js : 결과마다 "근거" 펼치기 상자 + 카드 읽어 주기 버튼
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 심사위원(시험관)이 각 숫자가 어떤 데이터, 어떤 계산, 어떤
 *            코드, 어떤 문헌에서 나왔는지 클릭 한 번으로 확인하게 함.
 * 사용법    : QP.Basis.box({data, method, formula, code, ref, note})
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 근거 도구를 붙임 / attaches evidence tools to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  function box(b, title) {                          // 근거 상자 HTML을 만듦 / builds the evidence box HTML
    const rows = [["데이터", b.data], ["처리 과정", b.method], ["계산식", b.formula], ["코드 위치", b.code], ["근거 문헌", b.ref], ["한계", b.note]] // 표시할 항목 목록임 / items to show
      .filter(function (r) { return r[1]; })        // 내용이 있는 항목만 남김 / keep only items with content
      .map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join(""); // 표의 한 줄로 바꿈 / turn into a table row
    const open = QP.State && QP.State.examiner ? " open" : ""; // 시험관 모드면 처음부터 펼쳐 둠 / open from the start in examiner mode
    return '<details class="basis"' + open + '><summary>근거' + (title ? ": " + title : "") + '</summary><table>' + rows + "</table></details>"; // 펼치기 상자임 / collapsible box
  }
  function attachReaders(root) {                    // 화면의 모든 카드에 "읽어 주기" 버튼을 붙임 / adds a "read aloud" button to every card on the screen
    root.querySelectorAll(".card").forEach(function (c) { // 카드마다 / for each card
      if (c.querySelector(":scope > .say")) return; // 이미 있으면 건너뜀 / skip if already present
      const b = document.createElement("button");   // 작은 버튼을 만듦 / create a small button
      b.className = "say"; b.title = "이 카드 읽어 주기"; b.textContent = "🔊"; // 모양과 설명임 / look and tooltip
      b.onclick = function (e) { e.stopPropagation(); const t = c.cloneNode(true); t.querySelectorAll("button,select,input,.basis,canvas,svg").forEach(function (x) { x.remove(); }); t.querySelectorAll("h3,p,li,tr,div,label").forEach(function (x) { x.append("\n"); }); t.querySelectorAll("td,th,b,span").forEach(function (x) { x.append(" "); }); QP.Voice.speak(t.textContent.replace(/\s*\n\s*/g, ". ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim(), true, true); }; // 블록마다 문장을 끊어 자연스럽게 읽음 / sentence breaks per block // 버튼, 그림을 뺀 글만 읽음 / read only the text without buttons and pictures
      c.appendChild(b);                             // 카드 오른쪽 위에 붙임 / attach at the top right of the card
    });
  }
  /* ---------- 용어 정보(ⓘ) / Term info (ⓘ)  ---------- */
  const TERMS = {                                   // 용어 → [한 줄 뜻, 자세한 설명]임 / term → [one-line meaning, detailed explanation]
    "탐지율": ["재현율(Recall). 실제 위험 중 경보를 낸 비율", "실제 위험 사건 100건 중 몇 건에 경보를 냈는지임. 높을수록 위험을 덜 놓침. 계산: 맞힌 위험 ÷ 전체 위험. 안전 분야에서 가장 중요한 지표임."],
    "오경보율": ["거짓 양성률(FPR). 정상인데 경보를 낸 비율", "정상 상황 100번 중 몇 번 괜히 울렸는지임. 낮을수록 사용자가 경보를 믿음. 이 실험은 모든 방식의 오경보 예산을 약 10%로 똑같이 맞춘 뒤 탐지율을 비교함."],
    "정밀도": ["Precision. 울린 경보 중 진짜 위험의 비율", "경보 10번 중 진짜 위험이 몇 번이었는지임. 계산: 맞힌 위험 ÷ 전체 경보."],
    "F1": ["정밀도와 재현율의 조화평균(0~1)", "F1 = 2 × 정밀도 × 재현율 ÷ (정밀도 + 재현율). 둘 중 하나만 높으면 낮게 나옴. 놓침과 헛경보를 함께 보는 한 숫자임."],
    "AUC": ["ROC 곡선 아래 면적(0.5~1). 위험을 정상보다 높게 점수 매길 확률", "무작위로 위험 하나, 정상 하나를 뽑았을 때 위험 쪽 점수가 더 높을 확률임. 0.5 = 찍기, 1 = 완벽. 경보 기준과 상관없이 점수의 ‘줄 세우기’ 능력을 봄(Hanley & McNeil, Radiology 1982)."],
    "경보 기준": ["점수가 이 값 이상이면 경보", "검증용 정상 표본 점수의 상위 10% 지점으로 정함. 방식마다 같은 오경보 예산을 쓰게 하기 위함임."],
    "선행 시간": ["사건 시작보다 경보가 앞선 시간(분)", "경보 시각이 사건 시작보다 빠를수록 미리 대비할 시간이 생김. 음수면 늦은 경보임."],
    "⟨Z⟩": ["겹침 점수. 대상 큐비트의 P(0) − P(1)", "−1~+1. 이 회로에서는 cos(π, a)×cos(π, b)와 같음. 두 신호가 함께 높거나 함께 낮으면 +, 한쪽만 높으면 −."],
    "%HRR": ["심박예비율", "(현재 심박 − 안정시 심박) ÷ (최대심박 − 안정시 심박). 개인마다 다른 체력을 반영한 운동 강도임(Karvonen 1957)."],
    "샷": ["회로를 한 번 실행하고 측정하는 일", "실제 양자 장비는 확률을 직접 볼 수 없어 수백~수천 번 측정해 비율로 추정함. 횟수가 적으면 오차(≈1/√샷)가 커짐."]
  };
  function info(term) {                             // 용어 옆 ⓘ 버튼 HTML을 만듦 / builds the ⓘ button HTML next to a term
    return '<button class="info" data-term="' + term + '" title="' + (TERMS[term] ? TERMS[term][0] : term) + '">i</button>'; // 마우스를 올리면 한 줄 뜻, 누르면 자세히 / hover for the one-line meaning, click for details
  }
  function desc(term) { return TERMS[term] ? TERMS[term][0] : ""; } // 표 오른쪽 설명 칸용 한 줄 뜻임 / one-line meaning for the right-hand description column
  document.addEventListener("click", function (e) {  // 화면 어디서든 ⓘ를 누르면 설명 창을 띄움 / clicking ⓘ anywhere opens an explanation popup
    const b = e.target.closest && e.target.closest(".info"); if (!b) { const old = document.querySelector(".info-pop"); if (old && !e.target.closest(".info-pop")) old.remove(); return; } // ⓘ가 아니면 열린 창을 닫음 / close the open popup if not clicking ⓘ
    e.stopPropagation(); const t = TERMS[b.dataset.term]; if (!t) return; // 용어 설명을 찾음 / find the term explanation
    const old = document.querySelector(".info-pop"); if (old) old.remove(); // 이전 창을 닫음 / close the previous popup
    const pop = document.createElement("div"); pop.className = "info-pop"; pop.innerHTML = "<b>" + b.dataset.term + "</b><p>" + t[0] + "</p><p class='small'>" + t[1] + "</p><button class='ghost'>🔊 읽기</button>"; // 설명 창을 만듦 / create the popup
    pop.querySelector("button").onclick = function () { QP.Voice.speak(b.dataset.term + ". " + t[0] + ". " + t[1], true, true); }; // 읽기 버튼임(직접 누름) / read button
    document.body.appendChild(pop); const r = b.getBoundingClientRect(); pop.style.left = Math.min(window.innerWidth - 330, r.left) + "px"; pop.style.top = Math.min(window.innerHeight - 200, r.bottom + 6) + "px"; // 버튼 아래에 띄움 / show it below the button
  }, true);
  QP.Basis = { box: box, attachReaders: attachReaders, info: info, desc: desc, TERMS: TERMS }; // 공개함 / make public
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
