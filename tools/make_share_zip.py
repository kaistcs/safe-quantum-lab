# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Builds a clean zip for students: excludes the git history, logs and local environments so it runs anywhere.
"""
make_share_zip.py : 학생에게 나눠 줄 깨끗한 압축 파일을 만듦 / builds a clean zip to hand out to students
  - 빼는 것 / excluded: .git(교수님 GitHub 연결, 자동 저장), logs, .venv, __pycache__, 이전 압축 파일
  - 결과 / output: 프로젝트 폴더 옆에 QP_학생배포_YYYYMMDD.zip / next to the project folder
"""
import datetime, os, sys, zipfile   # 표준 모듈 / standard modules

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트 / project root
SKIP_DIRS = {".git", "logs", ".venv", "__pycache__", ".pytest_cache", "node_modules"}   # 뺄 폴더 / folders to skip
SKIP_EXT = {".zip", ".pyc"}                                          # 뺄 파일 종류 / file types to skip


def main():                                                          # 실행 진입점 / entry point
    stamp = datetime.date.today().strftime("%Y%m%d")                 # 날짜 / date
    out = os.path.join(os.path.dirname(ROOT), "QP_학생배포_" + stamp + ".zip")   # 결과 파일 / output file
    base = os.path.basename(ROOT)                                    # 압축 안 최상위 폴더 이름 / top folder name inside the zip
    n = 0                                                            # 파일 수 / file count
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:       # 압축 시작 / start zipping
        for d, dirs, files in os.walk(ROOT):                         # 폴더를 돎 / walk folders
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS]        # 뺄 폴더 제외 / drop skipped folders
            for f in files:                                          # 파일마다 / for each file
                if os.path.splitext(f)[1].lower() in SKIP_EXT: continue   # 뺄 종류 / skip type
                p = os.path.join(d, f)                               # 전체 경로 / full path
                z.write(p, os.path.join(base, os.path.relpath(p, ROOT)))   # 압축에 넣음 / add to zip
                n += 1
    print("완료 / done:", out, "(" + str(n) + " files)")             # 결과 안내 / report
    return 0


if __name__ == "__main__":                                           # 직접 실행할 때만 / only when run directly
    sys.exit(main())
