#!/usr/bin/env bash
# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# setup.sh : macOS, Linux에서 처음 한 번 실행함(가상환경 .venv 생성, 패키지 설치, 숙명 CI 내려받기, 음성 MP3 녹음, 자동 시험) / first-time setup on macOS, Linux
set -e                                              # 오류가 나면 멈춤
cd "$(dirname "$0")"                                # 이 파일이 있는 폴더(프로젝트 루트)로 이동함
PY=$(command -v python3 || command -v python)       # 파이썬을 찾음
[ -z "$PY" ] && { echo "[오류] Python 3.10 이상을 설치하시기 바랍니다."; exit 1; }
[ -d .venv ] || "$PY" -m venv .venv                 # 가상환경을 만듦
PY=.venv/bin/python                                 # 가상환경의 파이썬을 씀
"$PY" -m pip install --upgrade pip                  # pip를 최신으로 함
VER=$("$PY" tools/latest.py)                        # 최신 버전 폴더 이름(예: v03)임
"$PY" -m pip install -r "versions/$VER/requirements.txt"   # 필요한 패키지를 설치함
echo "[1/3] 숙명 CI, 눈송이 이미지 내려받기"; "$PY" tools/fetch_brand.py || true
echo "[2/3] 신경망 음성 MP3 녹음(인터넷 필요)"; "$PY" tools/make_voice.py || true
echo "[3/3] 자동 시험"; (cd "versions/$VER" && "../../$PY" -m pytest -q)
echo "설치 완료. ./run.sh 로 실행하시기 바랍니다."
