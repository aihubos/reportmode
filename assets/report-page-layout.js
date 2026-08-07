(function () {
  "use strict";

  var body = document.body;
  if (!body || body.dataset.reportLayoutEnhanced === "true") return;
  body.dataset.reportLayoutEnhanced = "true";

  var printStyle = document.createElement("style");
  printStyle.id = "report-layout-print-style";
  document.head.appendChild(printStyle);
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
  function setPrintPage(layout) {
    printStyle.textContent = "@page { size: A4 " + (layout === "wide" ? "landscape" : "portrait") + "; margin: 15mm; }";
  }

  function setLayout(layout) {
    var isA4 = layout === "a4";
    body.classList.toggle("report-a4-mode", isA4);
    body.dataset.reportLayout = isA4 ? "a4" : "wide";
    buttons.forEach(function (button) {
      var active = button.dataset.reportLayout === layout;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    setPrintPage(layout);
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () { setLayout(button.dataset.reportLayout); });
  });

  // Every report opens in the shared default: portrait A4.
  setLayout("a4");

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("#report-pdf-button");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setPrintPage(body.dataset.reportLayout === "wide" ? "wide" : "a4");
    window.print();
  }, true);
})();
