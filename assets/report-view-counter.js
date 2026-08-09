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

  // CounterAPI v1 currently returns HTTP 410. Keep the report usable without
  // repeated network errors until an authenticated replacement is configured.
  var COUNTER_ENABLED = false;
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

  loadFallbackCount().then(function () {
    if (!COUNTER_ENABLED || !reportId || window.location.hostname !== "aihubos.github.io") return;

    var storageKey = "reportmode:view:" + reportId;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch (_) {
      // Continue without session de-duplication when browser storage is unavailable.
    }

    fetch(
      "https://api.counterapi.dev/v1/aihubos-reportmode/" +
        encodeURIComponent(reportId) +
        "/up",
      {
        cache: "no-store",
        keepalive: true,
        mode: "cors",
      },
    )
      .then(function (response) {
        if (!response.ok) throw new Error("counter unavailable");
        return response.json();
      })
      .then(function (data) {
        writeCount(data.count);
      })
      .catch(function () {
        try {
          window.sessionStorage.removeItem(storageKey);
        } catch (_) {
          // A later visit can retry when storage is unavailable.
        }
      });
  });
})();
