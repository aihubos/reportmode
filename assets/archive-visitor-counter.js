(function () {
  "use strict";

  var API_BASE = "https://reportmode-request-board.report-request-board.workers.dev";
  var SITE_ID = "report-hub-main";
  var STORAGE_KEY = "reporthub:visitor-id";
  var output = document.getElementById("archiveVisitorCount");
  if (!output) return;

  function makeVisitorId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (character) {
      return (Number(character) ^ Math.random() * 16 >> Number(character) / 4).toString(16);
    });
  }

  function visitorId() {
    try {
      var current = localStorage.getItem(STORAGE_KEY);
      if (current) return current;
      current = makeVisitorId();
      localStorage.setItem(STORAGE_KEY, current);
      return current;
    } catch (_) {
      return makeVisitorId();
    }
  }

  function show(data) {
    var total = Number(data.total || 0).toLocaleString("ko-KR");
    var today = Number(data.today || 0).toLocaleString("ko-KR");
    output.textContent = "누적 방문 " + total + " · 오늘 " + today;
    output.dataset.ready = "true";
  }

  function readOnly() {
    return fetch(API_BASE + "/visits?site=" + encodeURIComponent(SITE_ID), { cache: "no-store" })
      .then(function (response) { if (!response.ok) throw new Error("visit read failed"); return response.json(); })
      .then(show);
  }

  fetch(API_BASE + "/visits", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId: SITE_ID, visitorId: visitorId() })
  })
    .then(function (response) { if (!response.ok) throw new Error("visit write failed"); return response.json(); })
    .then(show)
    .catch(function () { return readOnly().catch(function () { output.textContent = "방문 집계 준비 중"; }); });
})();
