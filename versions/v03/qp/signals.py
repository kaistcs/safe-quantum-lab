# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Python definitions of the 20 monitored signals.
"""
signals.py : 20개 감시 신호와 회로가 묶어 볼 신호 쌍 정의 (web/js/data.js 와 같음)
왜 쓰는가 : 웹, 파이썬, CSV가 모두 같은 열 이름과 순서를 쓰게 하기 위함임.
"""
SIGNALS = [                                    # (그룹, 한국어 이름, CSV 열 이름) 목록임 / list of (group, Korean name, CSV column)
    ("몸 상태", "심박 부담", "hr_load"), ("몸 상태", "피로", "fatigue"), ("몸 상태", "증상 신고", "symptom"),
    ("기상과 시간", "강수", "rain"), ("기상과 시간", "강풍", "wind"), ("기상과 시간", "낙뢰 경보", "lightning"),
    ("기상과 시간", "폭염", "heat"), ("기상과 시간", "결빙", "ice"), ("기상과 시간", "일몰 여유 부족", "sunset"),
    ("경로와 지형", "급경사", "slope"), ("경로와 지형", "경로 이탈", "offroute"), ("경로와 지형", "하산 지연", "delay"),
    ("경로와 지형", "낙석 접근", "rockfall"), ("경로와 지형", "야생동물 신고 지역", "wildlife"), ("경로와 지형", "절벽 접근", "cliff"),
    ("장치와 구조", "위치 품질 저하", "gps_bad"), ("장치와 구조", "통신 불안정", "net_bad"), ("장치와 구조", "배터리 부족", "battery"),
    ("장치와 구조", "낙상과 미응답", "fall"), ("장치와 구조", "공식 출입 통제", "closed"),
]
COLUMNS = [s[2] for s in SIGNALS]              # CSV 열 이름만 모은 목록임 / list of CSV column names only
EXCLUSIONS = {2, 5, 18, 19}                    # 즉시 안전 규칙으로 처리해 학습에서 빼는 신호 번호임 / signals handled by immediate safety rules and removed from training
PAIRS = [(3, 9), (0, 1), (8, 11), (16, 17), (7, 9), (10, 14)]   # 함께 높을 때 위험한 신호 쌍(비-경사 등)임 / signal pairs dangerous when high together (rain-slope etc.)
