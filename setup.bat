@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM setup.bat : 처음 한 번만 실행. 설치 폴더 안의 .venv 가상환경을 만들고 필요한 패키지를 설치함 / first-time setup: creates .venv and installs packages
cd /d "%~dp0"
call tools\pyfind.bat
if "%PY%"=="" (pause & exit /b 1)
if not exist .venv %PY% -m venv .venv
set "PY=%~dp0.venv\Scripts\python.exe"
%PY% -m pip install --upgrade pip
for /f %%v in ('%PY% tools\latest.py') do set VER=%%v
%PY% -m pip install -r versions\%VER%\requirements.txt
echo.
echo [1/3] Downloading Sookmyung CI and Snowflake character images ...
%PY% tools\fetch_brand.py
echo [2/3] Recording human-like Korean neural voice (Azure SunHi) MP3 ... (internet, about 2-4 min)
%PY% tools\make_voice.py
echo [3/3] Running tests in versions\%VER% ...
pushd versions\%VER%
"%PY%" -m pytest -q
popd
echo Setup finished. Double-click run.bat to start.
pause
