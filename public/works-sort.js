// Click-to-sort for the works database table. Works alongside filter-index.js:
// filtering toggles row `hidden`; sorting only reorders rows, preserving it.

for (const head of document.querySelectorAll('[data-sort-head]')) {
  const table = head.closest('table');
  const tbody = table?.querySelector('tbody');
  if (!tbody) continue;

  const buttons = [...head.querySelectorAll('[data-sort-key]')];
  const collator = new Intl.Collator('ja', { numeric: true });

  const value = (row, key) => row.dataset[key === 'title' ? 'sortTitle' : key === 'category' ? 'sortCategory' : 'sortYear'] ?? '';

  const compare = (key, dir) => (a, b) => {
    const sign = dir === 'desc' ? -1 : 1;
    if (key === 'year' || key === 'category') {
      const va = value(a, key);
      const vb = value(b, key);
      // Blank (unknown) values always sort to the bottom, regardless of direction.
      if (va === '' && vb === '') return collator.compare(a.dataset.sortTitle, b.dataset.sortTitle);
      if (va === '') return 1;
      if (vb === '') return -1;
      const diff = Number(va) - Number(vb);
      if (diff !== 0) return sign * diff;
      // Tie-break by year then title for a stable, readable order.
      if (key === 'category') {
        const ya = a.dataset.sortYear === '' ? Infinity : Number(a.dataset.sortYear);
        const yb = b.dataset.sortYear === '' ? Infinity : Number(b.dataset.sortYear);
        if (ya !== yb) return sign * (ya - yb);
      }
      return sign * collator.compare(a.dataset.sortTitle, b.dataset.sortTitle);
    }
    return sign * collator.compare(value(a, key), value(b, key));
  };

  const sortBy = (key, dir) => {
    const rows = [...tbody.querySelectorAll('tr')];
    rows.sort(compare(key, dir));
    for (const row of rows) tbody.appendChild(row);

    for (const button of buttons) {
      const th = button.closest('th');
      const active = button.dataset.sortKey === key;
      th?.setAttribute('aria-sort', active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none');
      button.dataset.sortDir = active ? dir : '';
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const key = button.dataset.sortKey;
      const current = button.dataset.sortDir;
      const dir = current === 'asc' ? 'desc' : 'asc';
      sortBy(key, dir);
    });
  }

  // Establish the initial sorted state declared in the markup.
  const initial = buttons.find((b) => b.hasAttribute('data-sort-default')) ?? buttons[0];
  if (initial) sortBy(initial.dataset.sortKey, 'asc');
}
