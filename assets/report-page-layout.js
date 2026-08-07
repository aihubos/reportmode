(function () {
  "use strict";

  var body = document.body;
  if (!body || body.dataset.reportLayoutEnhanced === "true") return;
  body.dataset.reportLayoutEnhanced = "true";

  var printStyle = document.createElement("style");
  printStyle.id = "report-layout-print-style";
  document.head.appendChild(printStyle);
  var controls = document.createElement("div");
  controls.className = "report-layout-controls";
  controls.setAttribute("aria-label", "보고서 레이아웃");
  controls.innerHTML =
    '<span class="report-layout-label">레이아웃</span>' +
    '<div class="report-layout-buttons" role="group" aria-label="가로 또는 세로">' +
    '<button class="report-layout-button" type="button" data-report-layout="wide" aria-pressed="false">가로</button>' +
    '<button class="report-layout-button" type="button" data-report-layout="a4" aria-pressed="false">세로</button>' +
    "</div>";

  var switcher = document.querySelector(".report-view-switcher-inner");
  if (switcher) switcher.insertBefore(controls, switcher.firstChild);
  else document.body.insertBefore(controls, document.body.firstChild);

  var buttons = controls.querySelectorAll("[data-report-layout]");
  function setPrintPage(layout) {
    printStyle.textContent = "@page { size: A4 " + (layout === "wide" ? "landscape" : "portrait") + "; margin: 15mm; }";
  }

  function setLayout(layout) {
    var isA4 = layout === "a4";
    body.classList.toggle("report-a4-mode", isA4);
    body.dataset.reportLayout = isA4 ? "a4" : "wide";
    buttons.forEach(function (button) {
      var active = button.dataset.reportLayout === layout;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    setPrintPage(layout);
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () { setLayout(button.dataset.reportLayout); });
  });

  // Every report opens in the shared default: portrait A4.
  setLayout("a4");

  var commentStyle = document.createElement("style");
  commentStyle.textContent = ".report-comments{max-width:980px;margin:56px auto 36px;padding:0 22px}.report-comments-shell{padding:26px;border:1px solid #e5e8eb;border-radius:20px;background:#fff}.report-comments-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:18px}.report-comments-head h2{margin:0;color:#191f28;font-size:21px}.report-comments-head p{margin:0;color:#8b95a1;font-size:12px}.report-comment-form{display:grid;grid-template-columns:110px 1fr 128px;gap:8px;padding:14px;border-radius:14px;background:#f7f8fa}.report-comment-form input,.report-comment-form textarea{width:100%;border:1px solid #dfe4ea;border-radius:10px;background:#fff;color:#191f28;font:inherit;font-size:13px;outline:0}.report-comment-form input{min-height:38px;padding:0 10px}.report-comment-form textarea{grid-column:1 / -1;min-height:72px;padding:10px;resize:vertical}.report-comment-form input:focus,.report-comment-form textarea:focus{border-color:#3182f6;box-shadow:0 0 0 3px rgba(49,130,246,.1)}.report-comment-form button{min-height:38px;border:0;border-radius:10px;color:#fff;background:#3182f6;font:800 13px/1 inherit;cursor:pointer}.report-comment-form button:disabled{opacity:.6;cursor:wait}.report-comment-notice{grid-column:1 / -1;min-height:16px;margin:0;color:#6b7684;font-size:11px}.report-comment-list{display:grid;gap:10px;margin-top:18px}.report-comment{padding:14px 0;border-top:1px solid #edf0f2}.report-comment:first-child{border-top:0}.report-comment-meta{display:flex;align-items:center;gap:8px}.report-comment-meta strong{color:#333d4b;font-size:13px}.report-comment-meta time{color:#8b95a1;font-size:11px}.report-comment-delete{margin-left:auto;border:0;color:#8b95a1;background:transparent;font:700 11px/1 inherit;cursor:pointer}.report-comment-body{margin:7px 0 0;color:#4e5968;font-size:13px;line-height:1.55;white-space:pre-wrap}.report-comment-empty{padding:18px;border-radius:12px;color:#8b95a1;background:#f7f8fa;font-size:13px;text-align:center}@media(max-width:700px){.report-comments{margin:36px auto 22px;padding:0 14px}.report-comments-shell{padding:20px 16px}.report-comment-form{grid-template-columns:1fr 110px}.report-comment-form input[name=author]{grid-column:1}.report-comment-form input[name=password]{grid-column:2}}@media print{.report-comments{display:none!important}}";
  document.head.appendChild(commentStyle);

  function reportIdFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    var last = parts[parts.length - 1] || "report";
    if (last === "index.html" || last === "") last = parts[parts.length - 2] || "report";
    return last.replace(/\.html$/i, "");
  }

  function installComments() {
    var reportId = reportIdFromPath();
    if (!reportId || document.getElementById("reportComments")) return;
    var comments = document.createElement("section");
    comments.className = "report-comments";
    comments.id = "reportComments";
    comments.setAttribute("aria-label", "보고서 댓글");
    comments.innerHTML = '<div class="report-comments-shell"><div class="report-comments-head"><div><h2>이 보고서는 어떠셨나요?</h2><p>주제에 대한 의견과 다음 질문을 남겨 주세요.</p></div></div><form class="report-comment-form"><input name="author" maxlength="24" placeholder="이름 (선택)"><input name="password" type="password" minlength="4" required placeholder="삭제 비밀번호"><textarea name="content" minlength="2" maxlength="500" required placeholder="댓글을 남겨 주세요. 작성한 댓글은 비밀번호로 삭제할 수 있습니다."></textarea><button type="submit">댓글 남기기</button><p class="report-comment-notice" role="status"></p></form><div class="report-comment-list"><div class="report-comment-empty">댓글을 불러오는 중입니다.</div></div></div>';
    var main = document.querySelector("main");
    if (main) main.insertAdjacentElement("afterend", comments);
    else document.body.appendChild(comments);

    var api = "https://reportmode-request-board.report-request-board.workers.dev/comments";
    var form = comments.querySelector("form");
    var list = comments.querySelector(".report-comment-list");
    var notice = comments.querySelector(".report-comment-notice");
    var submit = form.querySelector("button[type=submit]");
    function formatDate(value) { var date = new Date(value); return Number.isNaN(date.getTime()) ? "방금 전" : date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }); }
    function render(items) {
      list.replaceChildren();
      if (!items.length) { var empty = document.createElement("div"); empty.className = "report-comment-empty"; empty.textContent = "첫 번째 댓글을 남겨 주세요."; list.appendChild(empty); return; }
      items.forEach(function (item) {
        var row = document.createElement("article"); row.className = "report-comment";
        var meta = document.createElement("div"); meta.className = "report-comment-meta";
        var author = document.createElement("strong"); author.textContent = item.author || "익명";
        var time = document.createElement("time"); time.dateTime = item.created_at; time.textContent = formatDate(item.created_at);
        var remove = document.createElement("button"); remove.type = "button"; remove.className = "report-comment-delete"; remove.textContent = "삭제";
        remove.addEventListener("click", function () {
          var password = window.prompt("댓글 작성 시 입력한 비밀번호를 적어 주세요.");
          if (!password) return;
          fetch(api + "/" + encodeURIComponent(item.id), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password }) })
            .then(function (response) { if (!response.ok) throw new Error("delete failed"); return load(); })
            .catch(function () { window.alert("비밀번호가 맞지 않거나 삭제하지 못했습니다."); });
        });
        meta.append(author, time, remove);
        var content = document.createElement("p"); content.className = "report-comment-body"; content.textContent = item.content;
        row.append(meta, content); list.appendChild(row);
      });
    }
    function load() {
      return fetch(api + "?report=" + encodeURIComponent(reportId), { cache: "no-store" })
        .then(function (response) { if (!response.ok) throw new Error("load failed"); return response.json(); })
        .then(function (data) { render(Array.isArray(data.comments) ? data.comments : []); })
        .catch(function () { list.innerHTML = '<div class="report-comment-empty">댓글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>'; });
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault(); submit.disabled = true; notice.textContent = "등록 중입니다…";
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: reportId, author: form.author.value, password: form.password.value, content: form.content.value }) })
        .then(function (response) { if (!response.ok) throw new Error("submit failed"); return response.json(); })
        .then(function () { form.reset(); notice.textContent = "댓글을 등록했습니다."; return load(); })
        .catch(function () { notice.textContent = "댓글을 등록하지 못했습니다. 입력 내용을 확인해 주세요."; })
        .finally(function () { submit.disabled = false; });
    });
    load();
  }

  installComments();

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("#report-pdf-button");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setPrintPage(body.dataset.reportLayout === "wide" ? "wide" : "a4");
    window.print();
  }, true);
})();
