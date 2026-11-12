@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@REM pyfind.bat : 사용할 파이썬을 찾아 PY 변수에 넣음 (.venv → python → py → Anaconda 순서) / finds Python into PY
@if exist "%~dp0..\.venv\Scripts\python.exe" (set "PY=%~dp0..\.venv\Scripts\python.exe" & goto :eof)
@where python >nul 2>nul && (set "PY=python" & goto :eof)
@where py >nul 2>nul && (set "PY=py -3" & goto :eof)
@if exist "%USERPROFILE%\anaconda3\python.exe" (set "PY=%USERPROFILE%\anaconda3\python.exe" & goto :eof)
@echo [ERROR] Python not found. Install Python 3.10+ or Anaconda.
@set "PY="
