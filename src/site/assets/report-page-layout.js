(function(){
  "use strict";
  var body = document.body;
  if (!body || body.dataset.reportLayoutEnhanced === "true") return;
  body.dataset.reportLayoutEnhanced = "true";

  var layoutScript = document.currentScript;
  if (!document.querySelector('script[src*="report-hub-brand.js"]')) {
    var brandScript = document.createElement("script");
    brandScript.src = layoutScript && layoutScript.src
      ? new URL("report-hub-brand.js?v=20260809-rh4", layoutScript.src).href
      : "https://aihubos.github.io/reportmode/assets/report-hub-brand.js?v=20260809-rh4";
    document.head.appendChild(brandScript);
  }

  // Always start in wide (가로). Only user click may switch to a4.
  var DEFAULT_LAYOUT = "wide";

  var printStyle = document.createElement("style");
  printStyle.id = "report-layout-print-style";
  document.head.appendChild(printStyle);

  var controls = document.createElement("div");
  controls.className = "report-layout-controls";
  controls.setAttribute("aria-label", "보고서 레이아웃");
  controls.innerHTML =
    '<span class="report-layout-label">레이아웃 선택</span>' +
    '<div class="report-layout-buttons" role="group" aria-label="가로 또는 세로">' +
    '<button class="report-layout-button" type="button" data-report-layout="wide" aria-label="가로 보기" aria-pressed="false"><span class="report-layout-icon" aria-hidden="true"><svg viewBox="0 0 20 16" focusable="false"><rect x="1.5" y="2.5" width="17" height="11" rx="2"></rect></svg></span><span>가로</span></button>' +
    '<button class="report-layout-button" type="button" data-report-layout="a4" aria-label="세로 보기" aria-pressed="false"><span class="report-layout-icon" aria-hidden="true"><svg viewBox="0 0 16 20" focusable="false"><rect x="2.5" y="1.5" width="11" height="17" rx="2"></rect></svg></span><span>세로</span></button>' +
    "</div>";

  var floatingMenu = document.querySelector(".report-hub-floating-menu");
  var switcher = document.querySelector(".report-view-switcher-inner");
  if (floatingMenu) floatingMenu.appendChild(controls);
  else if (switcher) switcher.insertBefore(controls, switcher.firstChild);
  else {
    controls.classList.add("is-standalone");
    document.body.insertBefore(controls, document.body.firstChild);
  }
  if (window.ReportHubBrand && window.ReportHubBrand.attachLayoutControls) {
    window.ReportHubBrand.attachLayoutControls();
  }

  var viewIcons = { simple: "▤", detail: "☷" };
  document.querySelectorAll(".report-view-button[data-report-view-target]").forEach(function (button) {
    var target = button.dataset.reportViewTarget;
    if (!button.querySelector(".report-view-icon") && viewIcons[target]) {
      var icon = document.createElement("span");
      icon.className = "report-view-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = viewIcons[target];
      button.insertBefore(icon, button.firstChild);
    }
    if (target === "simple") button.setAttribute("aria-label", "간단 보기");
    if (target === "detail") button.setAttribute("aria-label", "상세 보기");
  });

  var buttons = controls.querySelectorAll("[data-report-layout]");

  function findPrimaryPdfButton() {
    var direct = document.getElementById("report-pdf-button");
    if (direct) return direct;
    var candidates = document.querySelectorAll("button, a");
    for (var index = 0; index < candidates.length; index += 1) {
      var label = (candidates[index].textContent || "").replace(/\s+/g, " ").trim();
      if (label === "PDF 저장") return candidates[index];
    }
    return null;
  }

  function createPdfButton() {
    var button = document.createElement("button");
    button.id = "report-pdf-button";
    button.className = "pdf-save-button report-shared-pdf-button";
    button.type = "button";
    button.textContent = "PDF 저장";
    button.setAttribute("aria-label", "현재 보고서를 PDF로 저장");
    return button;
  }

  function stableReportUrl() {
    var url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function legacyCopy(value) {
    return new Promise(function (resolve, reject) {
      var input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, value.length);
      var copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (_) {
        copied = false;
      }
      input.remove();
      if (copied) resolve();
      else reject(new Error("copy unavailable"));
    });
  }

  function copyReportLink(value) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(value).catch(function () {
        return legacyCopy(value);
      });
    }
    return legacyCopy(value);
  }

  function setShareState(button, label, ariaLabel) {
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    window.clearTimeout(button.reportHubResetTimer);
    button.reportHubResetTimer = window.setTimeout(function () {
      button.textContent = "공유";
      button.setAttribute("aria-label", "현재 보고서 링크 복사");
    }, 1800);
  }

  function ensureReportActions() {
    var pdf = findPrimaryPdfButton();
    var host;
    if (pdf) {
      pdf.id = "report-pdf-button";
      host = pdf.closest(".report-utility-controls");
      if (host) {
        host.classList.add("report-sharing-tools");
      } else if (pdf.parentNode) {
        host = document.createElement("span");
        host.className = "report-sharing-tools";
        pdf.parentNode.insertBefore(host, pdf);
        host.appendChild(pdf);
      }
    } else {
      pdf = createPdfButton();
      host = document.createElement("div");
      host.className = "report-sharing-tools is-floating-fallback";
      controls.classList.add("has-report-actions");
      controls.appendChild(host);
      host.appendChild(pdf);
    }
    if (!host) return;

    var legacyShare = document.querySelector("#report-share-button, .share-report-button, .report-share-button");
    if (legacyShare && legacyShare.parentNode) legacyShare.parentNode.removeChild(legacyShare);

    var share = document.createElement("button");
    share.id = "report-share-button";
    share.className = "report-share-button share-report-button";
    share.type = "button";
    share.textContent = "공유";
    share.setAttribute("aria-label", "현재 보고서 링크 복사");
    share.addEventListener("click", function () {
      copyReportLink(stableReportUrl())
        .then(function () {
          setShareState(share, "복사됨", "보고서 링크가 복사되었습니다");
        })
        .catch(function () {
          setShareState(share, "복사 실패", "보고서 링크 복사에 실패했습니다");
        });
    });

    var countPanel = document.createElement("span");
    countPanel.className = "report-view-count-panel";
    countPanel.setAttribute("aria-label", "보고서 조회수");
    countPanel.innerHTML = '<span>조회수</span><strong data-report-view-count>0</strong>';
    host.appendChild(share);
    host.appendChild(countPanel);
  }

  ensureReportActions();

  function wrapWideContent() {
    document.querySelectorAll("table, pre, iframe, canvas, video").forEach(function (element) {
      if (element.closest(".report-overflow-shell, .table-wrap, .report-history-shared-table-wrap, [class*='table-wrap'], [class*='table-scroll']")) return;
      var parent = element.parentNode;
      if (!parent) return;
      var shell = document.createElement("div");
      shell.className = "report-overflow-shell";
      shell.setAttribute("role", "region");
      shell.setAttribute("tabindex", "0");
      shell.setAttribute("aria-label", element.tagName === "TABLE" ? "표 좌우 이동" : "넓은 콘텐츠 좌우 이동");
      parent.insertBefore(shell, element);
      shell.appendChild(element);
    });
  }

  function setPrintPage(layout) {
    printStyle.textContent =
      "@page { size: A4 " + (layout === "wide" ? "landscape" : "portrait") + "; margin: 15mm; }";
  }

  function setLayout(layout) {
    var next = layout === "a4" ? "a4" : "wide";
    var isA4 = next === "a4";
    body.classList.toggle("report-a4-mode", isA4);
    body.dataset.reportLayout = next;
    buttons.forEach(function (button) {
      var active = button.dataset.reportLayout === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    setPrintPage(next);
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      setLayout(button.dataset.reportLayout);
    });
  });

  wrapWideContent();
  window.addEventListener("load", wrapWideContent, { once: true });

  // Force wide on load even if HTML or cached state says otherwise.
  setLayout(DEFAULT_LAYOUT);

  document.addEventListener(
    "click",
    function (event) {
      var trigger = event.target.closest("#report-pdf-button");
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPrintPage(body.dataset.reportLayout === "wide" ? "wide" : "a4");
      window.print();
    },
    true
  );
})();
