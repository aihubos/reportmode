(function () {
  "use strict";

  var API = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? "http://127.0.0.1:8787"
    : "https://reportmode-request-board.report-request-board.workers.dev";
  var MANIFEST_URL = "../../reports/manifest.json";
  var THUMBNAIL_MAX_BYTES = 600 * 1024;
  var THUMBNAIL_PRESETS = [
    { width: 720, height: 405, quality: 0.82 },
    { width: 640, height: 360, quality: 0.76 },
    { width: 512, height: 288, quality: 0.7 },
  ];
  var state = {
    password: "",
    reports: [],
    reportsById: new Map(),
    reportsByPublicId: new Map(),
    counts: {},
    overrides: {},
    hidden: new Set(),
    analytics: null,
    editing: null,
    privateToken: "",
    privateReports: [],
    privateEditing: null,
    selectedReports: new Set(),
    selectedPrivateReports: new Set(),
    analyticsDays: 30,
    jobs: [],
  };

  function byId(id) { return document.getElementById(id); }

  if (!byId("archiveAdminGateForm")) return;

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error((body && body.error) || "request_failed");
          error.status = response.status;
          error.retryAfter = response.headers.get("Retry-After") || "";
          throw error;
        }
        return body;
      });
    });
  }

  function publicJson(url) {
    return requestJson(url, { method: "GET", cache: "no-store" });
  }

  function message(code, retryAfter) {
    if (code === "wrong_admin_password") return "관리자 비밀번호가 맞지 않습니다.";
    if (code === "admin_not_configured") return "관리자 기능을 준비 중입니다.";
    if (code === "missing_report") return "보고서 정보를 찾지 못했습니다.";
    if (code === "title_too_short") return "제목은 두 글자 이상 입력해 주세요.";
    if (code === "summary_too_short") return "상세 설명은 네 글자 이상 입력해 주세요.";
    if (code === "invalid_cover_url") return "썸네일은 HTTPS 이미지 주소 또는 JPEG 이미지로 입력해 주세요.";
    if (code === "private_login_blocked") return "입력 횟수를 초과했습니다. " + (retryAfter ? retryAfter + "초 후 다시 시도해 주세요." : "잠시 후 다시 시도해 주세요.");
    if (code === "private_storage_not_configured") return "비공개 저장소를 준비 중입니다.";
    if (code === "private_session_expired" || code === "private_auth_required") return "비공개 인증 시간이 끝났습니다. 관리자 비밀번호를 다시 입력해 주세요.";
    if (code === "private_report_exists") return "같은 ID의 비공개 보고서가 이미 있습니다.";
    if (code === "private_report_not_found") return "비공개 보고서를 찾지 못했습니다.";
    if (code === "invalid_private_report_id") return "보고서 ID는 영문, 숫자, 하이픈으로 입력해 주세요.";
    if (code === "invalid_display_date") return "작성일을 확인해 주세요.";
    if (code === "invalid_source_count") return "출처 수는 0부터 999까지 입력해 주세요.";
    if (code === "html_required") return "HTML 보고서 파일을 선택해 주세요.";
    if (code === "invalid_html_type") return "HTML 파일만 등록할 수 있습니다.";
    if (code === "html_too_large") return "HTML 파일은 최대 5MB까지 등록할 수 있습니다.";
    if (code === "invalid_cover_type") return "썸네일은 JPG, PNG, WebP 파일만 사용할 수 있습니다.";
    if (code === "cover_too_large") return "썸네일은 최대 1MB까지 등록할 수 있습니다.";
    if (code === "invalid_admin_action") return "지원하지 않는 일괄 작업입니다.";
    if (code === "missing_report_ids") return "보고서를 먼저 선택해 주세요.";
    if (code === "too_many_report_ids") return "한 번에 50개까지만 처리할 수 있습니다.";
    if (code === "lifecycle_not_configured" || code === "github_lifecycle_not_configured") return "비공개·삭제 자동화가 아직 연결되지 않았습니다.";
    if (code === "admin_job_not_found") return "작업 정보를 찾지 못했습니다.";
    if (code === "lifecycle_failed") return "일괄 작업이 실패했습니다. 공개 원본은 유지됩니다.";
    if (code === "lifecycle_partial") return "일부 보고서만 처리되었습니다. 작업 이력을 확인해 주세요.";
    if (code === "lifecycle_timeout") return "작업 확인 시간이 초과되었습니다. 잠시 후 상태를 다시 확인해 주세요.";
    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function setStatus(id, text, isError) {
    var output = byId(id);
    if (!output) return;
    output.textContent = text || "";
    output.dataset.error = isError ? "true" : "false";
  }

  function setText(id, value) {
    var output = byId(id);
    if (output) output.textContent = value;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Math.max(0, Number(value || 0)));
  }

  function displayDate(value) {
    var text = String(value || "").trim();
    if (!text) return "-";
    if (/^\d{6}$/.test(text)) return "20" + text.slice(0, 2) + "." + text.slice(2, 4) + "." + text.slice(4, 6);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.replaceAll("-", ".");
    var date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date).replaceAll(" ", "");
  }

  function safeImageUrl(value) {
    var candidate = String(value || "").trim();
    if (!candidate) return "";
    var inlineThumbnail = candidate.match(/^data:image\/jpeg;base64,([a-z0-9+/]*={0,2})$/i);
    if (inlineThumbnail) {
      var encoded = inlineThumbnail[1];
      var padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
      var byteLength = Math.floor((encoded.length * 3) / 4) - padding;
      return encoded.length % 4 === 0 && byteLength > 0 && byteLength <= THUMBNAIL_MAX_BYTES
        ? "data:image/jpeg;base64," + encoded
        : "";
    }
    try {
      var url = new URL(candidate, window.location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function publicImageUrl(value) {
    var requested = String(value || "").trim();
    if (!requested) return "";
    if (/^(https:|data:image\/jpeg;base64,)/i.test(requested)) return requested;
    return new URL("../../" + requested.replace(/^\/+/, ""), window.location.href).href;
  }

  function reportUrl(report) {
    var path = String((report && report.path) || "").replace(/^\/+/, "");
    if (path) return new URL("../../" + path, window.location.href).href;
    if (report && /^https:\/\//i.test(report.url || "")) return report.url;
    return new URL("../../archive/", window.location.href).href;
  }

  function reportPublicId(report) {
    var path = String((report && report.path) || "").replaceAll("\\", "/").replace(/^\/+/, "");
    if (path.endsWith("/")) path = path.slice(0, -1);
    var parts = path.split("/").filter(Boolean);
    var last = parts[parts.length - 1] || "";
    if (last.toLowerCase() === "index.html") last = parts[parts.length - 2] || "";
    last = last.replace(/\.html$/i, "");
    return last || (report && report.id) || "";
  }

  function reportViewCount(report) {
    return state.counts[reportPublicId(report)] ?? state.counts[report.id] ?? 0;
  }

  function presentation(report) {
    var override = state.overrides[report.id];
    return {
      title: (override && override.title) || report.title || report.id,
      summary: (override && override.summary) || report.summary || "",
      coverImage: (override && override.coverImage) || report.coverImage || "",
      coverAlt: (override && override.coverAlt) || report.coverAlt || report.title || "보고서 대표 이미지",
    };
  }

  function reportState(report) {
    var pendingJob = state.jobs.find(function (job) {
      return ["queued", "running"].includes(String(job.status)) && Array.isArray(job.items) && job.items.some(function (item) { return item.report_id === report.id; });
    });
    if (pendingJob) return { label: pendingJob.action === "make_private" ? "비공개 전환 중" : "삭제 중", hidden: false, pending: true };
    if (state.hidden.has(report.id)) return { label: "숨김", hidden: true };
    if (report.status === "draft") return { label: "초안", hidden: false };
    return { label: "공개", hidden: false };
  }

  function isExternalReport(report) {
    return !report || !report.path || report.isExternalLink === true;
  }

  function visibleReportsForSelection() {
    var search = String(byId("archiveAdminReportSearch").value || "").trim().toLocaleLowerCase("ko-KR");
    var selectedStatus = String(byId("archiveAdminReportStatus").value || "all");
    return state.reports.filter(function (report) { return matchesReport(report, search, selectedStatus); });
  }

  function updateSelectionUi() {
    var count = state.selectedReports.size;
    setText("archiveAdminSelectionCount", formatNumber(count) + "개 선택");
    var bar = byId("archiveAdminBulkBar");
    if (bar) bar.hidden = count === 0;
    var privateCount = state.selectedPrivateReports.size;
    setText("archiveAdminPrivateSelectionCount", formatNumber(privateCount) + "개 선택");
    var privateBar = byId("archiveAdminPrivateBulkBar");
    if (privateBar) privateBar.hidden = privateCount === 0;
  }

  function syncSelectAllCheckboxes() {
    var visible = visibleReportsForSelection();
    var allSelected = visible.length > 0 && visible.every(function (report) { return state.selectedReports.has(report.id); });
    [byId("archiveAdminSelectAll"), byId("archiveAdminHeaderSelect")].forEach(function (checkbox) {
      if (!checkbox) return;
      checkbox.checked = allSelected;
      checkbox.indeterminate = !allSelected && visible.some(function (report) { return state.selectedReports.has(report.id); });
    });
    var privateCheckbox = byId("archiveAdminPrivateHeaderSelect");
    var privateAll = state.privateReports.length > 0 && state.privateReports.every(function (report) { return state.selectedPrivateReports.has(report.id); });
    if (privateCheckbox) {
      privateCheckbox.checked = privateAll;
      privateCheckbox.indeterminate = !privateAll && state.privateReports.some(function (report) { return state.selectedPrivateReports.has(report.id); });
    }
    updateSelectionUi();
  }

  function makeCell(text, className) {
    var cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function makeThumbnail(report) {
    var imageUrl = publicImageUrl(presentation(report).coverImage);
    if (!imageUrl) {
      var fallback = document.createElement("div");
      fallback.className = "archive-admin-console-thumbnail-fallback";
      fallback.textContent = "표지 없음";
      return fallback;
    }
    var image = document.createElement("img");
    image.className = "archive-admin-console-thumbnail";
    image.src = imageUrl;
    image.alt = presentation(report).coverAlt;
    image.loading = "lazy";
    image.addEventListener("error", function () {
      var fallback = document.createElement("div");
      fallback.className = "archive-admin-console-thumbnail-fallback";
      fallback.textContent = "이미지 오류";
      image.replaceWith(fallback);
    }, { once: true });
    return image;
  }

  function renderDailyTable(id, rows, emptyText) {
    var body = byId(id);
    if (!body) return;
    body.replaceChildren();
    if (!Array.isArray(rows) || !rows.length) {
      var empty = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = emptyText;
      empty.appendChild(cell);
      body.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.append(makeCell(displayDate(row.date), "archive-admin-console-table-number"));
      tr.append(makeCell(formatNumber(row.count), "archive-admin-console-table-number"));
      body.appendChild(tr);
    });
  }

  function renderPopularReports(rows) {
    var list = byId("archiveAdminPopularList");
    if (!list) return;
    list.replaceChildren();
    if (!Array.isArray(rows) || !rows.length) {
      var empty = document.createElement("li");
      empty.className = "archive-admin-console-empty";
      empty.textContent = "아직 조회 데이터가 없습니다.";
      list.appendChild(empty);
      return;
    }
    rows.slice(0, 10).forEach(function (row, index) {
      var item = document.createElement("li");
      var rank = document.createElement("span");
      rank.className = "archive-admin-console-popular-rank";
      rank.textContent = String(index + 1);
      var copy = document.createElement("a");
      copy.className = "archive-admin-console-popular-copy";
      var report = state.reportsByPublicId.get(row.reportId) || state.reportsById.get(row.reportId);
      copy.href = report ? reportUrl(report) : "../../archive/";
      copy.target = "_blank";
      copy.rel = "noopener";
      copy.textContent = report ? presentation(report).title : row.reportId;
      var views = document.createElement("strong");
      views.textContent = formatNumber(row.views);
      item.append(rank, copy, views);
      list.appendChild(item);
    });
  }

  function renderAnalytics() {
    var analytics = state.analytics;
    var site = analytics && analytics.site ? analytics.site : { total: 0, today: 0, daily: [] };
    var reports = analytics && analytics.reports ? analytics.reports : { totalViews: 0, todayViews: 0, daily: [], top: [] };
    setText("archiveAdminMetricVisits", formatNumber(site.total));
    setText("archiveAdminMetricTodayVisits", formatNumber(site.today));
    setText("archiveAdminMetricViews", formatNumber(reports.totalViews));
    setText("archiveAdminMetricTodayViews", formatNumber(reports.todayViews));
    setText("archiveAdminMetricHidden", formatNumber(state.hidden.size));
    setText("archiveAdminAnalyticsUpdated", analytics && analytics.generatedAt ? "기준 " + displayDate(analytics.generatedAt) : "통계 불러오는 중");
    renderDailyTable("archiveAdminVisitDaily", site.daily, "방문 데이터가 없습니다.");
    renderDailyTable("archiveAdminViewDaily", reports.daily, "클릭 데이터가 없습니다.");
    renderPopularReports(reports.top);
    if (window.ReportHubAdminCharts) {
      window.ReportHubAdminCharts.renderTrend(
        analytics,
        byId("archiveAdminTrendChart"),
        byId("archiveAdminTrendSummary"),
        byId("archiveAdminTrendLegend"),
        byId("archiveAdminTrendTable"),
      );
    }
    renderSources(analytics && analytics.entries);
    renderJobs();
  }

  function sourceLabel(source) {
    return ({ direct: "직접 접속", internal: "Report Hub 내부", naver: "네이버", google: "구글", kakao: "카카오", daangn: "당근", social: "SNS", external: "기타 외부" })[source] || source || "기타";
  }

  function renderSources(entries) {
    var sourceList = byId("archiveAdminSourceList");
    var recent = byId("archiveAdminRecentEntries");
    if (!sourceList || !recent) return;
    var sources = entries && Array.isArray(entries.sources) ? entries.sources : [];
    sourceList.innerHTML = sources.length ? sources.map(function (row) {
      return '<div class="archive-admin-console-source-item"><span>' + sourceLabel(row.source) + '</span><strong>' + formatNumber(row.count) + ' · ' + formatNumber(row.share) + '%</strong><div class="archive-admin-console-source-bar"><span style="width:' + Math.min(100, Number(row.share || 0)) + '%"></span></div></div>';
    }).join("") : '<p class="archive-admin-console-empty">유입 데이터가 없습니다.</p>';
    var rows = entries && Array.isArray(entries.recent) ? entries.recent : [];
    recent.innerHTML = rows.length ? rows.slice(0, 100).map(function (row) {
      var referrer = row.referrerUrl ? '<a class="archive-admin-console-entry-link" href="' + escapeHtml(row.referrerUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(sourceLabel(row.source)) + '</a>' : escapeHtml(sourceLabel(row.source));
      var report = row.reportId ? escapeHtml(row.reportId) : "-";
      return '<tr><td class="archive-admin-console-table-number">' + escapeHtml(displayDate(row.createdAt)) + '</td><td>' + referrer + '</td><td>' + escapeHtml(row.landingPath || "/") + '</td><td>' + report + '</td></tr>';
    }).join("") : '<tr><td colspan="4">유입 데이터가 없습니다.</td></tr>';
  }

  function renderJobs() {
    var body = byId("archiveAdminJobs");
    if (!body) return;
    if (!state.jobs.length) {
      body.innerHTML = '<tr><td colspan="5">작업 이력이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = state.jobs.map(function (job) {
      var statusClass = job.status === "failed" ? "is-failed" : ["queued", "running"].includes(job.status) ? "is-pending" : "";
      var statusLabel = ({ queued: "대기", running: "처리 중", completed: "완료", partial: "일부 실패", failed: "실패" })[job.status] || job.status;
      var actionLabel = job.action === "make_private" ? "비공개 전환" : job.action === "delete" ? "삭제" : job.action;
      return '<tr><td class="archive-admin-console-table-number">' + escapeHtml(displayDate(job.requested_at)) + '</td><td>' + escapeHtml(actionLabel) + '</td><td><span class="archive-admin-console-state ' + statusClass + '">' + escapeHtml(statusLabel) + '</span></td><td>' + formatNumber(job.success_count) + ' / ' + formatNumber(job.requested_count) + '</td><td>' + escapeHtml(job.error_message || "-") + '</td></tr>';
    }).join("");
  }

  function matchesReport(report, query, selectedStatus) {
    var stateValue = reportState(report);
    if (selectedStatus === "visible" && stateValue.hidden) return false;
    if (selectedStatus === "hidden" && !stateValue.hidden) return false;
    if (selectedStatus === "draft" && report.status !== "draft") return false;
    if (!query) return true;
    var card = presentation(report);
    var haystack = [card.title, card.summary, report.category, (report.tags || []).join(" "), report.id]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    return haystack.includes(query);
  }

  function renderReports() {
    var body = byId("archiveAdminReportTableBody");
    if (!body) return;
    var search = String(byId("archiveAdminReportSearch").value || "").trim().toLocaleLowerCase("ko-KR");
    var selectedStatus = String(byId("archiveAdminReportStatus").value || "all");
    var visibleReports = state.reports.filter(function (report) {
      return matchesReport(report, search, selectedStatus);
    });
    setText("archiveAdminReportCount", "총 " + formatNumber(visibleReports.length) + "개");
    body.replaceChildren();
    if (!visibleReports.length) {
      var empty = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = 8;
      cell.textContent = "조건에 맞는 보고서가 없습니다.";
      empty.appendChild(cell);
      body.appendChild(empty);
      syncSelectAllCheckboxes();
      return;
    }
    visibleReports.forEach(function (report) {
      var card = presentation(report);
      var tr = document.createElement("tr");
      var coverCell = document.createElement("td");
      coverCell.appendChild(makeThumbnail(report));
      var reportCell = document.createElement("td");
      reportCell.className = "archive-admin-console-report-cell";
      var title = document.createElement("a");
      title.className = "archive-admin-console-report-title";
      title.href = reportUrl(report);
      title.target = "_blank";
      title.rel = "noopener";
      title.textContent = card.title;
      var summary = document.createElement("p");
      summary.className = "archive-admin-console-report-summary";
      summary.textContent = card.summary;
      reportCell.append(title, summary);
      var status = reportState(report);
      var statusCell = document.createElement("td");
      var statusBadge = document.createElement("span");
      statusBadge.className = "archive-admin-console-state" + (status.hidden ? " is-hidden" : "") + (status.pending ? " is-pending" : "");
      statusBadge.textContent = status.label;
      statusCell.appendChild(statusBadge);
      var actionCell = document.createElement("td");
      var actions = document.createElement("div");
      actions.className = "archive-admin-console-table-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "archive-admin-console-table-button";
      edit.textContent = "수정";
      edit.addEventListener("click", function () { openEditor(report); });
      var hide = document.createElement("button");
      hide.type = "button";
      hide.className = "archive-admin-console-table-button" + (status.hidden ? "" : " is-danger");
      hide.textContent = status.hidden ? "복구" : "숨김";
      hide.addEventListener("click", function () { toggleHidden(report, hide); });
      var makePrivate = document.createElement("button");
      makePrivate.type = "button";
      makePrivate.className = "archive-admin-console-table-button" + (isExternalReport(report) ? "" : " is-danger");
      makePrivate.textContent = "비공개";
      makePrivate.disabled = isExternalReport(report) || status.pending;
      makePrivate.title = isExternalReport(report) ? "외부 링크 보고서는 비공개 전환할 수 없습니다." : "R2 비공개 보고서로 전환";
      makePrivate.addEventListener("click", function () { runReportAction("make_private", [report.id]); });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "archive-admin-console-table-button is-danger";
      remove.textContent = "삭제";
      remove.disabled = status.pending;
      remove.addEventListener("click", function () { runReportAction("delete", [report.id]); });
      var checkboxCell = document.createElement("td");
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selectedReports.has(report.id);
      checkbox.setAttribute("aria-label", card.title + " 선택");
      checkbox.addEventListener("change", function () {
        if (checkbox.checked) state.selectedReports.add(report.id);
        else state.selectedReports.delete(report.id);
        syncSelectAllCheckboxes();
      });
      checkboxCell.appendChild(checkbox);
      actions.append(edit, makePrivate, hide, remove);
      actionCell.appendChild(actions);
      tr.append(
        checkboxCell,
        coverCell,
        reportCell,
        makeCell(report.category || "기타"),
        makeCell(displayDate(report.createdAt), "archive-admin-console-table-number"),
        makeCell(formatNumber(reportViewCount(report)), "archive-admin-console-table-number"),
        statusCell,
        actionCell,
      );
      body.appendChild(tr);
    });
    syncSelectAllCheckboxes();
  }

  function loadPublicData() {
    return Promise.all([
      publicJson(MANIFEST_URL),
      publicJson(API + "/report-views"),
      publicJson(API + "/report-overrides"),
      publicJson(API + "/hidden-reports"),
    ]).then(function (result) {
      var manifest = result[0];
      var views = result[1];
      var overrides = result[2];
      var hidden = result[3];
      state.reports = (Array.isArray(manifest.reports) ? manifest.reports : [])
        .filter(function (report) { return report && report.id; })
        .sort(function (left, right) {
          return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
        });
      state.reportsById = new Map(state.reports.map(function (report) { return [report.id, report]; }));
      state.reportsByPublicId = new Map(state.reports.map(function (report) { return [reportPublicId(report), report]; }));
      state.counts = views && views.counts && typeof views.counts === "object" ? views.counts : {};
      state.overrides = overrides && overrides.overrides && typeof overrides.overrides === "object" ? overrides.overrides : {};
      state.hidden = new Set(Array.isArray(hidden.reportIds) ? hidden.reportIds : []);
    });
  }

  function loadAnalytics() {
    return requestJson(API + "/admin/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: state.password, days: state.analyticsDays }),
    }).then(function (analytics) {
      state.analytics = analytics;
    });
  }

  function loadJobs() {
    return requestJson(API + "/admin/report-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: state.password, limit: 20 }),
    }).then(function (body) {
      state.jobs = Array.isArray(body.jobs) ? body.jobs : [];
    });
  }

  function refreshDashboard() {
    setStatus("archiveAdminDashboardStatus", "게시물 목록과 통계를 불러오는 중입니다.", false);
    return loadPublicData()
      .then(function () {
        renderReports();
        renderAnalytics();
        return Promise.all([loadAnalytics(), loadJobs()])
          .then(function () {
            renderAnalytics();
            setStatus("archiveAdminDashboardStatus", "목록과 통계를 새로 읽었습니다.", false);
          })
          .catch(function (error) {
            renderAnalytics();
            setStatus("archiveAdminDashboardStatus", "게시물 목록은 불러왔지만 통계를 읽지 못했습니다. " + message(error.message), true);
          });
      })
      .catch(function (error) {
        setStatus("archiveAdminDashboardStatus", message(error.message), true);
      });
  }

  function openDialog() {
    var dialog = byId("archiveAdminEditDialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog() {
    var dialog = byId("archiveAdminEditDialog");
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    state.editing = null;
    document.querySelectorAll(".archive-admin-console-table-wrap").forEach(function (tableWrap) {
      tableWrap.scrollLeft = 0;
    });
  }

  function previewImage() {
    var preview = byId("archiveAdminEditPreview");
    var empty = byId("archiveAdminEditPreviewEmpty");
    var coverInput = byId("archiveAdminEditCover");
    if (!preview || !empty || !coverInput || !state.editing) return;
    var requested = String(coverInput.value || "").trim();
    var source = requested ? safeImageUrl(requested) : publicImageUrl(presentation(state.editing).coverImage);
    if (requested && !source) {
      preview.hidden = true;
      preview.removeAttribute("src");
      empty.hidden = false;
      setStatus("archiveAdminEditStatus", "HTTPS 이미지 주소 또는 JPEG 이미지를 사용해 주세요.", true);
      return;
    }
    if (!source) {
      preview.hidden = true;
      preview.removeAttribute("src");
      empty.hidden = false;
      return;
    }
    preview.src = source;
    preview.alt = String(byId("archiveAdminEditCoverAlt").value || presentation(state.editing).coverAlt || "보고서 대표 이미지");
    preview.hidden = false;
    empty.hidden = true;
  }

  function thumbnailByteLength(dataUrl) {
    var encoded = String(dataUrl || "").split(",")[1] || "";
    var padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    return Math.floor((encoded.length * 3) / 4) - padding;
  }

  function createThumbnailDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//i.test(file.type || "")) {
        reject(new Error("thumbnail_file_required"));
        return;
      }
      var sourceUrl = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        try {
          for (var index = 0; index < THUMBNAIL_PRESETS.length; index += 1) {
            var preset = THUMBNAIL_PRESETS[index];
            var canvas = document.createElement("canvas");
            canvas.width = preset.width;
            canvas.height = preset.height;
            var context = canvas.getContext("2d");
            if (!context) throw new Error("thumbnail_canvas_unavailable");
            var scale = Math.max(preset.width / image.naturalWidth, preset.height / image.naturalHeight);
            var width = image.naturalWidth * scale;
            var height = image.naturalHeight * scale;
            context.drawImage(image, (preset.width - width) / 2, (preset.height - height) / 2, width, height);
            var dataUrl = canvas.toDataURL("image/jpeg", preset.quality);
            if (thumbnailByteLength(dataUrl) <= THUMBNAIL_MAX_BYTES) {
              URL.revokeObjectURL(sourceUrl);
              resolve(dataUrl);
              return;
            }
          }
          URL.revokeObjectURL(sourceUrl);
          reject(new Error("thumbnail_too_large"));
        } catch (error) {
          URL.revokeObjectURL(sourceUrl);
          reject(error);
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(sourceUrl);
        reject(new Error("thumbnail_decode_failed"));
      };
      image.src = sourceUrl;
    });
  }

  function openEditor(report) {
    state.editing = report;
    var card = presentation(report);
    byId("archiveAdminEditReportName").textContent = report.id;
    byId("archiveAdminEditTitle").value = card.title;
    byId("archiveAdminEditSummary").value = card.summary;
    byId("archiveAdminEditCover").value = state.overrides[report.id] && state.overrides[report.id].coverImage ? state.overrides[report.id].coverImage : "";
    byId("archiveAdminEditCoverAlt").value = card.coverAlt;
    byId("archiveAdminEditFile").value = "";
    setStatus("archiveAdminEditStatus", "", false);
    previewImage();
    openDialog();
    byId("archiveAdminEditTitle").focus();
  }

  function saveEditor(event) {
    event.preventDefault();
    if (!state.editing || !state.password) return;
    var title = String(byId("archiveAdminEditTitle").value || "").trim();
    var summary = String(byId("archiveAdminEditSummary").value || "").trim();
    var requestedCover = String(byId("archiveAdminEditCover").value || "").trim();
    var coverImage = requestedCover ? safeImageUrl(requestedCover) : "";
    var coverAlt = String(byId("archiveAdminEditCoverAlt").value || "").trim();
    var save = byId("archiveAdminEditSave");
    if (title.length < 2) {
      setStatus("archiveAdminEditStatus", "제목은 두 글자 이상 입력해 주세요.", true);
      return;
    }
    if (summary.length < 4) {
      setStatus("archiveAdminEditStatus", "상세 설명은 네 글자 이상 입력해 주세요.", true);
      return;
    }
    if (requestedCover && !coverImage) {
      setStatus("archiveAdminEditStatus", "HTTPS 이미지 주소 또는 JPEG 이미지를 사용해 주세요.", true);
      return;
    }
    save.disabled = true;
    setStatus("archiveAdminEditStatus", "카드 정보를 저장하는 중입니다.", false);
    requestJson(API + "/report-overrides/" + encodeURIComponent(state.editing.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminPassword: state.password,
        title: title,
        summary: summary,
        coverImage: coverImage,
        coverAlt: coverAlt,
      }),
    }).then(function (body) {
      state.overrides[state.editing.id] = body.override;
      renderReports();
      renderAnalytics();
      closeDialog();
      setStatus("archiveAdminDashboardStatus", "카드 정보를 저장했습니다.", false);
    }).catch(function (error) {
      setStatus("archiveAdminEditStatus", message(error.message), true);
    }).finally(function () {
      save.disabled = false;
    });
  }

  function restoreEditor() {
    if (!state.editing || !state.password) return;
    if (!window.confirm("이 보고서의 카드 제목, 설명, 썸네일을 원래 정보로 되돌릴까요?")) return;
    var restore = byId("archiveAdminEditRestore");
    restore.disabled = true;
    requestJson(API + "/report-overrides/" + encodeURIComponent(state.editing.id), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: state.password }),
    }).then(function () {
      delete state.overrides[state.editing.id];
      renderReports();
      renderAnalytics();
      closeDialog();
      setStatus("archiveAdminDashboardStatus", "원래 카드 정보로 되돌렸습니다.", false);
    }).catch(function (error) {
      setStatus("archiveAdminEditStatus", message(error.message), true);
    }).finally(function () {
      restore.disabled = false;
    });
  }

  function toggleHidden(report, button) {
    var hidden = state.hidden.has(report.id);
    button.disabled = true;
    runReportAction(hidden ? "unhide" : "hide", [report.id]).finally(function () { button.disabled = false; });
  }

  function actionLabel(action) {
    return ({ hide: "숨김", unhide: "숨김 해제", make_private: "비공개 전환", delete: "삭제" })[action] || action;
  }

  function confirmAction(action, reportIds) {
    if (action === "hide" || action === "unhide") {
      return window.confirm("선택한 " + reportIds.length + "개 보고서를 " + actionLabel(action) + "할까요?");
    }
    if (action === "make_private") {
      return window.confirm("선택한 " + reportIds.length + "개 보고서를 R2 비공개 저장소로 옮기고 현재 공개 페이지에서 제거할까요? 이미 공개된 GitHub 이력과 검색 캐시는 되돌릴 수 없습니다.");
    }
    return window.prompt("삭제하려면 ‘삭제’를 입력하세요.") === "삭제";
  }

  function pollAdminJob(jobId) {
    var attempts = 0;
    function check() {
      attempts += 1;
      return requestJson(API + "/admin/report-jobs/" + encodeURIComponent(jobId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: state.password }),
      }).then(function (body) {
        var job = body.job || {};
        state.jobs = state.jobs.filter(function (item) { return item.id !== job.id; });
        state.jobs.unshift(job);
        renderJobs();
        if (["completed", "partial", "failed"].includes(job.status)) {
          return refreshDashboard().then(function () {
            if (job.status === "failed") throw new Error("lifecycle_failed");
            if (job.status === "partial") throw new Error("lifecycle_partial");
            return job;
          });
        }
        if (attempts >= 20) {
          return refreshDashboard().then(function () { throw new Error("lifecycle_timeout"); });
        }
        return new Promise(function (resolve) { window.setTimeout(function () { resolve(check()); }, 3000); });
      }).catch(function (error) {
        setStatus("archiveAdminDashboardStatus", message(error.message), true);
        throw error;
      });
    }
    return check();
  }

  function runReportAction(action, reportIds) {
    if (!state.password) return Promise.resolve();
    var unique = Array.from(new Set(reportIds.filter(Boolean)));
    if (!unique.length) {
      setStatus("archiveAdminDashboardStatus", "보고서를 먼저 선택해 주세요.", true);
      return Promise.resolve();
    }
    if (!confirmAction(action, unique)) return Promise.resolve();
    var chunks = [];
    for (var index = 0; index < unique.length; index += 50) chunks.push(unique.slice(index, index + 50));
    setStatus("archiveAdminDashboardStatus", actionLabel(action) + " 작업을 시작했습니다.", false);
    return chunks.reduce(function (chain, chunk) {
      return chain.then(function () {
        return requestJson(API + "/admin/report-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: action, reportIds: chunk, adminPassword: state.password }),
        }).then(function (body) {
          chunk.forEach(function (id) { state.selectedReports.delete(id); });
          if (body.job) {
            state.jobs.unshift(body.job);
            renderJobs();
            return pollAdminJob(body.job.id);
          }
          if (action === "hide") chunk.forEach(function (id) { state.hidden.add(id); });
          if (action === "unhide") chunk.forEach(function (id) { state.hidden.delete(id); });
          return refreshDashboard();
        });
      });
    }, Promise.resolve()).then(function () {
      updateSelectionUi();
      setStatus("archiveAdminDashboardStatus", actionLabel(action) + " 작업을 완료했습니다.", false);
    }).catch(function (error) {
      setStatus("archiveAdminDashboardStatus", message(error.message), true);
    });
  }

  function applyBulkAction() {
    var action = String(byId("archiveAdminBulkAction").value || "");
    if (!action) {
      setStatus("archiveAdminDashboardStatus", "일괄 작업을 선택해 주세요.", true);
      return;
    }
    var ids = Array.from(state.selectedReports);
    if (action === "make_private") {
      var external = ids.filter(function (id) { var report = state.reportsById.get(id); return isExternalReport(report); });
      ids = ids.filter(function (id) { var report = state.reportsById.get(id); return !isExternalReport(report); });
      if (external.length) setStatus("archiveAdminDashboardStatus", external.length + "개 외부 링크 보고서는 비공개 전환에서 제외했습니다.", true);
    }
    runReportAction(action, ids);
  }

  function privateRequestJson(path, options) {
    var settings = Object.assign({ method: "GET", cache: "no-store" }, options || {});
    settings.headers = new Headers(settings.headers || {});
    if (state.privateToken) settings.headers.set("Authorization", "Bearer " + state.privateToken);
    return requestJson(API + path, settings).catch(function (error) {
      if (error.status === 401) expirePrivateSession();
      throw error;
    });
  }

  function savePrivateSession(token, expiresAt) {
    state.privateToken = String(token || "");
    try {
      window.sessionStorage.setItem("reportmode:private-session", JSON.stringify({ token: state.privateToken, expiresAt: expiresAt }));
    } catch (_) {}
  }

  function clearPrivateSession() {
    state.privateToken = "";
    state.privateReports = [];
    try { window.sessionStorage.removeItem("reportmode:private-session"); } catch (_) {}
    var add = byId("archiveAdminPrivateAdd");
    if (add) add.disabled = true;
  }

  function expirePrivateSession() {
    clearPrivateSession();
    state.password = "";
    byId("archiveAdminDashboard").hidden = true;
    byId("archiveAdminGate").hidden = false;
    setStatus("archiveAdminGateStatus", "비공개 인증 시간이 끝났습니다. 관리자 비밀번호를 다시 입력해 주세요.", true);
    window.setTimeout(function () { byId("archiveAdminGatePassword").focus(); }, 0);
  }

  function requestPrivateSession(password) {
    setStatus("archiveAdminPrivateStatus", "비공개 저장소 인증을 확인하는 중입니다.", false);
    return requestJson(API + "/private-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: password }),
      cache: "no-store",
    }).then(function (body) {
      savePrivateSession(body.token, body.expiresAt);
      byId("archiveAdminPrivateAdd").disabled = false;
      return loadPrivateReports();
    }).catch(function (error) {
      clearPrivateSession();
      setText("archiveAdminPrivateCount", "인증 필요");
      setStatus("archiveAdminPrivateStatus", message(error.message, error.retryAfter), true);
    });
  }

  function privateViewerUrl(report) {
    return new URL("../private/?report=" + encodeURIComponent(report.id), window.location.href).href;
  }

  function renderPrivateReports() {
    var body = byId("archiveAdminPrivateTableBody");
    if (!body) return;
    body.replaceChildren();
    setText("archiveAdminPrivateCount", "총 " + formatNumber(state.privateReports.length) + "개");
    if (!state.privateReports.length) {
      var empty = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 8;
      emptyCell.textContent = "등록된 비공개 보고서가 없습니다.";
      empty.appendChild(emptyCell);
      body.appendChild(empty);
      return;
    }
    state.privateReports.forEach(function (report) {
      var row = document.createElement("tr");
      var reportCell = document.createElement("td");
      reportCell.className = "archive-admin-console-report-cell";
      var reportLink = document.createElement("a");
      reportLink.className = "archive-admin-console-report-title";
      reportLink.href = privateViewerUrl(report);
      reportLink.textContent = report.title;
      var summary = document.createElement("p");
      summary.className = "archive-admin-console-report-summary";
      summary.textContent = report.summary;
      reportCell.append(reportLink, summary);
      var actionCell = document.createElement("td");
      var actions = document.createElement("div");
      actions.className = "archive-admin-console-table-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "archive-admin-console-table-button";
      edit.textContent = "수정";
      edit.addEventListener("click", function () { openPrivateEditor(report); });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "archive-admin-console-table-button is-danger";
      remove.textContent = "삭제";
      remove.addEventListener("click", function () { deletePrivateReport(report, remove); });
      actions.append(edit, remove);
      actionCell.appendChild(actions);
      var checkboxCell = document.createElement("td");
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selectedPrivateReports.has(report.id);
      checkbox.setAttribute("aria-label", report.title + " 선택");
      checkbox.addEventListener("change", function () {
        if (checkbox.checked) state.selectedPrivateReports.add(report.id);
        else state.selectedPrivateReports.delete(report.id);
        syncSelectAllCheckboxes();
      });
      checkboxCell.appendChild(checkbox);
      row.append(
        checkboxCell,
        reportCell,
        makeCell(displayDate(report.displayDate), "archive-admin-console-table-number"),
        makeCell(formatNumber(report.sourceCount), "archive-admin-console-table-number"),
        makeCell((report.tags || []).join(", ") || "-"),
        makeCell(report.hasCover ? "있음" : "없음"),
        makeCell(displayDate(report.updatedAt), "archive-admin-console-table-number"),
        actionCell,
      );
      body.appendChild(row);
    });
    syncSelectAllCheckboxes();
  }

  function loadPrivateReports() {
    if (!state.privateToken) return Promise.resolve();
    setStatus("archiveAdminPrivateStatus", "비공개 보고서를 불러오는 중입니다.", false);
    return privateRequestJson("/private-reports").then(function (body) {
      state.privateReports = Array.isArray(body.reports) ? body.reports : [];
      renderPrivateReports();
      setStatus("archiveAdminPrivateStatus", "비공개 저장소와 연결되었습니다.", false);
    }).catch(function (error) {
      if (error.status !== 401) setStatus("archiveAdminPrivateStatus", message(error.message, error.retryAfter), true);
    });
  }

  function privateDateInput(value) {
    var text = String(value || "");
    if (/^\d{6}$/.test(text)) return "20" + text.slice(0, 2) + "-" + text.slice(2, 4) + "-" + text.slice(4, 6);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  function privateDisplayDate(value) {
    return String(value || "").replaceAll("-", "").slice(2);
  }

  function suggestedPrivateId() {
    var date = privateDateInput("").replaceAll("-", "");
    return "private-" + date + "-" + Date.now().toString(36).slice(-6);
  }

  function openPrivateDialog() {
    var dialog = byId("archiveAdminPrivateDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closePrivateDialog() {
    var dialog = byId("archiveAdminPrivateDialog");
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    state.privateEditing = null;
    byId("archiveAdminPrivateForm").reset();
  }

  function openPrivateEditor(report) {
    state.privateEditing = report || null;
    var editing = Boolean(report);
    byId("archive-admin-private-dialog-title").textContent = editing ? "비공개 보고서 수정" : "비공개 보고서 등록";
    byId("archiveAdminPrivateDialogNote").textContent = editing ? "HTML과 썸네일을 선택하면 기존 파일을 교체합니다." : "원문과 썸네일은 공개 저장소에 저장되지 않습니다.";
    byId("archiveAdminPrivateId").value = editing ? report.id : suggestedPrivateId();
    byId("archiveAdminPrivateId").readOnly = editing;
    byId("archiveAdminPrivateDate").value = privateDateInput(editing ? report.displayDate : "");
    byId("archiveAdminPrivateTitle").value = editing ? report.title : "";
    byId("archiveAdminPrivateSummary").value = editing ? report.summary : "";
    byId("archiveAdminPrivateSourceCount").value = editing ? String(report.sourceCount || 0) : "0";
    byId("archiveAdminPrivateTags").value = editing ? (report.tags || []).join(", ") : "";
    byId("archiveAdminPrivateHtml").value = "";
    byId("archiveAdminPrivateHtml").required = !editing;
    byId("archiveAdminPrivateHtmlHelp").textContent = editing ? "선택하지 않으면 기존 HTML을 유지합니다." : "신규 등록 시 필수, 최대 5MB";
    byId("archiveAdminPrivateCover").value = "";
    byId("archiveAdminPrivateRemoveCover").checked = false;
    byId("archiveAdminPrivateRemoveCoverField").hidden = !editing || !report.hasCover;
    setStatus("archiveAdminPrivateEditStatus", "", false);
    openPrivateDialog();
    window.setTimeout(function () { (editing ? byId("archiveAdminPrivateTitle") : byId("archiveAdminPrivateId")).focus(); }, 0);
  }

  function savePrivateReport(event) {
    event.preventDefault();
    if (!state.privateToken) return;
    var editing = Boolean(state.privateEditing);
    var id = String(byId("archiveAdminPrivateId").value || "").trim();
    var title = String(byId("archiveAdminPrivateTitle").value || "").trim();
    var summary = String(byId("archiveAdminPrivateSummary").value || "").trim();
    var date = String(byId("archiveAdminPrivateDate").value || "");
    var sourceCount = Number(byId("archiveAdminPrivateSourceCount").value || 0);
    var html = byId("archiveAdminPrivateHtml").files && byId("archiveAdminPrivateHtml").files[0];
    var cover = byId("archiveAdminPrivateCover").files && byId("archiveAdminPrivateCover").files[0];
    if (!/^[a-z0-9][a-z0-9-]{2,119}$/i.test(id)) {
      setStatus("archiveAdminPrivateEditStatus", "보고서 ID는 영문, 숫자, 하이픈으로 입력해 주세요.", true);
      return;
    }
    if (title.length < 2 || summary.length < 4 || !date) {
      setStatus("archiveAdminPrivateEditStatus", "제목, 상세 설명, 작성일을 확인해 주세요.", true);
      return;
    }
    if (!editing && !html) {
      setStatus("archiveAdminPrivateEditStatus", "HTML 보고서 파일을 선택해 주세요.", true);
      return;
    }
    if (html && html.size > 5 * 1024 * 1024) {
      setStatus("archiveAdminPrivateEditStatus", "HTML 파일은 최대 5MB까지 등록할 수 있습니다.", true);
      return;
    }
    if (cover && cover.size > 1024 * 1024) {
      setStatus("archiveAdminPrivateEditStatus", "썸네일은 최대 1MB까지 등록할 수 있습니다.", true);
      return;
    }
    var data = new FormData();
    data.set("id", id);
    data.set("title", title);
    data.set("summary", summary);
    data.set("displayDate", privateDisplayDate(date));
    data.set("sourceCount", String(sourceCount));
    data.set("tags", String(byId("archiveAdminPrivateTags").value || ""));
    data.set("removeCover", byId("archiveAdminPrivateRemoveCover").checked ? "true" : "false");
    if (html) data.set("html", html);
    if (cover) data.set("cover", cover);
    var save = byId("archiveAdminPrivateSave");
    save.disabled = true;
    setStatus("archiveAdminPrivateEditStatus", editing ? "비공개 보고서를 수정하는 중입니다." : "비공개 보고서를 저장하는 중입니다.", false);
    privateRequestJson(editing ? "/private-reports/" + encodeURIComponent(id) : "/private-reports", {
      method: editing ? "PUT" : "POST",
      body: data,
    }).then(function () {
      closePrivateDialog();
      setStatus("archiveAdminPrivateStatus", editing ? "비공개 보고서를 수정했습니다." : "비공개 보고서를 등록했습니다.", false);
      return loadPrivateReports();
    }).catch(function (error) {
      if (error.status !== 401) setStatus("archiveAdminPrivateEditStatus", message(error.message, error.retryAfter), true);
    }).finally(function () {
      save.disabled = false;
    });
  }

  function deletePrivateReport(report, button) {
    if (!state.privateToken) return;
    if (!window.confirm('"' + report.title + '" 비공개 보고서를 삭제할까요? 원문과 썸네일도 함께 삭제됩니다.')) return;
    button.disabled = true;
    privateRequestJson("/private-reports/" + encodeURIComponent(report.id), {
      method: "DELETE",
    }).then(function () {
      setStatus("archiveAdminPrivateStatus", "비공개 보고서를 삭제했습니다.", false);
      return loadPrivateReports();
    }).catch(function (error) {
      if (error.status !== 401) setStatus("archiveAdminPrivateStatus", message(error.message, error.retryAfter), true);
    }).finally(function () {
      button.disabled = false;
    });
  }

  function deleteSelectedPrivateReports() {
    var ids = Array.from(state.selectedPrivateReports);
    if (!ids.length || !window.confirm("선택한 비공개 보고서 " + ids.length + "개를 삭제할까요?")) return;
    var reports = state.privateReports.filter(function (report) { return ids.includes(report.id); });
    var index = 0;
    function next() {
      if (index >= reports.length) {
        state.selectedPrivateReports.clear();
        loadPrivateReports();
        updateSelectionUi();
        return;
      }
      var report = reports[index++];
      privateRequestJson("/private-reports/" + encodeURIComponent(report.id), { method: "DELETE" })
        .then(function () { state.selectedPrivateReports.delete(report.id); })
        .catch(function (error) { setStatus("archiveAdminPrivateStatus", message(error.message, error.retryAfter), true); })
        .finally(next);
    }
    next();
  }

  function verifyAdministrator(event) {
    event.preventDefault();
    var passwordInput = byId("archiveAdminGatePassword");
    var submit = byId("archiveAdminGateSubmit");
    var password = String(passwordInput.value || "").trim();
    if (!password) {
      setStatus("archiveAdminGateStatus", "관리자 비밀번호를 입력해 주세요.", true);
      passwordInput.focus();
      return;
    }
    submit.disabled = true;
    setStatus("archiveAdminGateStatus", "관리자 비밀번호를 확인하는 중입니다.", false);
    requestJson(API + "/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: password }),
    }).then(function () {
      state.password = password;
      passwordInput.value = "";
      byId("archiveAdminGate").hidden = true;
      byId("archiveAdminDashboard").hidden = false;
      refreshDashboard();
      requestPrivateSession(password);
    }).catch(function (error) {
      setStatus("archiveAdminGateStatus", message(error.message), true);
    }).finally(function () {
      submit.disabled = false;
    });
  }

  byId("archiveAdminGateForm").addEventListener("submit", verifyAdministrator);
  byId("archiveAdminRefresh").addEventListener("click", function () {
    refreshDashboard();
    loadPrivateReports();
  });
  byId("archiveAdminReportSearch").addEventListener("input", renderReports);
  byId("archiveAdminReportStatus").addEventListener("change", renderReports);
  byId("archiveAdminAnalyticsDays").addEventListener("change", function (event) {
    state.analyticsDays = Number(event.target.value) || 30;
    refreshDashboard();
  });
  [byId("archiveAdminSelectAll"), byId("archiveAdminHeaderSelect")].forEach(function (checkbox) {
    if (!checkbox) return;
    checkbox.addEventListener("change", function () {
      visibleReportsForSelection().forEach(function (report) {
        if (checkbox.checked) state.selectedReports.add(report.id);
        else state.selectedReports.delete(report.id);
      });
      renderReports();
    });
  });
  byId("archiveAdminBulkApply").addEventListener("click", applyBulkAction);
  byId("archiveAdminBulkClear").addEventListener("click", function () {
    state.selectedReports.clear();
    renderReports();
  });
  byId("archiveAdminEditForm").addEventListener("submit", saveEditor);
  byId("archiveAdminEditClose").addEventListener("click", closeDialog);
  byId("archiveAdminEditRestore").addEventListener("click", restoreEditor);
  byId("archiveAdminEditCover").addEventListener("input", previewImage);
  byId("archiveAdminEditCoverAlt").addEventListener("input", previewImage);
  byId("archiveAdminEditFile").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    setStatus("archiveAdminEditStatus", "썸네일을 카드 크기로 정리하는 중입니다.", false);
    createThumbnailDataUrl(file).then(function (dataUrl) {
      byId("archiveAdminEditCover").value = dataUrl;
      previewImage();
      setStatus("archiveAdminEditStatus", "썸네일 미리보기를 준비했습니다.", false);
    }).catch(function () {
      setStatus("archiveAdminEditStatus", "이미지 파일을 읽지 못했습니다.", true);
    });
  });
  byId("archiveAdminPrivateAdd").addEventListener("click", function () { openPrivateEditor(null); });
  byId("archiveAdminPrivateSelectAll").addEventListener("change", function (event) {
    state.privateReports.forEach(function (report) {
      if (event.target.checked) state.selectedPrivateReports.add(report.id);
      else state.selectedPrivateReports.delete(report.id);
    });
    renderPrivateReports();
  });
  byId("archiveAdminPrivateHeaderSelect").addEventListener("change", function (event) {
    state.privateReports.forEach(function (report) {
      if (event.target.checked) state.selectedPrivateReports.add(report.id);
      else state.selectedPrivateReports.delete(report.id);
    });
    renderPrivateReports();
  });
  byId("archiveAdminPrivateBulkDelete").addEventListener("click", deleteSelectedPrivateReports);
  byId("archiveAdminPrivateBulkClear").addEventListener("click", function () {
    state.selectedPrivateReports.clear();
    renderPrivateReports();
  });
  byId("archiveAdminPrivateForm").addEventListener("submit", savePrivateReport);
  byId("archiveAdminPrivateClose").addEventListener("click", closePrivateDialog);
  byId("archiveAdminPrivateCancel").addEventListener("click", closePrivateDialog);
  byId("archiveAdminPrivateDialog").addEventListener("cancel", function () { state.privateEditing = null; });
})();
