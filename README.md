# 숙명 AGI 산행안전 양자 실험실 (Sookmyung AGI Lab. Quantum AI Hiking-Safety Lab)

- 웹 실험실 / Web lab: https://kaistcs.github.io/safe-quantum-lab/
- 소스 코드 / Source: https://github.com/kaistcs/safe-quantum-lab


Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
행정안전부 재난안전연구개발사업(한국산업기술기획평가원) 「등산로 위험정보 공유를 위한 사용자 참여형 스마트 안전 등산로 플랫폼 및 관리시스템 개발」 과제 결과물입니다.

## 1. 필요한 것 (어느 PC에서나 같음)
| 항목 | 내용 |
|---|---|
| 운영체제 | Windows 10/11, macOS 12 이상, Linux(Ubuntu 22.04 등) |
| Python | 3.10 이상 (https://www.python.org/downloads/ 또는 Anaconda) |
| 브라우저 | Microsoft Edge 권장(남녀 신경망 음성 교대), Chrome, Safari, Firefox 가능 |
| Git | GitHub에서 받거나 올릴 때만 필요 (https://git-scm.com) |
| 인터넷 | 설치 때 패키지, CI 이미지, 음성 MP3 녹음에만 필요. 실행은 오프라인 가능 |

## 2. 설치 (설치 폴더는 어디든 가능)
```bash
# (1) 받기: GitHub에서 복제하거나, 배포 zip을 원하는 폴더에 풉니다.
git clone https://github.com/<계정>/<저장소>.git
cd <저장소>

# (2) 처음 한 번 설치
setup.bat            # Windows: 두 번 클릭해도 됩니다
./setup.sh           # macOS, Linux

# (3) 실행 (빈 포트를 자동으로 찾고 브라우저를 엽니다)
run.bat              # Windows
./run.sh             # macOS, Linux
run.bat --lan        # 같은 와이파이의 휴대폰, 태블릿에서도 보기(./run.sh --lan)
```
- 서버 없이 보기: `versions/<최신 버전>/web/index.html` 을 브라우저로 직접 열어도 동작합니다(데이터 서버 저장 기능만 제외).
- 한 파일 배포본: `python tools/bundle.py v03` → `versions/v03/산행안전_양자실험실_v03.html` 하나로 어디서나 열립니다.
- 프록시, 사내망: `pip install` 이 막히면 `pip install -r versions/v03/requirements.txt --proxy http://<프록시>:<포트>` 를 씁니다.

## 3. 자주 쓰는 명령
| 하고 싶은 일 | Windows | macOS, Linux |
|---|---|---|
| 웹 실험실 열기 | `run.bat` | `./run.sh` |
| 파이썬 비교 실험 | `run_benchmark.bat --shots 20 --noise 0.3` | `.venv/bin/python versions/v03/experiments/benchmark.py --shots 20 --noise 0.3` |
| 신경망 음성 MP3 녹음 | `make_voice.bat` | `.venv/bin/python tools/make_voice.py` |
| 새 버전 폴더 만들기 | `new_version.bat` | `.venv/bin/python tools/new_version.py` |
| 저작권 머리말 점검, 삽입 | `python tools/add_copyright.py` | `python3 tools/add_copyright.py` |
| GitHub 올리기 | `git_connect.bat` | 아래 4절 명령 |

## 4. GitHub 올리기
```bash
python tools/add_copyright.py            # 모든 프로그램 파일 맨 위에 저작권 머리말이 있는지 확인, 없으면 넣음
mkdir -p .github/workflows && cp github_workflows/*.yml .github/workflows/   # 자동 게시, 주간 합성 데이터 작업
git init -b main && git add -A && git commit -m "Sookmyung AGI Lab: quantum AI hiking-safety lab v03"
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```
그다음 저장소 Settings › Pages › Source = **GitHub Actions** 로 두면 `https://<계정>.github.io/<저장소>/` 에 웹 실험실이 게시됩니다.


### GitHub 자동 저장 (손대지 않아도 저장) / Automatic GitHub save
1. 처음 한 번: GitHub에서 빈 저장소를 만들고 `git_connect.bat`(Windows)을 실행해 주소를 붙여 넣고 로그인함. 끝에 30분마다 자동 저장이 Windows 작업 스케줄러에 등록됨. macOS, Linux는 연결 후 `./install_autopush.sh` 한 번 실행.
2. 그다음부터: 코드, 새 버전 폴더, data_store의 생성 데이터가 바뀌면 30분마다 자동으로 commit, push 됨. `run.bat`으로 실험실을 켜 둔 동안에는 10분마다도 저장함.
3. 기록: `logs/auto_push.log`. 끄기: `install_autopush.bat --remove` 또는 `./install_autopush.sh --remove`. 바로 저장: `python tools/auto_push.py`.

Connect once with git_connect.bat (sign in to GitHub); from then on every change is committed and pushed every 30 minutes (and every 10 minutes while run.bat is open).

## 5. 폴더 구조
```
<설치 폴더>
├─ setup.bat, setup.sh   처음 1번 설치
├─ run.bat, run.sh       실행
├─ *.bat                 비교 실험, 음성 녹음, 새 버전, GitHub 연결
├─ LICENSE               저작권, 이용 조건
├─ install_autopush.*    GitHub 자동 저장 등록(30분마다)
├─ data_store/           생성 데이터 보관함(CSV + 근거 JSON)
├─ tools/                serve.py(포트, MIME, 데이터 저장 API), auto_push.py(GitHub 자동 저장), bundle.py, add_copyright.py, fetch_brand.py, make_voice.py …
├─ github_workflows/     pages.yml(웹 게시), synthetic-data.yml(주간 합성 데이터) → .github/workflows 로 복사해 씀
└─ versions/
   ├─ v01/, v02/         이전 버전 보관
   └─ v03/               현재 버전
      ├─ web/            index.html, css/, js/(부품별 파일), img/, brand/, audio/, data/
      ├─ qp/             파이썬 패키지: emulator, models, signals, data
      ├─ experiments/    benchmark.py
      ├─ tests/          pytest 시험
      └─ results/        비교 결과 JSON
```

## 레고 블럭(부품) 원칙
- 웹 js 파일 하나 = 부품 하나. `QP.Sim`(계산기) → `QP.Data` → `QP.Models` → `QP.Views`(화면) 순서로만 의존함.
- 파이썬도 같은 구조: `qp.emulator` → `qp.models` → `experiments`. 웹과 같은 난수, 같은 학습 순서라 숫자가 일치함.
- 새 화면 추가: `web\js\views.js` 의 `QP.Views` 목록에 `{id, group, title, color, render}` 한 줄 추가 + `narration.js` 대본 추가.

## 정직한 범위
- 2큐비트 회로 특징은 cos 곱 수식과 같으므로 대조군 성적이 같음. 이득의 원인은 “겹침(결합) 특징”임.
- 양자 고유 이점은 큰 회로, 실제 장비, 실측 데이터에서 검증할 연구 질문임(3차년도 시범연구).
