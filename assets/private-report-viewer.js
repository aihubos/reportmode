(function () {
  "use strict";

  var API = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? "http://127.0.0.1:8787"
    : "https://reportmode-request-board.report-request-board.workers.dev";
  var STORAGE_KEY = "reportmode:private-session";
  var reportId = new URLSearchParams(window.location.search).get("report") || "";
  var gate = document.getElementById("privateViewerGate");
  var form = document.getElementById("privateViewerGateForm");
  var passwordInput = document.getElementById("privateViewerPassword");
  var submit = document.getElementById("privateViewerSubmit");
  var gateStatus = document.getElementById("privateViewerGateStatus");
  var content = document.getElementById("privateViewerContent");
  var title = document.getElementById("privateViewerTitle");
  var meta = document.getElementById("privateViewerMeta");
  var loading = document.getElementById("privateViewerLoading");
  var frame = document.getElementById("privateViewerFrame");
  var lock = document.getElementById("privateViewerLock");
  var state = { token: "", expiresAt: "" };

  if (!gate || !form || !frame || !content) return;

  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-downloads allow-modals");

  function validReportId(value) {
    return /^[a-z0-9][a-z0-9-]{2,119}$/i.test(value);
  }

  function readSession() {
    try {
      var parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !parsed.token || Date.parse(parsed.expiresAt || "") <= Date.now()) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      state.token = String(parsed.token);
      state.expiresAt = String(parsed.expiresAt || "");
    } catch (_) {}
  }

  function saveSession(token, expiresAt) {
    state.token = token;
    state.expiresAt = expiresAt;
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token, expiresAt: expiresAt })); } catch (_) {}
  }

  function clearSession() {
    state.token = "";
    state.expiresAt = "";
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function message(code, retryAfter) {
    if (code === "wrong_admin_password") return "관리자 비밀번호가 맞지 않습니다.";
    if (code === "private_login_blocked") return "입력 횟수를 초과했습니다. " + (retryAfter ? retryAfter + "초 후 다시 시도해 주세요." : "잠시 후 다시 시도해 주세요.");
    if (code === "private_report_not_found") return "비공개 보고서를 찾지 못했습니다.";
    if (code === "private_session_expired" || code === "private_auth_required") return "인증 시간이 끝났습니다. 관리자 비밀번호를 다시 입력해 주세요.";
    return "비공개 보고서를 열지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function setGateStatus(text, isError) {
    gateStatus.textContent = text || "";
    gateStatus.dataset.error = isError ? "true" : "false";
  }

  function openGate(text, isError) {
    frame.srcdoc = "";
    frame.hidden = true;
    content.hidden = true;
    gate.hidden = false;
    loading.textContent = "";
    setGateStatus(text || "", Boolean(isError));
    window.setTimeout(function () { passwordInput.focus(); }, 0);
  }

  function showContentShell() {
    gate.hidden = true;
    content.hidden = false;
    frame.hidden = true;
    loading.textContent = "보고서를 불러오는 중입니다.";
  }

  function authorizedFetch(path) {
    return fetch(API + path, {
      headers: { Authorization: "Bearer " + state.token },
      cache: "no-store",
    });
  }

  function responseError(response, body) {
    var error = new Error(body && body.error || "private_request_failed");
    error.status = response.status;
    error.retryAfter = response.headers.get("Retry-After") || "";
    return error;
  }

  function isolateHtml(html) {
    return String(html || "")
      .replace(/<script\b[^>]*\bsrc=["'][^"']*report-(?:view-counter|comments|history)\.js[^"']*["'][^>]*>\s*<\/script>/gi, "")
      .replace(/<link\b[^>]*\bhref=["'][^"']*report-comments\.css[^"']*["'][^>]*>/gi, "");
  }

  function loadReport() {
    if (!state.token) {
      openGate("관리자 비밀번호를 입력해 주세요.", false);
      return Promise.resolve();
    }
    if (!validReportId(reportId)) {
      openGate("비공개 보고서 주소가 올바르지 않습니다.", true);
      passwordInput.disabled = true;
      submit.disabled = true;
      return Promise.resolve();
    }
    showContentShell();
    var reportPath = "/private-reports/" + encodeURIComponent(reportId);
    return Promise.all([
      authorizedFetch(reportPath).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw responseError(response, body);
          return body.report;
        });
      }),
      authorizedFetch(reportPath + "/content").then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () { return {}; }).then(function (body) { throw responseError(response, body); });
        }
        return response.text();
      }),
    ]).then(function (values) {
      var report = values[0];
      title.textContent = report.title;
      meta.textContent = String(report.displayDate || "").replaceAll("-", ".") + " · 출처 " + Number(report.sourceCount || 0).toLocaleString("ko-KR") + "개";
      document.title = report.title + " | Report Hub";
      frame.srcdoc = isolateHtml(values[1]);
      frame.hidden = false;
      loading.textContent = "";
    }).catch(function (error) {
      if (error.status === 401) clearSession();
      openGate(message(error.message, error.retryAfter), true);
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var password = String(passwordInput.value || "").trim();
    if (!password) {
      setGateStatus("관리자 비밀번호를 입력해 주세요.", true);
      passwordInput.focus();
      return;
    }
    submit.disabled = true;
    setGateStatus("관리자 비밀번호를 확인하는 중입니다.", false);
    fetch(API + "/private-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: password }),
      cache: "no-store",
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw responseError(response, body);
        return body;
      });
    }).then(function (body) {
      saveSession(String(body.token || ""), String(body.expiresAt || ""));
      passwordInput.value = "";
      return loadReport();
    }).catch(function (error) {
      setGateStatus(message(error.message, error.retryAfter), true);
      passwordInput.select();
    }).finally(function () {
      submit.disabled = false;
    });
  });

  lock.addEventListener("click", function () {
    var token = state.token;
    clearSession();
    if (token) {
      fetch(API + "/private-session", {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      }).catch(function () {});
    }
    openGate("비공개 보고서를 잠갔습니다.", false);
  });

  readSession();
  loadReport();
})();
