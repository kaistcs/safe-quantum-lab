# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
"""
emulator.py : 양자 회로 상태벡터 에뮬레이터 (Python 표준 라이브러리만 사용)

왜 쓰는가 : 실제 양자컴퓨터 없이 일반 PC 메모리에서 큐비트 상태(진폭 목록)를
           저장하고, 게이트를 행렬 계산으로 흉내 내기 위함임.
하는 일   : n큐비트 상태 생성, RY/RX/RZ/H/X/CNOT/CZ 게이트, 정확 판독,
           샷(유한 번 측정) 흉내, 메모리 계산.
웹 버전   : web/js/emulator.js 와 같은 계산을 함(결과 비교 가능).
세미나 자료 부록의 ry(), cx() 코드와 같은 규칙을 따름.
"""
import cmath                                   # 복소수 지수 함수(RZ 위상)에 씀
import math                                    # cos, sin, pi 등 수학 함수에 씀


class State:                                   # n큐비트 상태벡터를 담는 클래스임
    def __init__(self, n):                     # 큐비트 수 n으로 새 상태를 만듦
        self.n = n                             # 큐비트 수를 기록함
        self.size = 1 << n                     # 가능한 결과 수 2^n을 계산함
        self.amp = [0j] * self.size            # 모든 진폭을 복소수 0으로 채움
        self.amp[0] = 1 + 0j                   # 처음에는 |00..0> 상태(확률 100%)임

    def _apply1(self, q, a, b, c, d):          # 2x2 행렬 [[a,b],[c,d]]를 큐비트 q에 적용함
        bit = 1 << q                           # q번 큐비트를 가리키는 마스크임
        for i in range(self.size):             # 모든 진폭 위치를 살펴봄
            if i & bit:                        # q비트가 1인 위치는 짝에서 함께 처리하므로
                continue                       # 건너뜀
            j = i | bit                        # q비트만 1로 바꾼 짝 위치임
            x, y = self.amp[i], self.amp[j]    # 두 진폭을 꺼냄
            self.amp[i] = a * x + b * y        # 행렬 첫 줄을 곱한 새 진폭임
            self.amp[j] = c * x + d * y        # 행렬 둘째 줄을 곱한 새 진폭임
        return self                            # 연속 호출이 가능하도록 자신을 돌려줌

    def ry(self, q, angle):                    # y축 회전: 입력값을 확률로 바꾸는 데 씀
        c, s = math.cos(angle / 2), math.sin(angle / 2)   # 회전 성분임
        return self._apply1(q, c, -s, s, c)    # [[c,-s],[s,c]]를 적용함

    def rx(self, q, angle):                    # x축 회전 게이트임
        c, s = math.cos(angle / 2), math.sin(angle / 2)   # 회전 성분임
        return self._apply1(q, c, -1j * s, -1j * s, c)    # [[c,-is],[-is,c]]를 적용함

    def rz(self, q, angle):                    # z축 회전(위상만 바꿈)임
        return self._apply1(q, cmath.exp(-0.5j * angle), 0, 0, cmath.exp(0.5j * angle))  # 대각 행렬을 적용함

    def h(self, q):                            # 하다마드: 0과 1을 반반 섞음
        r = 1 / math.sqrt(2)                   # 1/√2 값임
        return self._apply1(q, r, r, r, -r)    # [[1,1],[1,-1]]/√2를 적용함

    def x(self, q):                            # NOT: 0과 1을 맞바꿈
        return self._apply1(q, 0, 1, 1, 0)     # [[0,1],[1,0]]을 적용함

    def cx(self, control, target):             # CNOT: 제어가 1이면 대상을 뒤집음
        cb, tb = 1 << control, 1 << target     # 두 큐비트의 마스크임
        for i in range(self.size):             # 모든 위치를 살펴봄
            if i & cb and not i & tb:          # 제어=1, 대상=0인 위치만 골라
                j = i | tb                     # 대상 비트를 1로 바꾼 짝과
                self.amp[i], self.amp[j] = self.amp[j], self.amp[i]   # 진폭을 맞바꿈
        return self                            # 자신을 돌려줌

    def cz(self, a, b):                        # CZ: 둘 다 1이면 부호를 뒤집음
        m = (1 << a) | (1 << b)                # 두 큐비트 마스크임
        for i in range(self.size):             # 모든 위치를 살펴봄
            if i & m == m:                     # 둘 다 1인 위치면
                self.amp[i] = -self.amp[i]     # 진폭에 -1을 곱함
        return self                            # 자신을 돌려줌

    def probs(self):                           # 각 결과의 정확한 확률 목록임
        return [abs(a) ** 2 for a in self.amp]  # |진폭|^2 = 확률임

    def prob_one(self, q):                     # q번 큐비트가 1일 확률임
        bit = 1 << q                           # 마스크임
        return sum(abs(a) ** 2 for i, a in enumerate(self.amp) if i & bit)  # q비트가 1인 확률을 모두 더함

    def expect_z(self, q):                     # Z 기댓값 = P(0) - P(1)
        return 1 - 2 * self.prob_one(q)        # -1~+1 사이 값임

    def norm(self):                            # 확률 총합(항상 1이어야 함)임
        return sum(self.probs())               # 검사용으로 씀


class LCG:                                     # 웹 버전과 똑같은 난수열을 내는 생성기임
    def __init__(self, seed):                  # 씨앗으로 시작함
        self.x = seed & 0xFFFFFFFF             # 32비트 부호 없는 정수로 맞춤

    def __call__(self):                        # 호출할 때마다 0~1 난수를 하나 돌려줌
        self.x = (self.x * 1664525 + 1013904223) & 0xFFFFFFFF   # JS의 Math.imul 방식과 같은 계산임
        return self.x / 4294967296             # 0 이상 1 미만으로 바꿈


def sample_prob(p, shots, rand):               # 확률 p를 shots번 측정해 추정함
    if not shots:                              # 샷 0이면
        return p                               # 정확한 값을 그대로 씀
    if shots > 200:                            # 샷이 많으면 정규 근사로 빠르게 계산함
        sd = math.sqrt(p * (1 - p) / shots)    # 비율의 표준편차임
        u1, u2 = max(rand(), 1e-12), rand()    # 박스-뮬러용 난수 두 개임
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)   # 표준정규 난수임
        return min(1.0, max(0.0, p + sd * z))  # 0~1로 자른 추정값임
    return sum(1 for _ in range(shots) if rand() < p) / shots   # 직접 shots번 던져 비율을 셈


def memory_bytes(n):                           # n큐비트 상태벡터의 메모리(바이트)임
    return (2 ** n) * 16                       # 복소수 하나 = 16바이트임
