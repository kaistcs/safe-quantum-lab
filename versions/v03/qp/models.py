# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Python feature builders and logistic models matching the web version.
"""
models.py : 특징 변환, 로지스틱 회귀 학습, 공정 비교 실험, 4큐비트 위험구역 회로

왜 쓰는가 : 일반 AI / 양자 특징 AI / 일반 수식 대조군 / 샷 측정 양자 AI 를
           같은 데이터, 같은 학습, 같은 오경보 예산으로 비교하기 위함임.
웹 버전   : web/js/models.js 와 같은 순서로 계산하므로 숫자가 거의 같게 나옴.
"""
import math                                    # 수학 함수에 씀 / used for math functions
import time                                    # 실행 시간 측정에 씀 / used to measure run time

from .emulator import LCG, State, sample_prob  # 같은 패키지의 에뮬레이터를 불러옴 / import the emulator from the same package
from .signals import EXCLUSIONS, PAIRS         # 규칙 신호와 신호 쌍 정의를 불러옴 / import rule-signal and signal-pair definitions
from .data.synthetic import sample_set         # 합성 데이터 생성기를 불러옴 / import the synthetic data generator


def pair_circuit(a, b):                        # 두 신호를 받는 2큐비트 회로임 / 2-qubit circuit taking two signals
    s = State(2)                               # |00>에서 시작함 / start from |00>
    s.ry(0, math.pi * a)                       # 첫 신호를 회전 각도로 넣음 / put the first signal in as a rotation angle
    s.ry(1, math.pi * b)                       # 둘째 신호를 회전 각도로 넣음 / put the second signal in as a rotation angle
    s.cx(0, 1)                                 # 두 큐비트를 얽음 / entangle the two qubits
    return s                                   # 판독 전 상태를 돌려줌 / return the state before readout


def pair_exact(a, b):                          # 정확 판독한 겹침 특징 <Z1>임 / overlap feature <Z1> read exactly
    return pair_circuit(a, b).expect_z(1)      # 둘째 큐비트 기댓값임 / expectation of the second qubit


def pair_analytic(a, b):                       # 같은 값을 수식으로 계산한 대조군임 / control computing the same value by formula
    return math.cos(math.pi * a) * math.cos(math.pi * b)   # cos 곱과 수학적으로 같음 / mathematically equal to the cos product


def pair_product(a, b):                        # 고전 곱 대조군임 / classical product control
    return a * b                               # 두 신호를 곱함 / multiply the two signals


def pair_zz(a, b):                             # Havlíček et al.(2019) ZZ 특징 맵(깊이 2)임 / Havlíček et al. (2019) ZZ feature map (depth 2)
    s = State(2)                               # |00>에서 시작함 / start from |00>
    x0, x1 = math.pi * a, math.pi * b          # 0~π 각도로 바꿈 / convert to an angle 0~π
    for _ in range(2):                         # 블록을 두 번 반복함 / repeat the block twice
        s.h(0).h(1)                            # 반반 섞음 / mix half and half
        s.rz(0, 2 * x0).rz(1, 2 * x1)          # 신호를 위상으로 넣음 / put the signal in as a phase
        s.cx(0, 1).rz(1, 2 * (math.pi - x0) * (math.pi - x1)).cx(0, 1)   # 곱 위상을 넣음 / put in the product phase
    return s.expect_zz(0, 1)                   # Z⊗Z 기댓값임 / Z⊗Z expectation


def features(x, method, ctx=None):             # 방식별 특징 목록을 만듦 / builds the feature list per method
    base = [v for i, v in enumerate(x) if i not in EXCLUSIONS]   # 규칙 신호 4개를 뺀 16개임 / 16 signals without the 4 rule signals
    if method == "linear":                     # 일반 AI면 / for the classical AI
        return base                            # 원래 값만 씀 / use only the original values
    extra = []                                 # 결합 특징 6개를 담을 목록임 / list for the 6 combined features
    for i, j in PAIRS:                         # 신호 쌍마다 / for each signal pair
        a, b = x[i], x[j]                      # 두 값을 꺼냄 / take the two values
        if method == "analytic":               # 대조군이면 / for the control
            extra.append(pair_analytic(a, b))  # 수식으로 계산함 / compute by formula
            continue                           # 다음 쌍으로 감 / go to the next pair
        if method == "product":                # 고전 곱 대조군이면 / for the classical product control
            extra.append(pair_product(a, b))   # 곱을 씀 / use the product
            continue                           # 다음 쌍으로 감 / go to the next pair
        if method == "zz":                     # ZZ 회로면 / for the ZZ circuit
            extra.append(pair_zz(a, b))        # 다른 양자 회로 특징을 씀 / use the other quantum circuit feature
            continue                           # 다음 쌍으로 감 / go to the next pair
        z = pair_exact(a, b)                   # 회로를 실행함 / run the circuit
        if method == "shots" and ctx and ctx.get("shots"):   # 샷 모드면 / in shot mode
            est = sample_prob((1 - z) / 2, ctx["shots"], ctx["rand"])   # 유한 번 측정한 추정값임 / estimate from finitely many measurements
            if ctx.get("noise"):               # 잡음이 있으면 / if there is noise
                est = est * (1 - ctx["noise"]) + ctx["noise"] * 0.5     # 0.5쪽으로 흐려짐 / blurred toward 0.5
            z = 1 - 2 * est                    # <Z> 형태로 되돌림 / convert back to <Z> form
        extra.append(z)                        # 특징을 추가함 / add the feature
    return base + extra                        # 22개 특징을 돌려줌 / return 22 features


