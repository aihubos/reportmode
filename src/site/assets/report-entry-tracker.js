(function () {
  "use strict";

  var API_BASE = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? "http://127.0.0.1:8787"
    : "https://reportmode-request-board.report-request-board.workers.dev";
  var SITE_ID = "report-hub-main";
  var SESSION_KEY = "reporthub:entry-session";
  var VISITOR_KEY = "reporthub:visitor-id";

  function uuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (character) {
      return (Number(character) ^ Math.random() * 16 >> Number(character) / 4).toString(16);
    });
  }

  function stored(key) {
    try { return sessionStorage.getItem(key) || ""; } catch (_) { return ""; }
  }

  function save(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  function visitorId() {
    try {
      var current = localStorage.getItem(VISITOR_KEY);
      if (current) return current;
      current = uuid();
      localStorage.setItem(VISITOR_KEY, current);
      return current;
    } catch (_) {
      return uuid();
    }
  }

  var scriptElement = document.currentScript;
  var currentReportId = scriptElement && scriptElement.getAttribute("data-report-id") || "";
  var isRedirectEntry = scriptElement && scriptElement.getAttribute("data-entry-redirect") === "true";

  function send() {
    var sessionId = stored(SESSION_KEY);
    if (!sessionId) {
      sessionId = uuid();
      save(SESSION_KEY, sessionId);
    }
    var query = new URLSearchParams(window.location.search);
    fetch(API_BASE + "/entry-sessions", {
      method: "POST",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: SITE_ID,
        entryId: sessionId,
        visitorId: visitorId(),
        landingPath: window.location.pathname,
        reportId: currentReportId,
        referrer: document.referrer,
        utmSource: query.get("utm_source") || "",
        utmMedium: query.get("utm_medium") || "",
        utmCampaign: query.get("utm_campaign") || "",
      }),
    }).catch(function () {});
  }

  if (isRedirectEntry) send();
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", send, { once: true });
  else send();
})();
