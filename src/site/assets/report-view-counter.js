+(function () {
  "use strict";

  var script = document.currentScript;
  var favicon = document.querySelector('link[rel~="icon"]');
  if (!favicon || favicon.getAttribute("href") === "data:,") {
    favicon = favicon || document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.setAttribute("sizes", "any");
    favicon.href = script && script.src
      ? new URL("favicon.svg?v=20260809-rh1", script.src).href
      : "../../assets/favicon.svg?v=20260809-rh1";
    if (!favicon.parentNode) document.head.appendChild(favicon);
  }

  var COUNTER_API = "https://reportmode-request-board.report-request-board.workers.dev";
  var VISITOR_KEY = "reporthub:visitor-id";
  var reportId = script && script.dataset ? script.dataset.reportId : "";
  var fallbackUrl = script && script.src
    ? new URL("../reports/view-counts.json", script.src).href
    : "../../reports/view-counts.json";

  function writeCount(value) {
    var count = Number(value);
    if (!Number.isFinite(count)) count = 0;
    count = Math.max(0, Math.trunc(count));
    document.querySelectorAll("[data-report-view-count]").forEach(function (element) {
      element.textContent = count.toLocaleString("ko-KR");
    });
    return count;
  }

  function loadFallbackCount() {
    if (!reportId) return Promise.resolve(writeCount(0));
    return fetch(fallbackUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("fallback unavailable");
        return response.json();
      })
      .then(function (counts) {
        return writeCount(counts[reportId]);
      })
      .catch(function () {
        return writeCount(0);
      });
  }

  function makeVisitorId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (character) {
      return (Number(character) ^ Math.random() * 16 >> Number(character) / 4).toString(16);
    });
  }

  function visitorId() {
    try {
      var current = window.localStorage.getItem(VISITOR_KEY);
      if (current) return current;
      current = makeVisitorId();
      window.localStorage.setItem(VISITOR_KEY, current);
      return current;
    } catch (_) {
      return makeVisitorId();
    }
  }

  function isPublicReport() {
    return window.location.hostname === "aihubos.github.io" || window.location.hostname === "aireport.ai-hub-os.com";
  }

  function loadLiveCount() {
    if (!reportId || !isPublicReport()) return Promise.resolve();
    return fetch(COUNTER_API + "/report-views", {
      method: "POST",
      cache: "no-store",
      keepalive: true,
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: reportId, visitorId: visitorId() }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error("counter unavailable");
        return response.json();
      })
      .then(function (data) {
        writeCount(data.count);
      })
      .catch(function () {
        // Keep the visible static fallback when the live service is unavailable.
      });
  }

  loadFallbackCount().then(loadLiveCount);
})();
