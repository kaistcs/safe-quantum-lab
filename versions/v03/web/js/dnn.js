/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름. */
/* [English] Shared deep neural network (22 → 12 → 8 → 6 → 1) used by the control room and DNN screen. */
/* =====================================================================
 * dnn.js : 화면 전체가 함께 쓰는 심층 신경망(DNN) 한 개
 * ---------------------------------------------------------------------
 * 왜 쓰는가 : 산행 관제실, DNN 학습 관제 화면이 같은 신경망을 보여 주어
 *            "학습된 가중치가 실제 판단에 어떻게 쓰이는지" 이어지게 함.
 * 구조      : 입력 22개(원래 신호 16 + 양자 겹침 특징 6) → 은닉 12 → 8 → 6(tanh, 3층)
 *            → 출력 1개(sigmoid, 위험 점수)
 * ===================================================================== */
(function (QP) {                                    // QP 이름공간에 DNN을 붙임 / attaches the DNN to the QP namespace
  "use strict";                                     // 엄격 모드를 켬 / turn on strict mode
  const M = QP.Models;                              // 모델 모듈임 / model module
  const DNN = { model: null, method: "quantum", rows: null, test: null }; // 현재 신경망과 학습 자료임 / current network and training data
  DNN.reset = function (method) {                   // 새 신경망을 만듦(무작위 시작) / create a new network (random start)
    DNN.method = method || DNN.method;              // 입력 방식(양자 22개 또는 일반 16개)임 / input type (22 quantum or 16 classical)
    DNN.model = M.mlpCreate(DNN.method === "linear" ? 16 : 22, 10, 5); // 같은 씨앗으로 만듦 / create with the same seed
    return DNN.model;                               // 신경망을 돌려줌 / return the network
  };
  DNN.setData = function (train, test) {            // 학습, 시험 자료를 정함 / set the training and test data
    DNN.rows = M.mlpRows(train, DNN.method); DNN.test = test ? M.mlpRows(test, DNN.method) : null; // 특징으로 바꿔 둠 / convert to features in advance
  };
  DNN.step = function (lr) { return M.mlpEpoch(DNN.model, DNN.rows, lr || .3); }; // 한 번 학습함 / train once
  DNN.train = function (train, epochs) {            // 처음부터 여러 번 학습함 / train several times from scratch
    DNN.reset(); DNN.setData(train, null);          // 새로 만들고 자료를 정함 / create anew and set the data
    for (let e = 0; e < (epochs || 25); e++) DNN.step(); // 정해진 횟수만큼 학습함 / train a fixed number of times
  };
  DNN.predict = function (x) { return M.mlpForward(DNN.model, M.features(x, DNN.method)).o; }; // 20개 신호로 위험 점수를 냄 / risk score from the 20 signals
  DNN.forward = function (x) { const f = M.features(x, DNN.method), r = M.mlpForward(DNN.model, f); r.f = f; return r; }; // 입력, 은닉, 출력값을 모두 돌려줌(그림용) / return input, hidden and output values (for drawing)
  DNN.testAcc = function () {                       // 시험 정확도, 탐지율임 / test accuracy and detection rate
    if (!DNN.test) return null; let ok = 0, tp = 0, P = 0; // 집계 변수임 / tally variables
    DNN.test.forEach(function (r) { const o = M.mlpForward(DNN.model, r.f).o; if ((o >= .5 ? 1 : 0) === r.label) ok++; if (r.label) { P++; if (o >= .5) tp++; } }); // 채점함 / score
    return { acc: ok / DNN.test.length, recall: tp / Math.max(1, P) }; // 결과임 / result
  };
  QP.DNN = DNN;                                     // 공개함 / make public
})(window.QP = window.QP || {});                    // QP 이름공간을 넘김 / pass the QP namespace
