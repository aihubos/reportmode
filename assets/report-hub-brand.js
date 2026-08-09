(function (root) {
  "use strict";

  var HOME = "https://aireport.ai-hub-os.com/";
  var VERSION = "20260809-rh1";
  var script = document.currentScript;
  var logoUrl = script && script.src
    ? new URL("favicon.svg?v=" + VERSION, script.src).href
    : "https://aihubos.github.io/reportmode/assets/favicon.svg?v=" + VERSION;

  function logoMarkup() {
    return '<img class="report-hub-logo" src="' + logoUrl + '" alt=""><span class="report-hub-wordmark">Report Hub</span>';
  }

  function setLink(link) {
    if (!link) return;
    link.href = HOME;
    link.setAttribute("aria-label", "Report Hub 메인으로 이동");
    link.innerHTML = logoMarkup();
  }

  function normalizeTitle() {
    var title = document.title
      .replaceAll("Jeremy's AI Report", "Report Hub")
      .replaceAll("AIHUBOS ReportMode", "Report Hub")
      .replaceAll("AIHUBOS REPORTMODE", "REPORT HUB")
      .replaceAll("Report Mode", "Report Hub")
      .replace(/\s+[—–·]\s+Report Hub\s*$/, " | Report Hub")
      .trim();
    if (!/Report Hub/i.test(title)) title += " | Report Hub";
    document.title = title;
  }

  function normalizeIcons() {
    var icon = document.querySelector('link[rel~="icon"]') || document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.setAttribute("sizes", "any");
    icon.href = logoUrl;
    if (!icon.parentNode) document.head.appendChild(icon);
  }

  function install() {
    if (!document.body) return;
    normalizeTitle();
    normalizeIcons();

    var archiveBrand = document.querySelector(".archive-brand");
    if (archiveBrand) {
      archiveBrand.classList.add("report-hub-brand-link");
      setLink(archiveBrand);
    }

    var home = document.querySelector(".report-home-button");
    if (!home && !archiveBrand) {
      home = document.createElement("a");
      home.className = "report-home-button";
      document.body.insertBefore(home, document.body.firstChild);
    }
    if (home) setLink(home);

    document.querySelectorAll("a.brand").forEach(function (link) {
      if (/\b(?:RM|RH)\b|Report (?:Mode|Hub)/i.test(link.textContent || "")) setLink(link);
    });
  }

  root.ReportHubBrand = { HOME: HOME, install: install };
  install();
})(typeof globalThis !== "undefined" ? globalThis : this);
