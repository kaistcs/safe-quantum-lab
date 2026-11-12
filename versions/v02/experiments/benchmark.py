# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
"""
benchmark.py : 일반 AI vs 양자 특징 AI vs 대조군 vs 샷 측정 양자 AI 비교 실험

왜 쓰는가 : 웹과 같은 실험을 파이썬에서 재현하고, 결과를 날짜별로 남기며,
           웹 성적표 화면에도 표시하기 위함임.
사용법    : python -m experiments.benchmark [--shots 100] [--noise 0.15] [--csv 데이터.csv]
결과      : results/benchmark_<날짜>.json, web/data/py_results.js
"""
import argparse                                # 명령줄 옵션 도구임
import csv                                     # CSV 읽기 도구임
import datetime                                # 날짜 도구임
import json                                    # JSON 저장 도구임
import os                                      # 경로 도구임

from qp.models import experiment               # 비교 실험 함수를 불러옴
from qp.signals import COLUMNS                 # 열 이름을 불러옴
from qp.data.synthetic import synthetic_label  # 정답이 없을 때 쓸 규칙을 불러옴


def load_csv(path):                            # 20개 신호 CSV를 학습/기준/시험으로 나눠 읽음
    with open(path, encoding="utf-8-sig") as f:   # BOM이 있어도 읽음
        rows = []                              # 표본 목록임
        for r in csv.DictReader(f):            # 한 줄씩 읽음
            x = [max(0.0, min(1.0, float(r.get(c) or 0))) for c in COLUMNS]   # 20개 신호를 0~1로 읽음
            y = int(float(r["label"])) if r.get("label") not in (None, "") else int(synthetic_label(x))   # 정답이 없으면 규칙으로 채움
            rows.append((x, y))                # 표본을 추가함
    a, b = int(len(rows) * .5), int(len(rows) * .7)   # 50/20/30으로 나눌 위치임
    return {"train": rows[:a], "valid": rows[a:b], "test": rows[b:]}   # 나눠서 돌려줌


def main():                                    # 시작점임
    ap = argparse.ArgumentParser()             # 옵션 해석기임
    ap.add_argument("--shots", type=int, default=100)   # 샷 수(0이면 샷 모드 생략)임
    ap.add_argument("--noise", type=float, default=0.15)   # 장비 잡음 비율임
    ap.add_argument("--csv")                   # 사용할 CSV(없으면 기본 합성)임
    a = ap.parse_args()                        # 옵션을 읽음
    data = load_csv(a.csv) if a.csv else None  # 데이터를 준비함
    res = experiment(data, shots=a.shots, noise=a.noise)   # 실험을 실행함
    today = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")   # 실행 시각임
    out = {"created": today, "data": a.csv or "default synthetic (901/902/903)", "shots": a.shots, "noise": a.noise, "methods": res}   # 저장할 내용임
    os.makedirs("results", exist_ok=True)      # 결과 폴더를 만듦
    path = os.path.join("results", "benchmark_" + today[:10] + ".json")   # 날짜별 파일 이름임
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # JSON으로 저장함
    with open(os.path.join("web", "data", "py_results.js"), "w", encoding="utf-8") as f:   # 웹에서 읽을 파일임
        f.write("/* run_benchmark.bat 이 만든 파이썬 실험 결과임 */\nwindow.QP_PY_RESULTS = " + json.dumps(out, ensure_ascii=False) + ";\n")   # 스크립트 형태로 써서 file://에서도 읽힘
    for m in res:                              # 방식마다 결과를 출력함
        print(f"{m['key']:9s} recall {m['recall']*100:5.1f}%  falseAlarm {m['falseAlarm']*100:5.1f}%  AUC {m['auc']:.3f}  {m['ms']:.0f}ms")   # 한 줄 요약임
    print("saved", path)                       # 저장 위치를 알림


if __name__ == "__main__":                     # 직접 실행했을 때만
    main()                                     # 시작점을 호출함
