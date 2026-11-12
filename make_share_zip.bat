@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM make_share_zip.bat : 학생 배포용 압축 파일 만들기(.git, logs 제외) / build the student zip (without .git, logs)
cd /d "%~dp0"
call tools\pyfind.bat
if "%PY%"=="" (echo Python not found & pause & exit /b 1)
%PY% tools\make_share_zip.py
pause
