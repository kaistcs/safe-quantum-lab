# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Downloads official Sookmyung CI and character images.
"""
fetch_brand.py : 숙명여자대학교 공식 홈페이지의 CI, 눈송이 캐릭터 원본 이미지를 내려받음

왜 쓰는가 : 웹 실험실 화면(왼쪽 위 로고, 서명, 대문, 관제실 산행자)에 숙명 CI와
           눈송이 캐릭터를 쓰기 위함임. 숙명여대 규정(임의 변형 금지, 정비례 확대/축소)을 따라
           원본 파일을 그대로 저장하고 화면에서는 크기만 조절함.
출처      : https://www.sookmyung.ac.kr/kr/intro/ui.do , /kr/intro/character.do
사용법    : python tools\\fetch_brand.py   (setup.bat 이 자동 실행)
"""
import os                                      # 경로 도구임 / path tools
import urllib.request                          # 내려받기 도구임 / download tool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)
UI = "https://www.sookmyung.ac.kr/_res/sookmyung/kr/img/intro/ui/"        # 공식 UI 이미지 주소임 / official UI image URL
CH = "https://www.sookmyung.ac.kr/_res/sookmyung/kr/img/intro/symbol/"    # 공식 캐릭터 이미지 주소임 / official character image URL
FILES = [UI + n for n in ["img-ui-symbol01.png", "img-horizontal-logo02.png", "img-emblem01.png", "img-slogan-horizontal03.png"]] + \
        [CH + n for n in ["img-character01.png"] + ["img-character-var0%d.png" % k for k in range(1, 9)] + ["img-character-var09-01.png"]]   # 내려받을 파일 목록임 / files to download


def main():                                    # 시작점임 / entry point
    vs = sorted([d for d in os.listdir(os.path.join(ROOT, "versions")) if d[1:].isdigit()], key=lambda d: int(d[1:]))   # 버전 목록임 / version list
    out = os.path.join(ROOT, "versions", vs[-1], "web", "brand")   # 최신 버전 brand 폴더임 / brand folder of the latest version
    os.makedirs(out, exist_ok=True)            # 폴더를 만듦 / create the folder
    ok = 0                                     # 성공 수임 / success count
    for url in FILES:                          # 파일마다 / for each file
        dst = os.path.join(out, url.split("/")[-1])   # 저장 경로임 / output path
        try:                                   # 내려받기를 시도함 / try to download
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (SMU AGI Lab QP)"})   # 브라우저처럼 요청함 / request like a browser
            data = urllib.request.urlopen(req, timeout=15).read()   # 원본을 받음 / fetch the original
            open(dst, "wb").write(data); ok += 1   # 그대로 저장함 / save as is
            print("saved", dst, len(data), "bytes")   # 진행을 알림 / report progress
        except Exception as e:                 # 실패하면 / on failure
            print("fail", url, e)              # 알리고 계속함(화면은 공식 주소에서 직접 불러오기를 시도함) / report and continue (the page tries the official URL directly)
    print(ok, "/", len(FILES), "files ->", out)   # 결과를 알림 / report the result


if __name__ == "__main__":                     # 직접 실행했을 때만 / only when run directly
    main()                                     # 시작점을 호출함 / call the entry point
