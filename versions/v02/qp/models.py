# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
"""
models.py : 특징 변환, 로지스틱 회귀 학습, 공정 비교 실험, 4큐비트 위험구역 회로

왜 쓰는가 : 일반 AI / 양자 특징 AI / 일반 수식 대조군 / 샷 측정 양자 AI 를
           같은 데이터, 같은 학습, 같은 오경보 예산으로 비교하기 위함임.
웹 버전   : web/js/models.js 와 같은 순서로 계산하므로 숫자가 거의 같게 나옴.
"""
import math                                    # 수학 함수에 씀
import time                                    # 실행 시간 측정에 씀

from .emulator import LCG, State, sample_prob  # 같은 패키지의 에뮬레이터를 불러옴
from .signals import EXCLUSIONS, PAIRS         # 규칙 신호와 신호 쌍 정의를 불러옴
from .data.synthetic import sample_set         # 합성 데이터 생성기를 불러옴


def pair_circuit(a, b):                        # 두 신호를 받는 2큐비트 회로임
    s = State(2)                               # |00>에서 시작함
    s.ry(0, math.pi * a)                       # 첫 신호를 회전 각도로 넣음
    s.ry(1, math.pi * b)                       # 둘째 신호를 회전 각도로 넣음
    s.cx(0, 1)                                 # 두 큐비트를 얽음
    return s                                   # 판독 전 상태를 돌려줌


def pair_exact(a, b):                          # 정확 판독한 겹침 특징 <Z1>임
    return pair_circuit(a, b).expect_z(1)      # 둘째 큐비트 기댓값임


def pair_analytic(a, b):                       # 같은 값을 수식으로 계산한 대조군임
    return math.cos(math.pi * a) * math.cos(math.pi * b)   # cos 곱과 수학적으로 같음


def features(x, method, ctx=None):             # 방식별 특징 목록을 만듦
    base = [v for i, v in enumerate(x) if i not in EXCLUSIONS]   # 규칙 신호 4개를 뺀 16개임
    if method == "linear":                     # 일반 AI면
        return base                            # 원래 값만 씀
    extra = []                                 # 결합 특징 6개를 담을 목록임
    for i, j in PAIRS:                         # 신호 쌍마다
        a, b = x[i], x[j]                      # 두 값을 꺼냄
        if method == "analytic":               # 대조군이면
            extra.append(pair_analytic(a, b))  # 수식으로 계산함
            continue                           # 다음 쌍으로 감
        z = pair_exact(a, b)                   # 회로를 실행함
        if method == "shots" and ctx and ctx.get("shots"):   # 샷 모드면
            est = sample_prob((1 - z) / 2, ctx["shots"], ctx["rand"])   # 유한 번 측정한 추정값임
            if ctx.get("noise"):               # 잡음이 있으면
                est = est * (1 - ctx["noise"]) + ctx["noise"] * 0.5     # 0.5쪽으로 흐려짐
            z = 1 - 2 * est                    # <Z> 형태로 되돌림
        extra.append(z)                        # 특징을 추가함
    return base + extra                        # 22개 특징을 돌려줌


def _sigmoid(z):                               # 숫자를 0~1 확률로 바꿈
    return 1 / (1 + math.exp(-z))              # 로지스틱 함수임


def _score(w, f):                              # 가중치와 특징으로 점수를 계산함
    z = w[0]                                   # 절편에서 시작함
    for i, v in enumerate(f):                  # 특징마다
        z += w[i + 1] * v                      # 가중치를 곱해 더함
    return _sigmoid(z)                         # 0~1 점수임


def fit(samples, method, ctx=None, epochs=160, lr=0.65, l2=0.004):   # 방식별 모델을 학습함
    rows = [(features(x, method, ctx), y) for x, y in samples]       # 특징을 미리 계산함
    w = [0.0] * (len(rows[0][0]) + 1)          # 가중치를 0에서 시작함
    for _ in range(epochs):                    # 정해진 횟수만큼 반복함
        g = [0.0] * len(w)                     # 기울기 누적임
        for f, y in rows:                      # 모든 표본을 봄
            err = _score(w, f) - y             # 예측 오차임
            g[0] += err                        # 절편 기울기임
            for i, v in enumerate(f):          # 특징마다
                g[i + 1] += err * v            # 기울기를 누적함
        for i in range(len(w)):                # 가중치마다
            w[i] -= lr * (g[i] / len(rows) + (l2 * w[i] if i else 0))   # 오차가 줄어드는 쪽으로 고침
    return lambda x, c=None: _score(w, features(x, method, c or ctx))   # 예측 함수를 돌려줌


