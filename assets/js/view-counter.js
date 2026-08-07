(function() {
  var STORAGE_KEY = 'rm-views';
  var raw = localStorage.getItem(STORAGE_KEY);
  var counts = {};
  if (raw) {
    try { counts = JSON.parse(raw); } catch(e) { counts = {}; }
  }
  var path = window.location.pathname;
  var fname = path.substring(path.lastIndexOf('/') + 1);
  if (!fname) { fname = 'index.html'; }
  if (!counts[fname]) { counts[fname] = 0; }
  counts[fname] = counts[fname] + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  var el = document.getElementById('view-count');
  if (el) { el.textContent = counts[fname]; }
})();
