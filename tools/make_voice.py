# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Pre-records narration as neural-voice MP3 files (edge-tts).
"""
make_voice.py : 음성 대본을 자연스러운 한국어 MP3로 미리 녹음함

왜 쓰는가 : 브라우저 TTS는 PC마다 목소리 품질이 다름. Microsoft Azure의 신경망 음성
           (ko-KR-SunHiNeural 여성, ko-KR-InJoonNeural 남성, ko-KR-HyunsuMultilingualNeural 남성)으로 녹음해 두면
           어떤 PC, 휴대폰에서도 같은 친절한 목소리로 들을 수 있음.
           (edge-tts 패키지 사용, 인터넷 연결 필요)
하는 일   : web/data/narration_ko.json 의 대본을 web/audio/<id>.mp3 로 저장함.
           웹은 MP3가 있으면 MP3를, 없으면 브라우저 TTS를 자동으로 씀.
사용법    : python tools\\make_voice.py [--voice ko-KR-SunHiNeural] [--rate -5%]
"""
import argparse                                # 명령줄 옵션 도구임 / command-line option tool
import asyncio                                 # edge-tts가 쓰는 비동기 실행 도구임 / async runner used by edge-tts
import json                                    # 대본 JSON 읽기 도구임 / narration JSON reader
import os                                      # 경로 도구임 / path tools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)


def latest_web():                              # 최신 버전의 web 폴더 경로임 / web folder path of the latest version
    vs = sorted([d for d in os.listdir(os.path.join(ROOT, "versions")) if d[1:].isdigit()], key=lambda d: int(d[1:]))   # 버전 목록임 / version list
    return os.path.join(ROOT, "versions", vs[-1], "web")   # 최신 web 폴더임 / latest web folder


async def run(voice, rate, male="ko-KR-InJoonNeural", alternate=True):   # 모든 대본을 녹음함(기본: 대본마다 여성, 남성 교대) / records every script (default: alternate female and male per script)
    import edge_tts                            # 설치되어 있어야 함(setup.bat이 설치) / must be installed (setup.bat installs it)
    web = latest_web()                         # 대상 폴더임 / target folder
    scripts = json.load(open(os.path.join(web, "data", "narration_ko.json"), encoding="utf-8"))   # 대본을 읽음 / read the scripts
    os.makedirs(os.path.join(web, "audio"), exist_ok=True)   # 음성 폴더를 만듦 / create the audio folder
    for n, (key, text) in enumerate(scripts.items()):   # 대본마다 / for each script
        v = male if alternate and n % 2 else voice   # 짝수 번째는 여성(SunHi), 홀수 번째는 남성(InJoon) 목소리임 / even scripts use the female (SunHi) voice, odd ones the male (InJoon) voice
        out = os.path.join(web, "audio", key + ".mp3")   # 저장 경로임 / output path
        if os.path.exists(out) and os.path.getsize(out) > 1000:   # 이미 녹음된 파일은 / already recorded files are
            continue                           # 건너뜀(대본이 바뀌면 audio 폴더의 해당 파일을 지우고 다시 실행) / skipped (if a script changes, delete its file in audio and run again)
        await edge_tts.Communicate("... " + text, v, rate=rate).save(out)   # 앞에 짧은 쉼을 두어 첫 음절 잘림을 막고 신경망 음성으로 녹음함 / records with a neural voice after a short pause to avoid clipping the first syllable
        print("saved", out)                    # 진행을 알림 / report progress


def main():                                    # 시작점임 / entry point
    ap = argparse.ArgumentParser()             # 옵션 해석기임 / option parser
    ap.add_argument("--voice", default="ko-KR-SunHiNeural")   # 목소리(친절한 여성 음성)임 / voice (friendly female voice)
    ap.add_argument("--rate", default="+8%")   # 약간 빠르게 읽음(요청 반영) / reads slightly faster (as requested)
    ap.add_argument("--male", default="ko-KR-InJoonNeural")   # 교대에 쓸 남성 목소리임 / male voice used for alternation
    ap.add_argument("--no-alternate", action="store_true")   # 남녀 교대를 끄려면 지정함 / set to turn off male/female alternation
    a = ap.parse_args()                        # 옵션을 읽음 / read the options
    asyncio.run(run(a.voice, a.rate, a.male, not a.no_alternate))   # 녹음을 실행함 / run the recording


if __name__ == "__main__":                     # 직접 실행했을 때만 / only when run directly
    main()                                     # 시작점을 호출함 / call the entry point
