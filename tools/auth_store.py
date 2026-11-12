# Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
# 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
# [English] Accounts for the local lab server: salted PBKDF2 passwords, sign-up, ID lookup by e-mail, password reset by a security question, access log.
"""
auth_store.py : 실험실 로그인 계정 관리 / login accounts for the lab server
  - 계정 파일 / account file : <프로젝트>/accounts/users.json (GitHub에 올리지 않음 / never pushed to GitHub)
  - 비밀번호, 확인 질문 답 : 소금(salt)을 친 PBKDF2-SHA256 해시로만 저장(원문 저장 안 함) / stored only as salted PBKDF2 hashes
  - 접속 기록 / access log : <프로젝트>/logs/access_log.csv (로그인 성공, 실패, 로그아웃, 가입, 찾기, 재설정)
  - 기본 계정 / default accounts : guest/guest(누구나), admin(처음 실행 때 무작위 비밀번호를 accounts/관리자_초기비밀번호.txt에 기록)
"""
import csv, datetime, hashlib, hmac, json, os, re, secrets, threading, time   # 표준 모듈 / standard modules

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 프로젝트 루트 / project root
ADIR = os.path.join(ROOT, "accounts"); UFILE = os.path.join(ADIR, "users.json")   # 계정 폴더와 파일 / account folder and file
LOG = os.path.join(ROOT, "logs", "access_log.csv")                   # 접속 기록 / access log
LOCK = threading.Lock()                                              # 동시 접근 보호 / guards concurrent access
SESS = {}                                                            # 로그인 표 {토큰: (아이디, 만료 시각)} / sessions {token: (id, expiry)}
FAIL = {}                                                            # 실패 횟수 {아이디: [횟수, 잠금 해제 시각]} / failures {id: [count, unlock time]}
ITER = 200_000                                                       # PBKDF2 반복 수 / PBKDF2 iterations
ID_RE = re.compile(r"^[A-Za-z0-9_.-]{3,20}$")                        # 아이디 규칙 / ID rule


def _hash(text, salt=None):                                          # 해시를 만듦 / make a hash
    salt = salt or secrets.token_hex(16)                             # 새 소금 / new salt
    h = hashlib.pbkdf2_hmac("sha256", text.encode("utf-8"), bytes.fromhex(salt), ITER).hex()   # PBKDF2
    return salt + "$" + h                                            # 소금$해시 / salt$hash


def _check(text, stored):                                            # 해시를 비교함 / compare against a stored hash
    try: salt, _ = stored.split("$", 1)
    except Exception: return False
    return hmac.compare_digest(_hash(text, salt), stored)            # 시간 일정 비교 / constant-time compare


def _norm(ans): return re.sub(r"\s+", "", (ans or "")).lower()       # 답 정규화(공백, 대소문자 무시) / normalize answers


def _load():                                                         # 계정 읽기(없으면 기본 계정 생성) / load accounts (create defaults if missing)
    if os.path.exists(UFILE):
        with open(UFILE, encoding="utf-8") as fh: return json.load(fh)
    os.makedirs(ADIR, exist_ok=True)
    pw = secrets.token_urlsafe(9)                                    # 관리자 초기 비밀번호 / initial admin password
    users = {"guest": {"name": "손님", "email": "", "role": "guest", "pw": _hash("guest"), "q": "", "a": "", "created": _now()},
             "admin": {"name": "관리자", "email": "", "role": "admin", "pw": _hash(pw), "q": "", "a": "", "created": _now()}}
    with open(os.path.join(ADIR, "관리자_초기비밀번호.txt"), "w", encoding="utf-8") as fh:
        fh.write("admin 초기 비밀번호 / initial admin password: " + pw + "\n로그인 후 꼭 바꾸십시오. / Change it after logging in.\n")
    _save(users); return users


def _save(users):                                                    # 계정 저장 / save accounts
    os.makedirs(ADIR, exist_ok=True); tmp = UFILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh: json.dump(users, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, UFILE)                                           # 원자적 교체 / atomic replace


