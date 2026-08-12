(function (root) {
  "use strict";

  var HOME = "https://aireport.ai-hub-os.com/";
  var VERSION = "20260812-report-hub-logo2";
  var SEOUL_TIME_ZONE = "Asia/Seoul";
  var script = document.currentScript;
  var faviconUrl = script && script.src
    ? new URL("favicon.svg?v=" + VERSION, script.src).href
    : "https://aihubos.github.io/reportmode/assets/favicon.svg?v=" + VERSION;
  var logoUrl = script && script.src
    ? new URL("report-hub-logo.png?v=" + VERSION, script.src).href
    : "https://aihubos.github.io/reportmode/assets/report-hub-logo.png?v=" + VERSION;
  var layoutObserver = null;
  var clockTimer = null;
  var topClearanceFrame = null;
  var mobileTopBarFrame = null;
  var mobileTopBarInstalled = false;

  function logoMarkup() {
    return '<span class="report-hub-brand-copy"><span class="report-hub-logo-mark-shimmer" aria-hidden="true"></span><img class="report-hub-logo-image" src="' + logoUrl + '" alt="Report Hub"></span>';
  }

  function formatClock(value) {
    var date = value instanceof Date ? value : new Date(value || Date.now());
    return {
      date: new Intl.DateTimeFormat("ko-KR", {
        timeZone: SEOUL_TIME_ZONE,
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(date),
      time: new Intl.DateTimeFormat("en-GB", {
        timeZone: SEOUL_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).format(date)
    };
  }

  function updateClock(clock, value) {
    if (!clock) return;
    var now = value instanceof Date ? value : new Date();
    var formatted = formatClock(now);
    var dateOutput = clock.querySelector(".report-hub-clock-date");
    var timeOutput = clock.querySelector(".report-hub-clock-time");
    if (dateOutput) dateOutput.textContent = formatted.date;
    if (timeOutput) timeOutput.textContent = formatted.time;
    clock.dateTime = now.toISOString();
    clock.title = formatted.date + " " + formatted.time + " (서울)";
  }

  function tickClocks() {
    document.querySelectorAll("[data-report-hub-clock]").forEach(function (clock) {
      updateClock(clock);
    });
  }

  function ensureClock(container, before) {
    if (!container) return null;
    var clock = container.querySelector("[data-report-hub-clock]");
    if (!clock) {
      clock = document.createElement("time");
      clock.className = "report-hub-clock";
      clock.setAttribute("data-report-hub-clock", "true");
      clock.setAttribute("aria-label", "서울 현재 날짜와 시각");
      clock.innerHTML = '<span class="report-hub-clock-date"></span><span class="report-hub-clock-time"></span>';
      container.insertBefore(clock, before || null);
    }
    updateClock(clock);
    if (!clockTimer && typeof root.setInterval === "function") {
      clockTimer = root.setInterval(tickClocks, 1000);
    }
    return clock;
  }

  function ensureArchiveBrandCluster(archiveBrand) {
    if (!archiveBrand || !archiveBrand.parentNode) return null;
    var cluster = archiveBrand.closest(".report-hub-brand-cluster");
    if (!cluster) {
      cluster = document.createElement("div");
      cluster.className = "report-hub-brand-cluster";
      archiveBrand.parentNode.insertBefore(cluster, archiveBrand);
      cluster.appendChild(archiveBrand);
    }
    ensureClock(cluster);
    return cluster;
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

  function boardLinkMarkup() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 4v-4h0A2.5 2.5 0 0 1 5 12.5v-6Z"></path></svg><span>게시판</span>';
  }

  function ensureBoardLink(menu) {
    if (!menu || menu.querySelector("[data-report-hub-board-link]")) return null;
    var link = document.createElement("a");
    link.className = "report-hub-board-link";
    link.href = new URL("board/", HOME).href;
    link.setAttribute("data-report-hub-board-link", "true");
    link.setAttribute("aria-label", "Report Hub 의견 게시판 열기");
    link.innerHTML = boardLinkMarkup();
    menu.appendChild(link);
    return link;
  }

  function attachLayoutControls() {
    if (!document.body || document.querySelector(".archive-brand")) return false;
    var menu = ensureFloatingMenu();
    var controls = document.querySelector(".report-layout-controls");
    if (!controls) return false;
    controls.classList.remove("is-standalone");
    ensureClock(menu, controls);
    if (controls.parentNode !== menu) menu.appendChild(controls);
    var utilityControls = document.querySelector(".report-view-switcher .report-utility-controls");
    if (utilityControls && utilityControls.parentNode !== menu) menu.appendChild(utilityControls);
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

  function removeLegacyTopMenus() {
    var selectors = [
      ".nav-wrap",
      ".floating-menu:not(.report-hub-floating-menu)",
      ".report-view-switcher",
      ".topbar",
      ".toolbar",
      "nav.nav:not(.report-hub-floating-menu)"
    ];
    document.querySelectorAll(selectors.join(",")).forEach(function (menu) {
      menu.remove();
    });
  }

  function removeLegacyViewModes() {
    document.body.dataset.reportView = "detail";
    document.querySelectorAll(".report-view-buttons, .simple-report").forEach(function (element) {
      element.remove();
    });
  }

  function firstReportContent() {
    var children = Array.prototype.slice.call(document.body.children);
    return children.find(function (element) {
      return /^(MAIN|HEADER|SECTION)$/i.test(element.tagName) &&
        !element.matches(".report-hub-floating-menu, .report-hub-top-spacer");
    }) || document.querySelector("main, header, section");
  }

  function ensureTopClearance() {
    var menu = document.querySelector(".report-hub-floating-menu");
    var content = firstReportContent();
    if (!menu || !content || menu.contains(content)) return;
    var spacer = document.querySelector(".report-hub-top-spacer");
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.className = "report-hub-top-spacer";
      spacer.setAttribute("aria-hidden", "true");
      content.parentNode.insertBefore(spacer, content);
    }
    spacer.style.height = "0px";
    var configuredGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rh-report-menu-content-gap"));
    var gap = Number.isFinite(configuredGap) ? configuredGap : 24;
    var requiredSpace = menu.getBoundingClientRect().bottom + gap;
    spacer.style.height = Math.max(0, Math.ceil(requiredSpace)) + "px";
  }

  function scheduleTopClearance() {
    if (topClearanceFrame) root.cancelAnimationFrame(topClearanceFrame);
    topClearanceFrame = root.requestAnimationFrame(function () {
      topClearanceFrame = null;
      ensureTopClearance();
    });
  }

  function mobileTopBarThreshold() {
    var configured = Number.parseFloat(root.getComputedStyle(document.documentElement).getPropertyValue("--rh-mobile-top-threshold"));
    return Number.isFinite(configured) ? configured : 8;
  }

  function syncMobileTopBar() {
    var bar = document.querySelector(".report-hub-floating-menu, .archive-topbar");
    if (!bar) return;
    var isMobile = root.matchMedia && root.matchMedia("(max-width: 700px)").matches;
    var scrollTop = Number(root.scrollY || root.pageYOffset || 0);
    var focused = bar.contains(document.activeElement);
    var hidden = Boolean(isMobile && scrollTop > mobileTopBarThreshold() && !focused);
    bar.classList.toggle("is-mobile-scroll-hidden", hidden);
  }

  function scheduleMobileTopBar() {
    if (mobileTopBarFrame) root.cancelAnimationFrame(mobileTopBarFrame);
    mobileTopBarFrame = root.requestAnimationFrame(function () {
      mobileTopBarFrame = null;
      syncMobileTopBar();
    });
  }

  function installMobileTopBarBehavior() {
    if (mobileTopBarInstalled) return;
    var bar = document.querySelector(".report-hub-floating-menu, .archive-topbar");
    if (!bar) return;
    mobileTopBarInstalled = true;
    bar.addEventListener("focusin", function () {
      bar.classList.remove("is-mobile-scroll-hidden");
    });
    root.addEventListener("scroll", scheduleMobileTopBar, { passive: true });
    root.addEventListener("resize", scheduleMobileTopBar, { passive: true });
    scheduleMobileTopBar();
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
      ensureArchiveBrandCluster(archiveBrand);
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
      ensureBoardLink(menu);
      ensureClock(menu, menu.querySelector(".report-layout-controls"));
      installTitleLinks();
      watchForLayoutControls();
      removeLegacyViewModes();
      removeLegacyTopMenus();
      scheduleTopClearance();
      root.addEventListener("resize", scheduleTopClearance, { passive: true });
    }
    installMobileTopBarBehavior();
  }

  root.ReportHubBrand = {
    HOME: HOME,
    install: install,
    attachLayoutControls: attachLayoutControls,
    formatClock: formatClock
  };
  install();
})(typeof globalThis !== "undefined" ? globalThis : this);
