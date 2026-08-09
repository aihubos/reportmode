(function (root) {
  "use strict";

  var HOME = "https://aireport.ai-hub-os.com/";
  var VERSION = "20260809-rh2";
  var script = document.currentScript;
  var faviconUrl = script && script.src
    ? new URL("favicon.svg?v=" + VERSION, script.src).href
    : "https://aihubos.github.io/reportmode/assets/favicon.svg?v=" + VERSION;
  var layoutObserver = null;

  function logoMarkup() {
    return '<span class="report-hub-wordmark">Report Hub</span>';
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
    icon.href = faviconUrl;
    if (!icon.parentNode) document.head.appendChild(icon);
  }

  function ensureFloatingMenu() {
    var menu = document.querySelector(".report-hub-floating-menu");
    if (menu) return menu;
    menu = document.createElement("nav");
    menu.className = "report-hub-floating-menu";
    menu.setAttribute("aria-label", "Report Hub 및 보고서 보기");
    document.body.insertBefore(menu, document.body.firstChild);
    return menu;
  }

  function attachLayoutControls() {
    if (!document.body || document.querySelector(".archive-brand")) return false;
    var menu = ensureFloatingMenu();
    var controls = document.querySelector(".report-layout-controls");
    if (!controls) return false;
    controls.classList.remove("is-standalone");
    if (controls.parentNode !== menu) menu.appendChild(controls);
    if (layoutObserver) {
      layoutObserver.disconnect();
      layoutObserver = null;
    }
    return true;
  }

  function scrollToTop() {
    var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduced ? "auto" : "smooth" });
  }

  function installTitleLinks() {
    var title = document.querySelector("h1");
    if (!title || title.dataset.reportTopLink === "true") return;
    title.dataset.reportTopLink = "true";
    title.classList.add("report-title-top-link");
    title.setAttribute("role", "link");
    title.setAttribute("tabindex", "0");
    title.setAttribute("aria-label", "보고서 최상단으로 이동");
    title.addEventListener("click", scrollToTop);
    title.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      scrollToTop();
    });
  }

  function normalizeReportHubLinks() {
    document.querySelectorAll("a").forEach(function (link) {
      if ((link.textContent || "").trim() !== "Report Hub") return;
      link.href = HOME;
      link.setAttribute("aria-label", "Report Hub 메인으로 이동");
    });
  }

  function watchForLayoutControls() {
    if (attachLayoutControls() || typeof MutationObserver === "undefined" || layoutObserver) return;
    layoutObserver = new MutationObserver(attachLayoutControls);
    layoutObserver.observe(document.body, { childList: true, subtree: true });
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
    normalizeReportHubLinks();

    if (!archiveBrand) {
      var menu = ensureFloatingMenu();
      if (home && home.parentNode !== menu) menu.insertBefore(home, menu.firstChild);
      installTitleLinks();
      watchForLayoutControls();
    }
  }

  root.ReportHubBrand = { HOME: HOME, install: install, attachLayoutControls: attachLayoutControls };
  install();
})(typeof globalThis !== "undefined" ? globalThis : this);
