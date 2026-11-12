@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM install_autopush.bat : 30분마다 GitHub 자동 저장을 Windows 작업 스케줄러에 등록함(PC가 켜져 있으면 손대지 않아도 저장) / registers auto GitHub save every 30 min in Windows Task Scheduler
REM 끄려면 / to remove:  install_autopush.bat --remove
cd /d "%~dp0"
call tools\pyfind.bat
if "%PY%"=="" (pause & exit /b 1)
if /i "%~1"=="--remove" (schtasks /delete /tn "SookmyungQP_AutoPush" /f & echo Removed. & pause & exit /b 0)
schtasks /create /tn "SookmyungQP_AutoPush" /sc minute /mo 30 /f /tr "\"%PY%\" \"%~dp0tools\auto_push.py\""
if errorlevel 1 (echo [ERROR] Task registration failed. & pause & exit /b 1)
echo.
echo GitHub auto-save registered: every 30 minutes. Log: logs\auto_push.log
"%PY%" tools\auto_push.py
pause
