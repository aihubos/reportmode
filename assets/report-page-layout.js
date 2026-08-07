(function () {
  "use strict";

  var body = document.body;
  if (!body || body.dataset.reportLayoutEnhanced === "true") return;
  body.dataset.reportLayoutEnhanced = "true";

  var storageKey = "reportmode:layout";
  var controls = document.createElement("div");
  controls.className = "report-layout-controls";
  controls.setAttribute("aria-label", "보고서 레이아웃");
  controls.innerHTML =
    '<span class="report-layout-label">레이아웃</span>' +
    '<div class="report-layout-buttons" role="group" aria-label="가로 또는 세로">' +
    '<button class="report-layout-button" type="button" data-report-layout="wide" aria-pressed="false">가로</button>' +
    '<button class="report-layout-button" type="button" data-report-layout="a4" aria-pressed="false">세로</button>' +
    "</div>";

  var switcher = document.querySelector(".report-view-switcher-inner");
  if (switcher) switcher.insertBefore(controls, switcher.firstChild);
  else document.body.insertBefore(controls, document.body.firstChild);

  var buttons = controls.querySelectorAll("[data-report-layout]");
  function setLayout(layout) {
    var isA4 = layout === "a4";
    body.classList.toggle("report-a4-mode", isA4);
    body.dataset.reportLayout = isA4 ? "a4" : "wide";
    buttons.forEach(function (button) {
      var active = button.dataset.reportLayout === layout;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try { localStorage.setItem(storageKey, layout); } catch (_) {}
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () { setLayout(button.dataset.reportLayout); });
  });

  var saved = "a4";
  try { saved = localStorage.getItem(storageKey) || "a4"; } catch (_) {}
  setLayout(saved === "wide" ? "wide" : "a4");
})();
