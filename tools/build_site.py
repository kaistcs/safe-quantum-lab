# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Builds the GitHub Pages site from version folders.
"""
build_site.py : GitHub Pages(웹 주소로 어디서나 접속)용 정적 사이트를 만듦

하는 일 : versions\\v01\\dist → _site\\v01, versions\\vNN\\web → _site\\vNN 으로 복사하고,
         _site\\index.html 은 최신 버전으로 이동하는 안내 페이지로 만듦.
사용법  : python tools\\build_site.py   (GitHub Actions pages.yml 이 자동 실행)
"""
import os                                      # 경로 도구임 / path tools
import shutil                                  # 복사 도구임 / copy tools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 저장소 최상위임 / repository root
SITE = os.path.join(ROOT, "_site")             # 결과 폴더임 / output folder
shutil.rmtree(SITE, ignore_errors=True)        # 이전 결과를 지움 / remove previous output
vs = sorted([d for d in os.listdir(os.path.join(ROOT, "versions")) if d[1:].isdigit()], key=lambda d: int(d[1:]))   # 버전 목록임 / version list
for v in vs:                                   # 버전마다 / for each version
    base = os.path.join(ROOT, "versions", v)   # 버전 폴더임 / version folder
    src = os.path.join(base, "web") if os.path.isdir(os.path.join(base, "web")) else os.path.join(base, "dist")   # 웹 폴더를 고름 / pick the web folder
    shutil.copytree(src, os.path.join(SITE, v))   # 사이트에 복사함 / copy into the site
links = "".join(f'<li><a href="{v}/">{v}</a></li>' for v in reversed(vs))   # 버전 목록 링크임 / links to versions
open(os.path.join(SITE, "index.html"), "w", encoding="utf-8").write(   # 첫 페이지를 씀 / write the front page
    f'<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={vs[-1]}/">'
    f'<title>산행안전 양자 실험실</title></head><body><p>최신 버전 {vs[-1]}로 이동합니다.</p><ul>{links}</ul></body></html>')   # 최신 버전으로 자동 이동함 / auto-redirect to the latest version
open(os.path.join(SITE, ".nojekyll"), "w").close()   # GitHub Pages의 파일 변환을 끔 / turn off GitHub Pages file processing
print("built", SITE, vs)                       # 결과를 알림 / report the result