def _sigmoid(z):                               # 숫자를 0~1 확률로 바꿈 / turns a number into a 0~1 probability
    return 1 / (1 + math.exp(-z))              # 로지스틱 함수임 / logistic function


def _score(w, f):                              # 가중치와 특징으로 점수를 계산함 / computes the score from weights and features
    z = w[0]                                   # 절편에서 시작함 / start from the bias
    for i, v in enumerate(f):                  # 특징마다 / for each feature
        z += w[i + 1] * v                      # 가중치를 곱해 더함 / add weight times feature
    return _sigmoid(z)                         # 0~1 점수임 / 0~1 score


def fit(samples, method, ctx=None, epochs=160, lr=0.65, l2=0.004):   # 방식별 모델을 학습함 / trains a model per method
    rows = [(features(x, method, ctx), y) for x, y in samples]       # 특징을 미리 계산함 / precompute the features
    w = [0.0] * (len(rows[0][0]) + 1)          # 가중치를 0에서 시작함 / start the weights at 0
    for _ in range(epochs):                    # 정해진 횟수만큼 반복함 / repeat a fixed number of times
        g = [0.0] * len(w)                     # 기울기 누적임 / gradient accumulators
        for f, y in rows:                      # 모든 표본을 봄 / visit every sample
            err = _score(w, f) - y             # 예측 오차임 / prediction error
            g[0] += err                        # 절편 기울기임 / bias gradient
            for i, v in enumerate(f):          # 특징마다 / for each feature
                g[i + 1] += err * v            # 기울기를 누적함 / accumulate the gradient
        for i in range(len(w)):                # 가중치마다 / for each weight
            w[i] -= lr * (g[i] / len(rows) + (l2 * w[i] if i else 0))   # 오차가 줄어드는 쪽으로 고침 / update in the direction that reduces error
    return lambda x, c=None: _score(w, features(x, method, c or ctx))   # 예측 함수를 돌려줌 / return the predict function


def cutoff(valid, predict):                    # 검증 정상의 상위 약 10%를 경보 기준으로 정함 / sets the alarm threshold at about the top 10% of normal validation scores
    neg = sorted(predict(x) for x, y in valid if not y)   # 정상 점수를 정렬함 / sort the normal scores
    return neg[math.ceil(len(neg) * 0.90) - 1] + 1e-9     # 경계값임 / boundary value


def auc(scores, labels):                       # ROC-AUC(위험을 정상보다 높게 매긴 비율)임 / ROC-AUC (share of risk scored above normal)
    pos = [s for s, y in zip(scores, labels) if y]        # 위험 점수임 / risk scores
    neg = sorted(s for s, y in zip(scores, labels) if not y)   # 정상 점수(정렬)임 / normal scores (sorted)
    import bisect                              # 이분 탐색 도구임 / binary search tool
    win = sum(bisect.bisect_left(neg, p) for p in pos)    # 위험이 이긴 쌍의 수임 / number of pairs where risk wins
    return win / (len(pos) * len(neg) or 1)    # 비율임 / proportion


def measure(test, predict, thr):               # 탐지율, 오경보율, AUC를 셈 / computes detection rate, false-alarm rate and AUC
    sc = [predict(x) for x, _ in test]         # 시험 점수임 / test scores
    lab = [y for _, y in test]                 # 정답임 / labels
    P = sum(lab); N = len(lab) - P             # 위험, 정상 수임 / counts of risk and normal
    tp = sum(1 for s, y in zip(sc, lab) if y and s >= thr)       # 맞힌 위험임 / risks caught
    fp = sum(1 for s, y in zip(sc, lab) if not y and s >= thr)   # 잘못 울린 정상임 / normals that rang wrongly
    prec = tp / max(1, tp + fp); rec = tp / (P or 1)   # 정밀도와 재현율임 / precision and recall
    return {"recall": rec, "falseAlarm": fp / (N or 1), "precision": prec, "f1": 2 * prec * rec / max(1e-9, prec + rec), "auc": auc(sc, lab), "P": P, "N": N}   # 결과임(F1 포함) / results (including F1)


