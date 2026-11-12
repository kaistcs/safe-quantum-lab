# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Prints the latest version folder name.
"""latest.py : 최신 버전 폴더 이름(v02 등)을 출력함. 배치 파일이 이 값으로 폴더를 찾음."""
import os                                      # 경로 도구임 / path tools
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)
vs = sorted([d for d in os.listdir(os.path.join(ROOT, "versions")) if d[1:].isdigit()], key=lambda d: int(d[1:]))   # 버전 목록임 / version list
print(vs[-1])                                  # 최신 버전 이름을 출력함 / prints the latest version name
