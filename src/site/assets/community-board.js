(function () {
  "use strict";

  var API_BASE = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? "http://127.0.0.1:8787"
    : "https://reportmode-request-board.report-request-board.workers.dev";
  var CATEGORY_LABELS = {
    report_opinion: "리포트 의견",
    ai_question: "AI 질문",
    knowledge_share: "정보 공유",
    free_opinion: "자유 의견",
  };
  var state = {
    page: 1,
    pageSize: 20,
    category: "all",
    sort: "latest",
    query: "",
    postId: "",
    post: null,
    posts: [],
    total: 0,
    totalPages: 1,
    dialogMode: "create",
    busy: false,
    action: "",
  };
  var visitorKey = "reporthub:visitor-id";
  var page = document.querySelector(".community-board-page");
  if (!page) return;

  var list = document.getElementById("board-post-list");
  var pagination = document.getElementById("board-pagination");
  var detail = document.getElementById("board-detail");
  var resultCount = document.getElementById("board-result-count");
  var searchForm = document.getElementById("board-search-form");
  var searchInput = document.getElementById("board-search-input");
  var sortSelect = document.getElementById("board-sort-select");
  var postDialog = document.getElementById("board-post-dialog");
  var postForm = document.getElementById("board-post-form");
  var actionDialog = document.getElementById("board-action-dialog");
  var actionForm = document.getElementById("board-action-form");
  var commentDialog = document.getElementById("board-comment-dialog");
  var commentEditForm = document.getElementById("board-comment-edit-form");
  var listWrap = document.querySelector(".community-board-list-wrap");
  var API_ERROR = {
    author_required: "작성자 이름을 입력해 주세요.",
    password_too_short: "비밀번호를 4글자 이상 입력해 주세요.",
    title_too_short: "제목을 4글자 이상 입력해 주세요.",
    content_too_short: "내용을 10글자 이상 입력해 주세요.",
    comment_too_short: "댓글을 2글자 이상 입력해 주세요.",
    invalid_category: "분류를 선택해 주세요.",
    reserved_admin_name: "Jeremy와 제레미 이름은 관리자 비밀번호로만 사용할 수 있습니다.",
    wrong_password: "비밀번호가 맞지 않습니다.",
    not_found: "글을 찾지 못했습니다. 목록을 새로 불러와 주세요.",
    invalid_visitor: "방문자 정보를 확인할 수 없습니다.",
  };

  function errorText(code) {
    return API_ERROR[code] || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function requestJson(path, options) {
    var config = Object.assign({ cache: "no-store", headers: {} }, options || {});
    if (config.body) config.headers["Content-Type"] = "application/json";
    return fetch(API_BASE + path, config).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(errorText(body && body.error));
          error.code = body && body.error;
          throw error;
        }
        return body;
      });
    });
  }

  function visitorId() {
    try {
      var current = localStorage.getItem(visitorKey);
      if (current) return current;
      current = globalThis.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000";
      localStorage.setItem(visitorKey, current);
      return current;
    } catch (_) {
      return "10000000-1000-4000-8000-100000000000";
    }
  }

  function formatDate(value, withTime) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", withTime
      ? { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function initial(value) {
    return Array.from(String(value || "방문자").trim())[0] || "방";
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function button(label, className) {
    var node = element("button", className, label);
    node.type = "button";
    return node;
  }

  function setStatus(node, text, isError) {
    if (!node) return;
    node.textContent = text || "";
    node.dataset.error = isError ? "true" : "false";
  }

  function setListBusy(busy) {
    if (!listWrap) return;
    listWrap.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function currentQuery() {
    var params = new URLSearchParams();
    if (state.postId) params.set("post", state.postId);
    else {
      if (state.page > 1) params.set("page", String(state.page));
      if (state.category !== "all") params.set("category", state.category);
      if (state.sort !== "latest") params.set("sort", state.sort);
      if (state.query) params.set("q", state.query);
    }
    return params.toString();
  }

  function syncUrl(replace) {
    var target = window.location.pathname + (currentQuery() ? "?" + currentQuery() : "");
    if (replace) window.history.replaceState({ postId: state.postId }, "", target);
    else window.history.pushState({ postId: state.postId }, "", target);
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    state.postId = params.get("post") || "";
    state.page = Math.max(1, Number(params.get("page") || 1) || 1);
    state.category = CATEGORY_LABELS[params.get("category")] ? params.get("category") : "all";
    state.sort = ["latest", "comments", "views"].indexOf(params.get("sort")) >= 0 ? params.get("sort") : "latest";
    state.query = String(params.get("q") || "").slice(0, 120);
    if (searchInput) searchInput.value = state.query;
    if (sortSelect) sortSelect.value = state.sort;
    document.querySelectorAll("[data-board-category]").forEach(function (tab) {
      tab.setAttribute("aria-selected", tab.dataset.boardCategory === state.category ? "true" : "false");
    });
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function clearPostForm() {
    if (!postForm) return;
    postForm.reset();
    postForm.elements.postId.value = "";
    postForm.elements.category.value = "report_opinion";
    document.querySelectorAll("[data-board-count]").forEach(function (counter) { counter.textContent = counter.dataset.boardCount === "title" ? "0 / 100" : "0 / 5,000"; });
    setStatus(document.getElementById("board-post-status"), "", false);
  }

  function clearActionForm() {
    if (!actionForm) return;
    actionForm.reset();
    setStatus(document.getElementById("board-action-status"), "", false);
    actionDialog.removeAttribute("data-item-id");
    actionDialog.removeAttribute("data-post-id");
    state.action = "";
  }

  function clearCommentEditForm() {
    if (!commentEditForm) return;
    commentEditForm.reset();
    setStatus(document.getElementById("board-comment-edit-status"), "", false);
  }

  function openWrite(post) {
    state.dialogMode = post ? "edit" : "create";
    clearPostForm();
    document.getElementById("board-dialog-title").textContent = post ? "게시글 수정" : "새 글 작성";
    var save = postForm.querySelector("[data-board-save]");
    save.textContent = post ? "수정 저장" : "게시하기";
    if (post) {
      postForm.elements.postId.value = post.id;
      postForm.elements.category.value = post.category;
      postForm.elements.title.value = post.title;
      postForm.elements.content.value = post.content;
      postForm.elements.author.value = post.author;
      updateCounters();
    }
    openDialog(postDialog);
    window.requestAnimationFrame(function () { postForm.elements.title.focus(); });
  }

  function renderSkeletons() {
    list.replaceChildren();
    for (var index = 0; index < 5; index += 1) list.appendChild(element("div", "community-board-skeleton"));
  }

  function renderPostRow(post, index) {
    var link = element("a", "community-board-post-row");
    link.href = "?post=" + encodeURIComponent(post.id);
    link.dataset.postId = post.id;
    var number = state.total - ((state.page - 1) * state.pageSize) - index;
    link.appendChild(element("span", "community-board-post-number", String(Math.max(1, number)).padStart(3, "0")));
    link.appendChild(element("span", "community-board-post-category", CATEGORY_LABELS[post.category] || "기타"));
    var copy = element("span", "community-board-post-copy");
    copy.appendChild(element("strong", "community-board-post-title", post.title));
    copy.appendChild(element("span", "community-board-post-excerpt", post.content || ""));
    link.appendChild(copy);
    var author = element("span", "community-board-post-author");
    author.appendChild(element("span", "community-board-avatar", initial(post.author)));
    author.appendChild(element("span", "", post.author || "방문자"));
    if (Number(post.is_admin) === 1) author.appendChild(element("span", "community-board-admin-badge", "관리자"));
    link.appendChild(author);
    var date = element("span", "community-board-post-date", formatDate(post.updated_at || post.created_at, false));
    if (post.updated_at) date.appendChild(element("small", "community-board-edited", "수정됨"));
    link.appendChild(date);
    link.appendChild(element("span", "community-board-post-comments", "댓글 " + Number(post.comment_count || 0).toLocaleString("ko-KR")));
    link.appendChild(element("span", "community-board-post-views", "조회 " + Number(post.view_count || 0).toLocaleString("ko-KR")));
    link.addEventListener("click", function (event) {
      event.preventDefault();
      state.postId = post.id;
      syncUrl(false);
      renderRoute();
    });
    return link;
  }

  function renderList(data) {
    state.posts = Array.isArray(data.posts) ? data.posts : [];
    state.total = Number(data.pagination && data.pagination.total || 0);
    state.totalPages = Math.max(1, Number(data.pagination && data.pagination.totalPages || 1));
    resultCount.textContent = state.total ? "총 " + state.total.toLocaleString("ko-KR") + "개의 글" : "아직 등록된 글 없음";
    list.replaceChildren();
    if (!state.posts.length) {
      var empty = element("div", state.query ? "community-board-empty" : "community-board-empty", state.query ? "검색 조건에 맞는 글이 없습니다." : "아직 작성된 글이 없습니다. 첫 의견을 남겨 주세요.");
      list.appendChild(empty);
    } else {
      state.posts.forEach(function (post, index) { list.appendChild(renderPostRow(post, index)); });
    }
    renderPagination();
  }

  function renderPagination() {
    pagination.replaceChildren();
    if (state.totalPages <= 1) return;
    var previous = button("이전", "");
    previous.disabled = state.page <= 1;
    previous.addEventListener("click", function () { if (state.page > 1) { state.page -= 1; syncUrl(false); loadPosts(); } });
    pagination.appendChild(previous);
    var start = Math.max(1, state.page - 2);
    var end = Math.min(state.totalPages, start + 4);
    for (var pageNumber = start; pageNumber <= end; pageNumber += 1) {
      var pageButton = button(String(pageNumber), "");
      if (pageNumber === state.page) pageButton.setAttribute("aria-current", "page");
      pageButton.addEventListener("click", (function (nextPage) {
        return function () { state.page = nextPage; syncUrl(false); loadPosts(); };
      })(pageNumber));
      pagination.appendChild(pageButton);
    }
    var next = button("다음", "");
    next.disabled = state.page >= state.totalPages;
    next.addEventListener("click", function () { if (state.page < state.totalPages) { state.page += 1; syncUrl(false); loadPosts(); } });
    pagination.appendChild(next);
  }

  function showList() {
    detail.hidden = true;
    document.querySelector(".community-board-layout").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDetail() {
    detail.hidden = false;
    document.querySelector(".community-board-layout").hidden = true;
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderDetail(post) {
    state.post = post;
    document.getElementById("board-detail-category").textContent = CATEGORY_LABELS[post.category] || "기타";
    document.getElementById("board-detail-title").textContent = post.title;
    var meta = document.getElementById("board-detail-meta");
    meta.replaceChildren();
    var author = element("span", "", post.author || "방문자");
    if (Number(post.is_admin) === 1) author.appendChild(element("span", "community-board-admin-badge", "관리자"));
    meta.appendChild(author);
    meta.appendChild(element("span", "", formatDate(post.created_at, true)));
    if (post.updated_at) meta.appendChild(element("span", "", "수정됨 " + formatDate(post.updated_at, true)));
    meta.appendChild(element("span", "", "조회 " + Number(post.view_count || 0).toLocaleString("ko-KR")));
    meta.appendChild(element("span", "", "댓글 " + Number(post.comment_count || 0).toLocaleString("ko-KR")));
    document.getElementById("board-detail-content").textContent = post.content || "";
    showDetail();
    loadComments(post.id);
  }

  function loadPosts() {
    renderSkeletons();
    setListBusy(true);
    var params = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize), category: state.category, sort: state.sort, q: state.query });
    return requestJson("/board/posts?" + params.toString())
      .then(renderList)
      .catch(function (error) {
        list.replaceChildren();
        var errorBox = element("div", "community-board-error");
        errorBox.appendChild(element("span", "", error.message));
        var retry = button("다시 시도", "");
        retry.addEventListener("click", loadPosts);
        errorBox.appendChild(retry);
        list.appendChild(errorBox);
        resultCount.textContent = "불러오기 실패";
      })
      .finally(function () { setListBusy(false); });
  }

  function loadPost(postId) {
    return requestJson("/board/posts/" + encodeURIComponent(postId))
      .then(function (data) {
        renderDetail(data.post);
        return requestJson("/board/posts/" + encodeURIComponent(postId) + "/views", {
          method: "POST",
          body: JSON.stringify({ visitorId: visitorId() }),
        }).then(function (viewData) {
          if (state.post && viewData && viewData.counted) {
            state.post.view_count = viewData.count;
            renderDetail(state.post);
          }
        }).catch(function () {});
      })
      .catch(function (error) {
        state.postId = "";
        syncUrl(true);
        showList();
        document.querySelector(".community-board-intro").hidden = false;
        var errorBox = element("div", "community-board-error", error.message);
        list.replaceChildren(errorBox);
        return loadPosts();
      });
  }

  function loadComments(postId) {
    var commentList = document.getElementById("board-comment-list");
    var count = document.getElementById("board-comments-count");
    commentList.replaceChildren(element("community-board-loading", "", "댓글을 불러오는 중입니다."));
    return requestJson("/board/posts/" + encodeURIComponent(postId) + "/comments")
      .then(function (data) {
        var comments = Array.isArray(data.comments) ? data.comments : [];
        count.textContent = comments.length + "개";
        commentList.replaceChildren();
        if (!comments.length) {
          commentList.appendChild(element("div", "community-board-empty", "아직 댓글이 없습니다. 첫 의견을 남겨 주세요."));
          return;
        }
        comments.forEach(function (comment) { commentList.appendChild(renderComment(comment)); });
      })
      .catch(function (error) {
        count.textContent = "불러오기 실패";
        commentList.replaceChildren(element("div", "community-board-error", error.message));
      });
  }

  function reloadCurrentPost() {
    if (!state.post || !state.post.id) return Promise.resolve();
    return requestJson("/board/posts/" + encodeURIComponent(state.post.id))
      .then(function (data) {
        state.post = data.post;
        renderDetail(state.post);
      });
  }

  function renderComment(comment) {
    var item = element("article", "community-board-comment");
    var head = element("div", "community-board-comment-head");
    head.appendChild(element("span", "community-board-avatar", initial(comment.author)));
    head.appendChild(element("strong", "community-board-comment-author", comment.author || "방문자"));
    if (Number(comment.is_admin) === 1) head.appendChild(element("span", "community-board-admin-badge", "관리자"));
    head.appendChild(element("time", "", formatDate(comment.updated_at || comment.created_at, true)));
    item.appendChild(head);
    item.appendChild(element("p", "community-board-comment-content", comment.content || ""));
    var actions = element("div", "community-board-comment-actions");
    var edit = button("수정", "");
    edit.addEventListener("click", function () { openCommentEdit(comment); });
    var remove = button("삭제", "");
    remove.addEventListener("click", function () { openAction("comment-delete", comment); });
    actions.append(edit, remove);
    item.appendChild(actions);
    return item;
  }

  function openAction(action, item) {
    state.action = action;
    actionDialog.dataset.itemId = item.id;
    actionDialog.dataset.postId = item.post_id || (state.post && state.post.id) || "";
    document.getElementById("board-action-title").textContent = action === "post-delete" ? "게시글 삭제" : "댓글 삭제";
    document.getElementById("board-action-copy").textContent = action === "post-delete"
      ? "게시글과 연결된 댓글도 함께 삭제됩니다. 작성 또는 관리자 비밀번호를 입력해 주세요."
      : "작성 또는 관리자 비밀번호를 입력해 주세요.";
    actionForm.reset();
    setStatus(document.getElementById("board-action-status"), "", false);
    openDialog(actionDialog);
    window.requestAnimationFrame(function () { actionForm.elements.password.focus(); });
  }

  function openCommentEdit(comment) {
    commentEditForm.reset();
    commentEditForm.elements.commentId.value = comment.id;
    commentEditForm.elements.author.value = comment.author || "";
    commentEditForm.elements.content.value = comment.content || "";
    setStatus(document.getElementById("board-comment-edit-status"), "", false);
    openDialog(commentDialog);
    window.requestAnimationFrame(function () { commentEditForm.elements.content.focus(); });
  }

  function updateCounters() {
    if (!postForm) return;
    var titleCount = document.querySelector('[data-board-count="title"]');
    var contentCount = document.querySelector('[data-board-count="content"]');
    if (titleCount) titleCount.textContent = postForm.elements.title.value.length + " / 100";
    if (contentCount) contentCount.textContent = postForm.elements.content.value.length.toLocaleString("ko-KR") + " / 5,000";
  }

  function renderRoute() {
    readUrl();
    if (state.postId) {
      document.querySelector(".community-board-intro").hidden = true;
      loadPost(state.postId);
    } else {
      document.querySelector(".community-board-intro").hidden = false;
      showList();
      loadPosts();
    }
  }

  document.querySelectorAll("[data-board-open-write]").forEach(function (trigger) {
    trigger.addEventListener("click", function () { openWrite(null); });
  });
  document.querySelectorAll("[data-board-dialog-close]").forEach(function (trigger) {
    trigger.addEventListener("click", function () { closeDialog(postDialog); });
  });
  document.querySelectorAll("[data-board-action-close]").forEach(function (trigger) {
    trigger.addEventListener("click", function () { closeDialog(actionDialog); });
  });
  document.querySelectorAll("[data-board-comment-close]").forEach(function (trigger) {
    trigger.addEventListener("click", function () { closeDialog(commentDialog); });
  });
  postDialog.addEventListener("close", clearPostForm);
  actionDialog.addEventListener("close", clearActionForm);
  commentDialog.addEventListener("close", clearCommentEditForm);
  document.querySelector("[data-board-back]").addEventListener("click", function () {
    state.postId = "";
    syncUrl(false);
    renderRoute();
  });
  document.querySelector("[data-board-copy]").addEventListener("click", function () {
    var url = window.location.href;
    var done = function () { setStatus(document.getElementById("board-comment-status"), "게시글 링크를 복사했습니다.", false); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(function () {});
    else {
      var input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      done();
    }
  });
  document.querySelector("[data-board-edit]").addEventListener("click", function () { if (state.post) openWrite(state.post); });
  document.querySelector("[data-board-delete]").addEventListener("click", function () { if (state.post) openAction("post-delete", state.post); });
  document.querySelectorAll("[data-board-category]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      state.category = tab.dataset.boardCategory;
      state.page = 1;
      syncUrl(false);
      document.querySelectorAll("[data-board-category]").forEach(function (item) { item.setAttribute("aria-selected", item === tab ? "true" : "false"); });
      loadPosts();
    });
  });
  sortSelect.addEventListener("change", function () {
    state.sort = sortSelect.value;
    state.page = 1;
    syncUrl(false);
    loadPosts();
  });
  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    state.query = searchInput.value.trim().slice(0, 120);
    state.page = 1;
    syncUrl(false);
    loadPosts();
  });
  postForm.elements.title.addEventListener("input", updateCounters);
  postForm.elements.content.addEventListener("input", updateCounters);
  postForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.busy) return;
    var data = {
      category: postForm.elements.category.value,
      title: postForm.elements.title.value.trim(),
      content: postForm.elements.content.value,
      author: postForm.elements.author.value.trim(),
      password: postForm.elements.password.value,
    };
    state.busy = true;
    var save = postForm.querySelector("[data-board-save]");
    save.disabled = true;
    setStatus(document.getElementById("board-post-status"), state.dialogMode === "edit" ? "수정 중입니다." : "등록 중입니다.", false);
    var postId = postForm.elements.postId.value;
    requestJson(postId ? "/board/posts/" + encodeURIComponent(postId) : "/board/posts", {
      method: postId ? "PATCH" : "POST",
      body: JSON.stringify(data),
    }).then(function (response) {
      var nextPost = response.post;
      closeDialog(postDialog);
      clearPostForm();
      state.postId = nextPost.id;
      syncUrl(false);
      renderRoute();
    }).catch(function (error) {
      setStatus(document.getElementById("board-post-status"), error.message, true);
    }).finally(function () { state.busy = false; save.disabled = false; });
  });
  actionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.busy) return;
    var password = actionForm.elements.password.value;
    if (password.length < 4) {
      setStatus(document.getElementById("board-action-status"), "비밀번호를 4글자 이상 입력해 주세요.", true);
      return;
    }
    state.busy = true;
    var submit = actionForm.querySelector("[data-board-action-submit]");
    submit.disabled = true;
    var action = state.action;
    setStatus(document.getElementById("board-action-status"), "삭제 중입니다.", false);
    var endpoint = action === "post-delete"
      ? "/board/posts/" + encodeURIComponent(actionDialog.dataset.itemId)
      : "/board/comments/" + encodeURIComponent(actionDialog.dataset.itemId);
    requestJson(endpoint, { method: "DELETE", body: JSON.stringify({ password: password, adminPassword: password }) })
      .then(function () {
        closeDialog(actionDialog);
        if (action === "post-delete") {
          state.postId = "";
          state.post = null;
          syncUrl(false);
          renderRoute();
        } else {
          reloadCurrentPost().catch(function (error) {
            setStatus(document.getElementById("board-comment-status"), error.message, true);
          });
        }
      })
      .catch(function (error) { setStatus(document.getElementById("board-action-status"), error.message, true); })
      .finally(function () { state.busy = false; submit.disabled = false; });
  });
  commentEditForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.busy) return;
    state.busy = true;
    var submit = commentEditForm.querySelector("button[type=submit]");
    submit.disabled = true;
    setStatus(document.getElementById("board-comment-edit-status"), "수정 중입니다.", false);
    requestJson("/board/comments/" + encodeURIComponent(commentEditForm.elements.commentId.value), {
      method: "PATCH",
      body: JSON.stringify({
        author: commentEditForm.elements.author.value.trim(),
        content: commentEditForm.elements.content.value,
        password: commentEditForm.elements.password.value,
      }),
    }).then(function () {
      closeDialog(commentDialog);
      loadComments(state.post.id);
    }).catch(function (error) { setStatus(document.getElementById("board-comment-edit-status"), error.message, true); })
      .finally(function () { state.busy = false; submit.disabled = false; });
  });
  document.getElementById("board-comment-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var form = event.currentTarget;
    var submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    setStatus(document.getElementById("board-comment-status"), "댓글을 등록하고 있습니다.", false);
    requestJson("/board/posts/" + encodeURIComponent(state.post.id) + "/comments", {
      method: "POST",
      body: JSON.stringify({
        author: form.elements.author.value.trim(),
        content: form.elements.content.value,
        password: form.elements.password.value,
      }),
    }).then(function () {
      form.elements.password.value = "";
      form.elements.content.value = "";
      setStatus(document.getElementById("board-comment-status"), "댓글을 등록했습니다.", false);
      return reloadCurrentPost();
    }).catch(function (error) { setStatus(document.getElementById("board-comment-status"), error.message, true); })
      .finally(function () { submit.disabled = false; });
  });
  window.addEventListener("popstate", renderRoute);
  renderRoute();
})();
