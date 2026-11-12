# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Python loaders for public data.
"""
public.py : 공개 데이터 → 20개 신호(0~1) CSV 변환기

왜 쓰는가 : 기상청, 산림청 등 공개 데이터를 웹 실험실과 파이썬 실험이 같은
           형식(20개 신호 열)으로 쓰게 하기 위함임.
지원 입력 :
  --asos  기상청 ASOS 시간자료 CSV(기상자료개방포털/공공데이터포털 내려받기)
          열 이름 예: 일시, 기온(°C), 강수량(mm), 풍속(m/s)
  --gpx   등산로 GPX 파일(산림청 숲길 정보, 아이나비 DTO-2 등) → 경사 신호
사용법    : python -m qp.data.public --asos asos.csv --gpx trail.gpx --out data/public/merged.csv
주의      : 정답(label) 열은 만들지 않음. 웹/실험에서 합성 규칙으로 채우거나,
           실측 사고 기록이 생기면 label 열을 직접 붙여야 함.
"""
import argparse                                # 명령줄 옵션 도구임 / command-line option tool
import csv                                     # CSV 읽기, 쓰기 도구임 / CSV read/write tool
import math                                    # 거리 계산 수학 함수임 / math functions for distance
import os                                      # 경로 처리에 씀 / used for path handling
import xml.etree.ElementTree as ET             # GPX(XML) 파일을 읽는 도구임 / tool to read GPX (XML) files

from ..signals import COLUMNS                  # 20개 열 이름을 불러옴 / import the 20 column names


def clip(v):                                   # 값을 0~1 범위로 자름 / clip a value to 0~1
    return max(0.0, min(1.0, v))               # 범위를 벗어나면 끝값으로 맞춤 / clamp to the end value if out of range


def _num(row, *keys):                          # 여러 후보 열 이름 중 있는 것을 숫자로 읽음 / reads as a number whichever of several candidate column names exists
    for k in keys:                             # 후보 이름마다 / for each candidate name
        for col in row:                        # 실제 열 이름과 비교함 / compare with real column names
            if col and col.strip().startswith(k):   # 이름이 후보로 시작하면 / if the name starts with the candidate
                try:                           # 숫자 변환을 시도함 / try numeric conversion
                    return float(row[col])     # 성공하면 숫자를 돌려줌 / return the number on success
                except (TypeError, ValueError):   # 빈칸이나 글자면 / if blank or text
                    return 0.0                 # 0으로 봄(강수 없음 등) / treat as 0 (e.g. no rain)
    return 0.0                                 # 해당 열이 없으면 0임 / 0 if the column is missing


def asos_rows(path):                           # ASOS 시간자료를 신호 사전 목록으로 바꿈 / converts ASOS hourly data into a list of signal dicts
    out = []                                   # 결과 목록임 / result list
    with open(path, encoding="cp949", errors="ignore") as f:   # 기상청 파일은 보통 CP949(한글 윈도우) 인코딩임 / KMA files are usually CP949 (Korean Windows) encoded
        for row in csv.DictReader(f):          # 한 줄씩 사전으로 읽음 / read each line as a dict
            t = _num(row, "기온")              # 기온(°C)임 / temperature (°C)
            rain = _num(row, "강수량")         # 시간 강수량(mm)임 / hourly rainfall (mm)
            wind = _num(row, "풍속")           # 풍속(m/s)임 / wind speed (m/s)
            out.append({                       # 0~1 신호로 바꿔 저장함 / store as 0~1 signals
                "rain": clip(rain / 10.0),     # 시간당 10mm 이상이면 최고(호우주의보 수준 참고)임 / maximum at 10 mm/h or more (heavy-rain advisory reference)
                "wind": clip(wind / 14.0),     # 14m/s 이상이면 최고(강풍주의보 기준 참고)임 / maximum at 14 m/s or more (strong-wind advisory reference)
                "heat": clip((t - 28.0) / 7.0),   # 28°C부터 오르기 시작해 35°C에서 최고임 / starts rising at 28°C and peaks at 35°C
                "ice": clip((2.0 - t) / 6.0),  # 2°C 아래로 내려가면 결빙 위험이 오름 / ice risk rises below 2°C
            })
    return out                                 # 시간별 신호 목록을 돌려줌 / return the hourly signal list


