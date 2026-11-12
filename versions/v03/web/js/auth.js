/* Copyright (c) 2025-2026 숙명여자대학교 박영호 교수 (Prof. Young-ho Park, Sookmyung Women's University). All rights reserved.
 * 행정안전부 재난안전연구개발사업 산행안전 과제 결과물. 이용 조건은 프로젝트 루트의 LICENSE를 따름.
 * [English] Login screen: full accounts (sign-up, find ID, reset password, access log) when served by run.bat; guest/guest gate on static hosting.
 *
 * auth.js : 로그인 화면 / login screen
 *   - run.bat(로컬 서버)로 열면: 진짜 계정(서버에 해시로 저장), 회원가입, 아이디 찾기(이메일), 비밀번호 찾기(확인 질문), 접속 기록(관리자)
 *   - GitHub 웹이나 html 파일로 열면: 서버가 없어 guest/guest 입장 화면만 동작하고, 접속 기록은 이 브라우저에만 남음
 */
(function (QP) {
  const $ = function (id) { return document.getElementById(id); };   // 요소 찾기 / find an element
  const SS = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }, del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { } } }; // 탭을 닫으면 지워지는 저장소 / per-tab storage
  let server = false, user = null;                  // 서버 사용 가능 여부, 로그인한 사람 / server available, logged-in user
  function api(op, body) { return fetch("api/auth/" + op, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); } // 서버 요청 / server request
  function localLog(ev, id, ok) { try { const a = JSON.parse(localStorage.getItem("qp_access_log") || "[]"); a.push([new Date().toLocaleString("ko-KR"), ev, id, "이 브라우저", ok ? "성공/ok" : "실패/fail", ""]); localStorage.setItem("qp_access_log", JSON.stringify(a.slice(-300))); } catch (e) { } } // 서버가 없을 때 브라우저 기록 / browser-only log without a server
  function ping() { return new Promise(function (res) { if (location.protocol === "file:") return res(false); const t = setTimeout(function () { res(false); }, 1500); fetch("api/auth/ping", { cache: "no-store" }).then(function (r) { clearTimeout(t); res(r.ok); }).catch(function () { clearTimeout(t); res(false); }); }); } // 서버 확인 / check the server

  function overlay() {                              // 로그인 화면 만들기 / build the login screen
    const d = document.createElement("div"); d.id = "login"; d.className = "login";
    d.innerHTML = '<div class="lbox"><div class="lhead"><b>숙명 AGI 산행안전 양자 실험실</b><span>로그인</span></div>' +
      '<div class="ltabs"><button data-t="in" class="on">로그인</button><button data-t="up">회원가입</button><button data-t="fid">아이디 찾기</button><button data-t="fpw">비밀번호 찾기</button></div>' +
      '<div class="lpane" id="lp-in"><label>아이디<input id="lId" autocomplete="username"></label><label>비밀번호<input id="lPw" type="password" autocomplete="current-password"></label><button id="lGo" class="primary">로그인</button><button id="lGuest">누구나: guest / guest 로 들어가기</button></div>' +
      '<div class="lpane" id="lp-up" hidden><label>아이디(영문, 숫자 3~20자)<input id="uId"></label><label>이름<input id="uName"></label><label>이메일(아이디 찾기에 씀)<input id="uMail" type="email"></label><label>비밀번호(6자 이상)<input id="uPw" type="password"></label><label>확인 질문(비밀번호 찾기에 씀)<select id="uQ"><option>내가 처음 오른 산은?</option><option>초등학교 이름은?</option><option>어릴 때 별명은?</option><option>가장 좋아하는 계절은?</option></select></label><label>질문의 답<input id="uA"></label><button id="uGo" class="primary">가입하기</button></div>' +
      '<div class="lpane" id="lp-fid" hidden><label>가입할 때 쓴 이메일<input id="fMail" type="email"></label><button id="fGo" class="primary">아이디 찾기</button></div>' +
      '<div class="lpane" id="lp-fpw" hidden><label>아이디<input id="rId"></label><button id="rQ">확인 질문 보기</button><p id="rQt" class="lq"></p><label>질문의 답<input id="rA"></label><label>새 비밀번호(6자 이상)<input id="rPw" type="password"></label><button id="rGo" class="primary">비밀번호 바꾸기</button></div>' +
      '<p id="lMsg" class="lmsg"></p><p class="lnote" id="lNote"></p></div>';
    document.body.appendChild(d); return d;
  }
  function msg(t, ok) { const m = $("lMsg"); m.textContent = t || ""; m.className = "lmsg" + (ok ? " ok" : t ? " bad" : ""); } // 안내 문구 / message
  function done(u, tok, cb) {                       // 로그인 성공 / login succeeded
    user = u; SS.set("qp_user", JSON.stringify(u)); if (tok) SS.set("qp_tok", tok);
    const o = $("login"); if (o) o.remove(); chip(); cb();
  }
  function gate(cb) {                               // 로그인한 뒤에만 cb를 부름 / call cb only after login
    const su = SS.get("qp_user"); if (su) { try { user = JSON.parse(su); } catch (e) { user = null; } }
    ping().then(function (ok) { server = ok;
      if (user) { chip(); return cb(); }            // 이 탭에서 이미 로그인함 / already logged in on this tab
      if (!server && /[?&]guest=1/.test(location.search)) return done({ id: "guest", name: "손님", role: "guest" }, null, cb); // 시연, 점검용 바로 입장(서버 없는 화면에서 guest만) / quick guest entry for demos and checks (static pages, guest only)
      overlay(); $("lNote").innerHTML = server ? "계정과 접속 기록은 이 PC의 실험실 서버(accounts 폴더, logs/access_log.csv)에 저장됩니다. 비밀번호는 해시로만 저장됩니다." : "지금은 서버 없이 열린 화면(GitHub 웹 또는 html 파일)이라 <b>guest / guest</b>로만 들어갈 수 있습니다. 회원가입, 아이디, 비밀번호 찾기는 <b>run.bat</b>으로 실행했을 때 쓸 수 있습니다.";
      document.querySelectorAll("#login .ltabs button").forEach(function (b) { b.onclick = function () { document.querySelectorAll("#login .ltabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); ["in", "up", "fid", "fpw"].forEach(function (k) { $("lp-" + k).hidden = k !== b.dataset.t; }); msg(!server && b.dataset.t !== "in" ? "이 기능은 run.bat으로 실행했을 때 쓸 수 있습니다." : ""); }; });
      const tryLogin = function (id, pw) { if (!id) return msg("아이디를 넣으십시오.");
        if (!server) { if (id === "guest" && pw === "guest") { localLog("login", id, true); return done({ id: "guest", name: "손님", role: "guest" }, null, cb); } localLog("login", id, false); return msg("서버 없이 열린 화면에서는 guest / guest 만 쓸 수 있습니다."); }
        api("login", { id: id, pw: pw }).then(function (r) { if (r.ok) done(r.user, r.token, cb); else msg(r.msg); }).catch(function () { msg("서버와 연결이 끊겼습니다."); }); };
      $("lGo").onclick = function () { tryLogin($("lId").value.trim(), $("lPw").value); };
      $("lPw").onkeydown = function (e) { if (e.key === "Enter") $("lGo").click(); };
      $("lGuest").onclick = function () { tryLogin("guest", "guest"); };
      $("uGo").onclick = function () { if (!server) return; api("signup", { id: $("uId").value.trim(), name: $("uName").value, email: $("uMail").value, pw: $("uPw").value, q: $("uQ").value, a: $("uA").value }).then(function (r) { msg(r.msg, r.ok); if (r.ok) { $("lId").value = $("uId").value.trim(); document.querySelector('#login [data-t="in"]').click(); msg(r.msg, true); } }); };
      $("fGo").onclick = function () { if (!server) return; api("find-id", { email: $("fMail").value }).then(function (r) { msg(r.ok ? "가입한 아이디: " + r.ids.join(", ") + " (일부를 가려서 보여 드립니다)" : r.msg, r.ok); }); };
      $("rQ").onclick = function () { if (!server) return; fetch("api/auth/question?id=" + encodeURIComponent($("rId").value.trim())).then(function (x) { return x.json(); }).then(function (r) { $("rQt").textContent = r.ok ? "질문: " + r.q : ""; if (!r.ok) msg(r.msg); else msg(""); }); };
      $("rGo").onclick = function () { if (!server) return; api("reset", { id: $("rId").value.trim(), a: $("rA").value, newpw: $("rPw").value }).then(function (r) { msg(r.msg, r.ok); }); };
      setTimeout(function () { const i = $("lId"); if (i) i.focus(); }, 50);
    });
  }
  function modal(title, html) {                     // 작은 창 / small dialog
    const m = document.createElement("div"); m.className = "login"; m.innerHTML = '<div class="lbox wide"><div class="lhead"><b>' + title + '</b><button class="lclose">✕ 닫기</button></div><div class="lbody">' + html + "</div></div>"; document.body.appendChild(m); m.querySelector(".lclose").onclick = function () { m.remove(); }; return m;
  }
  function chip() {                                 // 오른쪽 위 사용자 표시 / user chip at the top right
    const top = document.querySelector("header.top .top-btn"); if (!top || !user) return; let c = $("uChip"); if (!c) { c = document.createElement("div"); c.id = "uChip"; c.className = "uchip"; top.insertBefore(c, top.firstChild); }
    c.innerHTML = '<button id="uBtn">👤 ' + user.id + (user.role === "admin" ? " (관리자)" : "") + ' ▾</button><div id="uMenu" class="umenu" hidden>' + (server && user.role !== "guest" ? '<button id="uPwc">비밀번호 바꾸기</button>' : "") + (user.role === "admin" || !server ? '<button id="uLog">접속 기록 보기</button>' : "") + '<button id="uOut">로그아웃</button></div>';
    $("uBtn").onclick = function () { $("uMenu").hidden = !$("uMenu").hidden; };
    $("uOut").onclick = function () { const tok = SS.get("qp_tok"); if (server && tok) api("logout", { token: tok }).catch(function () { }); else localLog("logout", user.id, true); SS.del("qp_user"); SS.del("qp_tok"); if (QP.Voice) QP.Voice.shutdown && QP.Voice.shutdown(); location.reload(); };
    if ($("uPwc")) $("uPwc").onclick = function () { const m = modal("비밀번호 바꾸기", '<label>지금 비밀번호<input id="cOld" type="password"></label><label>새 비밀번호(6자 이상)<input id="cNew" type="password"></label><button id="cGo" class="primary">바꾸기</button><p id="cMsg" class="lmsg"></p>'); m.querySelector("#cGo").onclick = function () { api("change", { token: SS.get("qp_tok"), old: m.querySelector("#cOld").value, new: m.querySelector("#cNew").value }).then(function (r) { const p = m.querySelector("#cMsg"); p.textContent = r.msg; p.className = "lmsg " + (r.ok ? "ok" : "bad"); }); }; };
    if ($("uLog")) $("uLog").onclick = function () {
      const show = function (rows, users) { const m = modal("접속 기록" + (server ? "" : " (이 브라우저에만 남은 기록)"), (users ? '<p class="small">가입한 사람 ' + users.length + "명: " + users.map(function (u) { return u.id + "(" + u.role + ")"; }).join(", ") + '</p><div class="ladm"><input id="aId" placeholder="아이디"><input id="aPw" type="password" placeholder="새 비밀번호"><button id="aGo">관리자 재설정</button><span id="aMsg"></span></div>' : "") + '<table class="labtbl"><tr><th>시각</th><th>사건</th><th>아이디</th><th>IP</th><th>결과</th><th>비고</th></tr>' + rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + String(c).replace(/</g, "&lt;") + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>");
        const ag = m.querySelector("#aGo"); if (ag) ag.onclick = function () { api("admin-reset", { token: SS.get("qp_tok"), id: m.querySelector("#aId").value.trim(), newpw: m.querySelector("#aPw").value }).then(function (r) { m.querySelector("#aMsg").textContent = r.msg; }); }; };
      if (server) api("log", { token: SS.get("qp_tok") }).then(function (r) { if (r.ok) show(r.rows, r.users); else alert(r.msg); }); else { let a = []; try { a = JSON.parse(localStorage.getItem("qp_access_log") || "[]").reverse(); } catch (e) { } show(a, null); }
    };
  }
  QP.Auth = { gate: gate, user: function () { return user; } }; // 공개 / public API
})(window.QP = window.QP || {});
