(function () {
  var API = "https://reportmode-request-board.report-request-board.workers.dev";
  var STORAGE_KEY = "reportmode:admin-unlocked";
  var THUMBNAIL_MAX_BYTES = 600 * 1024;
  var THUMBNAIL_PRESETS = [
    { width: 720, height: 405, quality: 0.82 },
    { width: 640, height: 360, quality: 0.76 },
    { width: 512, height: 288, quality: 0.7 },
  ];
  var postsRoot = document.getElementById("archivePosts");
  if (!postsRoot) return;

  var state = {
    unlocked: false,
    password: "",
    hidden: new Set(),
    featured: new Set(),
    promotedDrafts: new Set(),
    overrides: new Map(),
    editorReportId: "",
    editorOpener: null,
    editorCoverState: "default",
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
    if (code === "title_too_short") return "제목은 두 글자 이상 입력해 주세요.";
    if (code === "summary_too_short") return "상세 설명은 네 글자 이상 입력해 주세요.";
    if (code === "invalid_cover_url") return "썸네일은 HTTPS 이미지 주소 또는 붙여넣은 JPEG 이미지만 사용할 수 있습니다.";
    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function setStatus(text, isError) {
    var status = document.getElementById("archiveAdminStatus");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.error = isError ? "true" : "false";
  }

  function rememberPresentation(post) {
    if (!post || post.dataset.presentationRemembered === "true") return;
    var title = post.querySelector("h2");
    var summary = post.querySelector(".archive-post-copy > p");
    var cover = post.querySelector(".archive-post-cover");
    var image = cover && cover.querySelector("img");
    post.dataset.presentationRemembered = "true";
    post.dataset.originalTitle = title ? title.textContent.trim() : "";
    post.dataset.originalSummary = summary ? summary.textContent.trim() : "";
    post.dataset.originalCoverClass = cover ? cover.className : "";
    post.dataset.originalCoverMarkup = cover ? cover.innerHTML : "";
    post.dataset.originalCoverImage = image ? (image.currentSrc || image.src || "") : "";
    post.dataset.originalCoverAlt = image ? (image.alt || "") : "";
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

  function restoreOriginalCover(post) {
    var cover = post.querySelector(".archive-post-cover");
    if (!cover) return;
    if (post.dataset.originalCoverClass) cover.className = post.dataset.originalCoverClass;
    cover.innerHTML = post.dataset.originalCoverMarkup || "";
  }

  function setCoverImage(post, imageUrl, alt) {
    var cover = post.querySelector(".archive-post-cover");
    if (!cover) return;
    var image = cover.querySelector("img");
    if (!image) {
      image = document.createElement("img");
      image.loading = "lazy";
      cover.classList.remove("archive-post-cover-fallback");
      cover.replaceChildren(image);
    }
    image.src = imageUrl;
    image.alt = alt || post.dataset.originalCoverAlt || post.dataset.originalTitle || "보고서 대표 이미지";
  }

  function applyPresentation(post, override) {
    rememberPresentation(post);
    var title = post.querySelector("h2");
    var summary = post.querySelector(".archive-post-copy > p");
    if (!override) {
      if (title) title.textContent = post.dataset.originalTitle || "";
      if (summary) summary.textContent = post.dataset.originalSummary || "";
      delete post.dataset.adminTitle;
      delete post.dataset.adminSummary;
      restoreOriginalCover(post);
      return;
    }
    if (title) title.textContent = override.title || post.dataset.originalTitle || "";
    if (summary) summary.textContent = override.summary || post.dataset.originalSummary || "";
    post.dataset.adminTitle = override.title || "";
    post.dataset.adminSummary = override.summary || "";
    if (override.coverImage) setCoverImage(post, override.coverImage, override.coverAlt);
    else restoreOriginalCover(post);
  }

  function applyOverrides() {
    posts().forEach(function (post) {
      applyPresentation(post, state.overrides.get(post.dataset.reportId || ""));
    });
    if (typeof window.reportmodeArchiveRender === "function") window.reportmodeArchiveRender(false);
    renderSpotlights();
  }

  function editorDialog() {
    return document.getElementById("archiveAdminEditor");
  }

  function editorStatus(text, isError) {
    var output = document.getElementById("archiveAdminEditorStatus");
    if (!output) return;
    output.textContent = text || "";
    output.dataset.error = isError ? "true" : "false";
  }

  function imageFileFromTransfer(transfer) {
    if (!transfer) return null;
    var items = Array.prototype.slice.call(transfer.items || []);
    for (var index = 0; index < items.length; index += 1) {
      var item = items[index];
      if (item.kind === "file" && /^image\//i.test(item.type || "")) return item.getAsFile();
    }
    var files = Array.prototype.slice.call(transfer.files || []);
    return files.find(function (file) { return /^image\//i.test(file.type || ""); }) || null;
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

  function updateEditorPreview() {
    var dialog = editorDialog();
    if (!dialog) return;
    var input = document.getElementById("archiveAdminEditorCover");
    var preview = document.getElementById("archiveAdminEditorPreview");
    var empty = document.getElementById("archiveAdminEditorPreviewEmpty");
    if (!input || !preview || !empty) return;
    var requested = String(input.value || "").trim();
    var imageUrl = requested ? safeImageUrl(requested) : (dialog.dataset.defaultCover || "");
    if (requested && !imageUrl) {
      state.editorCoverState = "invalid";
      preview.hidden = true;
      preview.removeAttribute("src");
      empty.hidden = false;
      editorStatus("HTTPS 이미지 주소 또는 붙여넣은 이미지를 사용해 주세요.", true);
      return;
    }
    if (!imageUrl) {
      state.editorCoverState = "default";
      preview.hidden = true;
      preview.removeAttribute("src");
      empty.hidden = false;
      editorStatus("", false);
      return;
    }
    var sourceAlreadyLoaded = preview.dataset.previewSource === imageUrl && preview.complete && preview.naturalWidth > 0;
    state.editorCoverState = requested ? (sourceAlreadyLoaded ? "valid" : "loading") : "default";
    preview.dataset.previewSource = imageUrl;
    preview.alt = String(document.getElementById("archiveAdminEditorCoverAlt").value || dialog.dataset.defaultCoverAlt || "보고서 대표 이미지");
    if (!sourceAlreadyLoaded) preview.src = imageUrl;
    preview.hidden = false;
    empty.hidden = true;
    if (requested) editorStatus(sourceAlreadyLoaded ? "썸네일 미리보기를 준비했습니다." : "썸네일 미리보기를 확인하는 중입니다.", false);
  }

  function replaceThumbnailFromFile(file) {
    var input = document.getElementById("archiveAdminEditorCover");
    if (!input) return;
    editorStatus("썸네일을 카드 크기로 정리하는 중입니다.", false);
    createThumbnailDataUrl(file)
      .then(function (dataUrl) {
        input.value = dataUrl;
        updateEditorPreview();
      })
      .catch(function (error) {
        var code = error && error.message;
        editorStatus(code === "thumbnail_too_large" ? "이미지가 너무 커서 카드용 썸네일로 만들지 못했습니다." : "이미지 파일을 읽지 못했습니다.", true);
      });
  }

  function closePresentationEditor() {
    var dialog = editorDialog();
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else {
      dialog.removeAttribute("open");
      document.body.classList.remove("archive-admin-editor-open");
    }
  }

  function openPresentationEditor(post, opener) {
    if (!state.unlocked || !state.password) {
      setStatus("먼저 관리자 비밀번호로 잠금을 해제해 주세요.", true);
      return;
    }
    buildPresentationEditor();
    var dialog = editorDialog();
    if (!dialog) return;
    rememberPresentation(post);
    var reportId = post.dataset.reportId || "";
    var override = state.overrides.get(reportId);
    state.editorReportId = reportId;
    state.editorOpener = opener || null;
    dialog.dataset.defaultCover = post.dataset.originalCoverImage || "";
    dialog.dataset.defaultCoverAlt = post.dataset.originalCoverAlt || "";
    document.getElementById("archiveAdminEditorTitle").value = override ? override.title : (post.dataset.originalTitle || "");
    document.getElementById("archiveAdminEditorSummary").value = override ? override.summary : (post.dataset.originalSummary || "");
    document.getElementById("archiveAdminEditorCover").value = override && override.coverImage ? override.coverImage : "";
    document.getElementById("archiveAdminEditorCoverAlt").value = override && override.coverAlt ? override.coverAlt : (post.dataset.originalCoverAlt || "");
    document.getElementById("archiveAdminEditorReportName").textContent = post.dataset.originalTitle || reportId;
    editorStatus("", false);
    updateEditorPreview();
    document.body.classList.add("archive-admin-editor-open");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.requestAnimationFrame(function () {
      document.getElementById("archiveAdminEditorTitle").focus();
    });
  }

  function savePresentationEditor(event) {
    event.preventDefault();
    var dialog = editorDialog();
    if (!dialog || !state.editorReportId || !state.password) return;
    var titleInput = document.getElementById("archiveAdminEditorTitle");
    var summaryInput = document.getElementById("archiveAdminEditorSummary");
    var coverInput = document.getElementById("archiveAdminEditorCover");
    var altInput = document.getElementById("archiveAdminEditorCoverAlt");
    var submit = document.getElementById("archiveAdminEditorSave");
    var title = String(titleInput.value || "").trim();
    var summary = String(summaryInput.value || "").trim();
    var requestedCover = String(coverInput.value || "").trim();
    var coverImage = requestedCover ? safeImageUrl(requestedCover) : "";
    if (title.length < 2) {
      editorStatus(message("title_too_short"), true);
      titleInput.focus();
      return;
    }
    if (summary.length < 4) {
      editorStatus(message("summary_too_short"), true);
      summaryInput.focus();
      return;
    }
    if (requestedCover && (!coverImage || state.editorCoverState !== "valid")) {
      editorStatus("썸네일 미리보기를 확인한 뒤 저장해 주세요.", true);
      return;
    }
    submit.disabled = true;
    editorStatus("카드 정보를 저장하는 중입니다.", false);
    requestJson(API + "/report-overrides/" + encodeURIComponent(state.editorReportId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminPassword: state.password,
        title: title,
        summary: summary,
        coverImage: coverImage,
        coverAlt: String(altInput.value || "").trim(),
      }),
    })
      .then(function (body) {
        state.overrides.set(state.editorReportId, body.override);
        applyOverrides();
        closePresentationEditor();
        setStatus("카드 제목, 상세 설명, 썸네일을 저장했습니다.");
      })
      .catch(function (error) {
        editorStatus(message(error.message), true);
      })
      .finally(function () {
        submit.disabled = false;
      });
  }

  function restorePresentationEditor() {
    var reportId = state.editorReportId;
    if (!reportId || !state.password) return;
    if (!state.overrides.has(reportId)) {
      editorStatus("이 카드에는 저장된 변경이 없습니다.", false);
      return;
    }
    var restore = document.getElementById("archiveAdminEditorRestore");
    restore.disabled = true;
    editorStatus("원래 카드 정보로 되돌리는 중입니다.", false);
    requestJson(API + "/report-overrides/" + encodeURIComponent(reportId), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: state.password }),
    })
      .then(function () {
        state.overrides.delete(reportId);
        applyOverrides();
        closePresentationEditor();
        setStatus("카드를 원래 정보로 되돌렸습니다.");
      })
      .catch(function (error) {
        editorStatus(message(error.message), true);
      })
      .finally(function () {
        restore.disabled = false;
      });
  }

  function buildPresentationEditor() {
    if (editorDialog()) return;
    var dialog = document.createElement("dialog");
    dialog.id = "archiveAdminEditor";
    dialog.className = "archive-admin-editor";
    dialog.innerHTML = [
      '<form id="archiveAdminEditorForm" class="archive-admin-editor-form" novalidate>',
      '  <div class="archive-admin-editor-head">',
      '    <div><span>카드 정보 수정</span><h2>보고서 카드 편집</h2><p id="archiveAdminEditorReportName"></p></div>',
      '    <button type="button" class="archive-admin-editor-close" data-admin-editor-close aria-label="카드 편집 닫기">닫기</button>',
      '  </div>',
      '  <label>제목<input id="archiveAdminEditorTitle" maxlength="140" required></label>',
      '  <label>상세 설명<textarea id="archiveAdminEditorSummary" maxlength="480" required></textarea></label>',
      '  <label>썸네일 이미지 주소<input id="archiveAdminEditorCover" type="url" inputmode="url" maxlength="825000" placeholder="https://... 또는 이미지 붙여넣기"></label>',
      '  <div class="archive-admin-thumbnail-drop" id="archiveAdminThumbnailDrop" tabindex="0" role="button" aria-label="썸네일 이미지 파일 선택, 끌어놓기 또는 붙여넣기">',
      '    <input id="archiveAdminEditorFile" type="file" accept="image/*" hidden>',
      '    <strong>이미지를 끌어놓거나 붙여넣으세요</strong><span>클릭해 파일을 선택할 수도 있습니다.</span>',
      '  </div>',
      '  <div class="archive-admin-thumbnail-preview" aria-live="polite"><img id="archiveAdminEditorPreview" alt="" hidden><span id="archiveAdminEditorPreviewEmpty">선택한 썸네일 미리보기</span></div>',
      '  <label>이미지 설명<input id="archiveAdminEditorCoverAlt" maxlength="160" placeholder="이미지를 설명하는 짧은 문장"></label>',
      '  <p class="archive-admin-editor-status" id="archiveAdminEditorStatus" role="status"></p>',
      '  <div class="archive-admin-editor-actions">',
      '    <button type="button" class="archive-admin-editor-restore" id="archiveAdminEditorRestore">원래 정보로 되돌리기</button>',
      '    <button type="submit" class="archive-admin-editor-save" id="archiveAdminEditorSave">변경 저장</button>',
      '  </div>',
      '</form>',
    ].join("");
    document.body.appendChild(dialog);
    var form = document.getElementById("archiveAdminEditorForm");
    var close = dialog.querySelector("[data-admin-editor-close]");
    var drop = document.getElementById("archiveAdminThumbnailDrop");
    var file = document.getElementById("archiveAdminEditorFile");
    var cover = document.getElementById("archiveAdminEditorCover");
    var alt = document.getElementById("archiveAdminEditorCoverAlt");
    var preview = document.getElementById("archiveAdminEditorPreview");
    close.addEventListener("click", closePresentationEditor);
    form.addEventListener("submit", savePresentationEditor);
    document.getElementById("archiveAdminEditorRestore").addEventListener("click", restorePresentationEditor);
    cover.addEventListener("input", updateEditorPreview);
    alt.addEventListener("input", updateEditorPreview);
    preview.addEventListener("load", function () {
      if (state.editorCoverState === "loading") {
        state.editorCoverState = "valid";
        editorStatus("썸네일 미리보기를 준비했습니다.", false);
      }
    });
    preview.addEventListener("error", function () {
      if (String(cover.value || "").trim()) {
        state.editorCoverState = "invalid";
        editorStatus("이미지를 불러오지 못했습니다. 주소를 확인해 주세요.", true);
      }
    });
    drop.addEventListener("click", function () { file.click(); });
    drop.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      file.click();
    });
    drop.addEventListener("dragover", function (event) {
      event.preventDefault();
      drop.classList.add("is-dragging");
    });
    drop.addEventListener("dragleave", function () { drop.classList.remove("is-dragging"); });
    drop.addEventListener("drop", function (event) {
      event.preventDefault();
      drop.classList.remove("is-dragging");
      var dropped = imageFileFromTransfer(event.dataTransfer);
      if (dropped) replaceThumbnailFromFile(dropped);
      else editorStatus("이미지 파일만 썸네일로 사용할 수 있습니다.", true);
    });
    file.addEventListener("change", function () {
      if (file.files && file.files[0]) replaceThumbnailFromFile(file.files[0]);
      file.value = "";
    });
    dialog.addEventListener("paste", function (event) {
      var pasted = imageFileFromTransfer(event.clipboardData);
      if (pasted) {
        event.preventDefault();
        replaceThumbnailFromFile(pasted);
        return;
      }
      var text = event.clipboardData && event.clipboardData.getData("text/plain");
      if (text && event.target !== cover && safeImageUrl(text)) {
        event.preventDefault();
        cover.value = text;
        updateEditorPreview();
      }
    });
    dialog.addEventListener("close", function () {
      var opener = state.editorOpener;
      state.editorReportId = "";
      state.editorOpener = null;
      document.body.classList.remove("archive-admin-editor-open");
      if (opener && document.contains(opener)) opener.focus();
    });
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
      var editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "archive-admin-edit";
      editButton.textContent = "수정";
      editButton.setAttribute("aria-label", "보고서 카드 정보 수정");
      editButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openPresentationEditor(post, editButton);
      });
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
      actions.append(editButton, featureButton, button);
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
    if (!unlocked) closePresentationEditor();
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

  function loadOverrides() {
    return requestJson(API + "/report-overrides", { method: "GET", cache: "no-store" })
      .then(function (body) {
        var values = body && body.overrides && typeof body.overrides === "object" ? body.overrides : {};
        state.overrides = new Map(Object.keys(values).map(function (reportId) {
          return [reportId, values[reportId]];
        }));
      })
      .catch(function () {
        state.overrides = new Map();
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
  Promise.all([loadHidden(), loadFeatured(), loadDraftPromotions(), loadOverrides()]).then(function () {
    var maybeUnlocked = false;
    try { maybeUnlocked = sessionStorage.getItem(STORAGE_KEY) === "1"; } catch (_) {}
    // session only remembers unlock UI intent; password must be re-entered after refresh for safety
    applyOverrides();
    applyHiddenState();
    if (maybeUnlocked) {
      setStatus("보안을 위해 새로고침 후 관리자 비밀번호를 다시 입력해 주세요.");
    }
  });
})();
