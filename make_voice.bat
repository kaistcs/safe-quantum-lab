@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
REM make_voice.bat : 음성 대본을 Microsoft Azure 신경망 한국어 음성 MP3로 녹음(인터넷 필요) / records narration MP3 with neural voices (internet required)
REM 남성 음성 / male voice:  make_voice.bat --voice ko-KR-InJoonNeural
cd /d "%~dp0"
call tools\pyfind.bat
%PY% -c "import edge_tts" 2>nul || %PY% -m pip install edge-tts
%PY% tools\make_voice.py %*
pause
