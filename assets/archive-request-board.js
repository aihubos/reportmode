(function () {
  var API = "https://reportmode-request-board.report-request-board.workers.dev/requests";
  var localApi = typeof window.REPORT_REQUEST_API === "string" ? window.REPORT_REQUEST_API : "";
  if (/^(127\.0\.0\.1|localhost)$/.test(window.location.hostname) && /^http:\/\/(127\.0\.0\.1|localhost):\d+\/requests$/.test(localApi)) API = localApi;
  var form = document.getElementById("requestBoardForm");
  if (!form) return;
  var author = document.getElementById("requestAuthor"), password = document.getElementById("requestPassword"), topic = document.getElementById("requestTopic");
  var list = document.getElementById("requestBoardList"), status = document.getElementById("requestBoardStatus"), count = document.getElementById("requestBoardCount");
  var submit = form.querySelector("button[type=submit]");
  var messages = { author_required: "신청자 이름을 적어 주세요.", topic_too_short: "궁금한 내용을 4글자 이상 적어 주세요.", password_too_short: "비밀번호를 4글자 이상 적어 주세요.", reply_too_short: "관리자 답글을 2글자 이상 적어 주세요.", wrong_password: "작성 비밀번호가 맞지 않습니다.", wrong_admin_password: "관리자 비밀번호가 맞지 않습니다.", read_only_request: "기존 방식으로 등록된 글은 수정·삭제할 수 없습니다.", not_found: "글을 찾지 못했습니다. 목록을 새로 불러와 주세요.", admin_not_configured: "관리자 답글 기능을 준비 중입니다." };
  [author, password, topic].forEach(function (field) { field.addEventListener("input", function () { field.removeAttribute("aria-invalid"); if (status.dataset.validation === "true") { status.textContent = ""; delete status.dataset.validation; } }); });
  function message(code) { return messages[code] || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요."; }
  function dateText(value) { var date = new Date(value); return Number.isNaN(date.getTime()) ? "방금" : date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }); }
  function el(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (typeof text === "string") node.textContent = text; return node; }
  function makeButton(text, className) { var node = el("button", className, text); node.type = "button"; return node; }
  function labeled(text, input) { var label = el("label", "", text); label.appendChild(input); return label; }
  function requestJson(url, options) { return fetch(url, options).then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { if (!response.ok) throw new Error(data.error || "request_failed"); return data; }); }); }
  function closePanels() { list.querySelectorAll(".request-board-inline-form").forEach(function (panel) { panel.remove(); }); }
  function panel(card, label) { closePanels(); var form = el("form", "request-board-inline-form"); form.noValidate = true; form.setAttribute("aria-label", label); card.appendChild(form); return form; }
  function controls(panel, label) { var row = el("div", "request-board-inline-actions"), save = makeButton(label, ""), cancel = makeButton("취소", ""), notice = el("p", "request-board-item-status"); save.type = "submit"; notice.setAttribute("role", "status"); cancel.addEventListener("click", function () { panel.remove(); }); row.append(save, cancel); panel.append(row, notice); return { save: save, notice: notice }; }
  function openEdit(card, item) {
    var form = panel(card, (item.author || "익명") + " 신청 글 수정");
    var name = document.createElement("input"), content = document.createElement("textarea"), secret = document.createElement("input");
    name.maxLength = 24; name.value = item.author || "익명"; content.maxLength = 240; content.value = item.topic || ""; secret.type = "password"; secret.maxLength = 80; secret.autocomplete = "current-password";
    form.append(labeled("신청자 이름", name), labeled("궁금한 내용", content), labeled("작성 비밀번호", secret));
    var action = controls(form, "수정 저장");
    form.addEventListener("submit", function (event) { event.preventDefault(); var a = name.value.trim(), t = content.value.trim(), p = secret.value; if (!a || t.length < 4 || p.length < 4) { var invalid = !a ? name : t.length < 4 ? content : secret; invalid.setAttribute("aria-invalid", "true"); invalid.focus(); action.notice.textContent = !a ? message("author_required") : t.length < 4 ? message("topic_too_short") : message("password_too_short"); return; } action.save.disabled = true; requestJson(API + "/" + encodeURIComponent(item.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: a, topic: t, password: p }) }).then(load).catch(function (error) { action.notice.textContent = message(error.message); }).finally(function () { action.save.disabled = false; }); });
  }
  function openDelete(card, item) {
    var form = panel(card, (item.author || "익명") + " 신청 글 삭제"), secret = document.createElement("input"); secret.type = "password"; secret.maxLength = 80; secret.autocomplete = "current-password";
    form.append(el("p", "request-board-helper", "삭제하면 글과 관리자 답글이 함께 사라집니다. 작성 비밀번호 또는 관리자 비밀번호를 입력하세요."), labeled("작성/관리자 비밀번호", secret));
    var action = controls(form, "삭제 확정");
    form.addEventListener("submit", function (event) { event.preventDefault(); if (!secret.value) { secret.setAttribute("aria-invalid", "true"); secret.focus(); action.notice.textContent = "비밀번호를 적어 주세요."; return; } action.save.disabled = true; requestJson(API + "/" + encodeURIComponent(item.id), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: secret.value, adminPassword: secret.value }) }).then(load).catch(function (error) { action.notice.textContent = message(error.message); }).finally(function () { action.save.disabled = false; }); });
  }
  function openReply(card, item) {
    var form = panel(card, (item.author || "익명") + " 신청 글 관리자 답글"), reply = document.createElement("textarea"), secret = document.createElement("input"); reply.maxLength = 600; reply.value = item.admin_reply || ""; secret.type = "password"; secret.maxLength = 80; secret.autocomplete = "current-password";
    form.append(labeled("관리자 답글", reply), labeled("관리자 비밀번호", secret));
    var action = controls(form, item.admin_reply ? "답글 수정" : "답글 등록");
    form.addEventListener("submit", function (event) { event.preventDefault(); var value = reply.value.trim(); if (value.length < 2 || !secret.value) { var invalid = value.length < 2 ? reply : secret; invalid.setAttribute("aria-invalid", "true"); invalid.focus(); action.notice.textContent = value.length < 2 ? message("reply_too_short") : "관리자 비밀번호를 적어 주세요."; return; } action.save.disabled = true; requestJson(API + "/" + encodeURIComponent(item.id) + "/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: value, adminPassword: secret.value }) }).then(load).catch(function (error) { action.notice.textContent = message(error.message); }).finally(function () { action.save.disabled = false; }); });
  }
  function render(items) {
    list.replaceChildren(); count.textContent = items.length ? "최근 " + items.length + "건" : "아직 제안 없음";
    if (!items.length) { list.appendChild(el("div", "request-board-empty", "아직 제안된 주제가 없습니다. 첫 번째 주제를 남겨 주세요.")); return; }
    items.forEach(function (item) {
      var card = el("article", "request-board-item"), head = el("div", "request-board-item-head"), displayAuthor = item.author || "익명", avatar = el("span", "request-board-avatar", displayAuthor.slice(0, 1).toUpperCase()), time = el("time", "", dateText(item.created_at)); avatar.setAttribute("aria-hidden", "true"); time.dateTime = item.created_at; head.append(avatar, el("strong", "request-board-author", displayAuthor)); if (item.updated_at) head.appendChild(el("span", "request-board-edited", "수정됨")); head.appendChild(time); card.append(head, el("p", "request-board-topic", item.topic || ""));
      if (item.admin_reply) { var reply = el("div", "request-board-reply"); reply.append(el("strong", "", "관리자 답변 · " + dateText(item.admin_replied_at)), el("p", "", item.admin_reply)); card.appendChild(reply); }
      var actions = el("div", "request-board-actions"); if (item.editable) { var edit = makeButton("수정", "request-board-action"); edit.addEventListener("click", function () { openEdit(card, item); }); actions.appendChild(edit); } else actions.appendChild(el("span", "request-board-edited", "이전 글 · 관리자 삭제 가능")); var remove = makeButton("삭제", "request-board-action"); remove.addEventListener("click", function () { openDelete(card, item); }); actions.appendChild(remove); var replyButton = makeButton(item.admin_reply ? "관리자 답글 수정" : "관리자 답글", "request-board-action is-admin"); replyButton.addEventListener("click", function () { openReply(card, item); }); actions.appendChild(replyButton); card.appendChild(actions); list.appendChild(card);
    });
  }
  function load() { return requestJson(API, { cache: "no-store" }).then(function (data) { render(Array.isArray(data.requests) ? data.requests : []); }).catch(function () { count.textContent = "연결을 다시 시도해 주세요"; }); }
  form.addEventListener("submit", function (event) { event.preventDefault(); var a = author.value.trim(), p = password.value, t = topic.value.trim(), invalid = !a ? author : p.length < 4 ? password : t.length < 4 ? topic : null; if (invalid) { invalid.setAttribute("aria-invalid", "true"); status.dataset.validation = "true"; status.textContent = invalid === author ? message("author_required") : invalid === password ? message("password_too_short") : message("topic_too_short"); invalid.focus(); return; } submit.disabled = true; status.textContent = "등록 중입니다…"; requestJson(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: a, password: p, topic: t, context: "" }) }).then(function () { form.reset(); status.textContent = "희망 리포트를 등록했습니다. 감사합니다!"; return load(); }).catch(function (error) { status.textContent = message(error.message); }).finally(function () { submit.disabled = false; }); });
  load();
})();