def _now(): return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(event, uid, ip, ok, note=""):                                # 접속 기록 한 줄 / one access-log line
    os.makedirs(os.path.dirname(LOG), exist_ok=True); new = not os.path.exists(LOG)
    with open(LOG, "a", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        if new: w.writerow(["시각/time", "사건/event", "아이디/id", "IP", "결과/result", "비고/note"])
        w.writerow([_now(), event, uid, ip, "성공/ok" if ok else "실패/fail", note])


def _mask(uid): return uid[:2] + "*" * max(1, len(uid) - 3) + uid[-1:] if len(uid) > 2 else uid[0] + "*"   # 아이디 가림 / mask an ID


def login(uid, pw, ip):                                              # 로그인 / log in
    with LOCK:
        users = _load(); f = FAIL.get(uid, [0, 0])
        if f[1] > time.time(): log("login", uid, ip, False, "잠김/locked"); return {"ok": False, "msg": "비밀번호를 5번 틀려 5분 동안 잠겼습니다. 잠시 뒤 다시 시도하십시오."}
        u = users.get(uid)
        if not u or not _check(pw, u["pw"]):
            f[0] += 1; f[1] = time.time() + 300 if f[0] >= 5 else 0; FAIL[uid] = [0, f[1]] if f[0] >= 5 else f
            log("login", uid, ip, False); return {"ok": False, "msg": "아이디 또는 비밀번호가 맞지 않습니다."}
        FAIL.pop(uid, None); tok = secrets.token_urlsafe(24); SESS[tok] = (uid, time.time() + 12 * 3600)
        log("login", uid, ip, True); return {"ok": True, "token": tok, "user": {"id": uid, "name": u["name"], "role": u["role"]}}


def who(tok):                                                        # 토큰 → 아이디 / token → id
    s = SESS.get(tok or "")
    if not s or s[1] < time.time(): SESS.pop(tok or "", None); return None
    return s[0]


def logout(tok, ip):
    uid = who(tok); SESS.pop(tok or "", None); log("logout", uid or "-", ip, True); return {"ok": True}


def signup(d, ip):                                                   # 회원가입 / sign up
    uid = (d.get("id") or "").strip(); pw = d.get("pw") or ""; email = (d.get("email") or "").strip().lower(); q = (d.get("q") or "").strip(); a = d.get("a") or ""
    if not ID_RE.match(uid): return {"ok": False, "msg": "아이디는 영문, 숫자, _ . - 로 3~20자입니다."}
    if len(pw) < 6: return {"ok": False, "msg": "비밀번호는 6자 이상이어야 합니다."}
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email): return {"ok": False, "msg": "이메일 형식이 맞지 않습니다."}
    if not q or not _norm(a): return {"ok": False, "msg": "비밀번호 찾기용 확인 질문과 답을 넣으십시오."}
    with LOCK:
        users = _load()
        if uid in users: log("signup", uid, ip, False, "중복"); return {"ok": False, "msg": "이미 있는 아이디입니다."}
        users[uid] = {"name": (d.get("name") or uid).strip()[:30], "email": email, "role": "user", "pw": _hash(pw), "q": q[:80], "a": _hash(_norm(a)), "created": _now()}
        _save(users)
    log("signup", uid, ip, True); return {"ok": True, "msg": "가입되었습니다. 로그인하십시오."}


def find_id(email, ip):                                              # 아이디 찾기(가린 아이디만 보임) / find ID (masked)
    email = (email or "").strip().lower(); users = _load()
    ids = [_mask(k) for k, u in users.items() if email and u.get("email") == email]
    log("find-id", email or "-", ip, bool(ids)); return {"ok": bool(ids), "ids": ids, "msg": "" if ids else "그 이메일로 가입한 아이디가 없습니다."}


def question(uid):                                                   # 확인 질문 보기 / get the security question
    u = _load().get((uid or "").strip())
    return {"ok": bool(u and u.get("q")), "q": u.get("q") if u else "", "msg": "" if u and u.get("q") else "확인 질문이 등록된 아이디가 아닙니다. 관리자에게 재설정을 요청하십시오."}


def reset(d, ip):                                                    # 비밀번호 재설정(확인 질문 답 일치) / reset the password (answer must match)
    uid = (d.get("id") or "").strip(); npw = d.get("newpw") or ""
    if len(npw) < 6: return {"ok": False, "msg": "새 비밀번호는 6자 이상이어야 합니다."}
    with LOCK:
        users = _load(); u = users.get(uid)
        if not u or not u.get("a") or not _check(_norm(d.get("a")), u["a"]): log("reset", uid, ip, False); return {"ok": False, "msg": "확인 질문의 답이 맞지 않습니다."}
        u["pw"] = _hash(npw); _save(users)
    log("reset", uid, ip, True); return {"ok": True, "msg": "비밀번호를 바꿨습니다. 새 비밀번호로 로그인하십시오."}


def change(tok, old, new, ip):                                       # 로그인한 사람의 비밀번호 바꾸기 / change own password
    uid = who(tok)
    if not uid: return {"ok": False, "msg": "다시 로그인하십시오."}
    if uid == "guest": return {"ok": False, "msg": "guest 계정의 비밀번호는 바꿀 수 없습니다."}
    if len(new or "") < 6: return {"ok": False, "msg": "새 비밀번호는 6자 이상이어야 합니다."}
    with LOCK:
        users = _load()
        if not _check(old or "", users[uid]["pw"]): log("change-pw", uid, ip, False); return {"ok": False, "msg": "지금 비밀번호가 맞지 않습니다."}
        users[uid]["pw"] = _hash(new); _save(users)
    log("change-pw", uid, ip, True); return {"ok": True, "msg": "비밀번호를 바꿨습니다."}


def admin_log(tok, n=300):                                           # 접속 기록 보기(관리자만) / view the access log (admin only)
    uid = who(tok); users = _load()
    if not uid or users.get(uid, {}).get("role") != "admin": return {"ok": False, "msg": "관리자만 볼 수 있습니다."}
    rows = []
    if os.path.exists(LOG):
        with open(LOG, encoding="utf-8-sig") as fh: rows = list(csv.reader(fh))[1:]
    return {"ok": True, "rows": rows[-n:][::-1], "users": [{"id": k, "name": u["name"], "role": u["role"], "email": u.get("email", ""), "created": u.get("created", "")} for k, u in users.items()]}


def admin_reset(tok, uid, npw, ip):                                  # 관리자가 비밀번호 재설정 / admin resets a password
    me = who(tok); users = _load()
    if not me or users.get(me, {}).get("role") != "admin": return {"ok": False, "msg": "관리자만 할 수 있습니다."}
    if uid not in users or len(npw or "") < 6: return {"ok": False, "msg": "아이디 또는 새 비밀번호(6자 이상)를 확인하십시오."}
    with LOCK: users[uid]["pw"] = _hash(npw); _save(users)
    log("admin-reset", uid, ip, True, "by " + me); return {"ok": True, "msg": uid + "의 비밀번호를 바꿨습니다."}
