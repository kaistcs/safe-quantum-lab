@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM run_benchmark.bat : 파이썬 비교 실험 → results\ 저장 + 웹 성적표 화면에 표시 / Python benchmark saved to results and shown in the web report
REM 예 / e.g.) run_benchmark.bat --shots 20 --noise 0.3     /  run_benchmark.bat --csv data\public\merged.csv
cd /d "%~dp0"
call tools\pyfind.bat
for /f %%v in ('%PY% tools\latest.py') do set VER=%%v
pushd versions\%VER%
%PY% -m qp.data.synthetic --seed 2026 --n 2750
%PY% -m experiments.benchmark %*
popd
pause
