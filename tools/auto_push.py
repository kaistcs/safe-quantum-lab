# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Automatic GitHub backup: commits and pushes every change in the project (code, versions, data_store) without user action.
"""
auto_push.py : GitHub 자동 저장 / automatic GitHub save
  - 바뀐 파일이 있으면 자동으로 commit 하고 GitHub로 push 함 / commits and pushes when files changed
  - 사용법 / usage
      python tools/auto_push.py              한 번 실행 / run once
      python tools/auto_push.py --loop 10    10분마다 계속 / every 10 minutes
  - 처음 한 번 git_connect.bat(또는 아래 README 명령)으로 저장소를 연결하고 로그인해 두면, 그다음부터는 손댈 필요 없음
    / after connecting the repository and signing in once, no further action is needed
  - 기록: logs/auto_push.log / log file: logs/auto_push.log
"""
import argparse, datetime, os, shutil, subprocess, sys, time   # 표준 모듈 / standard modules

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트 / project root
LOG = os.path.join(ROOT, "logs", "auto_push.log")   # 기록 파일 / log file


def log(msg):                                      # 기록을 남김 / write a log line
    os.makedirs(os.path.dirname(LOG), exist_ok=True)   # 폴더를 만듦 / make the folder
    line = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "  " + msg   # 시각을 붙임 / prefix the time
    print(line)                                    # 화면에도 보임 / also print
    with open(LOG, "a", encoding="utf-8") as fh: fh.write(line + "\n")   # 파일에 덧붙임 / append to the file


def git(*args, check=False):                       # git 명령을 실행함 / run a git command
    r = subprocess.run(["git"] + list(args), cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")   # 결과를 받음 / capture output
    if check and r.returncode != 0: raise RuntimeError((r.stderr or r.stdout).strip())   # 실패면 오류 / raise on failure
    return r                                       # 결과를 돌려줌 / return the result


def ready():                                       # 자동 저장을 할 수 있는 상태인지 확인함 / check whether auto-save is possible
    if shutil.which("git") is None: return "git이 설치되어 있지 않음 / git is not installed"   # git 없음 / no git
    if not os.path.isdir(os.path.join(ROOT, ".git")): return "아직 GitHub에 연결하지 않음(git_connect.bat 실행 필요) / not connected yet (run git_connect.bat)"   # 저장소 없음 / no repo
    url = git("remote", "get-url", "origin").stdout.strip()   # 원격 주소 / remote URL
    if not url: return "원격 저장소(origin)가 없음 / no remote 'origin'"   # 원격 없음 / no remote
    if "@" in url and not url.startswith("git@"): return "저장소 주소가 이메일로 잘못 들어감, git_connect.bat 다시 실행 / remote URL is an e-mail; run git_connect.bat again: " + url   # 잘못된 주소 / wrong URL
    return ""                                      # 준비됨 / ready


def sync_workflows():                              # GitHub 자동화 설정을 .github/workflows로 복사함 / copy workflows into .github/workflows
    src, dst = os.path.join(ROOT, "github_workflows"), os.path.join(ROOT, ".github", "workflows")   # 원본과 대상 / source and target
    if not os.path.isdir(src): return               # 원본이 없으면 끝 / nothing to copy
    os.makedirs(dst, exist_ok=True)                 # 대상 폴더를 만듦 / make the target folder
    for f in os.listdir(src):                       # 파일마다 / for each file
        if f.endswith(".yml"): shutil.copy2(os.path.join(src, f), os.path.join(dst, f))   # 복사함 / copy


def ensure_identity():                             # 커밋 작성자 정보가 없으면 기본값을 이 저장소에만 넣음 / set a repo-local author if missing
    if not git("config", "user.name").stdout.strip(): git("config", "user.name", "Young-ho Park")   # 이름 / name
    if not git("config", "user.email").stdout.strip(): git("config", "user.email", "qp-autosave@users.noreply.github.com")   # 이메일 / e-mail


def push_once():                                   # 한 번 저장함 / save once
    why = ready()                                   # 준비 상태 / readiness
    if why: log("건너뜀 / skipped: " + why); return False   # 준비 안 됨 / not ready
    ensure_identity()                               # 작성자 정보 확인 / make sure an author is set
    sync_workflows()                                # 자동화 설정을 맞춤 / sync workflows
    git("add", "-A")                                # 모든 변경을 올릴 준비 / stage all changes
    changed = [l for l in git("status", "--porcelain").stdout.splitlines() if l.strip()]   # 바뀐 파일 목록 / changed files
    if changed:                                     # 바뀐 것이 있으면 / if anything changed
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")   # 시각 / time
        r = git("commit", "-m", "auto-save " + stamp + " (" + str(len(changed)) + " files) / 자동 저장")   # 커밋 / commit
        if r.returncode != 0: log("커밋 실패 / commit failed: " + (r.stderr or r.stdout).strip()[:300]); return False   # 실패 기록 / log failure
    ahead = git("rev-list", "--count", "@{u}..HEAD").stdout.strip()   # 아직 올리지 않은 커밋 수 / commits not pushed yet
    if not changed and ahead in ("", "0"): log("변경 없음 / no changes"); return True   # 할 일 없음 / nothing to do
    git("pull", "--rebase", "--autostash")          # 다른 PC의 변경을 먼저 받음 / get changes from other PCs first
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() or "main"   # 현재 가지 / current branch
    r = git("push", "-u", "origin", branch)         # GitHub로 올림 / push to GitHub
    if r.returncode != 0: log("push 실패(로그인 또는 네트워크 확인) / push failed (check sign-in or network): " + (r.stderr or r.stdout).strip()[:300]); return False   # 실패 기록 / log failure
    log("GitHub 저장 완료 / saved to GitHub: " + str(len(changed)) + " files, branch " + branch)   # 성공 기록 / log success
    return True                                     # 성공 / success


def main():                                        # 실행 진입점 / entry point
    ap = argparse.ArgumentParser()                  # 옵션 해석기 / option parser
    ap.add_argument("--loop", type=float, default=0, help="분 단위 반복 간격(0이면 한 번) / repeat interval in minutes (0 = once)")   # 반복 간격 / interval
    a = ap.parse_args()                             # 옵션을 읽음 / read options
    if a.loop <= 0: return 0 if push_once() else 1  # 한 번 실행 / run once
    while True:                                     # 계속 반복 / repeat forever
        try: push_once()                            # 저장 시도 / try to save
        except Exception as e: log("오류 / error: " + str(e))   # 오류 기록 / log errors
        time.sleep(max(1.0, a.loop) * 60)           # 기다림 / wait


if __name__ == "__main__":                         # 직접 실행할 때만 / only when run directly
    sys.exit(main())                                # 실행 / run
