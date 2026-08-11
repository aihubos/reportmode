(function (root) {
  "use strict";

  var COLORS = {
    visitors: "var(--rh-primary)",
    views: "var(--rh-danger)",
    entries: "var(--rh-sub)",
  };

  function number(value) { return Math.max(0, Math.trunc(Number(value || 0))); }
  function format(value) { return number(value).toLocaleString("ko-KR"); }
  function dateLabel(value) { return String(value || "").slice(5).replace("-", "."); }
  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function seriesFor(analytics) {
    var site = analytics && analytics.site && analytics.site.daily || [];
    var reports = analytics && analytics.reports && analytics.reports.daily || [];
    var entries = analytics && analytics.entries && analytics.entries.daily || [];
    var byDate = new Map();
    site.concat(reports, entries).forEach(function (row) {
      if (!row || !row.date) return;
      if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date, visitors: 0, views: 0, entries: 0 });
    });
    site.forEach(function (row) { if (byDate.has(row.date)) byDate.get(row.date).visitors = number(row.count); });
    reports.forEach(function (row) { if (byDate.has(row.date)) byDate.get(row.date).views = number(row.count); });
    entries.forEach(function (row) { if (byDate.has(row.date)) byDate.get(row.date).entries = number(row.count); });
    return Array.from(byDate.values()).sort(function (left, right) { return left.date.localeCompare(right.date); });
  }

  function renderTrend(analytics, chart, summary, legend, table) {
    if (!chart || !summary || !legend || !table) return;
    var rows = seriesFor(analytics);
    if (!rows.length) {
      chart.innerHTML = '<p class="archive-admin-console-empty">선택한 기간에 통계가 없습니다.</p>';
      summary.replaceChildren();
      legend.replaceChildren();
      table.innerHTML = '<tr><td colspan="4">통계가 없습니다.</td></tr>';
      return;
    }
    var width = 960;
    var height = 240;
    var left = 42;
    var right = 14;
    var top = 18;
    var bottom = 34;
    var innerWidth = width - left - right;
    var innerHeight = height - top - bottom;
    var max = Math.max(1, ...rows.flatMap(function (row) { return [row.visitors, row.views, row.entries]; }));
    var x = function (index) { return left + (rows.length === 1 ? innerWidth / 2 : innerWidth * index / (rows.length - 1)); };
    var y = function (value) { return top + innerHeight - (value / max) * innerHeight; };
    var linePath = function (key) { return rows.map(function (row, index) { return (index ? "L" : "M") + x(index).toFixed(2) + " " + y(row[key]).toFixed(2); }).join(" "); };
    var areaPath = function (key) { return linePath(key) + " L" + x(rows.length - 1).toFixed(2) + " " + (top + innerHeight) + " L" + x(0).toFixed(2) + " " + (top + innerHeight) + " Z"; };
    var grid = Array.from({ length: 5 }, function (_, index) {
      var value = Math.round(max * (4 - index) / 4);
      var lineY = top + innerHeight * index / 4;
      return '<line class="chart-grid" x1="' + left + '" y1="' + lineY + '" x2="' + (width - right) + '" y2="' + lineY + '"></line><text class="chart-label" x="2" y="' + (lineY + 4) + '">' + format(value) + '</text>';
    }).join("");
    var labels = rows.map(function (row, index) {
      if (index !== 0 && index !== rows.length - 1 && index % Math.max(1, Math.ceil(rows.length / 6)) !== 0) return "";
      return '<text class="chart-label" text-anchor="middle" x="' + x(index) + '" y="' + (height - 8) + '">' + esc(dateLabel(row.date)) + '</text>';
    }).join("");
    var series = [
      { key: "visitors", label: "방문자", color: COLORS.visitors },
      { key: "views", label: "보고서 클릭", color: COLORS.views },
      { key: "entries", label: "유입 세션", color: COLORS.entries },
    ];
    var shapes = series.map(function (item) {
      var points = rows.map(function (row, index) {
        return '<circle class="chart-point" cx="' + x(index) + '" cy="' + y(row[item.key]) + '" r="3.5" fill="' + item.color + '"><title>' + esc(row.date) + ' · ' + esc(item.label) + ' ' + format(row[item.key]) + '</title></circle>';
      }).join("");
      return '<path class="chart-area" d="' + areaPath(item.key) + '" fill="' + item.color + '"></path><path class="chart-line" d="' + linePath(item.key) + '" stroke="' + item.color + '"></path>' + points;
    }).join("");
    chart.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">' + grid + labels + shapes + '</svg>';
    summary.innerHTML = series.map(function (item) {
      var total = rows.reduce(function (sum, row) { return sum + row[item.key]; }, 0);
      return '<div class="archive-admin-console-chart-summary-item"><small>' + item.label + '</small><strong>' + format(total) + '</strong></div>';
    }).join("");
    legend.innerHTML = series.map(function (item) {
      return '<span class="archive-admin-console-chart-legend-item"><i class="archive-admin-console-chart-legend-swatch" style="background:' + item.color + '"></i>' + item.label + '</span>';
    }).join("");
    table.innerHTML = rows.map(function (row) {
      return '<tr><td>' + esc(row.date) + '</td><td>' + format(row.visitors) + '</td><td>' + format(row.views) + '</td><td>' + format(row.entries) + '</td></tr>';
    }).join("");
  }

  root.ReportHubAdminCharts = { renderTrend: renderTrend, seriesFor: seriesFor };
})(window);