def haversine(lat1, lon1, lat2, lon2):         # 두 위경도 사이 거리(m)임 / distance (m) between two lat/lon points
    r = 6371000.0                              # 지구 반지름(m)임 / Earth radius (m)
    p1, p2 = math.radians(lat1), math.radians(lat2)   # 위도를 라디안으로 바꿈 / latitude to radians
    dp, dl = p2 - p1, math.radians(lon2 - lon1)       # 위도, 경도 차이임 / latitude and longitude differences
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2   # 하버사인 공식임 / haversine formula
    return 2 * r * math.asin(math.sqrt(a))     # 거리(m)를 돌려줌 / return the distance (m)


def gpx_slopes(path):                          # GPX 경로의 구간별 경사 신호를 계산함 / computes slope signals per segment of a GPX track
    ns = {"g": "http://www.topografix.com/GPX/1/1"}   # GPX 1.1 이름공간임 / GPX 1.1 namespace
    pts = ET.parse(path).getroot().findall(".//g:trkpt", ns) or ET.parse(path).getroot().findall(".//trkpt")   # 경로 점들을 찾음 / find the track points
    out = []                                   # 결과 목록임 / result list
    for p, q in zip(pts, pts[1:]):             # 이웃한 두 점마다 / for each pair of neighboring points
        d = haversine(float(p.get("lat")), float(p.get("lon")), float(q.get("lat")), float(q.get("lon")))   # 수평 거리임 / horizontal distance
        e1 = p.find("g:ele", ns) if p.find("g:ele", ns) is not None else p.find("ele")   # 첫 점 고도 태그임 / elevation tag of the first point
        e2 = q.find("g:ele", ns) if q.find("g:ele", ns) is not None else q.find("ele")   # 둘째 점 고도 태그임 / elevation tag of the second point
        if d < 1 or e1 is None or e2 is None:  # 거리가 너무 짧거나 고도가 없으면 / if the distance is too short or elevation is missing
            continue                           # 건너뜀 / skip
        grade = abs(float(e2.text) - float(e1.text)) / d   # 경사도(높이 차/거리)임 / grade (rise / distance)
        out.append({"slope": clip(grade / 0.35)})   # 35% 경사에서 최고가 되도록 바꿈 / scaled to peak at a 35% grade
    return out                                 # 구간별 경사 신호 목록임 / slope signal per segment


def merge(*sources):                           # 여러 출처의 신호를 한 표로 합침(길이는 가장 긴 쪽) / merges signals from several sources into one table (length of the longest)
    n = max((len(s) for s in sources if s), default=0)   # 최대 행 수임 / maximum number of rows
    rows = []                                  # 결과 행 목록임 / result rows
    for i in range(n):                         # 행마다 / for each row
        row = {c: 0.0 for c in COLUMNS}        # 20개 신호를 0으로 시작함 / start the 20 signals at 0
        for s in sources:                      # 출처마다 / for each source
            if s:                              # 비어 있지 않으면 / if not empty
                row.update(s[i % len(s)])      # 짧은 출처는 반복해서 채움 / repeat shorter sources to fill
        rows.append(row)                       # 한 행을 추가함 / add a row
    return rows                                # 합친 표를 돌려줌 / return the merged table


def main():                                    # 명령줄 시작점임 / command-line entry point
    ap = argparse.ArgumentParser(description="공개 데이터 → 20개 신호 CSV")   # 옵션 해석기임 / option parser
    ap.add_argument("--asos")                  # 기상청 ASOS CSV 경로임 / path of the KMA ASOS CSV
    ap.add_argument("--gpx")                   # 등산로 GPX 경로임 / path of the trail GPX
    ap.add_argument("--out", default="data/public/merged.csv")   # 저장 경로임 / output path
    a = ap.parse_args()                        # 옵션을 읽음 / read the options
    rows = merge(asos_rows(a.asos) if a.asos else [], gpx_slopes(a.gpx) if a.gpx else [])   # 변환하고 합침 / convert and merge
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)   # 폴더를 만듦 / create the folder
    with open(a.out, "w", newline="", encoding="utf-8-sig") as f:   # 저장 파일을 엶 / open the output file
        w = csv.DictWriter(f, fieldnames=COLUMNS)   # 20개 열 작성기임 / writer for the 20 columns
        w.writeheader()                        # 열 이름을 씀 / write the column names
        for r in rows:                         # 행마다 / for each row
            w.writerow({k: f"{v:.4f}" for k, v in r.items()})   # 소수 4자리로 씀 / write with 4 decimals
    print("saved", a.out, len(rows), "rows (label 없음: 웹 데이터 센터에서 올리면 합성 규칙으로 채움)")   # 결과를 알림 / report the result


if __name__ == "__main__":                     # 직접 실행했을 때만 / only when run directly
    main()                                     # 시작점을 호출함 / call the entry point
