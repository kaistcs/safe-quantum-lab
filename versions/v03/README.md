> Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.  
> 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.

# versions\v03 — 숙명 AGI 산행안전 양자 실험실 v03 (전체 안내는 프로젝트 루트의 README.md)

## 바로 쓰기
| 하고 싶은 일 | 방법 |
|---|---|
| 웹 실험실 열기 | `run.bat` 두 번 클릭 (빈 포트 자동, 브라우저 자동) |
| 서버 없이 열기 | `versions\v03\web\index.html` 두 번 클릭 |
| 휴대폰(같은 와이파이)에서 보기 | 명령창에서 `run.bat --lan` |
| 처음 환경 설치 | `setup.bat` (가상환경 .venv, 패키지, 숙명 CI 내려받기, 사람 같은 음성 MP3 녹음, 자동 시험) |
| 파이썬 비교 실험 | `run_benchmark.bat` (예: `run_benchmark.bat --shots 20 --noise 0.3`) |
| 고품질 음성 MP3 만들기 | `make_voice.bat` (Microsoft Azure 신경망 음성, 인터넷 필요) |
| 새 버전 만들기 | `new_version.bat` → versions\v03 생성 |
| GitHub 연결 | `git_connect.bat` → 저장소 Settings › Pages › Source = GitHub Actions |

## 구조
```
<설치 폴더>
├─ *.bat                 실행 버튼들
├─ tools\                serve.py(포트, MIME 해결), new_version.py, make_voice.py, build_site.py, latest.py, pyfind.bat
├─ .github\workflows\    pages.yml(웹 게시), synthetic-data.yml(주간 합성 데이터, 성적표)
└─ versions\
   ├─ v01\               원본 보관 (dist\, 산행안전_웹실험실_01.html)
   ├─ v02\               이전 버전
   └─ v03\               현재 버전 — 깨끗한 코드만
      ├─ web\            index.html, css\, js\(emulator, data, models, narration, voice, charts, views, app), img\, audio\, data\
      ├─ qp\             파이썬 패키지: emulator, models, signals, data\synthetic, data\public
      ├─ experiments\    benchmark.py
      ├─ tests\          test_emulator.py (세미나 부록 기대값 포함)
      ├─ data\           synthetic\, public\
      └─ results\        날짜별 비교 결과 JSON
```

## 레고 블럭(부품) 원칙
- 웹 js 파일 하나 = 부품 하나. `QP.Sim`(계산기) → `QP.Data` → `QP.Models` → `QP.Views`(화면) 순서로만 의존함.
- 파이썬도 같은 구조: `qp.emulator` → `qp.models` → `experiments`. 웹과 같은 난수, 같은 학습 순서라 숫자가 일치함.
- 새 화면 추가: `web\js\views.js` 의 `QP.Views` 목록에 `{id, group, title, color, render}` 한 줄 추가 + `narration.js` 대본 추가.

## 정직한 범위
- 2큐비트 회로 특징은 cos 곱 수식과 같으므로 대조군 성적이 같음. 이득의 원인은 “겹침(결합) 특징”임.
- 양자 고유 이점은 큰 회로, 실제 장비, 실측 데이터에서 검증할 연구 질문임(3차년도 시범연구).
