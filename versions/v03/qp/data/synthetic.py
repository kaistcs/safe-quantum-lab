# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Python synthetic data generator.
"""
synthetic.py : 씨앗 고정 합성 데이터 생성기

왜 쓰는가 : 실측 사고 데이터가 없으므로, 규칙(신호 쌍의 곱 > 기준)으로 정답을
           붙인 가상 표본을 만들어 비교 실험을 재현 가능하게 하기 위함임.
사용법    : python -m qp.data.synthetic --seed 2026 --n 2750 [--cut 0.46] [--noise 0.03]
결과      : data/synthetic/synthetic_seed<씨앗>_<날짜>.csv 와 manifest.json 기록
"""
import argparse                                # 명령줄 옵션을 읽는 도구임 / tool to read command-line options
import csv                                     # CSV 파일 쓰기 도구임 / CSV file writer
import datetime                                # 오늘 날짜를 얻는 도구임 / tool to get today's date
import json                                    # 기록 파일(JSON)을 다루는 도구임 / tool for the log file (JSON)
import os                                      # 폴더 만들기, 경로 처리에 씀 / used to make folders and handle paths

from ..emulator import LCG                     # 웹과 같은 난수 생성기를 불러옴 / import the same random generator as the web
from ..signals import COLUMNS, PAIRS           # 열 이름과 신호 쌍을 불러옴 / import column names and signal pairs


def synthetic_label(x, cut=0.46):              # 합성 정답 규칙임 / synthetic label rule
    return any(x[a] * x[b] > cut for a, b in PAIRS)   # 한 쌍이라도 곱이 기준을 넘으면 위험임 / risk if any pair's product exceeds the threshold


def sample_set(seed, count, power=2, cut=0.46, label_noise=0.0):   # 표본 count개를 만듦 / makes count samples
    rand = LCG(seed)                           # 같은 씨앗이면 같은 표본이 나옴 / the same seed gives the same samples
    out = []                                   # 결과 목록임 / result list
    for _ in range(count):                     # 표본 수만큼 반복함 / repeat for the number of samples
        x = [rand() ** power for _ in COLUMNS]  # 대부분 낮고 가끔 높은 20개 신호임 / 20 signals, mostly low and occasionally high
        y = 1 if synthetic_label(x, cut) else 0   # 규칙으로 정답을 붙임 / attach the label by the rule
        if label_noise and rand() < label_noise:  # 정해진 비율만큼 / for the given share
            y = 1 - y                          # 정답을 뒤집어 기록 오류를 흉내 냄 / flip the label to imitate recording errors
        out.append((x, y))                     # (신호, 정답) 묶음으로 저장함 / store as (signals, label)
    return out                                 # 목록을 돌려줌 / return the list


def write_csv(rows, path):                     # 표본을 CSV로 저장함 / save samples as CSV
    os.makedirs(os.path.dirname(path), exist_ok=True)   # 폴더가 없으면 만듦 / create the folder if missing
    with open(path, "w", newline="", encoding="utf-8-sig") as f:   # 엑셀에서 한글이 안 깨지도록 BOM을 붙임 / add a BOM so Korean is not garbled in Excel
        w = csv.writer(f)                      # CSV 작성기임 / CSV writer
        w.writerow(COLUMNS + ["label"])        # 첫 줄(열 이름)을 씀 / write the first line (column names)
        for x, y in rows:                      # 표본마다 / for each sample
            w.writerow([f"{v:.4f}" for v in x] + [y])   # 소수 4자리로 한 줄을 씀 / write one line with 4 decimals


def main():                                    # 명령줄에서 실행할 때의 시작점임 / entry point when run from the command line
    ap = argparse.ArgumentParser(description="합성 산행 데이터 생성")   # 옵션 해석기임 / option parser
    ap.add_argument("--seed", type=int, default=2026)   # 씨앗 번호임 / seed number
    ap.add_argument("--n", type=int, default=2750)      # 표본 수임 / number of samples
    ap.add_argument("--cut", type=float, default=0.46)  # 위험 기준임 / risk threshold
    ap.add_argument("--noise", type=float, default=0.0) # 정답 잡음 비율임 / label noise ratio
    ap.add_argument("--out", default="data/synthetic")  # 저장 폴더임 / output folder
    a = ap.parse_args()                        # 옵션을 읽음 / read the options
    rows = sample_set(a.seed, a.n, cut=a.cut, label_noise=a.noise)   # 표본을 만듦 / make the samples
    today = datetime.date.today().isoformat()  # 오늘 날짜 문자열임 / today's date string
    path = os.path.join(a.out, f"synthetic_seed{a.seed}_{today}.csv")   # 파일 경로임 / file path
    write_csv(rows, path)                      # 저장함 / save
    man = os.path.join(a.out, "manifest.json")  # 생성 기록 파일 경로임 / path of the generation log
    log = json.load(open(man, encoding="utf-8")) if os.path.exists(man) else []   # 기존 기록을 읽음 / read the existing log
    log.append({"file": os.path.basename(path), "seed": a.seed, "n": a.n, "cut": a.cut, "noise": a.noise,
                "positives": sum(y for _, y in rows), "created": today})   # 이번 기록을 추가함 / add this record
    json.dump(log, open(man, "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # 기록을 저장함 / save the log
    print("saved", path, "positives", log[-1]["positives"], "/", a.n)   # 결과를 알림 / report the result


if __name__ == "__main__":                     # 직접 실행했을 때만 / only when run directly
    main()                                     # 시작점을 호출함 / call the entry point
