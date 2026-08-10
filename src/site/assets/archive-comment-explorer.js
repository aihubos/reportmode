(function () {
  "use strict";

  var API_BASE = "https://reportmode-request-board.report-request-board.workers.dev";
  var RECENT_LIMIT = 4;
  var recentList = document.getElementById("archiveCommentsRecentList");
  var allList = document.getElementById("archiveAllCommentsList");
  var recentCount = document.getElementById("archiveCommentsCount");
  var allCount = document.getElementById("archiveAllCommentsCount");
  var openAll = document.getElementById("archiveCommentsOpenAll");
  var dialog = document.getElementById("archiveCommentsDialog");
  var closeDialog = document.getElementById("archiveCommentsDialogClose");
  if (!recentList || !allList || !recentCount || !allCount || !openAll || !dialog || !closeDialog) return;

  function reportMap() {
    var reports = Object.create(null);
    document.querySelectorAll("[data-report-item]").forEach(function (item) {
      var reportId = item.dataset.reportId || "";
      var link = item.querySelector(".archive-post-link");
      var title = item.querySelector(".archive-post-copy h2");
      if (!reportId || !link) return;
      reports[reportId] = {
        href: link.href,
        title: title ? title.textContent.trim() : reportId
      };
    });
    return reports;
  }

  function dateText(value) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "방금";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(date);
  }

  function createEmpty(message) {
    var empty = document.createElement("p");
    empty.className = "archive-comments-empty";
    empty.textContent = message;
    return empty;
  }

  function commentHref(comment, reports) {
    var report = reports[String(comment.report_id || "")];
    var commentId = String(comment.id || "");
    if (!report || !report.href || !commentId) return "";
    return report.href.replace(/#.*/, "") + "#comment-" + commentId;
  }

  function commentItem(comment, reports) {
    var report = reports[String(comment.report_id || "")];
    var href = commentHref(comment, reports);
    var item = document.createElement(href ? "a" : "article");
    item.className = "archive-comment-explorer-item";
    if (href) item.href = href;
    else item.classList.add("is-unavailable");

    var meta = document.createElement("span");
    meta.className = "archive-comment-explorer-meta";
    var author = document.createElement("strong");
    author.textContent = comment.author || "방문자";
    var reportName = document.createElement("span");
    reportName.className = "archive-comment-explorer-report";
    reportName.textContent = report ? report.title : "원문 보고서를 찾을 수 없습니다";
    var time = document.createElement("time");
    time.dateTime = comment.updated_at || comment.created_at || "";
    time.textContent = dateText(comment.updated_at || comment.created_at);
    meta.append(author, reportName, time);
    if (Number(comment.is_admin) === 1) {
      var badge = document.createElement("span");
      badge.className = "archive-comment-explorer-admin";
      badge.textContent = "관리자";
      meta.appendChild(badge);
    }
    var content = document.createElement("span");
    content.className = "archive-comment-explorer-content";
    content.textContent = comment.content || "";
    item.append(meta, content);
    return item;
  }

  function renderList(container, comments, reports, limit) {
    container.replaceChildren();
    var visibleComments = typeof limit === "number" ? comments.slice(0, limit) : comments;
    if (!visibleComments.length) {
      container.appendChild(createEmpty("아직 등록된 댓글이 없습니다."));
      return;
    }
    visibleComments.forEach(function (comment) {
      container.appendChild(commentItem(comment, reports));
    });
  }

  function setLoading(isLoading) {
    recentList.setAttribute("aria-busy", isLoading ? "true" : "false");
    allList.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function renderError(message) {
    recentList.replaceChildren(createEmpty(message));
    allList.replaceChildren(createEmpty(message));
    recentCount.textContent = "연결 확인";
    allCount.textContent = "연결 확인";
  }

  function loadComments() {
    setLoading(true);
    return fetch(API_BASE + "/comments/recent", { cache: "no-store" })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) throw new Error(data.error || "comments_unavailable");
          return Array.isArray(data.comments) ? data.comments : [];
        });
      })
      .then(function (comments) {
        var reports = reportMap();
        renderList(recentList, comments, reports, RECENT_LIMIT);
        renderList(allList, comments, reports);
        recentCount.textContent = comments.length ? "최근 " + Math.min(comments.length, RECENT_LIMIT) + "건" : "댓글 없음";
        allCount.textContent = comments.length ? "전체 " + comments.length + "건" : "댓글 없음";
      })
      .catch(function () {
        renderError("댓글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(function () {
        setLoading(false);
      });
  }

  openAll.addEventListener("click", function () {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    closeDialog.focus();
  });
  closeDialog.addEventListener("click", function () {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog.click();
  });

  loadComments();
})();
