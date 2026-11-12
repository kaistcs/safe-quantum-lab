> Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.  
> 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.

# data_store : 생성 데이터 보관함 / Generated data store

- 웹 실험실에서 만든 합성 데이터가 자동(또는 "보관함에 저장" 버튼)으로 여기에 저장됩니다.
- 데이터 하나 = `D번호_날짜시각.csv`(표본) + `D번호_날짜시각.json`(근거, 검증 항목, 요인 결합 정보).
- 웹 실험실의 「③ 합성 데이터 생성과 실험 관제 › 데이터 보관함」 화면에서 목록 보기, 미리보기, 불러오기, 내려받기를 할 수 있습니다.
- 버전 폴더(versions/vNN)와 무관하게 유지되므로 새 버전에서도 그대로 쓸 수 있습니다.

Datasets generated in the web lab are saved here automatically (or with the "Save to store" button):
one `.csv` (samples) and one `.json` (evidence, checks, factor design) per dataset.
Browse, preview, load and download them on the "Data store" screen.
