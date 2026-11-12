# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Adds or checks the copyright header at the top of every program file.
"""
add_copyright.py : 모든 프로그램 파일 맨 위에 저작권 머리말을 넣음(이미 있으면 건너뜀, 여러 번 실행해도 안전)
사용법 : python tools/add_copyright.py          (넣기)
         python tools/add_copyright.py --check  (없는 파일만 알려 주고 바꾸지 않음, 배포 전 점검용)
대상   : .js .css .html .py .bat .sh .yml .md (versions/ 안의 모든 버전과 tools/, 루트 실행 파일)
"""
import os, sys                                       # 파일 목록, 명령줄 인자용 표준 모듈임 / standard modules for file lists and command-line arguments

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)
MARK = "숙명여자대학교 박영호 교수"         # 머리말이 이미 있는지 확인하는 표시 글자임 / marker text to check whether the header already exists
LINE1 = "Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved."   # 첫 줄임 / first line
BAT1 = "Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved."   # 배치 파일용 영문 첫 줄임 / English first line for batch files
BAT2 = "Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE."   # 배치 파일용 영문 둘째 줄임 / English second line for batch files
LINE2 = "행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름."   # 둘째 줄임 / second line
SKIP_DIRS = {".git", ".venv", "__pycache__", "node_modules", "_site", ".pytest_cache", "dist", "raw"}   # 건너뛸 폴더임 / folders to skip


def header(ext):                                     # 확장자별 주석 형식의 머리말을 만듦 / builds the header in each file type's comment style
    if ext in (".js", ".css"):                       # 자바스크립트, 스타일 파일은 블록 주석임 / JavaScript and CSS use block comments
        return "/* " + LINE1 + "\n * " + LINE2 + " */\n"
    if ext == ".html":                               # HTML은 <!-- --> 주석임 / HTML uses <!-- --> comments
        return "<!-- " + LINE1 + "\n     " + LINE2 + " -->\n"
    if ext == ".md":                                 # 마크다운 문서는 맨 위에 보이는 한 줄로 넣음 / Markdown gets a visible first line
        return "> " + LINE1 + "  \n> " + LINE2 + "\n\n"
    if ext == ".bat":                                # 배치 파일은 화면에 찍히지 않는 @REM 이며, chcp 전이라 한글이 깨지지 않게 영문만 씀 / batch files use @REM (not echoed) and ASCII only so text is not garbled before chcp
        return "@REM " + BAT1 + "\n@REM " + BAT2 + "\n"
    return "# " + LINE1 + "\n# " + LINE2 + "\n"       # 파이썬, 셸, YAML은 # 주석임 / comment


def insert(text, ext):                               # 파일 내용 맨 위(필수 첫 줄 뒤)에 머리말을 넣음 / inserts the header at the top of the content (after required first lines)
    h = header(ext)                                  # 넣을 머리말임 / header to insert
    lines = text.split("\n")                         # 줄 단위로 나눔 / split into lines
    if ext == ".html" and lines and lines[0].lower().startswith("<!doctype"):   # HTML은 <!DOCTYPE> 다음 줄에 넣어야 표준 모드가 유지됨 / in HTML it must follow <!DOCTYPE> to keep standards mode
        return lines[0] + "\n" + h + "\n".join(lines[1:])
    if ext in (".py", ".sh") and lines and lines[0].startswith("#!"):   # 실행 줄(#!)은 맨 위에 그대로 둠 / keep the shebang (#!) line at the very top
        rest = lines[1:]                             # 나머지 줄임 / remaining lines
        if ext == ".py" and rest and "coding" in rest[0]:   # 인코딩 선언 줄도 그대로 둠 / keep the encoding declaration line too
            return lines[0] + "\n" + rest[0] + "\n" + h + "\n".join(rest[1:])
        return lines[0] + "\n" + h + "\n".join(rest)
    return h + text                                  # 그 밖에는 맨 위에 넣음 / otherwise insert at the very top


def targets():                                       # 머리말을 넣을 파일 목록을 모음 / collects the files that need the header
    exts = {".js", ".css", ".html", ".py", ".bat", ".sh", ".yml", ".yaml", ".md"}   # 대상 확장자임 / target extensions
    for base, dirs, files in os.walk(ROOT):          # 루트부터 모든 폴더를 돎 / walks every folder from the root
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]   # 건너뛸 폴더를 뺌 / removes folders to skip
        for f in files:                              # 파일마다 / for each file
            ext = os.path.splitext(f)[1].lower()     # 확장자임 / extension
            if ext not in exts: continue             # 대상이 아니면 건너뜀 / skip if not a target
            if f.endswith(".min.js") or "_v0" in f and ext == ".html" and "산행안전" in f: continue   # 압축 라이브러리, 묶음 배포본(자동 생성)은 건너뜀 / skip minified libraries and bundled builds (generated)
            if f == "py_results.js" or f.startswith("narration_ko"): continue   # 자동 생성 데이터 파일은 생성기가 머리말을 붙임 / generated data files get their header from the generator
            yield os.path.join(base, f), ext         # 경로와 확장자를 돌려줌 / returns path and extension


def main():                                          # 실행 진입점임 / entry point
    check = "--check" in sys.argv                    # 점검만 할지임 / check-only mode
    added, ok = [], 0                                # 넣은 파일, 이미 있던 파일 수임 / files inserted and files already done
    for path, ext in targets():                      # 대상 파일마다 / for each target file
        with open(path, encoding="utf-8", errors="replace") as fh: text = fh.read()   # 읽음 / read
        if MARK in text[:600] or "Prof. Young-ho Park" in text[:400]: ok += 1; continue     # 맨 위에 이미 있으면 건너뜀 / skip if already at the top
        added.append(os.path.relpath(path, ROOT))    # 넣을 목록에 더함 / add to the insert list
        if not check:                                # 점검 모드가 아니면 / unless in check mode
            nl = "\r\n" if "\r\n" in text else "\n"   # 원래 줄바꿈 방식(Windows 배치 파일은 CRLF)을 유지함 / keep the original line endings (CRLF for Windows batch files)
            new = insert(text.replace("\r\n", "\n"), ext)   # 줄바꿈을 통일해 머리말을 넣음 / normalize line endings and insert the header
            with open(path, "w", encoding="utf-8", newline="") as fh: fh.write(new.replace("\n", nl))   # 원래 줄바꿈으로 저장함 / save with the original line endings
    print(("[점검] 머리말 없는 파일 " if check else "[완료] 머리말을 넣은 파일 ") + str(len(added)) + "개, 이미 있음 " + str(ok) + "개")   # 결과를 알림 / report the result
    for a in added[:200]: print("  - " + a)          # 목록을 보여 줌 / show the list
    return 1 if (check and added) else 0             # 점검 모드에서 빠진 파일이 있으면 실패 코드임 / in check mode, return failure code if files are missing


if __name__ == "__main__":                           # 직접 실행할 때만 / only when run directly
    sys.exit(main())                                 # 실행함 / run
