@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM run.bat : 최신 버전 웹 실험실을 실행함(빈 포트 자동 선택, 브라우저 자동 열기) / runs the latest web lab (free port, browser opens)
REM 같은 와이파이의 휴대폰에서도 보려면 / to view on phones on the same Wi-Fi:  run.bat --lan
cd /d "%~dp0"
call tools\pyfind.bat
if "%PY%"=="" goto nopy
%PY% tools\serve.py %*
goto end
:nopy
echo Python not found - opening the page directly from file instead.
for /f %%v in ('dir /b /ad /o:n versions') do set VER=%%v
start "" "%~dp0versions\%VER%\web\index.html"
:end
pause
