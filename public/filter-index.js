const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ja-JP');

for (const form of document.querySelectorAll('[data-filter-form]')) {
  const input = form.querySelector('[data-filter-input]');
  const root = form.closest('article') ?? document;
  const items = [...root.querySelectorAll('[data-filter-item]')];
  const groups = [...root.querySelectorAll('[data-filter-group]')];
  const count = root.querySelector('[data-filter-count]');
  const empty = root.querySelector('[data-filter-empty]');
  const tabs = [...root.querySelectorAll('[data-filter-tab]')];
  let activeCategory = tabs.find((tab) => tab.getAttribute('aria-pressed') === 'true')?.dataset.filterValue ?? '';

  const update = () => {
    const query = normalize(input.value.trim());
    let visible = 0;

    for (const item of items) {
      const haystack = normalize(item.dataset.search ?? item.textContent ?? '');
      const categories = (item.dataset.categories ?? '').split(',').filter(Boolean);
      const matchesQuery = query === '' || haystack.includes(query);
      const matchesCategory = activeCategory === '' || categories.includes(activeCategory);
      const matches = matchesQuery && matchesCategory;

      item.hidden = !matches;
      if (matches) visible += 1;
    }

    for (const group of groups) {
      const visibleItems = [...group.querySelectorAll('[data-filter-item]:not([hidden])')];
      group.hidden = visibleItems.length === 0;
      group.open = visibleItems.length > 0 && (query !== '' || activeCategory !== 'hrt');

      const groupCount = group.querySelector('[data-filter-group-count]');
      if (groupCount) groupCount.textContent = String(visibleItems.length);
    }

    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible !== 0;
  };

  input.addEventListener('input', update);

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.filterValue ?? '';

      for (const currentTab of tabs) {
        currentTab.setAttribute('aria-pressed', currentTab === tab ? 'true' : 'false');
      }

      update();
    });
  }

  for (const button of root.querySelectorAll('[data-expand-button]')) {
    button.addEventListener('click', () => {
      const card = button.closest('[data-filter-item]');
      const panel = card?.querySelector('[data-expand-panel]');
      if (!panel) return;

      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      button.textContent = expanded ? '詳細を開く' : '詳細を閉じる';
      panel.hidden = expanded;
    });
  }

  update();
}
