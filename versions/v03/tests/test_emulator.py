# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Tests for the emulator against seminar-appendix expected values.
"""
test_emulator.py : 에뮬레이터와 모델이 올바른지 자동으로 확인하는 시험(pytest)
실행 : setup.bat 후  python -m pytest -q  (versions/v03 폴더에서)
"""
import math                                    # 수학 함수임 / math functions
import random                                  # 무작위 입력용임 / for random inputs

from qp.emulator import State, LCG             # 검사 대상 에뮬레이터임 / emulator under test
from qp.models import pair_exact, pair_analytic, zone_assess, experiment   # 검사 대상 모델임 / models under test
from qp.data.synthetic import sample_set       # 검사 대상 합성 데이터임 / synthetic data under test


def test_norm_preserved():                     # 게이트를 여러 번 적용해도 확률 합이 1인지 확인함 / checks that probabilities sum to 1 after many gates
    s = State(3)                               # 3큐비트 상태임 / 3-qubit state
    for q in range(3):                         # 큐비트마다 / for each qubit
        s.h(q).ry(q, 0.7).rz(q, 1.1)           # 여러 게이트를 적용함 / apply several gates
    s.cx(0, 1).cz(1, 2)                        # 두 큐비트 게이트도 적용함 / also apply two-qubit gates
    assert abs(s.norm() - 1) < 1e-12           # 총합이 1이어야 함 / the total must be 1


def test_cnot_truth_table():                   # CNOT 진리표를 확인함 / checks the CNOT truth table
    for c in (0, 1):                           # 제어 큐비트 값마다 / for each control value
        for t in (0, 1):                       # 대상 큐비트 값마다 / for each target value
            s = State(2)                       # |00>에서 시작함 / start from |00>
            if c: s.x(0)                       # 제어를 c로 맞춤 / set the control to c
            if t: s.x(1)                       # 대상을 t로 맞춤 / set the target to t
            s.cx(0, 1)                         # CNOT을 적용함 / apply CNOT
            expect = c | ((t ^ c) << 1)        # 기대 결과 위치임 / expected outcome position
            assert abs(s.probs()[expect] - 1) < 1e-12   # 그 위치 확률이 1이어야 함 / that position must have probability 1


def test_pair_equals_analytic():               # 2큐비트 회로 = cos 곱 대조군인지 확인함 / checks the 2-qubit circuit equals the cos-product control
    rnd = random.Random(0)                     # 고정 난수임 / fixed random generator
    for _ in range(100):                       # 100번 무작위로 검사함 / test 100 random cases
        a, b = rnd.random(), rnd.random()      # 두 입력임 / two inputs
        assert abs(pair_exact(a, b) - pair_analytic(a, b)) < 1e-12   # 값이 같아야 함 / values must be equal


def test_zone_fixtures_from_seminar():         # 세미나 자료 부록의 기대 결과를 그대로 확인함 / checks the expected results from the seminar appendix as given
    fixtures = {"zone": (15, 260, 190), "wildlife": (220, 20, 170), "rockfall": (240, 300, 12), "clear": (220, 270, 180)}   # 예시 입력임 / example inputs
    for expected, (name, d) in enumerate(fixtures.items()):   # 예시마다 / for each example
        q = zone_assess(d, 0.95)["quantum"]    # 판독값임 / readout values
        if name != "clear":                    # 위험 예시면 / for a risk example
            assert max(range(3), key=q.__getitem__) == expected   # 해당 위험이 가장 높아야 함 / that risk must be the highest
        else:                                  # 안전 예시면 / for a safe example
            assert max(q) < 0.1                # 모두 낮아야 함 / all must be low
    assert zone_assess((None, 40, 50), 0.95)["action"] == "check_sources"   # 자료 없음 → 출처 확인 / no data → confirm source
    assert zone_assess((10, 40, 50), 0.4)["action"] == "check_sources"      # 신뢰도 낮음 → 출처 확인 / low reliability → confirm source
    assert zone_assess((None, 40, 50), 0.4, True)["action"] == "block_route"   # 통제 → 즉시 제외 / closed → exclude immediately


def test_lcg_matches_js():                     # 웹(JS)과 같은 난수열인지 첫 값으로 확인함 / checks the first value matches the web (JS) random sequence
    r = LCG(901)                               # 웹 기본 씨앗임 / default web seed
    assert abs(r() - ((901 * 1664525 + 1013904223) % 2**32) / 2**32) < 1e-15   # 같은 공식이어야 함 / must be the same formula


def test_synthetic_deterministic():            # 같은 씨앗이면 같은 데이터인지 확인함 / checks the same seed gives the same data
    assert sample_set(5, 20) == sample_set(5, 20)   # 두 번 만들어도 같아야 함 / must match when made twice


def test_quantum_feature_helps_on_synthetic(): # 합성 시험에서 결합 특징이 탐지율을 올리는지 확인함 / checks combined features raise detection on synthetic tests
    r = {m["key"]: m for m in experiment(shots=0)}   # 기본 실험을 실행함 / run the default experiment
    assert r["quantum"]["recall"] > r["linear"]["recall"]   # 양자 특징 AI가 더 많이 찾아야 함 / the quantum-feature AI must find more
    assert abs(r["quantum"]["recall"] - r["analytic"]["recall"]) < 1e-9   # 대조군과 같아야 함(정직성 확인) / must equal the control (honesty check)


def test_zz_feature_matches_web():             # 웹(JS)과 같은 ZZ 특징 맵 값인지 확인함 / checks ZZ feature-map values match the web (JS)
    from qp.models import pair_zz              # 검사 대상임 / under test
    assert abs(pair_zz(.3, .7) - 0.09549150281252652) < 1e-9   # 브라우저 계산값과 같아야 함 / must equal the browser computation
