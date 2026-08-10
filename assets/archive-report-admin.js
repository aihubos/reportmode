(function () {
  var API = "https://reportmode-request-board.report-request-board.workers.dev";
  var STORAGE_KEY = "reportmode:admin-unlocked";
  var postsRoot = document.getElementById("archivePosts");
  if (!postsRoot) return;

  var state = {
    unlocked: false,
    password: "",
    hidden: new Set(),
    featured: new Set(),
    promotedDrafts: new Set(),
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
    if (code === "featured_limit_reached") return "추천 글은 최대 3개까지 선택할 수 있습니다.";
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
    renderSpotlights();
  }

  function makeSpotlightItem(post, index, kind) {
    var link = post.querySelector(".archive-post-link");
    var heading = post.querySelector("h2");
    var category = post.querySelector(".archive-post-category");
    var date = post.querySelector(".archive-post-meta span:nth-child(2)");
    var count = post.querySelector("[data-view-count]");
    var sourceImage = post.querySelector(".archive-post-cover img");
    var item = document.createElement("a");
    item.className = "archive-spotlight-item";
    item.href = link ? link.href : "#";
    item.dataset.spotlightReportId = post.dataset.reportId || "";
    if (kind === "featured") item.dataset.featuredFallbackItem = "";
    else item.dataset.popularReport = "";

    var rank = document.createElement("span");
    rank.className = "archive-spotlight-rank";
    rank.setAttribute("aria-hidden", "true");
    rank.textContent = String(index + 1).padStart(2, "0");

    var copy = document.createElement("span");
    copy.className = "archive-spotlight-copy";
    var meta = document.createElement("small");
    meta.textContent = [
      category && category.textContent,
      date && date.textContent,
      count ? count.textContent : "조회수 0",
    ].filter(Boolean).join(" · ");
    var title = document.createElement("strong");
    title.textContent = heading ? heading.textContent : post.dataset.reportId || "보고서";
    copy.append(meta, title);

    var cover = document.createElement("span");
    cover.className = "archive-spotlight-cover";
    if (sourceImage) {
      var image = sourceImage.cloneNode(false);
      image.alt = "";
      image.loading = "lazy";
      cover.appendChild(image);
    } else {
      var fallback = document.createElement("span");
      fallback.className = "archive-spotlight-cover-fallback";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = "RH";
      cover.appendChild(fallback);
    }
    item.append(rank, copy, cover);
    return item;
  }

  function renderSpotlights() {
    var featuredList = document.getElementById("archiveFeaturedList");
    var popularList = document.getElementById("archivePopularList");
    if (!featuredList || !popularList) return;
    var visiblePosts = posts().filter(function (post) {
      return !state.hidden.has(post.dataset.reportId || "") && post.dataset.reportDraft !== "true";
    });
    var byId = new Map(visiblePosts.map(function (post) {
      return [post.dataset.reportId || "", post];
    }));
    var popularPosts = visiblePosts.slice().sort(function (a, b) {
      var aOutput = a.querySelector("[data-view-count]");
      var bOutput = b.querySelector("[data-view-count]");
      var aCount = Number(aOutput?.dataset.viewCountLive || aOutput?.dataset.viewCountFallback || 0);
      var bCount = Number(bOutput?.dataset.viewCountLive || bOutput?.dataset.viewCountFallback || 0);
      return bCount - aCount || visiblePosts.indexOf(a) - visiblePosts.indexOf(b);
    }).slice(0, 3);
    var popularIds = new Set(popularPosts.map(function (post) {
      return post.dataset.reportId || "";
    }));
    var featuredPosts = Array.from(state.featured)
      .map(function (id) { return byId.get(id); })
      .filter(Boolean);
    featuredPosts = featuredPosts.filter(function (post) {
      return !popularIds.has(post.dataset.reportId || "");
    });
    visiblePosts.forEach(function (post) {
      var reportId = post.dataset.reportId || "";
      if (featuredPosts.length >= 3 || popularIds.has(reportId) || featuredPosts.indexOf(post) >= 0) return;
      featuredPosts.push(post);
    });
    featuredList.replaceChildren.apply(featuredList, featuredPosts.slice(0, 3).map(function (post, index) {
      return makeSpotlightItem(post, index, "featured");
    }));
    popularList.replaceChildren.apply(popularList, popularPosts.map(function (post, index) {
      return makeSpotlightItem(post, index, "popular");
    }));
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
      var isFeatured = state.featured.has(id);
      var isDraft = post.dataset.reportDraft === "true";
      var isPromoted = state.promotedDrafts.has(id);
      var featureButton = document.createElement("button");
      featureButton.type = "button";
      featureButton.className = "archive-admin-feature" + (isFeatured ? " is-featured" : "");
      featureButton.textContent = "★";
      featureButton.setAttribute("aria-pressed", isFeatured ? "true" : "false");
      featureButton.setAttribute("aria-label", isFeatured ? "추천 글에서 제외" : "추천 글로 지정");
      featureButton.setAttribute("title", isFeatured ? "추천 글에서 제외" : "추천 글로 지정");
      featureButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleFeaturedToggle(id, isFeatured, featureButton);
      });
      var button = document.createElement("button");
      button.type = "button";
      button.className = "archive-admin-delete";
      button.textContent = isHidden ? "복구" : "삭제";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleToggle(post, id, isHidden);
      });
      if (isDraft) {
        var promoteButton = document.createElement("button");
        promoteButton.type = "button";
        promoteButton.className = "archive-admin-promote" + (isPromoted ? " is-promoted" : "");
        promoteButton.textContent = isPromoted ? "메인 제외" : "메인 등록";
        promoteButton.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          handleDraftPromotion(id, isPromoted, promoteButton);
        });
        actions.appendChild(promoteButton);
      }
      actions.append(featureButton, button);
      post.classList.add("has-admin-actions");
      post.appendChild(actions);
    });
  }

  function handleDraftPromotion(reportId, currentlyPromoted, button) {
    if (!state.password) {
      setStatus("먼저 관리자 비밀번호로 잠금을 해제해 주세요.", true);
      return;
    }
    button.disabled = true;
    setStatus(currentlyPromoted ? "메인 목록에서 제외 중입니다…" : "메인 목록에 등록 중입니다…");
    var request = currentlyPromoted
      ? requestJson(API + "/draft-promotions/" + encodeURIComponent(reportId), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminPassword: state.password }),
        })
      : requestJson(API + "/draft-promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: reportId, adminPassword: state.password }),
        });
    request.then(function (body) {
      state.promotedDrafts = new Set(Array.isArray(body.reportIds) ? body.reportIds : []);
      window.reportmodeDraftPromotions = state.promotedDrafts;
      posts().forEach(function (post) {
        var actions = post.querySelector(".archive-admin-actions");
        if (actions) actions.remove();
        post.classList.remove("has-admin-actions");
      });
      ensureDeleteButtons();
      if (typeof window.reportmodeArchiveRender === "function") window.reportmodeArchiveRender(false);
      setStatus(currentlyPromoted ? "메인 목록에서 제외했습니다." : "메인 목록에 등록했습니다.");
    }).catch(function (error) {
      setStatus(message(error.message), true);
    }).finally(function () {
      button.disabled = false;
    });
  }

  function handleFeaturedToggle(reportId, currentlyFeatured, button) {
    if (!state.password) {
      setStatus("먼저 관리자 비밀번호로 잠금을 해제해 주세요.", true);
      return;
    }
    if (!currentlyFeatured && state.featured.size >= 3) {
      setStatus(message("featured_limit_reached"), true);
      return;
    }
    button.disabled = true;
    setStatus(currentlyFeatured ? "추천에서 제외 중입니다…" : "추천 글로 지정 중입니다…");
    var request = currentlyFeatured
      ? requestJson(API + "/featured-reports/" + encodeURIComponent(reportId), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminPassword: state.password }),
        })
      : requestJson(API + "/featured-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: reportId, adminPassword: state.password }),
        });
    request
      .then(function (body) {
        state.featured = new Set(Array.isArray(body.reportIds) ? body.reportIds : []);
        posts().forEach(function (post) {
          var actions = post.querySelector(".archive-admin-actions");
          if (actions) actions.remove();
          post.classList.remove("has-admin-actions");
        });
        ensureDeleteButtons();
        renderSpotlights();
        setStatus(currentlyFeatured ? "추천 글에서 제외했습니다." : "추천 글로 지정했습니다.");
      })
      .catch(function (error) {
        setStatus(message(error.message), true);
      })
      .finally(function () {
        button.disabled = false;
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
          item.classList.remove("has-admin-actions");
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
      '<p class="archive-admin-help">관리자 비밀번호를 입력하면 추천·삭제 기능이 나타납니다. Draft 카드의 메인 등록 버튼으로 전체 목록 노출을 선택할 수 있습니다.</p>',
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
          setStatus("관리자 모드가 켜졌습니다. 카드의 별표로 추천 글을 선택할 수 있습니다.");
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

  function loadFeatured() {
    return requestJson(API + "/featured-reports", { method: "GET", cache: "no-store" })
      .then(function (body) {
        state.featured = new Set(Array.isArray(body.reportIds) ? body.reportIds : []);
      })
      .catch(function () {
        state.featured = new Set();
      });
  }

  function loadDraftPromotions() {
    return requestJson(API + "/draft-promotions", { method: "GET", cache: "no-store" })
      .then(function (body) {
        state.promotedDrafts = new Set(Array.isArray(body.reportIds) ? body.reportIds : []);
        window.reportmodeDraftPromotions = state.promotedDrafts;
      })
      .catch(function () {
        state.promotedDrafts = new Set();
        window.reportmodeDraftPromotions = state.promotedDrafts;
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
  window.addEventListener("reportmode:view-counts-updated", renderSpotlights);
  Promise.all([loadHidden(), loadFeatured(), loadDraftPromotions()]).then(function () {
    var maybeUnlocked = false;
    try { maybeUnlocked = sessionStorage.getItem(STORAGE_KEY) === "1"; } catch (_) {}
    // session only remembers unlock UI intent; password must be re-entered after refresh for safety
    applyHiddenState();
    if (maybeUnlocked) {
      setStatus("보안을 위해 새로고침 후 관리자 비밀번호를 다시 입력해 주세요.");
    }
  });
})();
