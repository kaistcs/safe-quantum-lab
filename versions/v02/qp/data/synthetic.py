# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
"""
synthetic.py : 씨앗 고정 합성 데이터 생성기

왜 쓰는가 : 실측 사고 데이터가 없으므로, 규칙(신호 쌍의 곱 > 기준)으로 정답을
           붙인 가상 표본을 만들어 비교 실험을 재현 가능하게 하기 위함임.
사용법    : python -m qp.data.synthetic --seed 2026 --n 2750 [--cut 0.46] [--noise 0.03]
결과      : data/synthetic/synthetic_seed<씨앗>_<날짜>.csv 와 manifest.json 기록
"""
import argparse                                # 명령줄 옵션을 읽는 도구임
import csv                                     # CSV 파일 쓰기 도구임
import datetime                                # 오늘 날짜를 얻는 도구임
import json                                    # 기록 파일(JSON)을 다루는 도구임
import os                                      # 폴더 만들기, 경로 처리에 씀

from ..emulator import LCG                     # 웹과 같은 난수 생성기를 불러옴
from ..signals import COLUMNS, PAIRS           # 열 이름과 신호 쌍을 불러옴


def synthetic_label(x, cut=0.46):              # 합성 정답 규칙임
    return any(x[a] * x[b] > cut for a, b in PAIRS)   # 한 쌍이라도 곱이 기준을 넘으면 위험임


def sample_set(seed, count, power=2, cut=0.46, label_noise=0.0):   # 표본 count개를 만듦
    rand = LCG(seed)                           # 같은 씨앗이면 같은 표본이 나옴
    out = []                                   # 결과 목록임
    for _ in range(count):                     # 표본 수만큼 반복함
        x = [rand() ** power for _ in COLUMNS]  # 대부분 낮고 가끔 높은 20개 신호임
        y = 1 if synthetic_label(x, cut) else 0   # 규칙으로 정답을 붙임
        if label_noise and rand() < label_noise:  # 정해진 비율만큼
            y = 1 - y                          # 정답을 뒤집어 기록 오류를 흉내 냄
        out.append((x, y))                     # (신호, 정답) 묶음으로 저장함
    return out                                 # 목록을 돌려줌


def write_csv(rows, path):                     # 표본을 CSV로 저장함
    os.makedirs(os.path.dirname(path), exist_ok=True)   # 폴더가 없으면 만듦
    with open(path, "w", newline="", encoding="utf-8-sig") as f:   # 엑셀에서 한글이 안 깨지도록 BOM을 붙임
        w = csv.writer(f)                      # CSV 작성기임
        w.writerow(COLUMNS + ["label"])        # 첫 줄(열 이름)을 씀
        for x, y in rows:                      # 표본마다
            w.writerow([f"{v:.4f}" for v in x] + [y])   # 소수 4자리로 한 줄을 씀


def main():                                    # 명령줄에서 실행할 때의 시작점임
    ap = argparse.ArgumentParser(description="합성 산행 데이터 생성")   # 옵션 해석기임
    ap.add_argument("--seed", type=int, default=2026)   # 씨앗 번호임
    ap.add_argument("--n", type=int, default=2750)      # 표본 수임
    ap.add_argument("--cut", type=float, default=0.46)  # 위험 기준임
    ap.add_argument("--noise", type=float, default=0.0) # 정답 잡음 비율임
    ap.add_argument("--out", default="data/synthetic")  # 저장 폴더임
    a = ap.parse_args()                        # 옵션을 읽음
    rows = sample_set(a.seed, a.n, cut=a.cut, label_noise=a.noise)   # 표본을 만듦
    today = datetime.date.today().isoformat()  # 오늘 날짜 문자열임
    path = os.path.join(a.out, f"synthetic_seed{a.seed}_{today}.csv")   # 파일 경로임
    write_csv(rows, path)                      # 저장함
    man = os.path.join(a.out, "manifest.json")  # 생성 기록 파일 경로임
    log = json.load(open(man, encoding="utf-8")) if os.path.exists(man) else []   # 기존 기록을 읽음
    log.append({"file": os.path.basename(path), "seed": a.seed, "n": a.n, "cut": a.cut, "noise": a.noise,
                "positives": sum(y for _, y in rows), "created": today})   # 이번 기록을 추가함
    json.dump(log, open(man, "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # 기록을 저장함
    print("saved", path, "positives", log[-1]["positives"], "/", a.n)   # 결과를 알림


if __name__ == "__main__":                     # 직접 실행했을 때만
    main()                                     # 시작점을 호출함
