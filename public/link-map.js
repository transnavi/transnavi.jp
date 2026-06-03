// Interactive pseudo-3D map of the site's internal links, drawn into #link-map
// on /sitemap/ from /link-map.json. Hand-rolled (no library): a 3D force layout,
// perspective projection, gentle auto-rotation, glossy spheres, drag-to-orbit,
// click/tap a node to open that page. Pauses when scrolled out of view.
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var COLORS = {
    start: '#4ba8ea',
    medical: '#e8589b',
    support: '#36b37e',
    society: '#f2994a',
    reference: '#8a6dc6',
    site: '#8d97ad',
  };
  var FOCAL = 760;
  var AUTO = 0.0022; // auto-rotation speed (rad/frame)

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgb(' + Math.round(((n >> 16) & 255) * f) + ',' + Math.round(((n >> 8) & 255) * f) + ',' + Math.round((n & 255) * f) + ')';
  }

  async function init() {
    var host = document.getElementById('link-map');
    if (!host) return;
    var data;
    try {
      data = await (await fetch('/link-map.json')).json();
    } catch (e) {
      return;
    }
    var nodes = data.nodes;
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var links = data.links.filter(function (l) { return byId[l.source] && byId[l.target]; });

    var W = Math.max(320, host.clientWidth || 680);
    var H = host.clientHeight || 560;
    var cx = W / 2;
    var cy = H / 2;

    // Initial positions: a rough sphere (deterministic by index).
    nodes.forEach(function (n, i) {
      var phi = Math.acos(1 - (2 * (i + 0.5)) / nodes.length);
      var theta = Math.PI * (1 + Math.sqrt(5)) * i;
      var r = 150;
      n.x = r * Math.sin(phi) * Math.cos(theta);
      n.y = r * Math.sin(phi) * Math.sin(theta);
      n.z = r * Math.cos(phi);
      n.vx = n.vy = n.vz = 0;
      n.deg = 0;
    });
    links.forEach(function (l) { byId[l.source].deg++; byId[l.target].deg++; });

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'link-map-svg', role: 'img', 'aria-label': 'サイト内のページのつながりの3D図' });
    var defs = el('defs', {});
    svg.appendChild(defs);
    Object.keys(COLORS).forEach(function (g) {
      var grad = el('radialGradient', { id: 'lmg-' + g, cx: '35%', cy: '32%', r: '75%' });
      grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.8' }));
      grad.appendChild(el('stop', { offset: '38%', 'stop-color': COLORS[g] }));
      grad.appendChild(el('stop', { offset: '100%', 'stop-color': shade(COLORS[g], 0.62) }));
      defs.appendChild(grad);
    });
    var gEdges = el('g', { class: 'lm-edges' });
    var gNodes = el('g', { class: 'lm-nodes' });
    svg.appendChild(gEdges);
    svg.appendChild(gNodes);
    host.appendChild(svg);

    var edgeEls = links.map(function () { var line = el('line', { class: 'lm-edge' }); gEdges.appendChild(line); return line; });
    nodes.forEach(function (n) {
      var g = el('g', { class: 'lm-node', tabindex: '0', role: 'link', 'aria-label': n.label });
      n._r = 6 + Math.min(7, n.deg);
      n._c = el('circle', { r: n._r, fill: 'url(#lmg-' + n.group + ')' });
      n._t = el('text', { class: 'lm-label', x: 0, y: n._r + 13 });
      n._t.textContent = n.label;
      g.appendChild(n._c);
      g.appendChild(n._t);
      gNodes.appendChild(g);
      n._g = g;
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter') location.href = n.id; });
    });

    // Camera (orbit) angles.
    var rotY = 0.4;
    var rotX = -0.32;
    var alpha = 1;

    function physics() {
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          var d2 = dx * dx + dy * dy + dz * dz || 0.01;
          var d = Math.sqrt(d2);
          var f = (3400 / d2) * alpha;
          var fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
          a.vx += fx; a.vy += fy; a.vz += fz;
          b.vx -= fx; b.vy -= fy; b.vz -= fz;
        }
      }
      links.forEach(function (l) {
        var a = byId[l.source], b = byId[l.target];
        var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        var f = ((d - 96) / d) * 0.05 * alpha;
        a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
        b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
      });
      nodes.forEach(function (n) {
        n.vx -= n.x * 0.0016 * alpha; n.vy -= n.y * 0.0016 * alpha; n.vz -= n.z * 0.0016 * alpha;
        n.x += n.vx * 0.82; n.y += n.vy * 0.82; n.z += n.vz * 0.82;
        n.vx *= 0.82; n.vy *= 0.82; n.vz *= 0.82;
      });
    }

    function project(n) {
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var x1 = n.x * cosY - n.z * sinY;
      var z1 = n.x * sinY + n.z * cosY;
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      var y1 = n.y * cosX - z1 * sinX;
      var z2 = n.y * sinX + z1 * cosX;
      var s = FOCAL / (FOCAL + z2);
      return { sx: cx + x1 * s, sy: cy + y1 * s, s: s, z: z2 };
    }

    function render() {
      var P = {};
      nodes.forEach(function (n) { P[n.id] = project(n); });
      // depth sort: far (large z) first
      var order = nodes.slice().sort(function (a, b) { return P[b.id].z - P[a.id].z; });
      order.forEach(function (n) { gNodes.appendChild(n._g); });
      nodes.forEach(function (n) {
        var p = P[n.id];
        var op = 0.45 + 0.55 * (1 - Math.min(1, Math.max(0, (p.z + 200) / 400)));
        n._g.setAttribute('transform', 'translate(' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1) + ') scale(' + p.s.toFixed(3) + ')');
        n._g.style.opacity = op.toFixed(2);
        n._t.style.opacity = op > 0.8 ? '1' : op > 0.62 ? '0.55' : '0';
        n._px = p.sx; n._py = p.sy; n._pr = n._r * p.s;
      });
      links.forEach(function (l, i) {
        var a = P[l.source], b = P[l.target];
        var e = edgeEls[i];
        e.setAttribute('x1', a.sx.toFixed(1)); e.setAttribute('y1', a.sy.toFixed(1));
        e.setAttribute('x2', b.sx.toFixed(1)); e.setAttribute('y2', b.sy.toFixed(1));
        e.style.opacity = (0.18 + 0.34 * (1 - Math.min(1, Math.max(0, ((a.z + b.z) / 2 + 200) / 400)))).toFixed(2);
      });
    }

    // Drag to orbit; tap without drag opens the node under the pointer.
    var dragging = false, moved = false, lx = 0, ly = 0, downNode = null;
    function ptHit(e) {
      var rect = svg.getBoundingClientRect();
      var mx = ((e.clientX - rect.left) / rect.width) * W;
      var my = ((e.clientY - rect.top) / rect.height) * H;
      var best = null, bd = 1e9;
      nodes.forEach(function (n) {
        var d = Math.hypot(n._px - mx, n._py - my);
        if (d < Math.max(11, n._pr + 5) && d < bd) { bd = d; best = n; }
      });
      return best;
    }
    svg.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false; lx = e.clientX; ly = e.clientY; downNode = ptHit(e);
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      rotY += dx * 0.008;
      rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.006));
      lx = e.clientX; ly = e.clientY;
      if (!running) { render(); }
    });
    svg.addEventListener('pointerup', function (e) {
      dragging = false;
      if (!moved && downNode) location.href = downNode.id;
      downNode = null;
    });

    // Run loop; pause when off-screen.
    var raf = null, running = false;
    function loop() {
      if (alpha > 0.03) { physics(); alpha *= 0.985; }
      if (!dragging) rotY += AUTO;
      render();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    render();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { threshold: 0.01 }).observe(host);
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
