(function () {
  "use strict";

  var API_BASE = "https://reportmode-request-board.report-request-board.workers.dev";
  var script = document.currentScript;
  var reportId = script && script.dataset ? (script.dataset.reportId || "").trim() : "";
  if (!reportId) return;

  function ready(callback) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  }

  function errorMessage(code) {
    var messages = {
      author_required: "작성자 이름을 입력해 주세요.",
      password_too_short: "비밀번호를 4글자 이상 입력해 주세요.",
      invalid_comment: "이름, 비밀번호와 댓글 내용을 확인해 주세요.",
      reserved_admin_name: "Jeremy와 제레미 이름은 관리자 비밀번호로만 사용할 수 있습니다.",
      wrong_password: "비밀번호가 맞지 않습니다.",
      wrong_admin_password: "관리자 비밀번호가 맞지 않습니다.",
      admin_not_configured: "관리자 기능을 준비하는 중입니다.",
      not_found: "댓글을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
      method_not_allowed: "현재 요청을 처리할 수 없습니다.",
      invalid_json: "요청 형식을 확인해 주세요."
    };
    return messages[code] || "댓글 처리 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.";
  }

  function api(path, options) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeoutId = controller ? window.setTimeout(function () { controller.abort(); }, 10000) : null;
    var config = Object.assign({ cache: "no-store", headers: {} }, options || {});
    if (controller) config.signal = controller.signal;
    if (config.body) config.headers["Content-Type"] = "application/json";
    return fetch(API_BASE + path, config)
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) {
            var error = new Error(errorMessage(data.error));
            error.code = data.error;
            throw error;
          }
          return data;
        });
      })
      .finally(function () { if (timeoutId) window.clearTimeout(timeoutId); });
  }

  function formatDate(value) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function initial(value) {
    return Array.from((value || "방문자").trim())[0] || "방";
  }

  ready(function () {
    if (document.querySelector(".report-comments")) return;

    var section = document.createElement("section");
    section.className = "report-comments";
    section.id = "report-comments";
    section.setAttribute("aria-labelledby", "report-comments-title");
    section.innerHTML =
      '<div class="report-comments-card">' +
        '<div class="report-comments-head">' +
          '<div><div class="report-comments-kicker">READER COMMENTS</div><h2 id="report-comments-title">댓글</h2><p>보고서에 대한 질문과 의견을 남겨 주세요.</p></div>' +
          '<strong class="report-comments-count" id="reportCommentsCount">불러오는 중</strong>' +
        '</div>' +
        '<form class="report-comments-form" id="reportCommentsForm" novalidate>' +
          '<div class="report-comments-identity">' +
            '<label>작성자 이름<input id="reportCommentAuthor" name="author" maxlength="24" autocomplete="name" required placeholder="이름 또는 닉네임"></label>' +
            '<label>수정·삭제 비밀번호<input id="reportCommentPassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="new-password" required placeholder="4글자 이상"></label>' +
          '</div>' +
          '<label>댓글 내용<textarea id="reportCommentContent" name="content" minlength="2" maxlength="500" required placeholder="궁금한 점이나 의견을 입력해 주세요."></textarea></label>' +
          '<p class="report-comments-helper">작성 비밀번호로 본인 댓글을 수정·삭제할 수 있습니다. Jeremy·제레미 이름은 관리자만 사용할 수 있습니다.</p>' +
          '<div class="report-comments-form-actions"><p class="report-comments-status" id="reportCommentsStatus" role="status" aria-live="polite"></p><button class="report-comments-submit" type="submit">댓글 등록</button></div>' +
        '</form>' +
        '<div class="report-comments-feed" aria-live="polite"><div class="report-comments-list" id="reportCommentsList"><div class="report-comments-empty">댓글을 불러오는 중입니다.</div></div></div>' +
      '</div>';

    var history = document.querySelector(".report-history");
    var main = document.querySelector("main");
    if (history && history.parentNode) history.parentNode.insertBefore(section, history);
    else if (main && main.parentNode) main.parentNode.insertBefore(section, main.nextSibling);
    else document.body.appendChild(section);

    var form = section.querySelector("#reportCommentsForm");
    var authorInput = section.querySelector("#reportCommentAuthor");
    var passwordInput = section.querySelector("#reportCommentPassword");
    var contentInput = section.querySelector("#reportCommentContent");
    var submitButton = form.querySelector("button[type='submit']");
    var status = section.querySelector("#reportCommentsStatus");
    var count = section.querySelector("#reportCommentsCount");
    var list = section.querySelector("#reportCommentsList");

    function setStatus(message, isError) {
      status.textContent = message || "";
      status.dataset.error = isError ? "true" : "false";
    }

    function setBusy(busy) {
      form.setAttribute("aria-busy", busy ? "true" : "false");
      submitButton.disabled = busy;
    }

    function closeInlinePanels() {
      list.querySelectorAll(".report-comment-inline").forEach(function (panel) {
        panel.hidden = true;
        panel.replaceChildren();
      });
    }

    function focusCommentFromHash() {
      var targetId = (window.location.hash || "").slice(1);
      if (!/^comment-[0-9a-f-]{36}$/i.test(targetId)) return;
      var target = document.getElementById(targetId);
      if (!target) return;
      list.querySelectorAll(".report-comment.is-targeted").forEach(function (item) {
        item.classList.remove("is-targeted");
      });
      target.classList.add("is-targeted");
      target.setAttribute("tabindex", "-1");
      target.scrollIntoView({
        behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center"
      });
      window.requestAnimationFrame(function () {
        try { target.focus({ preventScroll: true }); }
        catch (_error) { target.focus(); }
      });
    }

    function inlineStatus(formElement, message, isError) {
      var output = formElement.querySelector(".report-comment-inline-status");
      if (!output) return;
      output.textContent = message || "";
      output.dataset.error = isError ? "true" : "false";
    }

    function openEdit(item, comment) {
      closeInlinePanels();
      var panel = item.querySelector(".report-comment-inline");
      panel.hidden = false;
      var editForm = document.createElement("form");
      editForm.innerHTML =
        '<div class="report-comment-inline-grid">' +
          '<label>작성자 이름<input name="author" maxlength="24" required></label>' +
          '<label>작성 또는 관리자 비밀번호<input name="password" type="password" minlength="4" maxlength="80" autocomplete="current-password" required></label>' +
        '</div>' +
        '<label>수정할 내용<textarea name="content" minlength="2" maxlength="500" required></textarea></label>' +
        '<p class="report-comment-inline-status" role="status"></p>' +
        '<div class="report-comment-inline-actions"><button class="report-comment-inline-button" type="submit">수정 저장</button><button class="report-comment-inline-button" type="button" data-inline-cancel>취소</button></div>';
      editForm.querySelector("[name='author']").value = comment.author || "";
      editForm.querySelector("[name='content']").value = comment.content || "";
      panel.appendChild(editForm);
      editForm.querySelector("[data-inline-cancel]").addEventListener("click", function () { panel.hidden = true; });
      editForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var author = editForm.elements.author.value.trim();
        var content = editForm.elements.content.value.trim();
        var password = editForm.elements.password.value;
        if (!author || content.length < 2 || password.length < 4) {
          inlineStatus(editForm, "이름·내용·비밀번호를 확인해 주세요.", true);
          return;
        }
        var buttons = editForm.querySelectorAll("button");
        buttons.forEach(function (button) { button.disabled = true; });
        api("/comments/" + encodeURIComponent(comment.id), {
          method: "PATCH",
          body: JSON.stringify({ author: author, content: content, password: password })
        }).then(function () {
          setStatus("댓글을 수정했습니다.", false);
          return loadComments();
        }).catch(function (error) {
          inlineStatus(editForm, error.message, true);
          buttons.forEach(function (button) { button.disabled = false; });
        });
      });
    }

    function openDelete(item, comment) {
      closeInlinePanels();
      var panel = item.querySelector(".report-comment-inline");
      panel.hidden = false;
      var deleteForm = document.createElement("form");
      deleteForm.innerHTML =
        '<label>작성 또는 관리자 비밀번호<input name="password" type="password" minlength="4" maxlength="80" autocomplete="current-password" required placeholder="비밀번호 입력"></label>' +
        '<p class="report-comments-helper">삭제하면 되돌릴 수 없습니다.</p>' +
        '<p class="report-comment-inline-status" role="status"></p>' +
        '<div class="report-comment-inline-actions"><button class="report-comment-inline-button is-delete" type="submit">댓글 삭제</button><button class="report-comment-inline-button" type="button" data-inline-cancel>취소</button></div>';
      panel.appendChild(deleteForm);
      deleteForm.querySelector("[data-inline-cancel]").addEventListener("click", function () { panel.hidden = true; });
      deleteForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var password = deleteForm.elements.password.value;
        if (password.length < 4) {
          inlineStatus(deleteForm, "비밀번호를 4글자 이상 입력해 주세요.", true);
          return;
        }
        var buttons = deleteForm.querySelectorAll("button");
        buttons.forEach(function (button) { button.disabled = true; });
        api("/comments/" + encodeURIComponent(comment.id), {
          method: "DELETE",
          body: JSON.stringify({ password: password })
        }).then(function () {
          setStatus("댓글을 삭제했습니다.", false);
          return loadComments();
        }).catch(function (error) {
          inlineStatus(deleteForm, error.message, true);
          buttons.forEach(function (button) { button.disabled = false; });
        });
      });
    }

    function renderComments(comments) {
      list.replaceChildren();
      count.textContent = comments.length + "개";
      if (!comments.length) {
        var empty = document.createElement("div");
        empty.className = "report-comments-empty";
        empty.textContent = "아직 댓글이 없습니다. 첫 의견을 남겨 주세요.";
        list.appendChild(empty);
        return;
      }
      comments.forEach(function (comment) {
        var item = document.createElement("article");
        item.className = "report-comment";
        item.id = "comment-" + comment.id;
        var head = document.createElement("div");
        head.className = "report-comment-head";
        var avatar = document.createElement("span");
        avatar.className = "report-comment-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = initial(comment.author);
        var author = document.createElement("strong");
        author.className = "report-comment-author";
        author.textContent = comment.author || "방문자";
        head.append(avatar, author);
        if (Number(comment.is_admin) === 1) {
          var badge = document.createElement("span");
          badge.className = "report-comment-admin-badge";
          badge.textContent = "관리자";
          head.appendChild(badge);
        }
        if (comment.updated_at) {
          var edited = document.createElement("span");
          edited.className = "report-comment-edited";
          edited.textContent = "수정됨";
          head.appendChild(edited);
        }
        var time = document.createElement("time");
        time.className = "report-comment-time";
        time.dateTime = comment.updated_at || comment.created_at || "";
        time.textContent = formatDate(comment.updated_at || comment.created_at);
        head.appendChild(time);
        var content = document.createElement("p");
        content.className = "report-comment-content";
        content.textContent = comment.content || "";
        var actions = document.createElement("div");
        actions.className = "report-comment-actions";
        actions.innerHTML = '<button class="report-comment-action" type="button" data-comment-action="edit">수정</button><button class="report-comment-action is-delete" type="button" data-comment-action="delete">삭제</button>';
        var inline = document.createElement("div");
        inline.className = "report-comment-inline";
        inline.hidden = true;
        actions.querySelector('[data-comment-action="edit"]').addEventListener("click", function () { openEdit(item, comment); });
        actions.querySelector('[data-comment-action="delete"]').addEventListener("click", function () { openDelete(item, comment); });
        item.append(head, content, actions, inline);
        list.appendChild(item);
      });
      focusCommentFromHash();
    }

    function loadComments() {
      list.setAttribute("aria-busy", "true");
      return api("/comments?report=" + encodeURIComponent(reportId))
        .then(function (data) { renderComments(Array.isArray(data.comments) ? data.comments : []); })
        .catch(function (error) {
          count.textContent = "불러오기 실패";
          list.replaceChildren();
          var errorBox = document.createElement("div");
          errorBox.className = "report-comments-empty";
          errorBox.textContent = error.message;
          list.appendChild(errorBox);
        })
        .finally(function () { list.setAttribute("aria-busy", "false"); });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var author = authorInput.value.trim();
      var password = passwordInput.value;
      var content = contentInput.value.trim();
      [authorInput, passwordInput, contentInput].forEach(function (input) { input.setAttribute("aria-invalid", "false"); });
      if (!author) authorInput.setAttribute("aria-invalid", "true");
      if (password.length < 4) passwordInput.setAttribute("aria-invalid", "true");
      if (content.length < 2) contentInput.setAttribute("aria-invalid", "true");
      if (!author || password.length < 4 || content.length < 2) {
        setStatus("이름·내용·비밀번호를 확인해 주세요.", true);
        return;
      }
      setBusy(true);
      setStatus("댓글을 등록하고 있습니다.", false);
      api("/comments", {
        method: "POST",
        body: JSON.stringify({ reportId: reportId, author: author, content: content, password: password })
      }).then(function () {
        passwordInput.value = "";
        contentInput.value = "";
        setStatus("댓글을 등록했습니다.", false);
        return loadComments();
      }).catch(function (error) {
        setStatus(error.message, true);
      }).finally(function () { setBusy(false); });
    });

    window.addEventListener("hashchange", focusCommentFromHash);
    loadComments();
  });
})();
