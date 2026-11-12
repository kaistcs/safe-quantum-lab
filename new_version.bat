@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM new_version.bat : 최신 버전을 복사해 다음 번호 폴더(v03, v04 ...)를 만듦 / copies the latest version into the next folder
cd /d "%~dp0"
call tools\pyfind.bat
set /p NOTE=Change summary (optional): 
%PY% tools\new_version.py "%NOTE%"
pause
