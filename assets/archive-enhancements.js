(function () {
  "use strict";

  var root = document.getElementById("grid");
  if (!root) return;

  var stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "../assets/archive-enhancements.css";
  document.head.appendChild(stylesheet);

  root.id = "archivePosts";
  var search = document.getElementById("search");
  var count = document.getElementById("count");
  if (search) search.id = "archiveSearch";
  if (count) count.id = "archiveResultCount";

  var posts = Array.prototype.slice.call(root.querySelectorAll(".library-card[data-report-id]"));
  var category = document.getElementById("category");
  var fallbackCounts = {};
  var counterBase = "https://api.counterapi.dev/v1/aihubos-reportmode/";
  var counterEnabled = window.location.hostname === "aihubos.github.io";

  function formatCount(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "0";
  }

  function viewStorageKey(reportId) {
    return "reportmode:view:" + reportId;
  }

  function countStorageKey(reportId) {
    return "reportmode:view-count:" + reportId;
  }

  function cachedCount(reportId) {
    try {
      var value = Number(window.localStorage.getItem(countStorageKey(reportId)));
      return Number.isFinite(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function setViewText(post, value) {
    var output = post.querySelector("[data-view-count]");
    if (output) output.textContent = "조회수 " + formatCount(value);
  }

  function normalizePosts() {
    posts.forEach(function (post) {
      post.setAttribute("data-report-item", "");
      var date = post.querySelector(".library-date");
      if (date) date.classList.add("archive-post-meta");
      var link = post.querySelector(".library-card-link");
      if (link) {
        link.addEventListener("click", function () {
          var reportId = post.dataset.reportId || "";
          if (!counterEnabled || !reportId) return;
          var key = viewStorageKey(reportId);
          try {
            if (window.sessionStorage.getItem(key)) return;
            window.sessionStorage.setItem(key, "1");
          } catch (_) {}
          fetch(counterBase + encodeURIComponent(reportId) + "/up", { cache: "no-store", keepalive: true, mode: "cors" }).catch(function () {
            try { window.sessionStorage.removeItem(key); } catch (_) {}
          });
        });
      }
      if (date && !date.querySelector("[data-view-count]")) {
        var output = document.createElement("span");
        output.className = "archive-view-count";
        output.dataset.viewCount = "";
        output.dataset.viewCountFallback = "0";
        output.textContent = "조회수 0";
        date.appendChild(output);
      }
      post.dataset.search = ((post.dataset.title || "") + " " + post.textContent).toLocaleLowerCase("ko");
    });
  }

  function injectRequestBoard() {
    if (document.getElementById("requestBoardForm")) return;
    var board = document.createElement("section");
    board.className = "request-board";
    board.setAttribute("aria-labelledby", "request-board-title");
    board.innerHTML = [
      '<div class="request-board-copy">',
      '  <div class="request-board-kicker">REPORT WISHLIST</div>',
      '  <h2 id="request-board-title"><span class="request-board-highlight">다음 리포트,</span><br>무엇이 궁금하신가요?</h2>',
      '  <p>원하는 기업·제품·이슈를 남겨 주세요. 검토할 가치가 있는 주제는 다음 리포트 후보로 반영합니다.</p>',
      '</div>',
      '<form class="request-board-form" id="requestBoardForm" novalidate>',
      '  <div class="request-board-identity">',
      '    <label>신청자 이름<input id="requestAuthor" name="author" maxlength="24" autocomplete="name" required placeholder="이름 또는 닉네임"></label>',
      '    <label>수정·삭제 비밀번호<input id="requestPassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="new-password" required placeholder="4글자 이상"></label>',
      '  </div>',
      '  <label>궁금한 점 또는 원하는 리포트 주제<textarea id="requestTopic" name="topic" minlength="4" maxlength="240" required placeholder="예: 엔비디아 실적과 경쟁력 분석. AMD·구글과 비교해 장기 경쟁력이 궁금합니다."></textarea></label>',
      '  <p class="request-board-helper">비밀번호는 글을 수정하거나 삭제할 때 필요합니다.</p>',
      '  <button class="request-board-submit" type="submit">리포트 희망 남기기 →</button>',
      '  <p class="request-board-status" id="requestBoardStatus" role="status"></p>',
      '</form>',
      '<div class="request-board-feed" aria-live="polite">',
      '  <div class="request-board-feed-head"><strong>최근 희망 리포트</strong><span id="requestBoardCount">불러오는 중</span></div>',
      '  <div class="request-board-list" id="requestBoardList"><div class="request-board-empty">아직 제안된 주제가 없습니다. 첫 번째 주제를 남겨 주세요.</div></div>',
      '</div>'
    ].join("");
    var controls = document.querySelector(".controls");
    if (controls && controls.parentNode) controls.parentNode.insertBefore(board, controls);
    else root.parentNode.insertBefore(board, root);
  }

  function applyFallbackCounts() {
    posts.forEach(function (post) {
      var reportId = post.dataset.reportId || "";
      var fallback = Number(fallbackCounts[reportId]);
      if (!Number.isFinite(fallback)) fallback = 0;
      var output = post.querySelector("[data-view-count]");
      if (output) output.dataset.viewCountFallback = String(fallback);
      var cached = cachedCount(reportId);
      setViewText(post, cached === null ? fallback : cached);
    });
  }

  function fetchCount(reportId) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 5000);
    return fetch(counterBase + encodeURIComponent(reportId) + "/", { cache: "no-store", mode: "cors", signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error("counter unavailable");
        return response.json();
      })
      .then(function (body) {
        var value = Number(body.count);
        if (!Number.isFinite(value)) throw new Error("invalid counter value");
        return value;
      })
      .finally(function () { window.clearTimeout(timer); });
  }

  function loadVisibleCounts(visible) {
    if (!counterEnabled) return;
    var index = 0;
    function next() {
      var post = visible[index++];
      if (!post) return;
      var reportId = post.dataset.reportId || "";
      fetchCount(reportId).then(function (value) {
        setViewText(post, value);
        try { window.localStorage.setItem(countStorageKey(reportId), String(value)); } catch (_) {}
      }).catch(function () {
        // The fallback number is already visible; retry on a later render.
      }).finally(function () {
        window.setTimeout(next, 120);
      });
    }
    next();
  }

  function render() {
    var query = search ? search.value.trim().toLocaleLowerCase("ko") : "";
    var selected = category ? category.value : "";
    var hiddenSet = window.reportmodeHiddenReports;
    var filtered = posts.filter(function (post) {
      var reportId = post.dataset.reportId || "";
      if (!window.reportmodeAdminUnlocked && hiddenSet && hiddenSet.has(reportId)) return false;
      var matchesQuery = !query || (post.dataset.search || "").indexOf(query) !== -1;
      var matchesCategory = !selected || post.dataset.category === selected;
      return matchesQuery && matchesCategory;
    });
    posts.forEach(function (post) { post.hidden = true; });
    filtered.forEach(function (post) { post.hidden = false; });
    if (count) count.textContent = filtered.length + "개";
    loadVisibleCounts(filtered);
  }

  normalizePosts();
  injectRequestBoard();
  var footer = document.querySelector("footer");
  if (footer) footer.classList.add("archive-footer");
  if (search) search.addEventListener("input", render);
  if (category) category.addEventListener("change", render);
  window.reportmodeArchiveRender = render;
  applyFallbackCounts();
  render();

  fetch("../reports/view-counts.json", { cache: "no-store" })
    .then(function (response) { return response.ok ? response.json() : {}; })
    .then(function (body) {
      fallbackCounts = body && typeof body === "object" ? body : {};
      applyFallbackCounts();
    })
    .catch(function () {});
})();
