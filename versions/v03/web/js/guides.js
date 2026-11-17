/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Card-level ⓘ guides: what changed, how to use it, how to read the result, evidence and limits (Korean and English). */
/* =====================================================================
 * guides.js (2026-11-17) : 카드 제목 옆 ⓘ를 누르면 열리는 "자세한 안내" 창
 *  창 안의 순서 : 1. 무엇이 바뀌었나(날짜) 2. 사용 방법(번호 순서) 3. 결과 읽는 법 4. 근거와 한계
 *  읽기(직접 누름이라 바로 읽음), ▶ 그 화면으로 가기, ✕ 닫기. Esc나 바깥을 눌러도 닫힘
 *  사용 : QP.Guide.btn("키") 를 제목 HTML 뒤에 붙임
 * ===================================================================== */
(function (QP) {
  "use strict";
  const en = function () { return QP.I18N && QP.I18N.lang() === "en"; };
  const G = {
    news: { go: null, ko: { t: "2026-11-17 새 기능과 변경 내역 전체",
        what: ["100대 명산 난이도를 실제 등산로 GPX 607개 코스로 계산하도록 바꾸었습니다(97개 산 실측, 3개 산 추정).", "메타학습 화면에 공정한 비교 기준인 ‘모두 섞어 학습 후 미세 조정’을 더하고, 개인차 크기를 바꾸어 직접 비교하는 실험 카드를 넣었습니다.", "메타학습을 일반인도 이해하도록 ‘과녁과 출발점’ 그림 5단계 이야기를 넣었습니다.", "LSTM을 실제로 학습시키는 새 화면 ‘AI LSTM 학습 실험(시간 누적 위험)’을 메뉴 ③ 메타학습 다음에 넣었습니다.", "카드 해설, 메타 흐름, 이야기 단계, 실험 단계마다 눈송이 지시봉이 설명하는 곳을 가리킵니다.", "새 카드마다 제목 옆 ⓘ를 누르면 이 창처럼 변경 내역, 사용 방법, 결과 읽는 법, 근거가 모두 나옵니다."],
        how: ["왼쪽 메뉴 B. 에뮬레이팅 실험 → ③ 합성 데이터 생성과 실험 관제를 펼칩니다.", "‘AI 메타학습(사람마다 빠른 적응)’을 누르고, 가운데 ‘▶ 5단계 이야기 듣기’로 개념을 먼저 봅니다.", "오른쪽 아래 ‘정직한 비교 실험’에서 개인차 크기를 고르고 ‘▶ 세 방법 비교 실험’을 누릅니다.", "다음 메뉴 ‘AI LSTM 학습 실험’에서 학습 산행 수를 고르고 ‘▶ 학습 실험 시작’을 누릅니다.", "위쪽 날씨 상자의 ‘☰ 전체 100곳’을 누르면 산마다 실측 난이도와 출처가 나옵니다.", "모든 것을 자동으로 보시려면 왼쪽 위 ‘▶ 전체 자동 안내’를 누릅니다(32단계, 설명이 끝나야 다음 단계)."],
        read: ["숫자는 모두 이 화면에서 실제로 계산한 값입니다.", "메타학습은 지금 가상 자료에서 ‘모두 섞어 학습’보다 높지 않았고, 이 사실을 그대로 보여 줍니다.", "LSTM은 시간이 쌓이는 위험에서 순간 모델보다 분명히 낫고, 양자 겹침 입력은 자료가 적거나 학습이 짧을 때만 도움이 되었습니다."],
        why: ["모든 결과는 가상 자료 기준이며 실제 아이나비 워치 기록과 산행 시계열로 다시 확인해야 합니다.", "근거 문헌은 각 카드의 ‘근거’ 상자에 있습니다."] },
      en: { t: "All new features and changes on 2026-11-17",
        what: ["Top-100 mountain difficulty now comes from 607 real GPX trail courses (97 mountains measured, 3 estimated).", "The meta-learning screen adds the fair baseline 'pooled training plus fine-tuning' and an experiment card to compare by the size of personal differences.", "A 5-step picture story, 'targets and a starting point', explains meta-learning for everyone.", "A new screen, 'AI LSTM training lab (time-accumulated risk)', actually trains an LSTM; it sits after meta-learning in menu 3.", "Snowflake's pointer now points at what is being explained in card guides, the meta flow, story steps and experiment steps.", "On every new card, the ⓘ next to the title opens a window like this with changes, how to use, how to read results and evidence."],
        how: ["Open the left menu B. Emulation experiments → 3. Synthetic data and experiment control.", "Click 'AI meta-learning' and first watch the concept with '▶ Listen to the 5-step story'.", "In 'Honest comparison' at the bottom right, choose the size of personal differences and press '▶ Run 3-way comparison'.", "In the next menu item 'AI LSTM training lab', choose the number of training hikes and press '▶ Start experiment'.", "Press '☰ All 100' in the weather box at the top to see measured difficulty and sources for each mountain.", "To see everything automatically, press '▶ Full auto guide' at the top left (32 steps; each moves on only after its explanation)."],
        read: ["All numbers are computed on this screen.", "Meta-learning was not higher than pooled training on the current virtual data, and the screen shows this as it is.", "The LSTM is clearly better than the moment model on risk that builds up over time; quantum overlap inputs helped only with little data or short training."],
        why: ["All results are on virtual data and must be rechecked on real iNavi watch records and hike time series.", "References are in each card's 'Evidence' box."] } },
    wx: { go: null, ko: { t: "100대 명산 난이도(실제 등산로 GPX)와 산행 가능성",
        what: ["2026-11-17: 난이도를 정상 높이로 추정하던 방식에서, 실제 등산로 GPX 607개 코스로 계산하는 방식으로 바꾸었습니다.", "97개 산은 실측, 대암산, 서대산, 점봉산은 조건에 맞는 코스가 없어 기존 추정을 씁니다.", "상자와 표에 ‘실측 코스 n개’, ‘위험 표지 n개’, ‘추정’ 표시가 붙습니다."],
        how: ["위쪽 날씨 상자의 ◀ ▶로 산을 넘기거나, 상자 위에 마우스를 올려 멈춥니다.", "난이도 표시 위에 마우스를 올리면 코스 거리, 오르막, 코스별 시간 범위, 위험 표지 평균이 나옵니다.", "‘☰ 전체 100곳’을 누르면 권역별 요약과 100곳 표가 열리고, 표의 줄을 누르면 그 산으로 바뀝니다.", "표 아래 번호 목록에서 목록, 좌표, 날씨, 난이도, 통제 기준의 출처를 확인합니다."],
        read: ["난이도: 왕복 3.5시간 미만 쉬움, 5시간 미만 보통, 6.5시간 미만 어려움, 그 이상 매우 어려움입니다.", "산행 가능성: 날씨 감점에 난이도 가중을 곱하고, 일몰 전 하산이 가능한지 함께 봅니다. 초록 산행 가능, 파랑 주의하며 가능, 주황 권장 안 함, 빨강 불가입니다."],
        why: ["공공데이터포털 15098177 「한국등산트레킹지원센터_산림청 100대명산_20220112」 GPX(이용 허락 제한 없음).", "정상 높이의 85% 이상까지 오르는 코스만 쓰고, 편도 코스는 같은 길로 돌아온다고 보고 왕복으로 환산합니다.", "시간 = 거리/4 km/h + 오르막/600 m/h (Naismith 1892, Scarf 2007) + 휴식 30분. 실제 소요는 사람, 계절, 길 상태에 따라 다릅니다."] },
      en: { t: "Top-100 mountain difficulty (real GPX trails) and hiking feasibility",
        what: ["2026-11-17: difficulty is now computed from 607 real GPX trail courses instead of being estimated from summit height.", "97 mountains are measured; Daeamsan, Seodaesan and Jeombongsan have no suitable course and keep the estimate.", "The box and table show 'measured courses n', 'danger markers n' or 'estimate'."],
        how: ["Use ◀ ▶ in the weather box at the top, or hover over the box to pause it.", "Hover over the difficulty label to see course distance, climb, time range by course and average danger markers.", "Press '☰ All 100' for the regional summary and the 100-mountain table; click a row to switch to that mountain.", "The numbered list under the table gives the sources of the list, coordinates, weather, difficulty and closure rules."],
        read: ["Difficulty: round trip under 3.5 h easy, under 5 h moderate, under 6.5 h hard, otherwise very hard.", "Feasibility: weather penalties times a difficulty weight, plus whether you can descend before sunset. Green go, blue OK with caution, orange not advised, red no-go."],
        why: ["Public data portal 15098177, Korea Mountaineering and Trekking Support Center top-100 GPX (no use restrictions).", "Only courses reaching 85% of the summit height are used; one-way courses are doubled into a round trip.", "Time = distance/4 km/h + climb/600 m/h (Naismith 1892, Scarf 2007) + 30 min rest. Real times vary with person, season and trail."] } },
    metaStory: { go: "meta", ko: { t: "메타학습 쉬운 그림 5단계(과녁과 출발점)",
        what: ["2026-11-17 새로 넣은 카드입니다. 메타학습을 수식 없이 그림으로 설명합니다."],
        how: ["‘▶ 5단계 이야기 듣기’를 누릅니다. 목소리로 읽어 드리며, 한 단계 설명이 끝나야 다음 그림으로 넘어갑니다.", "위쪽 5개 칸이 단계이고, 지금 단계가 색으로 채워지며 아래 막대가 진행을 보여 줍니다.", "오른쪽 번호 범례로 그림 기호의 뜻을 확인합니다."],
        read: ["1. 기록 모으기: 과녁은 그 사람에게 딱 맞는 위험 기준, 파란 점은 연습 기록 10개, 주황 점은 시험 기록 30개입니다.", "2. 한 사람에게 맞춰 보기: 별(출발점)에서 분홍 점선으로 다섯 걸음 고치며 과녁에 다가갑니다.", "3. 맞췄는지 시험: 초록 ○는 맞힘, 빨강 ×는 틀림입니다.", "4. 출발점 옮기기: 누구에게든 몇 걸음이면 닿는 자리로 남색 선을 따라 출발점이 옮겨 갑니다(바깥 루프).", "5. 새 사람: 배운 출발점은 한두 걸음, 회색 무작위 출발점은 다섯 걸음 뒤에도 멉니다. 오른쪽에 이 화면의 실제 수치가 나옵니다."],
        why: ["그림은 개념 설명용이며 실제 수치는 ‘정직한 비교 실험’ 카드에서 계산합니다.", "Finn 등 ICML 2017(MAML), Nichol 등 2018(1차 근사)."] },
      en: { t: "Meta-learning in 5 easy pictures (targets and a start)",
        what: ["New card on 2026-11-17. It explains meta-learning with pictures instead of formulas."],
        how: ["Press '▶ Listen to the 5-step story'. It is read aloud, and the next picture comes only after each explanation ends.", "The five boxes at the top are the steps; the current one is filled with color and the bar below shows progress.", "Use the numbered legend on the right for the meaning of each symbol."],
        read: ["1. Collect: a target is the risk standard that fits that person; blue dots are 10 practice records and orange dots 30 test records.", "2. Fit one person: from the star (start), five pink dotted steps move toward the target.", "3. Test: green ○ is right, red × is wrong.", "4. Move the start: the start moves along the navy line to where anyone can be reached in a few steps (outer loop).", "5. New person: the learned start needs one or two steps; the gray random start is still far after five. Real numbers from this screen appear on the right."],
        why: ["The picture explains the idea; real numbers are computed in the 'Honest comparison' card.", "Finn et al. ICML 2017 (MAML), Nichol et al. 2018 (first-order)."] } },
    metaCmp: { go: "meta", ko: { t: "정직한 비교 실험: 메타 vs 모두 섞어 학습 vs 무작위",
        what: ["2026-11-17 새로 넣은 카드입니다. 이전에는 메타를 무작위 시작하고만 비교해 메타가 크게 좋아 보였습니다.", "공정한 기준인 ‘모두 섞어 학습 후 미세 조정(pooled)’을 같은 사람, 같은 기록, 같은 Adam 0.05로 학습해 함께 비교합니다."],
        how: ["1. 개인차 크기를 고릅니다: 1배(지금 자료), 3배, 6배. 사람마다 위험 경계가 다른 정도입니다.", "2. ‘▶ 세 방법 비교 실험’을 누릅니다. 아래 다섯 단계 표시가 차례로 켜집니다.", "3. 왼쪽 손실 곡선이 내려가는 동안 학습(시작 씨앗 3개 × 150회)이 진행됩니다.", "4. 오른쪽 막대가 0, 1, 5걸음 적응 정확도로 자라며, 가장 높은 막대에 ‘1위’ 표시가 붙습니다.", "5. 판정 문장과 기록표를 확인하고, 개인차를 바꾸어 다시 실행하면 기록표에 줄이 쌓입니다."],
        read: ["0걸음은 그 사람 기록을 보기 전, 1걸음과 5걸음은 그 사람 기록 10개로 고친 뒤의 정확도입니다.", "1배에서는 섞어 학습이 메타보다 약 3%p 높고, 개인차가 커질수록 격차가 사라집니다.", "무작위보다 메타가 20%p 이상 높으므로 ‘여러 사람에게서 배운 출발점’의 효과는 분명하지만, ‘메타 방식만의 효과’는 지금 자료로는 확인되지 않습니다."],
        why: ["처음 보는 12명 × 시험 묶음 3개 × 시작 씨앗 3개의 평균입니다.", "섞어 학습은 미세 조정 학습률 0.1을 씁니다(0.5에서는 오히려 떨어져 각 방법에 맞는 값을 씀).", "Chen 등 ICLR 2019, Tian 등 ECCV 2020: 함께 학습 후 미세 조정이 강한 기준선이라는 보고와 같은 경향입니다.", "가상 자료 기준이며 실제 워치 기록으로 다시 확인해야 합니다."] },
      en: { t: "Honest comparison: meta vs pooled vs random",
        what: ["New card on 2026-11-17. Before, meta was compared only with a random start, which made it look much better.", "The fair baseline 'pooled training plus fine-tuning' is trained with the same people, the same records and the same Adam 0.05, and compared together."],
        how: ["1. Choose the size of personal differences: ×1 (current data), ×3, ×6, meaning how much the risk boundary differs between people.", "2. Press '▶ Run 3-way comparison'. The five step markers light up in order.", "3. Training (3 seeds × 150) runs while the loss curves on the left go down.", "4. Bars on the right grow to the accuracy after 0, 1 and 5 adaptation steps; the highest is marked 'best'.", "5. Read the verdict and the record table; run again with another size and rows accumulate."],
        read: ["Step 0 is before seeing the person's records; steps 1 and 5 are after fitting with 10 of their records.", "At ×1, pooled is about 3 pp higher than meta; the gap disappears as differences grow.", "Meta is more than 20 pp above random, so a start learned from many people clearly helps, but an effect specific to meta is not confirmed on the current data."],
        why: ["Mean over 12 new people × 3 test sets × 3 seeds.", "Pooled uses fine-tuning learning rate 0.1 (0.5 made it worse, so each method uses a suitable value).", "Same trend as Chen et al. ICLR 2019 and Tian et al. ECCV 2020: pooled training plus fine-tuning is a strong baseline.", "Virtual data; must be rechecked on real watch records."] } },
    metaCurve: { go: "meta", ko: { t: "새 사람 적응 곡선(세 방법)",
        what: ["2026-11-17: 초록 선(모두 섞어 학습 후 미세 조정)을 더해 세 방법을 함께 그립니다."],
        how: ["위쪽 ‘▶ 메타 학습 시작’을 누르면 학습이 진행되며 곡선이 바뀝니다.", "‘초기화’를 누르면 처음부터 다시 학습합니다."],
        read: ["가로는 적응 걸음 0~10, 세로는 처음 보는 12명의 평균 정확도입니다.", "1. 남색 메타, 2. 초록 모두 섞어 학습, 3. 회색 무작위 시작입니다. 아래 문장에 0, 1, 5걸음 값이 나옵니다."],
        why: ["개인차 1배 자료이며, 조건을 바꾼 비교는 아래 ‘정직한 비교 실험’에서 합니다."] },
      en: { t: "Adaptation curve for a new person (three methods)",
        what: ["2026-11-17: the green line (pooled plus fine-tuning) is added so all three methods are drawn together."],
        how: ["Press '▶ Start meta-learning' at the top; the curves change as training runs.", "Press 'Reset' to train again from the start."],
        read: ["Horizontal: adaptation steps 0-10. Vertical: mean accuracy over 12 new people.", "1. navy meta, 2. green pooled, 3. gray random. The sentence below gives the values at 0, 1 and 5 steps."],
        why: ["This uses personal differences ×1; comparisons under other conditions are in 'Honest comparison' below."] } },
    lstm: { go: "lstmlab", ko: { t: "LSTM 실제 학습 실험(시간이 쌓여야 생기는 위험)",
        what: ["2026-11-17 새로 만든 화면입니다. 이전 LSTM 그림은 손으로 정한 가중치로 동작만 보여 주었고, 이 화면은 실제로 학습시켜 성능을 비교합니다.", "세 모델을 같은 자료, 같은 미니배치, 같은 갱신 횟수로 학습합니다: 1. 순간 모델, 2. LSTM, 3. LSTM + 양자 겹침 입력 2개."],
        how: ["1. 학습 산행 수를 고릅니다: 20개(적은 자료), 40개, 160개(충분).", "2. ‘▶ 학습 실험 시작’을 누릅니다. 위쪽 6단계 표시가 차례로 켜지고 눈송이가 해당 카드를 가리킵니다.", "3. 단계마다 설명이 끝나야 다음 단계로 넘어갑니다. ‘멈춤’으로 언제든 멈출 수 있습니다.", "4. 끝나면 오른쪽 아래 채점표와 판정 문장을 읽습니다. 산행 수를 20개로 바꾸어 다시 실행하면 양자 입력의 효과가 달라지는지 볼 수 있습니다."],
        read: ["① ② 그림: 네 신호 선, 회색 점선 피로(워치로 못 잼), 아래 막대 쌓인 부담, 빨간 점선 기준, 분홍 띠 위험 정답입니다.", "③ 그림: 세 손실 곡선, 노란 점선 5, 15, 40바퀴에서 채점합니다.", "④ ⑤ 그림: 시험 산행 하나에서 세 모델의 위험 점수, 세모는 첫 경보(몇 분 미리인지), 주황 막대는 LSTM 기억 띠 크기입니다.", "⑥ 채점표: AUC(0.5 찍기 ~ 1 완벽), 위험 구간 탐지율(오경보 10%로 같게 맞춤), 사건 탐지, 평균 첫 경보입니다.", "160개 기준 결과: 순간 모델 AUC 약 0.94, 두 LSTM 약 0.996. 양자 입력은 20개, 5바퀴처럼 적을 때만 더 빨리 배웠고 수렴 후에는 같았습니다."],
        why: ["정답 S_t = 0.82 S_(t−1) + 피로×경사 + 0.8 비×경사 + 0.25 배터리×피로, 1.9 초과 시 위험(가상 규칙).", "Hochreiter & Schmidhuber 1997, Werbos 1990(BPTT), Kingma & Ba 2015, Fawcett 2006.", "가상 자료 기준이며 실제 아이나비 시계열로 다시 확인해야 합니다."] },
      en: { t: "Real LSTM training (risk that builds up over time)",
        what: ["New screen on 2026-11-17. The earlier LSTM picture only showed how it works with hand-set weights; this screen actually trains and compares performance.", "Three models are trained on the same data, minibatches and number of updates: 1. moment model, 2. LSTM, 3. LSTM + 2 quantum overlap inputs."],
        how: ["1. Choose the number of training hikes: 20 (little data), 40, 160 (enough).", "2. Press '▶ Start experiment'. The 6 step markers light up in order and Snowflake points at the card.", "3. Each step moves on only after its explanation. 'Stop' stops it any time.", "4. At the end, read the scorecard and verdict at the bottom right. Run again with 20 hikes to see whether the quantum inputs matter."],
        read: ["Plots 1, 2: four signal lines, gray dotted fatigue (not measured), bars of accumulated strain, red dotted threshold, pink band of risk labels.", "Plot 3: three loss curves; scoring at the yellow dotted 5, 15, 40 epochs.", "Plots 4, 5: risk scores of the three models on one test hike; triangles are first alarms (minutes early); orange bars are LSTM memory size.", "Plot 6: AUC (0.5 guess to 1 perfect), risk-step detection at equal 10% false alarms, events caught, mean first alarm.", "With 160 hikes: moment model AUC about 0.94, both LSTMs about 0.996. Quantum inputs learned faster only with little data or short training (20 hikes, 5 epochs) and were equal after convergence."],
        why: ["Label S_t = 0.82 S_(t−1) + fatigue×slope + 0.8 rain×slope + 0.25 battery×fatigue, risk above 1.9 (virtual rule).", "Hochreiter & Schmidhuber 1997, Werbos 1990 (BPTT), Kingma & Ba 2015, Fawcett 2006.", "Virtual data; must be rechecked on real iNavi time series."] } }
  };
  const HEAD = { ko: ["1. 무엇이 바뀌었나", "2. 사용 방법", "3. 결과 읽는 법", "4. 근거와 한계"], en: ["1. What changed", "2. How to use", "3. How to read the results", "4. Evidence and limits"] };
  function btn(key) { return '<button class="info info-g" data-guide="' + key + '" title="' + (en() ? "Details: changes, how to use, how to read" : "자세히: 변경 내역, 사용 방법, 결과 읽는 법") + '">i</button>'; }
  function close() { const o = document.querySelector(".guide-pop"); if (o) o.remove(); }
  function open(key, anchor) {
    const g = G[key]; if (!g) return; close(); const L = en() ? g.en : g.ko, H = en() ? HEAD.en : HEAD.ko;
    const pop = document.createElement("div"); pop.className = "guide-pop";
    pop.innerHTML = '<div class="gp-h"><b>ⓘ ' + L.t + '</b><span><button class="ghost" data-a="read">' + (en() ? "Read" : "읽기") + "</button>" + (g.go && location.hash.slice(1).split("-")[0] !== g.go ? '<button class="ghost" data-a="go">▶ ' + (en() ? "Go to the screen" : "그 화면으로 가기") + "</button>" : "") + '<button class="ghost" data-a="x">✕</button></span></div>' +
      [L.what, L.how, L.read, L.why].map(function (a, k) { return "<h4>" + H[k] + "</h4><ol>" + a.map(function (x) { return "<li>" + x.replace(/^\d+\.\s/, "") + "</li>"; }).join("") + "</ol>"; }).join("");
    pop.addEventListener("click", function (e) { e.stopPropagation(); const a = e.target.closest("[data-a]"); if (!a) return; const k = a.dataset.a;
      if (k === "x") close(); if (k === "go") { close(); QP.App.go(g.go); }
      if (k === "read") QP.Voice.speak([L.t].concat(L.what, L.how, L.read, L.why).join(" "), true, true); });
    document.body.appendChild(pop);
    const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, bottom: 120 }, w = Math.min(560, innerWidth - 20);
    pop.style.width = w + "px"; pop.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left - 20)) + "px"; const ph = pop.offsetHeight; pop.style.top = Math.max(10, Math.min(innerHeight - ph - 10, r.bottom + 6)) + "px"; /* 화면 안에 다 보이게 / keep it inside the screen */
  }
  document.addEventListener("click", function (e) { const b = e.target.closest && e.target.closest("[data-guide]"); if (b) { e.stopPropagation(); e.preventDefault(); open(b.dataset.guide, b); return; } if (!e.target.closest || !e.target.closest(".guide-pop")) close(); }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  QP.Guide = { btn: btn, open: open, close: close, G: G };
})(window.QP = window.QP || {});
