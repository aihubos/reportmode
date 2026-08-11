(function () {
  "use strict";

  var API = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? "http://127.0.0.1:8787"
    : "https://reportmode-request-board.report-request-board.workers.dev";
  var STORAGE_KEY = "reportmode:private-session";
  var privateButtons = Array.prototype.slice.call(document.querySelectorAll("[data-private-category]"));
  var dialog = document.getElementById("archivePrivateAuthDialog");
  var form = document.getElementById("archivePrivateAuthForm");
  var passwordInput = document.getElementById("archivePrivatePassword");
  var authStatus = document.getElementById("archivePrivateAuthStatus");
  var authSubmit = document.getElementById("archivePrivateAuthSubmit");
  var authCancel = document.getElementById("archivePrivateAuthCancel");
  var library = document.getElementById("archivePrivateLibrary");
  var libraryStatus = document.getElementById("archivePrivateLibraryStatus");
  var privatePosts = document.getElementById("archivePrivatePosts");
  var privateEmpty = document.getElementById("archivePrivateEmpty");
  var privatePagination = document.getElementById("archivePrivatePagination");
  var lockButton = document.getElementById("archivePrivateLock");
  var publicPosts = document.getElementById("archivePosts");
  var publicListHead = document.querySelector(".archive-list-head");
  var publicEmpty = document.getElementById("archiveEmpty");
  var publicPagination = document.getElementById("archivePagination");
  var search = document.getElementById("archiveSearch");
  var pageSize = document.getElementById("archivePageSize");
  var sort = document.getElementById("archiveSort");
  var boardTitle = document.getElementById("board-title");
  var resultCount = document.getElementById("archiveResultCount");
  var originalBoardTitle = boardTitle ? boardTitle.textContent : "전체 보고서";
  var state = {
    active: false,
    token: "",
    expiresAt: "",
    reports: [],
    page: 1,
    objectUrls: [],
  };

  if (!privateButtons.length || !dialog || !form || !library || !privatePosts) return;

  function readSession() {
    try {
      var parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !parsed.token || Date.parse(parsed.expiresAt || "") <= Date.now()) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      state.token = String(parsed.token);
      state.expiresAt = String(parsed.expiresAt || "");
    } catch (_) {
      state.token = "";
      state.expiresAt = "";
    }
  }

  function saveSession(token, expiresAt) {
    state.token = token;
    state.expiresAt = expiresAt;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token, expiresAt: expiresAt }));
    } catch (_) {}
  }

  function clearSession() {
    state.token = "";
    state.expiresAt = "";
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function requestJson(path, options) {
    var settings = Object.assign({ method: "GET", cache: "no-store" }, options || {});
    settings.headers = new Headers(settings.headers || {});
    if (state.token) settings.headers.set("Authorization", "Bearer " + state.token);
    return fetch(API + path, settings).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(body.error || "private_request_failed");
          error.status = response.status;
          error.retryAfter = response.headers.get("Retry-After") || "";
          throw error;
        }
        return body;
      });
    });
  }

  function message(code, retryAfter) {
    if (code === "wrong_admin_password") return "관리자 비밀번호가 맞지 않습니다.";
    if (code === "private_login_blocked") return "입력 횟수를 초과했습니다. " + (retryAfter ? retryAfter + "초 후 다시 시도해 주세요." : "잠시 후 다시 시도해 주세요.");
    if (code === "private_session_expired" || code === "private_auth_required") return "인증 시간이 끝났습니다. 관리자 비밀번호를 다시 입력해 주세요.";
    if (code === "private_storage_not_configured") return "비공개 저장소를 준비 중입니다.";
    return "비공개 보고서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function setAuthStatus(text, isError) {
    authStatus.textContent = text || "";
    authStatus.dataset.error = isError ? "true" : "false";
  }

  function setLibraryStatus(text) {
    libraryStatus.textContent = text || "";
  }

  function revokeObjectUrls() {
    state.objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    state.objectUrls = [];
  }

  function clearPrivateCards() {
    revokeObjectUrls();
    privatePosts.replaceChildren();
    privatePagination.replaceChildren();
    state.reports = [];
  }

  function syncPrivateButtons() {
    privateButtons.forEach(function (button) {
      button.classList.toggle("is-active", state.active);
      button.classList.toggle("is-unlocked", Boolean(state.token));
      button.setAttribute("aria-pressed", state.active ? "true" : "false");
      var count = button.querySelector("[data-private-category-count]");
      if (count) count.textContent = state.token ? String(state.reports.length) : "잠금";
    });
  }

  function syncPrivateUrl() {
    var params = new URLSearchParams(window.location.search);
    params.set("category", "Private");
    if (search && search.value) params.set("q", search.value); else params.delete("q");
    if (pageSize && pageSize.value !== "30") params.set("size", pageSize.value); else params.delete("size");
    if (sort && sort.value !== "created") params.set("sort", sort.value); else params.delete("sort");
    var query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }

  function openAuth() {
    setAuthStatus("", false);
    passwordInput.value = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(function () { passwordInput.focus(); }, 0);
  }

  function closeAuth() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function showPrivateShell() {
    state.active = true;
    window.reportmodePrivateLibraryActive = true;
    if (publicPosts) publicPosts.hidden = true;
    if (publicListHead) publicListHead.hidden = true;
    if (publicEmpty) publicEmpty.hidden = true;
    if (publicPagination) publicPagination.hidden = true;
    library.hidden = false;
    lockButton.hidden = !state.token;
    if (boardTitle) boardTitle.textContent = "비공개 보고서";
    if (resultCount) resultCount.textContent = state.token ? "비공개 보고서를 확인하는 중" : "관리자 인증 필요";
    syncPrivateButtons();
    syncPrivateUrl();
  }

  function leavePrivate() {
    state.active = false;
    window.reportmodePrivateLibraryActive = false;
    clearPrivateCards();
    library.hidden = true;
    if (publicPosts) publicPosts.hidden = false;
    if (publicListHead) publicListHead.hidden = false;
    if (boardTitle) boardTitle.textContent = originalBoardTitle;
    syncPrivateButtons();
  }

  function selectPublicAll() {
    var allButton = document.querySelector('[data-category-filter="all"]');
    if (allButton) allButton.click();
    else {
      leavePrivate();
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  function formatDate(value) {
    var text = String(value || "");
    if (/^\d{6}$/.test(text)) return "20" + text.slice(0, 2) + "." + text.slice(2, 4) + "." + text.slice(4, 6);
    return text.replaceAll("-", ".");
  }

  function addText(parent, tagName, text, className) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function loadCover(report, cover) {
    if (!report.hasCover || !state.token) return;
    fetch(API + "/private-reports/" + encodeURIComponent(report.id) + "/cover", {
      headers: { Authorization: "Bearer " + state.token },
      cache: "no-store",
    }).then(function (response) {
      if (!response.ok) throw new Error("cover_failed");
      return response.blob();
    }).then(function (blob) {
      if (!state.active || !document.contains(cover)) return;
      var url = URL.createObjectURL(blob);
      state.objectUrls.push(url);
      var image = document.createElement("img");
      image.src = url;
      image.alt = report.title + " 비공개 보고서 표지";
      image.loading = "lazy";
      cover.replaceChildren(image);
    }).catch(function () {});
  }

  function makePrivateCard(report) {
    var article = document.createElement("article");
    article.className = "archive-private-post";
    article.dataset.privateReport = report.id;
    var link = document.createElement("a");
    link.className = "archive-private-post-link";
    link.href = "./private/?report=" + encodeURIComponent(report.id);
    var copy = document.createElement("div");
    var meta = document.createElement("div");
    meta.className = "archive-private-post-meta";
    addText(meta, "strong", "비공개");
    addText(meta, "span", formatDate(report.displayDate));
    addText(meta, "span", "출처 " + Number(report.sourceCount || 0).toLocaleString("ko-KR") + "개");
    copy.appendChild(meta);
    addText(copy, "h3", report.title);
    addText(copy, "p", report.summary);
    if (Array.isArray(report.tags) && report.tags.length) {
      var tags = document.createElement("div");
      tags.className = "archive-private-post-tags";
      report.tags.slice(0, 3).forEach(function (tag) { addText(tags, "span", "#" + tag); });
      copy.appendChild(tags);
    }
    var cover = document.createElement("div");
    cover.className = "archive-private-cover";
    addText(cover, "span", "RH");
    link.append(copy, cover);
    article.appendChild(link);
    loadCover(report, cover);
    return article;
  }

  function makePageButton(label, page, active, disabled) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "archive-private-page-button" + (active ? " is-active" : "");
    button.textContent = label;
    button.disabled = disabled;
    if (active) button.setAttribute("aria-current", "page");
    button.addEventListener("click", function () {
      state.page = page;
      renderPrivateReports();
      library.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return button;
  }

  function renderPrivateReports() {
    revokeObjectUrls();
    privatePosts.replaceChildren();
    privatePagination.replaceChildren();
    var query = search ? search.value.trim().toLocaleLowerCase("ko") : "";
    var filtered = state.reports.filter(function (report) {
      return !query || [report.title, report.summary].concat(report.tags || []).join(" ").toLocaleLowerCase("ko").includes(query);
    });
    filtered.sort(function (left, right) {
      var field = sort && sort.value === "updated" ? "updatedAt" : "createdAt";
      return Date.parse(right[field] || 0) - Date.parse(left[field] || 0);
    });
    var size = Math.max(5, Number(pageSize && pageSize.value || 30));
    var pages = Math.max(1, Math.ceil(filtered.length / size));
    state.page = Math.min(state.page, pages);
    var visible = filtered.slice((state.page - 1) * size, state.page * size);
    visible.forEach(function (report) { privatePosts.appendChild(makePrivateCard(report)); });
    privateEmpty.hidden = filtered.length !== 0;
    setLibraryStatus(filtered.length ? "총 " + filtered.length + "개의 비공개 보고서" : "등록된 비공개 보고서가 없습니다.");
    if (resultCount) resultCount.textContent = filtered.length ? "총 " + filtered.length + "개의 비공개 보고서" : "비공개 보고서 0개";
    if (filtered.length > size) {
      privatePagination.appendChild(makePageButton("이전", Math.max(1, state.page - 1), false, state.page === 1));
      for (var page = 1; page <= pages; page += 1) privatePagination.appendChild(makePageButton(String(page), page, page === state.page, false));
      privatePagination.appendChild(makePageButton("다음", Math.min(pages, state.page + 1), false, state.page === pages));
    }
    syncPrivateButtons();
    syncPrivateUrl();
  }

  function loadPrivateReports() {
    if (!state.token) {
      setLibraryStatus("관리자 인증이 필요합니다.");
      openAuth();
      return Promise.resolve();
    }
    setLibraryStatus("비공개 보고서를 불러오는 중입니다.");
    library.setAttribute("aria-busy", "true");
    return requestJson("/private-reports").then(function (body) {
      state.reports = Array.isArray(body.reports) ? body.reports : [];
      state.page = 1;
      lockButton.hidden = false;
      renderPrivateReports();
    }).catch(function (error) {
      if (error.status === 401) {
        clearSession();
        clearPrivateCards();
        lockButton.hidden = true;
        syncPrivateButtons();
        setLibraryStatus(message(error.message));
        openAuth();
        return;
      }
      setLibraryStatus(message(error.message, error.retryAfter));
    }).finally(function () {
      library.removeAttribute("aria-busy");
    });
  }

  function enterPrivate() {
    showPrivateShell();
    return loadPrivateReports();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var password = String(passwordInput.value || "").trim();
    if (!password) {
      setAuthStatus("관리자 비밀번호를 입력해 주세요.", true);
      passwordInput.focus();
      return;
    }
    authSubmit.disabled = true;
    authCancel.disabled = true;
    setAuthStatus("관리자 비밀번호를 확인하는 중입니다.", false);
    fetch(API + "/private-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: password }),
      cache: "no-store",
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(body.error || "private_request_failed");
          error.retryAfter = response.headers.get("Retry-After") || "";
          throw error;
        }
        return body;
      });
    }).then(function (body) {
      saveSession(String(body.token || ""), String(body.expiresAt || ""));
      passwordInput.value = "";
      closeAuth();
      showPrivateShell();
      return loadPrivateReports();
    }).catch(function (error) {
      setAuthStatus(message(error.message, error.retryAfter), true);
      passwordInput.select();
    }).finally(function () {
      authSubmit.disabled = false;
      authCancel.disabled = false;
    });
  });

  authCancel.addEventListener("click", function () {
    closeAuth();
    if (!state.token && state.active) selectPublicAll();
  });

  lockButton.addEventListener("click", function () {
    var token = state.token;
    clearSession();
    clearPrivateCards();
    lockButton.hidden = true;
    if (token) {
      fetch(API + "/private-session", {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      }).catch(function () {});
    }
    selectPublicAll();
  });

  document.addEventListener("click", function (event) {
    var filter = event.target.closest && event.target.closest("[data-category-filter]");
    if (!filter) return;
    var value = filter.dataset.categoryFilter || "all";
    if (value === "Private") {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("reportmode:archive-close-mobile-panel"));
      enterPrivate();
      return;
    }
    if (state.active) leavePrivate();
  }, true);

  document.addEventListener("input", function (event) {
    if (!state.active || event.target !== search) return;
    event.stopImmediatePropagation();
    state.page = 1;
    renderPrivateReports();
  }, true);

  document.addEventListener("change", function (event) {
    if (!state.active || (event.target !== pageSize && event.target !== sort)) return;
    event.stopImmediatePropagation();
    state.page = 1;
    renderPrivateReports();
  }, true);

  readSession();
  syncPrivateButtons();
  if (new URLSearchParams(window.location.search).get("category") === "Private") enterPrivate();
})();
