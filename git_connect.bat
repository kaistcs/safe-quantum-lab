@REM Copyright (c) 2025-2026 Prof. Young-ho Park, Sookmyung Women's University, Korea. All rights reserved.
@REM Ministry of the Interior and Safety (MOIS) disaster-safety R&D, hiking-safety project. See LICENSE.
@echo off
chcp 65001 >nul
setlocal EnableExtensions
REM git_connect.bat : 이 프로젝트 폴더를 GitHub 저장소에 연결하고 첫 업로드를 함, 이어서 30분마다 자동 저장을 등록함 / connects to GitHub, first upload, then registers auto-save
REM 여러 번 실행해도 안전함, 잘못 입력했으면 다시 실행하면 됨 / safe to re-run; just run again after a wrong input
cd /d "%~dp0"
where git >nul 2>nul || (echo [ERROR] Git not installed: https://git-scm.com/download/win & pause & exit /b 1)

echo ==================================================================
echo  GitHub connect / GitHub 연결
echo  1) 먼저 GitHub 웹에서 빈 저장소를 만들어 두십시오 (README 체크 해제 권장)
echo     Create an EMPTY repository on github.com first, e.g. safe-quantum-lab
echo ==================================================================

if not exist .git git init >nul
git branch -M main >nul 2>nul

REM ---- 1. 커밋 작성자 정보 / commit author identity ----
set "GNAME="
set "GMAIL="
for /f "delims=" %%a in ('git config user.name 2^>nul') do set "GNAME=%%a"
for /f "delims=" %%a in ('git config user.email 2^>nul') do set "GMAIL=%%a"
if defined GNAME goto name_ok
set "GNAME=Young-ho Park"
set /p "GNAME=Author name / 작성자 이름 [Young-ho Park]: "
git config user.name "%GNAME%"
:name_ok
if defined GMAIL goto mail_ok
:ask_mail
set "GMAIL="
set /p "GMAIL=GitHub e-mail / GitHub 가입 이메일: "
if not defined GMAIL goto ask_mail
echo %GMAIL%| findstr "@" >nul || (echo [!] 이메일 형식이 아님 / not an e-mail & goto ask_mail)
git config user.email "%GMAIL%"
:mail_ok
echo Author / 작성자: %GNAME%  %GMAIL%

REM ---- 2. 저장소 주소 / repository URL ----
:ask_url
set "URL="
echo.
echo 저장소 주소를 넣으십시오, 이메일이 아님 / Enter the REPOSITORY URL, not an e-mail
echo   예 / e.g.  https://github.com/myid/safe-quantum-lab.git   또는 / or  myid/safe-quantum-lab
set /p "URL=GitHub repo URL: "
if not defined URL goto ask_url
echo %URL%| findstr /b /c:"git@" >nul && goto url_ok
echo %URL%| findstr "@" >nul && (echo [!] 이메일이 아니라 저장소 주소를 넣어야 함 / that is an e-mail, not a repo URL & goto ask_url)
echo %URL%| findstr /b /c:"https://" >nul || set "URL=https://github.com/%URL%"
:url_ok
echo %URL%| findstr /e /c:".git" >nul || set "URL=%URL%.git"
echo URL: %URL%
git remote remove origin >nul 2>nul
git remote add origin "%URL%"

REM ---- 3. 첫 커밋 / first commit ----
if not exist .github\workflows mkdir .github\workflows
copy /y github_workflows\*.yml .github\workflows\ >nul 2>nul
git add -A
git commit -q -m "Sookmyung AGI Lab: quantum AI hiking-safety lab v03" >nul 2>nul
git rev-parse --verify HEAD >nul 2>nul || (echo [ERROR] 커밋을 만들지 못함 / could not create a commit & pause & exit /b 1)

REM ---- 4. 업로드 / push (브라우저 로그인 창이 뜨면 로그인) ----
echo.
echo GitHub 로그인 창이 뜨면 로그인하십시오 / sign in if a GitHub window appears
git push -u origin main
if errorlevel 1 (
  echo 원격에 이미 파일이 있으면 합친 뒤 다시 올림 / remote has files: merging, then pushing again
  git pull origin main --allow-unrelated-histories --no-edit
  git push -u origin main
  if errorlevel 1 (
    echo.
    echo [ERROR] push 실패: 저장소 주소, 로그인, 저장소 권한을 확인한 뒤 git_connect.bat 를 다시 실행하십시오
    echo         push failed: check URL, sign-in and permissions, then run git_connect.bat again
    pause & exit /b 1
  )
)

echo.
echo Registering automatic GitHub save (every 30 minutes) ...
call "%~dp0install_autopush.bat"
echo.
echo 완료 / Done.  Next: GitHub repo - Settings - Pages - Source = "GitHub Actions"
pause
