(function () {
  "use strict";

  var API = "https://reportmode-request-board.report-request-board.workers.dev";
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
    counts: {},
    overrides: {},
    hidden: new Set(),
    analytics: null,
    editing: null,
  };

  function byId(id) { return document.getElementById(id); }

  if (!byId("archiveAdminGateForm")) return;

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

  function publicJson(url) {
    return requestJson(url, { method: "GET", cache: "no-store" });
  }

  function message(code) {
    if (code === "wrong_admin_password") return "관리자 비밀번호가 맞지 않습니다.";
    if (code === "admin_not_configured") return "관리자 기능을 준비 중입니다.";
    if (code === "missing_report") return "보고서 정보를 찾지 못했습니다.";
    if (code === "title_too_short") return "제목은 두 글자 이상 입력해 주세요.";
    if (code === "summary_too_short") return "상세 설명은 네 글자 이상 입력해 주세요.";
    if (code === "invalid_cover_url") return "썸네일은 HTTPS 이미지 주소 또는 JPEG 이미지로 입력해 주세요.";
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

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Math.max(0, Number(value || 0)));
  }

  function displayDate(value) {
    var text = String(value || "").trim();
    if (!text) return "-";
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
    if (state.hidden.has(report.id)) return { label: "숨김", hidden: true };
    if (report.status === "draft") return { label: "초안", hidden: false };
    return { label: "공개", hidden: false };
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
      var report = state.reportsById.get(row.reportId);
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
      cell.colSpan = 7;
      cell.textContent = "조건에 맞는 보고서가 없습니다.";
      empty.appendChild(cell);
      body.appendChild(empty);
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
      statusBadge.className = "archive-admin-console-state" + (status.hidden ? " is-hidden" : "");
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
      actions.append(edit, hide);
      actionCell.appendChild(actions);
      tr.append(
        coverCell,
        reportCell,
        makeCell(report.category || "기타"),
        makeCell(displayDate(report.createdAt), "archive-admin-console-table-number"),
        makeCell(formatNumber(state.counts[report.id]), "archive-admin-console-table-number"),
        statusCell,
        actionCell,
      );
      body.appendChild(tr);
    });
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
      state.counts = views && views.counts && typeof views.counts === "object" ? views.counts : {};
      state.overrides = overrides && overrides.overrides && typeof overrides.overrides === "object" ? overrides.overrides : {};
      state.hidden = new Set(Array.isArray(hidden.reportIds) ? hidden.reportIds : []);
    });
  }

  function loadAnalytics() {
    return requestJson(API + "/admin/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: state.password }),
    }).then(function (analytics) {
      state.analytics = analytics;
    });
  }

  function refreshDashboard() {
    setStatus("archiveAdminDashboardStatus", "게시물 목록과 통계를 불러오는 중입니다.", false);
    return loadPublicData()
      .then(function () {
        renderReports();
        renderAnalytics();
        return loadAnalytics()
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
    if (!state.password) return;
    var hidden = state.hidden.has(report.id);
    var question = hidden
      ? "이 보고서를 도서관에 다시 표시할까요?"
      : "이 보고서를 도서관에서 숨길까요? 보고서 원본은 삭제되지 않습니다.";
    if (!window.confirm(question)) return;
    button.disabled = true;
    requestJson(hidden ? API + "/hidden-reports/" + encodeURIComponent(report.id) : API + "/hidden-reports", {
      method: hidden ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hidden ? { adminPassword: state.password } : { reportId: report.id, adminPassword: state.password }),
    }).then(function () {
      if (hidden) state.hidden.delete(report.id);
      else state.hidden.add(report.id);
      renderReports();
      renderAnalytics();
      setStatus("archiveAdminDashboardStatus", hidden ? "보고서를 다시 표시했습니다." : "보고서를 도서관에서 숨겼습니다.", false);
    }).catch(function (error) {
      setStatus("archiveAdminDashboardStatus", message(error.message), true);
    }).finally(function () {
      button.disabled = false;
    });
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
    }).catch(function (error) {
      setStatus("archiveAdminGateStatus", message(error.message), true);
    }).finally(function () {
      submit.disabled = false;
    });
  }

  byId("archiveAdminGateForm").addEventListener("submit", verifyAdministrator);
  byId("archiveAdminRefresh").addEventListener("click", refreshDashboard);
  byId("archiveAdminReportSearch").addEventListener("input", renderReports);
  byId("archiveAdminReportStatus").addEventListener("change", renderReports);
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
})();
