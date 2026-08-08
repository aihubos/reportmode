(function () {
  var API = "https://reportmode-request-board.report-request-board.workers.dev";
  var STORAGE_KEY = "reportmode:admin-unlocked";
  var postsRoot = document.getElementById("archivePosts");
  if (!postsRoot) return;

  var state = {
    unlocked: false,
    password: "",
    hidden: new Set(),
  };

  function posts() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-report-item][data-report-id]"));
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error((body && body.error) || "request_failed");
          error.status = response.status;
          throw error;
        }
        return body;
      });
    });
  }

  function message(code) {
    if (code === "wrong_admin_password") return "관리자 비밀번호가 맞지 않습니다.";
    if (code === "admin_not_configured") return "관리자 기능을 준비 중입니다.";
    if (code === "missing_report") return "보고서 ID를 찾지 못했습니다.";
    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function setStatus(text, isError) {
    var status = document.getElementById("archiveAdminStatus");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.error = isError ? "true" : "false";
  }

  function applyHiddenState() {
    posts().forEach(function (post) {
      var id = post.dataset.reportId || "";
      var isHidden = state.hidden.has(id);
      post.classList.toggle("is-admin-hidden", isHidden);
      if (!state.unlocked) {
        post.hidden = isHidden || post.dataset.adminForceHidden === "true";
        if (isHidden) post.dataset.adminForceHidden = "true";
      } else {
        // admin can still see hidden cards marked
        if (post.dataset.adminForceHidden === "true" && !isHidden) {
          delete post.dataset.adminForceHidden;
        }
        if (isHidden) {
          post.hidden = false;
          post.dataset.adminForceHidden = "true";
        }
      }
      var badge = post.querySelector(".archive-admin-hidden-badge");
      if (isHidden) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "archive-admin-hidden-badge";
          badge.textContent = "삭제됨";
          var meta = post.querySelector(".archive-post-meta");
          if (meta) meta.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
    // re-run archive filter/render if available
    if (typeof window.reportmodeArchiveRender === "function") {
      window.reportmodeArchiveRender(false);
    } else {
      // fallback count update for visible non-hidden
      var count = document.getElementById("archiveResultCount");
      if (count && !state.unlocked) {
        var visible = posts().filter(function (post) {
          return !state.hidden.has(post.dataset.reportId || "");
        }).length;
        count.textContent = "총 " + visible + "개의 글";
      }
    }
  }

  function ensureDeleteButtons() {
    posts().forEach(function (post) {
      var actions = post.querySelector(".archive-admin-actions");
      if (!state.unlocked) {
        if (actions) actions.remove();
        return;
      }
      if (actions) return;
      actions = document.createElement("div");
      actions.className = "archive-admin-actions";
      var id = post.dataset.reportId || "";
      var isHidden = state.hidden.has(id);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "archive-admin-delete";
      button.textContent = isHidden ? "복구" : "삭제";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleToggle(post, id, isHidden);
      });
      actions.appendChild(button);
      var link = post.querySelector(".archive-post-link");
      if (link) link.appendChild(actions);
      else post.appendChild(actions);
    });
  }

  function handleToggle(post, reportId, currentlyHidden) {
    if (!state.password) {
      setStatus("먼저 관리자 비밀번호로 잠금을 해제해 주세요.", true);
      return;
    }
    var titleNode = post.querySelector("h2");
    var title = titleNode ? titleNode.textContent.trim() : reportId;
    var ok = window.confirm(
      currentlyHidden
        ? ("이 보고서를 도서관에 다시 표시할까요?\n\n" + title)
        : ("이 보고서를 도서관에서 삭제(숨김)할까요?\n\n" + title + "\n\n관리자 비밀번호 확인 후 바로 반영됩니다.")
    );
    if (!ok) return;

    var button = post.querySelector(".archive-admin-delete");
    if (button) button.disabled = true;
    setStatus(currentlyHidden ? "복구 중입니다…" : "삭제 중입니다…");

    var req = currentlyHidden
      ? requestJson(API + "/hidden-reports/" + encodeURIComponent(reportId), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminPassword: state.password }),
        })
      : requestJson(API + "/hidden-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: reportId, adminPassword: state.password }),
        });

    req
      .then(function () {
        if (currentlyHidden) state.hidden.delete(reportId);
        else state.hidden.add(reportId);
        window.reportmodeHiddenReports = state.hidden;
        ensureDeleteButtons();
        applyHiddenState();
        // recreate buttons with updated label
        posts().forEach(function (item) {
          var actions = item.querySelector(".archive-admin-actions");
          if (actions) actions.remove();
        });
        ensureDeleteButtons();
        setStatus(currentlyHidden ? "보고서를 다시 표시했습니다." : "보고서를 삭제(숨김) 처리했습니다.");
      })
      .catch(function (error) {
        setStatus(message(error.message), true);
      })
      .finally(function () {
        if (button) button.disabled = false;
      });
  }

  function setUnlocked(unlocked, password) {
    state.unlocked = unlocked;
    state.password = unlocked ? password : "";
    window.reportmodeAdminUnlocked = unlocked;
    try {
      if (unlocked) sessionStorage.setItem(STORAGE_KEY, "1");
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    var panel = document.getElementById("archiveAdminPanel");
    var unlockBtn = document.getElementById("archiveAdminUnlockBtn");
    var lockBtn = document.getElementById("archiveAdminLockBtn");
    var form = document.getElementById("archiveAdminForm");
    if (panel) panel.classList.toggle("is-unlocked", unlocked);
    if (unlockBtn) unlockBtn.hidden = unlocked;
    if (lockBtn) lockBtn.hidden = !unlocked;
    if (form) form.hidden = unlocked;
    ensureDeleteButtons();
    applyHiddenState();
  }

  function buildPanel() {
    var host = document.querySelector(".archive-footer");
    if (!host || document.getElementById("archiveAdminPanel")) return;
    var panel = document.createElement("section");
    panel.id = "archiveAdminPanel";
    panel.className = "archive-admin-panel";
    panel.innerHTML = [
      '<button type="button" class="archive-admin-summary" aria-controls="archiveAdminBody" aria-expanded="false">관리자 메뉴</button>',
      '<div id="archiveAdminBody" class="archive-admin-body" hidden>',
      '<div class="archive-admin-head">',
      '  <div>',
      '    <div class="archive-admin-kicker">ADMIN</div>',
      '    <strong>보고서 관리</strong>',
      '  </div>',
      '  <div class="archive-admin-head-actions">',
      '    <button type="button" class="archive-admin-chip" id="archiveAdminUnlockBtn">관리자 잠금 해제</button>',
      '    <button type="button" class="archive-admin-chip is-lock" id="archiveAdminLockBtn" hidden>잠금</button>',
      '  </div>',
      '</div>',
      '<form id="archiveAdminForm" class="archive-admin-form" hidden novalidate>',
      '  <label>관리자 비밀번호',
      '    <input id="archiveAdminPassword" type="password" maxlength="80" autocomplete="current-password" placeholder="관리자 비밀번호">',
      '  </label>',
      '  <button type="submit" class="archive-admin-submit">확인</button>',
      '</form>',
      '<p class="archive-admin-help">관리자 비밀번호를 입력하면 각 보고서 카드에 삭제 버튼이 나타납니다. 삭제 시 도서관 목록에서 숨겨집니다.</p>',
      '<p class="archive-admin-status" id="archiveAdminStatus" role="status"></p>',
      '</div>',
    ].join("");
    host.appendChild(panel);

    var summary = panel.querySelector(".archive-admin-summary");
    var body = panel.querySelector("#archiveAdminBody");
    summary.addEventListener("click", function () {
      var isOpen = body.hidden;
      body.hidden = !isOpen;
      panel.classList.toggle("is-open", isOpen);
      summary.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.getElementById("archiveAdminUnlockBtn").addEventListener("click", function () {
      document.getElementById("archiveAdminForm").hidden = false;
      document.getElementById("archiveAdminPassword").focus();
    });
    document.getElementById("archiveAdminLockBtn").addEventListener("click", function () {
      setUnlocked(false, "");
      setStatus("관리자 모드를 잠갔습니다.");
    });
    document.getElementById("archiveAdminForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = document.getElementById("archiveAdminPassword");
      var password = (input.value || "").trim();
      if (!password) {
        input.setAttribute("aria-invalid", "true");
        setStatus("관리자 비밀번호를 입력해 주세요.", true);
        return;
      }
      var submit = event.target.querySelector("button[type='submit']");
      submit.disabled = true;
      setStatus("확인 중입니다…");
      requestJson(API + "/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: password }),
      })
        .then(function () {
          input.value = "";
          setUnlocked(true, password);
          setStatus("관리자 모드가 켜졌습니다. 카드의 삭제 버튼으로 숨길 수 있습니다.");
        })
        .catch(function (error) {
          setStatus(message(error.message), true);
        })
        .finally(function () {
          submit.disabled = false;
        });
    });
  }

  function loadHidden() {
    return requestJson(API + "/hidden-reports", { method: "GET", cache: "no-store" })
      .then(function (body) {
        state.hidden = new Set(Array.isArray(body.reportIds) ? body.reportIds : []);
        window.reportmodeHiddenReports = state.hidden;
      })
      .catch(function () {
        state.hidden = new Set();
      });
  }

  // Hook archive render if present later: patch after DOM ready by wrapping filter
  function patchArchiveFilter() {
    // monkey-patch by intercepting posts visibility in Mutation? Better: patch render via exposed function.
    // We inject into existing IIFE by replacing filter condition through event.
    // Soft approach: observe and re-hide after render.
    var target = document.getElementById("archivePosts");
    if (!target || target.dataset.adminObserver === "true") return;
    target.dataset.adminObserver = "true";
    var timer = null;
    var observer = new MutationObserver(function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        // keep deleted posts hidden for public mode after pagination/filter
        posts().forEach(function (post) {
          var id = post.dataset.reportId || "";
          if (!state.unlocked && state.hidden.has(id)) {
            post.hidden = true;
            post.dataset.adminForceHidden = "true";
          }
        });
        if (state.unlocked) ensureDeleteButtons();
      }, 30);
    });
    observer.observe(target, { attributes: true, childList: true, subtree: true });
  }

  buildPanel();
  patchArchiveFilter();
  loadHidden().then(function () {
    var maybeUnlocked = false;
    try { maybeUnlocked = sessionStorage.getItem(STORAGE_KEY) === "1"; } catch (_) {}
    // session only remembers unlock UI intent; password must be re-entered after refresh for safety
    applyHiddenState();
    if (maybeUnlocked) {
      setStatus("보안을 위해 새로고침 후 관리자 비밀번호를 다시 입력해 주세요.");
    }
  });
})();
