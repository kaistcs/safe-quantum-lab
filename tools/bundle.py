# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Bundles a version into one self-contained HTML file.
"""
bundle.py : 웹 실험실을 "파일 하나짜리 HTML"로 묶음

왜 쓰는가 : 이메일, 메신저로 보내거나 claude.ai 등 웹에 올릴 때 파일 하나면 편하기 때문임.
하는 일   : index.html 안의 css, js를 그 자리에 넣고, 사진은 data: 주소로 바꿈.
           (음성 MP3는 크기 때문에 넣지 않음 → 브라우저 TTS로 자동 대체)
사용법    : python tools\\bundle.py [버전]  → versions\\vNN\\산행안전_양자실험실_vNN.html
"""
import base64                                  # 사진을 글자(base64)로 바꾸는 도구임 / tool to turn images into text (base64)
import json                                    # 사진표를 JS 글자로 바꾸는 도구임 / tool to turn the image table into JS text
import os                                      # 경로 도구임 / path tools
import re                                      # 문자열 찾기 도구임 / string search tool
import sys                                     # 명령줄 인자 도구임 / command-line argument tool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)
vs = sorted([d for d in os.listdir(os.path.join(ROOT, "versions")) if d[1:].isdigit()], key=lambda d: int(d[1:]))   # 버전 목록임 / version list
ver = sys.argv[1] if len(sys.argv) > 1 else vs[-1]   # 묶을 버전임(기본 최신) / version to bundle (default latest)
web = os.path.join(ROOT, "versions", ver, "web")   # 웹 폴더임 / web folder
html = open(os.path.join(web, "index.html"), encoding="utf-8").read()   # 첫 화면 파일을 읽음 / read the entry page


def read(rel):                                 # 웹 폴더 기준 파일을 글자로 읽음 / read a file relative to the web folder as text
    return open(os.path.join(web, rel), encoding="utf-8").read()   # 내용을 돌려줌 / return the content


html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: "<style>\n" + read(m.group(1)) + "\n</style>", html)   # css를 그 자리에 넣음 / inline the CSS in place
html = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>\n" + read(m.group(1)).replace("</script", "<\\/script") + "\n</script>", html)   # js를 그 자리에 넣음 / inline the JS in place


imgs = {}                                      # 내장할 이미지 표임 / table of images to embed
for folder in ("img", "brand"):                # 사진 폴더와 숙명 CI 폴더를 모두 살펴봄 / scan both the image folder and the Sookmyung CI folder
    d = os.path.join(web, folder)              # 폴더 경로임 / folder path
    if not os.path.isdir(d):                   # 없으면 / if missing
        continue                               # 건너뜀 / skip
    for n in os.listdir(d):                    # 파일마다 / for each file
        mime = "image/png" if n.lower().endswith(".png") else "image/jpeg"   # 형식임 / format
        uri = "data:" + mime + ";base64," + base64.b64encode(open(os.path.join(d, n), "rb").read()).decode()   # data 주소로 바꿈 / convert to a data URL
        imgs[folder + "/" + n] = uri; imgs[n] = uri   # "brand/파일"과 "파일" 두 이름으로 모두 찾을 수 있게 함 / findable both as "brand/file" and "file"
html = html.replace("<script>", "<script>window.QP_IMG = " + json.dumps(imgs) + "; // 묶음본 전용 내장 사진표임\n</script>\n<script>", 1)   # 첫 스크립트 앞에 사진표를 넣음 / put the image table before the first script
out = os.path.join(ROOT, "versions", ver, f"산행안전_양자실험실_{ver}.html")   # 저장 경로임 / output path
open(out, "w", encoding="utf-8").write(html)   # 저장함 / save
print("bundled", out, round(len(html) / 1024), "KB")   # 결과를 알림 / report the result