def experiment(data=None, shots=0, noise=0.0, seed=7):   # 공정 비교 실험 전체임 / the whole fair comparison experiment
    if data is None:                           # 데이터가 없으면 기본 합성 데이터를 씀 / use default synthetic data if none
        data = {"train": sample_set(901, 1400), "valid": sample_set(902, 550), "test": sample_set(903, 800)}   # 웹과 같은 씨앗임 / same seed as the web
    methods = ["linear", "quantum", "analytic", "product", "zz"] + (["shots"] if shots else [])   # 비교할 방식들임(웹과 같음) / methods to compare (same as the web)
    out = []                                   # 결과 목록임 / result list
    for m in methods:                          # 방식마다 / for each method
        ctx = {"shots": shots, "noise": noise, "rand": LCG(seed)} if m == "shots" else None   # 샷 설정임 / shot settings
        t0 = time.perf_counter()               # 시작 시각임 / start time
        predict = fit(data["train"], m, ctx)   # 학습함 / train
        thr = cutoff(data["valid"], predict)   # 경보 기준을 정함 / set the alarm threshold
        res = measure(data["test"], predict, thr)   # 시험함 / test
        res.update({"key": m, "threshold": thr, "ms": (time.perf_counter() - t0) * 1000})   # 정보를 덧붙임 / attach info
        out.append(res)                        # 목록에 넣음 / add to the list
    return out                                 # 결과를 돌려줌 / return the results


# ---------- 세미나 자료 부록: 4큐비트 위험구역 회로 / Seminar appendix: 4-qubit risk-zone circuit  ----------
def zone_encode(distances, quality):           # 거리 3개와 신뢰도를 0~1 입력으로 바꿈 / turns three distances and reliability into 0~1 inputs
    scales = (120.0, 180.0, 100.0)             # 위험구역, 야생동물, 낙석 기준 거리임 / reference distances for risk zone, wildlife, rockfall
    if len(distances) != 3 or not 0 <= quality <= 1:      # 입력 형식이 틀리면 / if the input format is wrong
        raise ValueError("expected three distances and quality in [0, 1]")   # 오류를 냄 / raise an error
    if quality < 0.6 or any(d is None for d in distances):   # 신뢰도가 낮거나 자료가 없으면 / if reliability is low or data is missing
        return None                            # 판독을 보류함 / withhold the readout
    return [max(0.0, min(1.0, 1 - d / r)) for d, r in zip(distances, scales)] + [quality]   # 가까울수록 1임 / 1 when closer


def zone_circuit(x):                           # 4큐비트 회로를 실행해 큐비트별 P(1)을 돌려줌 / runs the 4-qubit circuit and returns P(1) per qubit
    s = State(4)                               # 진폭 16개 상태임 / 16-amplitude state
    for q, v in enumerate(x):                  # 네 입력을 / the four inputs
        s.ry(q, math.pi * v)                   # 네 큐비트의 회전 각도로 넣음 / as rotation angles of the four qubits
    for c, t in ((0, 3), (1, 3), (2, 3)):      # 세 위험 큐비트를 / the three risk qubits
        s.cx(c, t)                             # 보조 큐비트 q3에 연결함 / connected to ancilla qubit q3
    for q in range(3):                         # 세 위험 큐비트를 / the three risk qubits
        s.ry(q, math.pi * x[3] / 12)           # 신뢰도만큼 보정 회전함 / correction rotation by reliability
    assert abs(s.norm() - 1) < 1e-9            # 확률 총합이 1인지 확인함 / check the total probability is 1
    return [s.prob_one(q) for q in range(4)]   # 판독값 4개임 / four readout values


def zone_assess(distances, quality, closed=False):   # 정책 우선 판단 절차임 / policy-first decision procedure
    if closed:                                 # 공식 통제면 / if officially closed
        return {"action": "block_route"}       # 바로 경로 후보에서 제외함 / remove from route candidates immediately
    x = zone_encode(distances, quality)        # 입력을 부호화함 / encode the inputs
    if x is None:                              # 자료가 부족하면 / if data is insufficient
        return {"action": "check_sources"}     # 출처 확인을 요청함 / request source confirmation
    p = zone_circuit(x)                        # 회로를 실행함 / run the circuit
    return {"action": "score_only", "classical": x[:3], "quantum": p[:3], "readout_ancilla": p[3]}   # 결과임 / result
