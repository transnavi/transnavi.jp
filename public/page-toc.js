// Build a table of contents from an article's <h2> headings.
//
// Runs on content pages only (an .article-shell with >= 3 real <h2>s, and not a
// filter/map index page). On wide screens the TOC is a sticky sidebar; on small
// screens it is a collapsible 目次 box at the top. The current section is
// highlighted as you scroll. Headings carry toggle-able furigana <ruby>, so the
// link text is read with <rt> stripped.
(function () {
  var DESKTOP = '(min-width: 1080px)';
  var shell = document.querySelector('main#main-content .article-shell');
  var nav = document.getElementById('page-toc');
  if (!shell || !nav) return;

  // Skip interactive index pages (clinics / glossary / works / resources / map):
  // a TOC of their filter sections is noise.
  if (document.querySelector('[data-filter-input], #map')) return;

  // Real section headings only — not ones inside cards, asides, nav or widgets.
  var heads = Array.prototype.filter.call(shell.querySelectorAll('h2'), function (h) {
    return !h.closest('nav, aside, details, .notice, .page-disclaimer, .concept-card, .clinic-card, [data-filter-item]');
  });
  if (heads.length < 3) return;

  function textOf(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll('rt, rp').forEach(function (r) { r.remove(); });
    return (clone.textContent || '').trim();
  }

  var list = document.createElement('ol');
  list.className = 'page-toc-list';
  var links = {};
  heads.forEach(function (h, i) {
    if (!h.id) h.id = 'toc-sec-' + (i + 1);
    h.style.scrollMarginTop = '24px';
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = textOf(h);
    li.appendChild(a);
    list.appendChild(li);
    links[h.id] = a;
  });

  var box = document.createElement('details');
  box.className = 'page-toc-box';
  box.open = window.matchMedia(DESKTOP).matches;
  var summary = document.createElement('summary');
  summary.className = 'page-toc-summary';
  summary.textContent = '目次';
  box.appendChild(summary);
  box.appendChild(list);
  nav.appendChild(box);
  nav.hidden = false;
  nav.parentElement.classList.add('has-toc');

  // On small screens, collapse the box again after jumping to a section.
  list.addEventListener('click', function (e) {
    if (e.target.tagName === 'A' && !window.matchMedia(DESKTOP).matches) box.open = false;
  });

  // Scroll-spy: mark the link of the section currently near the top.
  if ('IntersectionObserver' in window) {
    var current = null;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (current) current.classList.remove('is-current');
        current = links[entry.target.id];
        if (current) current.classList.add('is-current');
      });
    }, { rootMargin: '0px 0px -78% 0px', threshold: 0 });
    heads.forEach(function (h) { spy.observe(h); });
  }
})();
