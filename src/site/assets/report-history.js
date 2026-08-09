(function (root) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function statusLabel(status) {
    if (status === "historical") return "과거판 보존";
    if (status === "content-refreshed") return "내용·출처 재검증";
    return "검토 완료";
  }

  function listMarkup(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return "<ul>" + items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>";
  }

  function reviewMarkup(review) {
    if (!review) return "";
    var changes = listMarkup(review.changes);
    var watchItems = listMarkup(review.watchItems);
    return (
      '<div class="report-content-review-shared">' +
        '<div class="report-content-review-shared-head"><span>CONTENT REVIEW · ' + escapeHtml(review.reviewedAt || "") + '</span><strong>' + escapeHtml(review.label || "검토 완료") + '</strong></div>' +
        '<h3>내용 검토 결과</h3>' +
        '<p>' + escapeHtml(review.summary || "내용과 출처를 다시 확인했습니다.") + '</p>' +
        ((changes || watchItems) ? '<div class="report-content-review-shared-grid">' +
          (changes ? '<div><b>이번에 반영</b>' + changes + '</div>' : '') +
          (watchItems ? '<div><b>계속 확인</b>' + watchItems + '</div>' : '') +
        '</div>' : '') +
      '</div>'
    );
  }

  function buildMarkup(record) {
    var previous = record.previousVersion || {};
    var previousRow = previous.url ? (
      '<tr><td>' + escapeHtml(previous.version || "이전판") + '</td><td>' + escapeHtml(previous.date || "") + '</td><td>' + escapeHtml(previous.label || "업데이트 전 기준판") + '</td><td><span class="report-history-shared-status is-previous">과거 정보</span></td><td><a class="report-history-previous-link" href="' + escapeHtml(previous.url) + '" target="_blank" rel="noopener noreferrer">이전 보고서 보기 ↗</a></td></tr>'
    ) : "";
    return (
      '<div class="report-history-shared-card">' +
        '<div class="report-history-shared-head">' +
          '<div><span>VERSION HISTORY</span><h2>버전 및 업데이트 이력</h2><p>' + escapeHtml(record.title) + '</p></div>' +
          '<strong>' + escapeHtml(record.currentVersion || "현재판") + '</strong>' +
        '</div>' +
        reviewMarkup(record.contentReview) +
        '<div class="report-history-shared-table-wrap" role="region" aria-label="버전 및 업데이트 이력" tabindex="0">' +
          '<table class="report-history-shared-table"><thead><tr><th>버전</th><th>업데이트일</th><th>변경 내용</th><th>상태</th><th>보고서</th></tr></thead><tbody>' +
            '<tr><td>' + escapeHtml(record.currentVersion || "현재판") + '</td><td>' + escapeHtml(record.updatedAt || "") + '</td><td>' + escapeHtml(record.changeSummary || "내용과 출처를 다시 확인했습니다.") + '</td><td><span class="report-history-shared-status">' + escapeHtml(statusLabel(record.status)) + '</span></td><td>현재 보고서</td></tr>' +
            previousRow +
          '</tbody></table>' +
        '</div>' +
      '</div>'
    );
  }

  function fallbackPreviousUrl(pathname, snapshotId) {
    var marker = "/reportmode/reports/";
    if (pathname.indexOf(marker) === -1) return pathname;
    return pathname.replace(marker, "/reportmode/versions/" + snapshotId + "/reports/");
  }

  function updateVisibleMetadata(doc, record) {
    var values = {
      reportVersion: record.currentVersion,
      reportUpdated: "Updated " + String(record.updatedAt || "").replaceAll("-", "."),
      historyCurrentVersion: "Current " + record.currentVersion,
    };
    Object.keys(values).forEach(function (id) {
      var node = doc.getElementById(id);
      if (node) node.textContent = values[id];
    });
  }

  function findPageFooter(doc) {
    var footers = doc.querySelectorAll("body > footer");
    return footers.length ? footers[footers.length - 1] : null;
  }

  function pageRecord(doc, reportId) {
    var meta = {};
    var metadata = doc.getElementById("report-metadata");
    if (metadata) {
      try { meta = JSON.parse(metadata.textContent || "{}"); }
      catch (_error) { meta = {}; }
    }
    var history = Array.isArray(meta.history) ? meta.history : [];
    var latest = history[0] || {};
    var rawVersion = String(meta.version || latest.version || "v1.0.0");
    var currentVersion = /^v/i.test(rawVersion) ? rawVersion : "v" + rawVersion;
    return {
      id: reportId,
      title: meta.title || doc.title || "보고서",
      currentVersion: currentVersion,
      updatedAt: meta.updatedAt || meta.updated || latest.date || "2026-08-09",
      status: "verified",
      changeSummary: latest.summary || "최초 등록 및 내용 검토",
    };
  }

  function mount(doc, record) {
    if (!doc || !doc.body || doc.body.dataset.reportHistoryEnhanced === "true") return;
    doc.body.dataset.reportHistoryEnhanced = "true";
    updateVisibleMetadata(doc, record);

    var existing = doc.querySelector(".report-history");
    if (existing) {
      existing.id = "history";
      existing.className = "report-history report-history-shared";
      if (existing.removeAttribute) existing.removeAttribute("aria-labelledby");
      existing.setAttribute("aria-label", "버전 및 업데이트 이력");
      existing.innerHTML = buildMarkup(record);
      return;
    }

    var section = doc.createElement("section");
    section.id = "history";
    section.className = "report-history report-history-shared";
    section.setAttribute("aria-label", "버전 및 업데이트 이력");
    section.innerHTML = buildMarkup(record);
    var footer = findPageFooter(doc);
    if (footer && footer.parentNode) footer.parentNode.insertBefore(section, footer);
    else doc.body.appendChild(section);
  }

  function boot(doc, win, script) {
    if (!doc || !win || !script) return;
    var reportId = script.dataset.reportId;
    var snapshotId = script.dataset.snapshotId;
    var hasPrevious = script.dataset.hasPrevious === "true";
    if (!reportId) return;
    var query = snapshotId ? "?v=" + encodeURIComponent(snapshotId) : "";
    var manifestUrl = new URL("../versions/manifest.json" + query, script.src).href;
    win.fetch(manifestUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("version manifest " + response.status);
        return response.json();
      })
      .then(function (manifest) {
        var record = (manifest.reports || []).find(function (item) { return item.id === reportId; });
        mount(doc, record || pageRecord(doc, reportId));
      })
      .catch(function (error) {
        console.warn("Report history fallback:", error.message);
        if (!hasPrevious || !snapshotId) {
          mount(doc, pageRecord(doc, reportId));
          return;
        }
        var record = pageRecord(doc, reportId);
        record.status = "content-refreshed";
        record.changeSummary = "내용과 출처를 다시 확인했습니다.";
        record.previousVersion = {
          version: "이전판",
          date: "2026-08-09",
          label: "내용 최신화 전 기준판",
          url: fallbackPreviousUrl(win.location.pathname, snapshotId),
        };
        mount(doc, record);
      });
  }

  var api = { boot: boot, buildMarkup: buildMarkup, fallbackPreviousUrl: fallbackPreviousUrl, findPageFooter: findPageFooter, mount: mount, pageRecord: pageRecord };
  root.ReportModeHistory = api;
  if (typeof document !== "undefined" && typeof window !== "undefined") {
    boot(document, window, document.currentScript);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
