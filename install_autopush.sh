#!/usr/bin/env bash
# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# install_autopush.sh : macOS, Linux에서 30분마다 GitHub 자동 저장을 crontab에 등록함 / registers auto GitHub save every 30 min in crontab
# 끄려면 / to remove: ./install_autopush.sh --remove
cd "$(dirname "$0")"                                # 프로젝트 루트로 이동 / go to the project root
DIR="$(pwd)"; if [ -x .venv/bin/python ]; then PY="$DIR/.venv/bin/python"; else PY=$(command -v python3); fi   # 파이썬 / python
LINE="*/30 * * * * cd \"$DIR\" && \"$PY\" tools/auto_push.py >/dev/null 2>&1   # SookmyungQP_AutoPush"   # 등록할 줄 / cron line
( crontab -l 2>/dev/null | grep -v SookmyungQP_AutoPush ) > /tmp/qp_cron   # 기존 줄을 뺌 / remove the old line
[ "$1" = "--remove" ] || echo "$LINE" >> /tmp/qp_cron   # 새 줄을 더함 / add the new line
crontab /tmp/qp_cron && rm -f /tmp/qp_cron && echo "done (log: logs/auto_push.log)"   # 적용 / apply
[ "$1" = "--remove" ] || "$PY" tools/auto_push.py   # 바로 한 번 저장 / save once now
