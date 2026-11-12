#!/usr/bin/env bash
# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# run.sh : macOS, Linux에서 최신 버전 웹 실험실을 실행함(빈 포트 자동, 브라우저 자동). 같은 와이파이 기기에서 보려면 ./run.sh --lan / runs the latest web lab on macOS, Linux
cd "$(dirname "$0")"                                # 프로젝트 루트로 이동함
if [ -x .venv/bin/python ]; then PY=.venv/bin/python; else PY=$(command -v python3 || command -v python); fi   # 파이썬을 고름
[ -z "$PY" ] && { echo "[오류] Python 3.10 이상이 필요합니다."; exit 1; }
exec "$PY" tools/serve.py "$@"                      # 서버를 실행함
