(() => {
  'use strict';
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const parseMeta = () => {
    const node = q('#report-metadata');
    if (!node) return null;
    try { return JSON.parse(node.textContent || '{}'); }
    catch (error) { console.error('Invalid report metadata:', error); return null; }
  };
  const escapeText = (value) => String(value ?? '');
  const renderHistory = (meta) => {
    const targets = [q('#rmHistoryBody'), q('#historyBody')].filter(Boolean);
    const history = Array.isArray(meta?.history) ? meta.history : [];
    targets.forEach((body) => {
      body.innerHTML = '';
      if (!history.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = '기록된 변경 이력이 없습니다.';
        row.appendChild(cell); body.appendChild(row); return;
      }
      history.forEach((item) => {
        const row = document.createElement('tr');
        const values = [
          `v${escapeText(item.version)}`,
          escapeText(item.date).replaceAll('-', '.'),
          escapeText(item.type),
          escapeText(item.summary),
          [item.updatedBy, item.reviewStatus].filter(Boolean).join(' · ')
        ];
        values.forEach((value, index) => {
          const cell = document.createElement('td');
          if (index === 4) { const badge = document.createElement('span'); badge.className = 'rm-status'; badge.textContent = value; cell.appendChild(badge); }
          else cell.textContent = value;
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
    });
  };
  const updateMeta = (meta) => {
    if (!meta) return;
    const version = `v${meta.version || ''}`;
    const date = String(meta.updatedAt || '').replaceAll('-', '.');
    const sets = {
      reportVersion: version,
      reportUpdated: `Updated ${date}`,
      reportGeneration: [meta.generation, meta.reviewStatus].filter(Boolean).join(' · '),
      historyCurrentVersion: `Current ${version}`,
      rmVersion: version,
      rmUpdated: date,
      rmHistoryVersion: `Current ${version}`
    };
    Object.entries(sets).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
    document.title = `${meta.title || document.title.replace(/\s*[·|]\s*v\d+\.\d+\.\d+.*$/i, '')} · ${version}`;
    renderHistory(meta);
  };
  const setupMediaFallback = () => {
    qa('img').forEach((img) => {
      if (!img.getAttribute('alt')) img.setAttribute('alt', '보고서 관련 이미지');
      img.addEventListener('error', () => {
        img.removeAttribute('srcset');
        img.classList.add('rm-broken-media');
        img.alt = `${img.alt || '이미지'} — 파일을 불러오지 못했습니다`;
        const svg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="100%" height="100%" fill="#F7F8FA"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" fill="#6B7684">Report image unavailable</text></svg>')}`;
        if (img.src !== svg) img.src = svg;
      }, { once: true });
    });
  };
  const setupVideo = () => {
    qa('[data-rm-youtube]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-rm-youtube');
        if (!id || !/^[\w-]{6,20}$/.test(id)) return;
        const iframe = document.createElement('iframe');
        iframe.className = 'rm-video-frame'; iframe.title = button.getAttribute('data-title') || '관련 영상';
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
        iframe.loading = 'lazy'; iframe.referrerPolicy = 'strict-origin-when-cross-origin'; iframe.allowFullscreen = true;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        button.replaceWith(iframe);
      });
    });
  };
  const setupLayout = () => {
    const body = document.body;
    if (!body) return;
    if (!body.dataset.reportView) body.dataset.reportView = 'detail';
    const actions = q('.rm-topline-actions');
    const existing = q('.report-layout-controls');
    if (existing && actions && existing.parentElement !== actions) actions.insertBefore(existing, actions.firstChild);
    if (body.dataset.reportLayoutEnhanced === 'true') return;
    body.dataset.reportLayoutEnhanced = 'true';
    const printStyle = document.createElement('style');
    printStyle.id = 'report-layout-print-style';
    document.head.appendChild(printStyle);
    const controls = document.createElement('div');
    controls.className = 'report-layout-controls';
    controls.setAttribute('aria-label', '보고서 레이아웃');
    controls.innerHTML = '<span class="report-layout-label">레이아웃</span><div class="report-layout-buttons" role="group" aria-label="가로 또는 세로"><button class="report-layout-button" type="button" data-report-layout="wide" aria-pressed="false">가로</button><button class="report-layout-button" type="button" data-report-layout="a4" aria-pressed="false">세로</button></div>';
    if (actions) actions.insertBefore(controls, actions.firstChild);
    else body.insertBefore(controls, body.firstChild);
    const buttons = qa('[data-report-layout]', controls);
    const setPrintPage = (layout) => {
      printStyle.textContent = `@page { size: A4 ${layout === 'wide' ? 'landscape' : 'portrait'}; margin: 15mm; }`;
    };
    const setLayout = (layout) => {
      const next = layout === 'a4' ? 'a4' : 'wide';
      body.classList.toggle('report-a4-mode', next === 'a4');
      body.dataset.reportLayout = next;
      buttons.forEach((button) => {
        const active = button.dataset.reportLayout === next;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      setPrintPage(next);
    };
    buttons.forEach((button) => button.addEventListener('click', () => setLayout(button.dataset.reportLayout)));
    setLayout('wide');
  };
  const setupPrint = () => qa('[data-rm-print]').forEach((button) => button.addEventListener('click', () => window.print()));
  const setupExternalLinks = () => qa('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  const meta = parseMeta();
  updateMeta(meta); setupMediaFallback(); setupVideo(); setupLayout(); setupPrint(); setupExternalLinks();
})();