def cutoff(valid, predict):                    # 검증 정상의 상위 약 10%를 경보 기준으로 정함
    neg = sorted(predict(x) for x, y in valid if not y)   # 정상 점수를 정렬함
    return neg[math.ceil(len(neg) * 0.90) - 1] + 1e-9     # 경계값임


def auc(scores, labels):                       # ROC-AUC(위험을 정상보다 높게 매긴 비율)임
    pos = [s for s, y in zip(scores, labels) if y]        # 위험 점수임
    neg = sorted(s for s, y in zip(scores, labels) if not y)   # 정상 점수(정렬)임
    import bisect                              # 이분 탐색 도구임
    win = sum(bisect.bisect_left(neg, p) for p in pos)    # 위험이 이긴 쌍의 수임
    return win / (len(pos) * len(neg) or 1)    # 비율임


def measure(test, predict, thr):               # 탐지율, 오경보율, AUC를 셈
    sc = [predict(x) for x, _ in test]         # 시험 점수임
    lab = [y for _, y in test]                 # 정답임
    P = sum(lab); N = len(lab) - P             # 위험, 정상 수임
    tp = sum(1 for s, y in zip(sc, lab) if y and s >= thr)       # 맞힌 위험임
    fp = sum(1 for s, y in zip(sc, lab) if not y and s >= thr)   # 잘못 울린 정상임
    return {"recall": tp / (P or 1), "falseAlarm": fp / (N or 1), "auc": auc(sc, lab), "P": P, "N": N}   # 결과임


def experiment(data=None, shots=0, noise=0.0, seed=7):   # 공정 비교 실험 전체임
    if data is None:                           # 데이터가 없으면 기본 합성 데이터를 씀
        data = {"train": sample_set(901, 1400), "valid": sample_set(902, 550), "test": sample_set(903, 800)}   # 웹과 같은 씨앗임
    methods = ["linear", "quantum", "analytic"] + (["shots"] if shots else [])   # 비교할 방식들임
    out = []                                   # 결과 목록임
    for m in methods:                          # 방식마다
        ctx = {"shots": shots, "noise": noise, "rand": LCG(seed)} if m == "shots" else None   # 샷 설정임
        t0 = time.perf_counter()               # 시작 시각임
        predict = fit(data["train"], m, ctx)   # 학습함
        thr = cutoff(data["valid"], predict)   # 경보 기준을 정함
        res = measure(data["test"], predict, thr)   # 시험함
        res.update({"key": m, "threshold": thr, "ms": (time.perf_counter() - t0) * 1000})   # 정보를 덧붙임
        out.append(res)                        # 목록에 넣음
    return out                                 # 결과를 돌려줌


# ---------- 세미나 자료 부록: 4큐비트 위험구역 회로 ----------
def zone_encode(distances, quality):           # 거리 3개와 신뢰도를 0~1 입력으로 바꿈
    scales = (120.0, 180.0, 100.0)             # 위험구역, 야생동물, 낙석 기준 거리임
    if len(distances) != 3 or not 0 <= quality <= 1:      # 입력 형식이 틀리면
        raise ValueError("expected three distances and quality in [0, 1]")   # 오류를 냄
    if quality < 0.6 or any(d is None for d in distances):   # 신뢰도가 낮거나 자료가 없으면
        return None                            # 판독을 보류함
    return [max(0.0, min(1.0, 1 - d / r)) for d, r in zip(distances, scales)] + [quality]   # 가까울수록 1임


def zone_circuit(x):                           # 4큐비트 회로를 실행해 큐비트별 P(1)을 돌려줌
    s = State(4)                               # 진폭 16개 상태임
    for q, v in enumerate(x):                  # 네 입력을
        s.ry(q, math.pi * v)                   # 네 큐비트의 회전 각도로 넣음
    for c, t in ((0, 3), (1, 3), (2, 3)):      # 세 위험 큐비트를
        s.cx(c, t)                             # 보조 큐비트 q3에 연결함
    for q in range(3):                         # 세 위험 큐비트를
        s.ry(q, math.pi * x[3] / 12)           # 신뢰도만큼 보정 회전함
    assert abs(s.norm() - 1) < 1e-9            # 확률 총합이 1인지 확인함
    return [s.prob_one(q) for q in range(4)]   # 판독값 4개임


def zone_assess(distances, quality, closed=False):   # 정책 우선 판단 절차임
    if closed:                                 # 공식 통제면
        return {"action": "block_route"}       # 바로 경로 후보에서 제외함
    x = zone_encode(distances, quality)        # 입력을 부호화함
    if x is None:                              # 자료가 부족하면
        return {"action": "check_sources"}     # 출처 확인을 요청함
    p = zone_circuit(x)                        # 회로를 실행함
    return {"action": "score_only", "classical": x[:3], "quantum": p[:3], "readout_ancilla": p[3]}   # 결과임
