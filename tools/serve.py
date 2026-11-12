# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Local web server: free port, correct MIME types, data-request and data-store APIs.
"""
serve.py : 웹 실험실 실행기(프로젝트 루트 기준, 어느 PC에서나 동작, 포트 문제 해결판)

왜 쓰는가 : v01은 8080 포트가 이미 쓰이면 실패했고, Windows에서 .js 파일이
           text/plain으로 전달되면 브라우저가 스크립트를 막는 문제가 있었음.
하는 일   : (1) 8765번부터 비어 있는 포트를 자동으로 찾음
           (2) .js/.css/.mp3 등의 MIME 형식을 강제로 바르게 지정함
           (3) 모든 버전을 한 서버로 제공함 → /v01/dist/, /v02/web/
           (4) 브라우저를 자동으로 열고, 같은 와이파이용 LAN 주소도 알려 줌
사용법    : python tools\\serve.py [--port 8765] [--lan] [--version v02] [--no-browser]
"""
import argparse                                # 명령줄 옵션 도구임 / command-line option tool
import datetime                                # 저장 파일 이름의 시각에 씀 / used for the time in saved file names
import json                                    # 요청 본문(JSON) 처리에 씀 / used to handle request bodies (JSON)
import subprocess                              # Edge 브라우저 실행에 씀 / used to launch the Edge browser
import sys                                     # 모듈 경로 조정에 씀 / used to adjust the module path
import functools                               # 처리기에 폴더를 묶어 넘기는 도구임 / tool to bind the folder to the handler
import http.server                             # 파이썬 내장 웹 서버임 / Python built-in web server
import mimetypes                               # 파일 형식(MIME) 표를 다루는 도구임 / tool for file types (MIME)
import os                                      # 경로 도구임 / path tools
import socket                                  # 포트 검사, IP 확인 도구임 / port checks, IP lookup
import socketserver                            # 다중 접속 서버 도구임 / multi-connection server tool
import webbrowser                              # 브라우저 자동 열기 도구임 / browser auto-open tool
import threading                               # 자동 GitHub 저장을 뒤에서 돌림 / runs auto GitHub save in the background
import time                                    # 자동 저장 간격 / auto-save interval
import urllib.parse                            # 주소의 질문 부분 해석 / parses URL query strings

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트(설치한 폴더) 위치임 / project root (install folder)
STORE = os.path.join(ROOT, "data_store")             # 생성 데이터 보관함 폴더 / folder that keeps generated datasets


def store_list():                              # 보관함의 데이터 목록(새 것부터) / list stored datasets, newest first
    os.makedirs(STORE, exist_ok=True)          # 없으면 만듦 / create if missing
    out = []                                   # 결과 목록임 / result list
    for f in sorted(os.listdir(STORE), reverse=True):   # 파일마다 / for each file
        if not f.endswith(".csv"): continue    # CSV만 셈 / count CSV only
        base = os.path.join(STORE, f[:-4]); meta = {}   # 같은 이름의 JSON(근거 정보)임 / JSON with the same name (evidence info)
        if os.path.exists(base + ".json"):
            try: meta = json.load(open(base + ".json", encoding="utf-8"))   # 근거 정보를 읽음 / read the evidence info
            except Exception: meta = {}
        rows = max(0, sum(1 for _ in open(base + ".csv", encoding="utf-8-sig")) - 1)   # 행 수(머리줄 제외)임 / number of rows (excluding the header)
        out.append({"file": f, "id": meta.get("id"), "name": meta.get("name"), "grade": meta.get("grade"), "kind": meta.get("kind"), "saved_at": meta.get("saved_at"), "rows": rows, "bytes": os.path.getsize(base + ".csv"), "has_meta": bool(meta)})   # 목록 항목임 / list item
    return out                                 # 목록을 돌려줌 / return the list
VERS = os.path.join(ROOT, "versions")          # 버전 폴더 위치임 / location of the version folders
for ext, typ in {".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
                 ".mp3": "audio/mpeg", ".wav": "audio/wav", ".svg": "image/svg+xml", ".html": "text/html"}.items():   # 자주 쓰는 형식마다 / for each common type
    mimetypes.add_type(typ, ext)               # Windows 레지스트리 설정과 무관하게 바른 형식을 등록함 / register correct types regardless of Windows registry settings


