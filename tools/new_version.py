# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Creates the next version folder from the latest one.
"""
new_version.py : 최신 버전 폴더를 복사해 다음 번호의 깨끗한 버전 폴더를 만듦

왜 쓰는가 : 버전마다 "그 시점의 깨끗한 코드"만 남기기 위함임(저장 공간보다 추적성을 우선).
하는 일   : versions\\vNN → versions\\vNN+1 복사(캐시, 결과, 가상환경 제외),
           VERSION 숫자 갱신, CHANGELOG에 새 항목 추가, 웹 화면의 버전 표시 갱신.
사용법    : python tools\\new_version.py ["변경 요약"]
"""
import datetime                                # 날짜 도구임 / date tool
import os                                      # 경로 도구임 / path tools
import shutil                                  # 폴더 복사 도구임 / folder copy tool
import sys                                     # 명령줄 인자 도구임 / command-line argument tool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)
VERS = os.path.join(ROOT, "versions")          # 버전 폴더임 / version folder
SKIP = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "results", ".venv", "*.log", "산행안전_양자실험실_*.html")   # 복사하지 않을 것들임 / things not to copy


def main():                                    # 시작점임 / entry point
    vs = sorted([d for d in os.listdir(VERS) if d.startswith("v") and d[1:].isdigit()], key=lambda d: int(d[1:]))   # 버전 목록임 / version list
    src = vs[-1]                               # 최신 버전임 / latest version
    dst = f"v{int(src[1:]) + 1:02d}"           # 다음 번호(v03 형식)임 / next number (v03 style)
    if os.path.exists(os.path.join(VERS, dst)):   # 이미 있으면 / if it already exists
        raise SystemExit(dst + " 폴더가 이미 있음")   # 덮어쓰지 않고 종료함 / exit without overwriting
    shutil.copytree(os.path.join(VERS, src), os.path.join(VERS, dst), ignore=SKIP)   # 깨끗하게 복사함 / copy cleanly
    num = dst[1:].lstrip("0") or "0"           # 버전 숫자임 / version number
    open(os.path.join(VERS, dst, "VERSION"), "w").write(f"0.{num}.0\n")   # VERSION을 갱신함 / update VERSION
    note = sys.argv[1] if len(sys.argv) > 1 else "(변경 내용을 적어 주세요)"   # 변경 요약임 / change summary
    log = os.path.join(VERS, dst, "CHANGELOG.md")   # 변경 기록 파일임 / changelog file
    old = open(log, encoding="utf-8").read() if os.path.exists(log) else "# CHANGELOG\n"   # 기존 기록을 읽음 / read the existing log
    head, _, rest = old.partition("\n")        # 첫 줄(제목)과 나머지로 나눔 / split into the first line (title) and the rest
    open(log, "w", encoding="utf-8").write(f"{head}\n\n## {dst} ({datetime.date.today()})\n- {src}에서 복사해 시작\n- {note}\n{rest}")   # 새 항목을 맨 위에 넣음 / put the new entry on top
    idx = os.path.join(VERS, dst, "web", "index.html")   # 웹 첫 화면 파일임 / web entry page
    if os.path.exists(idx):                    # 있으면 / if present
        t = open(idx, encoding="utf-8").read().replace(src + "</small>", dst + "</small>").replace("실험실 " + src, "실험실 " + dst)   # 화면의 버전 표시를 바꿈 / change the version label on the page
        open(idx, "w", encoding="utf-8").write(t)   # 저장함 / save
    print(f"{src} → {dst} 생성 완료: {os.path.join(VERS, dst)}")   # 결과를 알림 / report the result


if __name__ == "__main__":                     # 직접 실행했을 때만 / only when run directly
    main()                                     # 시작점을 호출함 / call the entry point