def versions():                                # 존재하는 버전 폴더 목록(번호 순)임 / existing version folders (in number order)
    vs = [d for d in os.listdir(VERS) if d.startswith("v") and d[1:].isdigit()]   # v숫자 형식만 고름 / pick only vNN names
    return sorted(vs, key=lambda d: int(d[1:]))   # 번호 순으로 정렬함 / sort by number


def entry(v):                                  # 버전별 첫 화면 경로임 / entry page path per version
    return f"/{v}/web/index.html" if os.path.isdir(os.path.join(VERS, v, "web")) else f"/{v}/dist/index.html"   # v01은 dist, 이후는 web임 / v01 uses dist, later versions use web


class Handler(http.server.SimpleHTTPRequestHandler):   # 요청 처리기임 / request handler
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".css": "text/css", ".mp3": "audio/mpeg"}   # 형식 표를 한 번 더 고정함 / fix the type table once more

    def do_GET(self):                          # 주소 요청을 처리함 / handle GET requests
        if self.path.split("?")[0].endswith("/api/datasets"):   # 데이터 보관함 목록 / list the data store
            return self._json(200, {"dir": STORE, "items": store_list()})   # 보관된 데이터 목록을 돌려줌 / return the list of stored datasets
        if self.path.split("?")[0].endswith("/api/dataset"):    # 보관된 데이터 하나 읽기 / read one stored dataset
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query); name = os.path.basename(q.get("file", [""])[0])   # 파일 이름(경로 조작 방지)임 / file name (prevents path tricks)
            base = os.path.join(STORE, os.path.splitext(name)[0])   # 확장자를 뺀 경로임 / path without extension
            if not name or not os.path.exists(base + ".csv"): return self._json(404, {"error": "not found"})   # 없으면 오류임 / error if missing
            meta = json.load(open(base + ".json", encoding="utf-8")) if os.path.exists(base + ".json") else {}   # 근거 정보임 / evidence info
            return self._json(200, {"meta": meta, "csv": open(base + ".csv", encoding="utf-8-sig").read()})   # 내용을 돌려줌 / return the content
        if self.path in ("/", "/index.html"):  # 첫 주소로 오면 / when the root address is requested
            self.send_response(302)            # 다른 주소로 안내함 / redirect to another address
            self.send_header("Location", entry(self.server.version))   # 선택 버전의 첫 화면으로 보냄 / send to the entry page of the selected version
            self.end_headers()                 # 응답 머리를 끝냄 / end the response headers
            return                             # 처리를 끝냄 / done
        return super().do_GET()                # 나머지는 파일을 그대로 보냄 / serve other files as they are

    def do_HEAD(self):                         # 머리만 묻는 요청도 같은 규칙으로 처리함 / handle HEAD requests with the same rules
        if self.path in ("/", "/index.html"):  # 첫 주소면 / if root address
            return self.do_GET()               # 같은 안내(302)를 보냄 / send the same redirect (302)
        return super().do_HEAD()               # 나머지는 원래대로 처리함 / otherwise handle normally

    def _json(self, code, obj):                # JSON 응답을 보냄 / send a JSON response
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")   # 응답 글자를 바이트로 바꿈 / convert the response text to bytes
        self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)   # 응답을 씀 / write the response

    def do_POST(self):                         # 화면에서 보낸 데이터 요청, 데이터셋 저장을 처리함 / handle data requests and dataset saves from the page
        n = int(self.headers.get("Content-Length", 0))   # 본문 길이임 / body length
        try:                                   # 잘못된 요청에도 서버가 멈추지 않게 함 / keep the server running even on bad requests
            data = json.loads(self.rfile.read(n).decode("utf-8"))   # 본문 JSON을 읽음 / read the JSON body
        except Exception:                      # 읽기 실패면 / if reading fails
            return self._json(400, {"error": "bad json"})   # 오류로 응답함 / answer with an error
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")   # 파일 이름용 시각임 / time for the file name
        ver = self.path.strip("/").split("/")[0] if self.path.strip("/").split("/")[0].startswith("v") else versions()[-1]   # 요청을 보낸 화면의 버전임 / version of the page that sent the request
        if self.path.endswith("/api/request"):  # 데이터 생성 요청 기록이면 / if it is a data-generation request log
            os.makedirs(os.path.join(ROOT, "requests"), exist_ok=True)   # 요청 폴더를 만듦 / create the request folder
            path = os.path.join(ROOT, "requests", "req_" + stamp + ".json")   # 저장 경로임 / output path
            json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # 요청을 저장함 / save the request
            return self._json(200, {"path": path})   # 저장 위치를 알려 줌 / report the saved location
        if self.path.endswith("/api/save-dataset"):   # 데이터셋 저장이면 / if it is a dataset save
            out = STORE; os.makedirs(out, exist_ok=True)   # 데이터 보관함(프로젝트 루트/data_store, 버전과 무관하게 유지)임 / data store at project root
            base = os.path.join(out, data.get("id", "D") + "_" + stamp)   # 파일 이름 앞부분임 / file name prefix
            open(base + ".csv", "w", encoding="utf-8-sig").write(data.pop("csv", ""))   # CSV를 저장함 / save the CSV
            json.dump(data, open(base + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # 근거, 검증 정보를 저장함 / save the evidence and check info
            data["saved_at"] = stamp; json.dump(data, open(base + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # 저장 시각을 함께 기록함 / also record the save time
            return self._json(200, {"path": base + ".csv", "file": os.path.basename(base) + ".csv"})   # 저장 위치를 알려 줌 / report the saved location
        return self._json(404, {"error": "unknown api"})   # 모르는 주소임 / unknown address

    def end_headers(self):                     # 응답 머리에 공통 설정을 붙임 / add common settings to response headers
        self.send_header("Cache-Control", "no-store")   # 개발 중 옛 파일이 남지 않게 캐시를 끔 / turn off caching so old files do not linger during development
        super().end_headers()                  # 원래 처리를 이어감 / continue the original processing

    def log_message(self, fmt, *args):         # 접속 기록 출력을 간단히 함 / simplify the access log
        pass                                   # 화면이 어지럽지 않게 생략함 / omitted to keep the console clean


def free_port(start, host):                    # start부터 비어 있는 포트를 찾음 / finds a free port starting from start
    for p in range(start, start + 100):        # 100개까지 차례로 시도함 / try up to 100 in order
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:   # 시험용 소켓을 만듦 / create a test socket
            try:                               # 묶기를 시도함 / try to bind
                s.bind((host, p))              # 성공하면 비어 있는 포트임 / if it succeeds the port is free
                return p                       # 그 포트를 돌려줌 / return that port
            except OSError:                    # 이미 쓰이면 / if already in use
                continue                       # 다음 번호를 시도함 / try the next number
    raise SystemExit("빈 포트를 찾지 못했음")    # 모두 실패하면 종료함 / exit if all fail


def lan_ip():                                  # 같은 와이파이에서 접속할 이 PC의 IP를 구함 / finds this PC's IP for access from the same Wi-Fi
    try:                                       # 실패해도 괜찮도록 시도함 / tries so that failure is harmless
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:   # UDP 소켓을 만듦 / create a UDP socket
            s.connect(("8.8.8.8", 80))         # 실제 전송 없이 경로만 정함 / sets a route without actually sending
            return s.getsockname()[0]          # 이 PC의 내부 IP를 돌려줌 / return this PC's internal IP
    except OSError:                            # 네트워크가 없으면 / if there is no network
        return "127.0.0.1"                     # 자기 자신 주소를 돌려줌 / return the loopback address


def main():                                    # 시작점임 / entry point
    vs = versions()                            # 버전 목록을 읽음 / read the version list
    ap = argparse.ArgumentParser()             # 옵션 해석기임 / option parser
    ap.add_argument("--port", type=int, default=8765)   # 시작 포트임(8080 충돌을 피함) / start port (avoids the 8080 conflict)
    ap.add_argument("--lan", action="store_true")       # 같은 와이파이의 다른 기기 접속 허용 여부임 / whether other devices on the same Wi-Fi may connect
    ap.add_argument("--version", default=vs[-1])        # 기본은 최신 버전임 / default is the latest version
    ap.add_argument("--no-browser", action="store_true")   # 브라우저 자동 열기 끄기임 / turn off browser auto-open
    ap.add_argument("--browser", default="edge")   # 기본은 Microsoft Edge(사람 같은 신경망 음성 내장)임 / default is Microsoft Edge (built-in human-like neural voices)
    ap.add_argument("--no-autopush", action="store_true", help="GitHub 자동 저장 끄기 / turn off auto GitHub save")
    a = ap.parse_args()                        # 옵션을 읽음 / read the options
    host = "0.0.0.0" if a.lan else "127.0.0.1"   # LAN 허용이면 모든 주소, 아니면 이 PC만임 / all addresses if LAN is allowed, otherwise this PC only
    port = free_port(a.port, host)             # 빈 포트를 찾음 / find a free port
    handler = functools.partial(Handler, directory=VERS)   # versions 폴더를 제공하도록 묶음 / bind to serve the versions folder
    socketserver.ThreadingTCPServer.allow_reuse_address = True   # 재시작 시 포트 재사용을 허용함 / allow port reuse on restart
    with socketserver.ThreadingTCPServer((host, port), handler) as httpd:   # 서버를 만듦 / create the server
        httpd.version = a.version              # 첫 화면 버전을 기록함 / record the entry version
        url = f"http://127.0.0.1:{port}/"      # 이 PC 접속 주소임 / address on this PC
        print("=" * 60)                        # 구분선임 / divider line
        print(f" 산행안전 양자 실험실 {a.version}  / Hiking-safety quantum AI lab {a.version}")   # 안내임 / notice
        print(f" 주소 / URL : {url}")           # 핵심 주소 하나만 알림(지난 버전 주소는 생략) / show only the key address (older versions omitted)
        if a.lan:                              # LAN 허용이면 / if LAN is allowed
            print(f" 같은 와이파이 기기: http://{lan_ip()}:{port}/  (Windows 방화벽 허용 필요)")   # LAN 주소를 알림 / show the LAN address
        print(" 끝내려면 이 창에서 Ctrl+C / press Ctrl+C to stop")      # 종료 방법을 알림 / show how to quit
        print("=" * 60)                        # 구분선임 / divider line
        if not getattr(a, "no_autopush", False):   # GitHub 자동 저장(연결된 경우) / automatic GitHub save when connected
            def _autopush():                    # 10분마다 바뀐 것을 GitHub로 올림 / push changes every 10 minutes
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # tools 폴더를 찾게 함 / make tools importable
                import auto_push                # 자동 저장 모듈 / auto-save module
                while True:                     # 계속 / forever
                    try: auto_push.push_once()  # 한 번 저장 / save once
                    except Exception as e: print("auto_push:", e)   # 오류는 알리고 계속 / report and continue
                    time.sleep(600)             # 10분 쉼 / wait 10 minutes
            threading.Thread(target=_autopush, daemon=True).start()   # 뒤에서 시작 / start in background
            print(" GitHub 자동 저장: 10분마다 / auto-save to GitHub every 10 min")   # 안내 / notice
        if not a.no_browser:                   # 자동 열기가 켜져 있으면 / if auto-open is on
            opened = False                     # Edge로 열었는지 기록함 / records whether Edge opened it
            if a.browser == "edge" and os.name == "nt":   # Windows에서 Edge를 원하면 / if Edge is wanted on Windows
                try:                           # Edge 실행을 시도함 / try to launch Edge
                    subprocess.Popen(["cmd", "/c", "start", "", "msedge", url], shell=False); opened = True   # Edge로 엶(SunHi, InJoon 신경망 음성 사용 가능) / open in Edge (SunHi, InJoon neural voices available)
                except Exception:              # Edge가 없으면 / if Edge is missing
                    opened = False             # 기본 브라우저로 넘어감 / fall back to the default browser
            if not opened:                     # Edge로 못 열었으면 / if Edge could not open it
                webbrowser.open(url)           # 기본 브라우저로 엶 / open in the default browser
        try:                                   # 서버를 계속 실행함 / keep the server running
            httpd.serve_forever()              # 요청을 기다림 / wait for requests
        except KeyboardInterrupt:              # Ctrl+C를 누르면 / when Ctrl+C is pressed
            print("종료함")                     # 종료를 알림 / report shutdown


if __name__ == "__main__":                     # 직접 실행했을 때만 / only when run directly
    main()                                     # 시작점을 호출함 / call the entry point
