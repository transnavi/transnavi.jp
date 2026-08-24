// Builds a static English mirror in dist/en from the rendered Japanese site.
// Translations live in src/data/en-translations.json, so ordinary builds make
// no network requests. Run with --update after Japanese copy changes.
import fs from 'node:fs';
import path from 'node:path';
import { HTMLElement, TextNode, parse } from 'node-html-parser';

const DIST = 'dist';
const EN_DIR = path.join(DIST, 'en');
const CATALOG_FILE = 'src/data/en-translations.json';
const OVERRIDES_FILE = 'src/data/en-overrides.json';
const UPDATE = process.argv.includes('--update');
const JAPANESE = /[ぁ-んァ-ヶ一-龠々〆〤]/;
const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'SVG', 'CODE', 'PRE', 'NOSCRIPT', 'TEMPLATE', 'RT', 'RP']);
const HTML_ATTRS = new Set(['alt', 'aria-label', 'content', 'placeholder', 'title', 'value']);

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8'));
const glossaryEnglish = Object.fromEntries(glossary.map((entry) => [entry.term, entry.translations.en]));
const clinics = JSON.parse(fs.readFileSync('src/data/clinics.json', 'utf8'));
const clinicNames = new Set(clinics.flatMap((clinic) => [clinic.name, clinic.displayName].filter(Boolean)));
const works = JSON.parse(fs.readFileSync('src/data/works.json', 'utf8'));
const workEnglish = Object.fromEntries(
  works.map((work) => {
    const alias = (work.aliases || []).find((value) => /[A-Za-z]/.test(value));
    return [work.title, alias ? `${alias} (${work.title})` : work.title];
  }),
);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else files.push(file);
  }
  return files;
}

const japaneseHtmlFiles = () => walk(DIST).filter((file) => file.endsWith('.html') && !file.startsWith(`${EN_DIR}${path.sep}`));
const keyOf = (value) => value.replace(/\s+/g, ' ').trim();
const needsTranslation = (value) => JAPANESE.test(value);

function translatableAttribute(name, value, element = null) {
  const worksTableValue = element?.closest('[data-works-db]') && ['data-search', 'data-sort-title', 'data-initial'].includes(name);
  return needsTranslation(value) && !worksTableValue && (HTML_ATTRS.has(name) || name.startsWith('data-'));
}

function visitText(node, callback, blocked = false) {
  if (node instanceof TextNode) {
    if (!blocked) callback(node);
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const language = node.getAttribute('lang');
  const nextBlocked = blocked || SKIP_TEXT.has(node.tagName) || Boolean(language && language !== 'ja');
  for (const child of node.childNodes) visitText(child, callback, nextBlocked);
}

function visitJsonStrings(value, callback, key = '') {
  if (typeof value === 'string') {
    if (needsTranslation(value) && !['url', 'href', 'id'].includes(key)) callback(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitJsonStrings(item, callback, key);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) visitJsonStrings(child, callback, childKey);
  }
}

function jsonScripts(root) {
  return root.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
}

function collectStrings() {
  const strings = new Set();
  const add = (value) => {
    const key = keyOf(value);
    const derived = key in glossaryEnglish || clinicNames.has(key) || key in workEnglish || key.startsWith('作者：');
    if (key && needsTranslation(key) && !(key in overrides) && !derived) strings.add(key);
  };

  for (const file of japaneseHtmlFiles()) {
    const root = parse(fs.readFileSync(file, 'utf8'));
    visitText(root, (node) => add(node.text));
    for (const element of root.querySelectorAll('*')) {
      for (const [name, value] of Object.entries(element.attributes)) {
        if (translatableAttribute(name, value, element)) add(value);
      }
    }
    for (const script of jsonScripts(root)) {
      try {
        visitJsonStrings(JSON.parse(script.text), add);
      } catch {
        // A malformed optional data block remains untouched and is reported by
        // the page feature that consumes it.
      }
    }
    for (const noscript of root.querySelectorAll('noscript')) {
      const fragment = parse(noscript.text);
      visitText(fragment, (node) => add(node.text));
      for (const element of fragment.querySelectorAll('*')) {
        for (const [name, value] of Object.entries(element.attributes)) {
          if (translatableAttribute(name, value, element)) add(value);
        }
      }
    }
  }

  const linkMapFile = path.join(DIST, 'link-map.json');
  if (fs.existsSync(linkMapFile)) {
    visitJsonStrings(JSON.parse(fs.readFileSync(linkMapFile, 'utf8')), add);
  }
  return [...strings].sort((a, b) => a.localeCompare(b, 'ja'));
}

function polishTranslation(value) {
  return value
    .split(/(https?:\/\/[^\s)]+)/)
    .map((part, index) => {
      if (index % 2) return part;
      return part
        .replace(/(?:Translation|Translator|Transgender|Trans)[ -]?Navi/gi, 'TransNavi')
        .replace(/Toransu Navi/gi, 'TransNavi')
        .replace(/\b(?:Furahol|Frahol)\b/gi, 'DIY HRT')
        .replace(/\bMamorouyo Kokoro\b/g, 'Ministry of Health, Labour and Welfare mental health support portal')
        .replace(/\bKinki Trance Meeting\b/g, 'Kinki Trans Meeting')
        .replace(/\bGender Assignment Hormone Therapy\b/gi, 'gender-affirming hormone therapy')
        .replace(/\bForce Outing\b/gi, 'Outing')
        .replace(/\b(?:Japanese|Japan) GI \(Gender Nonconform(?:ity|ing)\) Society\b/gi, 'Japan Society of Gender Incongruence')
        .replace(/\bJapan Society for Gender Nonconformity\b/gi, 'Japan Society of Gender Incongruence')
        .replace(/\bgender non[- ]?conformity\b/gi, (match) => (/^[A-Z]/.test(match) ? 'Gender incongruence' : 'gender incongruence'))
        .replace(/\bgender nonconforming(?=\s*(?:\(GI\)|in ICD-11))/gi, (match) => (/^[A-Z]/.test(match) ? 'Gender incongruence' : 'gender incongruence'))
        .replace(/\bvaginal ostomy(?: surgery)?\b/gi, 'vaginoplasty')
        .replace(/\bvaginostomy\b/gi, 'vaginoplasty')
        .replace(/\bgrottoplasty\b/gi, 'glottoplasty')
        .replace(/``/g, '“')
        .replace(/''/g, '”');
    })
    .join('')
    .trim();
}

async function googleTranslate(text, attempt = 0) {
  const body = new URLSearchParams({ client: 'gtx', sl: 'ja', tl: 'en', dt: 't', q: text });
  try {
    const response = await fetch('https://translate.googleapis.com/translate_a/single', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const translated = (data[0] || []).map((part) => part[0] || '').join('');
    if (!translated) throw new Error('empty response');
    return translated;
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt));
    return googleTranslate(text, attempt + 1);
  }
}

async function translateBatch(values) {
  if (values.length === 1) return [polishTranslation(await googleTranslate(values[0]))];
  const joined = values.map((value, index) => `${index ? `\n[[[TN_SPLIT_${index}]]]\n` : ''}${value}`).join('');
  const translated = await googleTranslate(joined);
  const parts = translated.split(/\s*\[\[\[TN_SPLIT_\d+\]\]\]\s*/);
  if (parts.length === values.length) return parts.map(polishTranslation);
  return Promise.all(values.map(async (value) => polishTranslation(await googleTranslate(value))));
}

function makeBatches(values, maxCharacters = 3200) {
  const batches = [];
  let batch = [];
  let size = 0;
  for (const value of values) {
    const added = value.length + 32;
    if (batch.length && size + added > maxCharacters) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(value);
    size += added;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

async function updateCatalog(strings) {
  const missing = strings.filter((value) => !(value in catalog));
  if (!missing.length) {
    console.log(`english: translation catalog is current (${strings.length} strings)`);
    return;
  }

  const batches = makeBatches(missing);
  console.log(`english: translating ${missing.length} strings in ${batches.length} batches`);
  let next = 0;
  let completed = 0;
  async function worker() {
    while (next < batches.length) {
      const index = next++;
      const batch = batches[index];
      const translated = await translateBatch(batch);
      batch.forEach((source, i) => (catalog[source] = translated[i]));
      completed++;
      if (completed % 10 === 0 || completed === batches.length) {
        console.log(`english: translated ${completed}/${batches.length} batches`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, batches.length) }, () => worker()));
  const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b, 'ja')));
  fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`english: wrote ${Object.keys(sorted).length} translations to ${CATALOG_FILE}`);
}

const translationOf = (value) => {
  const key = keyOf(value);
  if (key in overrides) return polishTranslation(overrides[key]);
  if (key.endsWith(' - とらんすナビ')) return `${translationOf(key.slice(0, -' - とらんすナビ'.length))} - TransNavi`;
  if (key.endsWith(' →')) {
    const base = key.slice(0, -' →'.length);
    if (base in overrides) return `${translationOf(base)} →`;
    if (key in catalog) return polishTranslation(catalog[key]);
    return `${translationOf(base)} →`;
  }
  if (key in glossaryEnglish) return glossaryEnglish[key];
  if (key in workEnglish) return workEnglish[key];
  if (key.startsWith('作者：')) return `Creator: ${key.slice('作者：'.length)}`;
  const translated = polishTranslation(catalog[key] ?? key);
  if (clinicNames.has(key) && translated !== key) return `${translated} (${key})`;
  return translated;
};

const escapeText = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function capitalizeFirstWord(element) {
  let found = false;

  function visit(node) {
    if (found) return;
    if (node instanceof TextNode) {
      const index = node.text.search(/[A-Za-z]/);
      if (index === -1) return;
      found = true;
      const firstLetter = node.text[index];
      if (firstLetter === firstLetter.toLowerCase()) {
        node.rawText = escapeText(
          `${node.text.slice(0, index)}${firstLetter.toUpperCase()}${node.text.slice(index + 1)}`,
        );
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    for (const child of node.childNodes) visit(child);
  }

  visit(element);
}

function conciseDescription(value, maximum = 160) {
  const normalized = keyOf(value);
  if (normalized.length <= maximum) return normalized;
  const candidate = normalized.slice(0, maximum - 1);
  const boundary = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('; '), candidate.lastIndexOf(' '));
  const end = boundary >= Math.floor(maximum * 0.65) ? boundary : candidate.length;
  return `${candidate.slice(0, end).replace(/[,:;.!?\s]+$/, '')}…`;
}

function polishEnglishInterface(root) {
  root.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6').forEach(capitalizeFirstWord);

  for (const link of root.querySelectorAll('a.link-chip[data-filter-item][title]')) {
    const title = keyOf(link.querySelector('.link-chip-title')?.text ?? '');
    const description = keyOf(link.getAttribute('title') ?? '');
    const tags = link.querySelectorAll('.link-chip-tag').map((tag) => keyOf(tag.text)).filter(Boolean);
    link.setAttribute('data-search', [title, description, ...tags].filter(Boolean).join(' '));
  }

  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    const meta = root.querySelector(selector);
    const content = meta?.getAttribute('content');
    if (meta && content) meta.setAttribute('content', conciseDescription(content));
  }

  for (const link of root.querySelectorAll('a[href="https://db.transnavi.jp/ja/"]')) {
    link.setAttribute('href', 'https://db.transnavi.jp/en/');
  }

  const licenseNote = root.querySelector('.footer-license-note');
  licenseNote?.set_content(
    'For details, see <a href="/en/data/">Citing and reusing the data</a>. If a page lists a different source or license, follow the terms shown on that page.',
  );
}

function replaceTextNode(node) {
  const raw = node.text;
  const source = keyOf(raw);
  const shouldTranslate = needsTranslation(source) || source in overrides;
  const rendered = shouldTranslate ? translationOf(source) : raw.trim();
  const polished = rendered
    .replace(/。/g, '.')
    .replace(/、/g, ', ')
    .replace(/「/g, '“')
    .replace(/」/g, '”')
    .replace(/『/g, '‘')
    .replace(/』/g, '’')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/・/g, ' · ');
  if (!shouldTranslate && polished === raw.trim()) return;
  const leading = raw.match(/^\s*/)?.[0] ?? '';
  const trailing = raw.match(/\s*$/)?.[0] ?? '';
  node.rawText = escapeText(`${leading}${polished}${trailing}`);
}

function addInlineWordSpacing(root) {
  const containers = root.querySelectorAll(
    'p, li, dd, dt, blockquote, figcaption, summary, h1, h2, h3, h4, h5, h6, .page-disclaimer',
  );
  for (const container of containers) {
    const textNodes = [];
    visitText(container, (node) => {
      if (node.text) textNodes.push(node);
    });
    for (let index = 1; index < textNodes.length; index++) {
      const previous = textNodes[index - 1];
      const current = textNodes[index];
      if (/\s$/.test(previous.text) || /^\s/.test(current.text)) continue;
      if (/[\p{L}\p{N}.!?,:;)\]”’]$/u.test(previous.text) && /^[\p{L}\p{N}(“‘]/u.test(current.text)) {
        current.rawText = ` ${current.rawText}`;
      }
    }
  }
}

function localizePath(value) {
  if (!value.startsWith('/') || value.startsWith('/en/')) return value;
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  const pathname = match?.[1] ?? value;
  const suffix = match?.[2] ?? '';
  if (pathname !== '/' && path.posix.extname(pathname)) return value;
  return `/en${pathname}${suffix}`;
}

function localizeAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'transnavi.jp') return value;
    const localized = localizePath(`${url.pathname}${url.search}${url.hash}`);
    return localized === `${url.pathname}${url.search}${url.hash}` ? value : new URL(localized, url.origin).toString();
  } catch {
    return value;
  }
}

function translateJson(value, key = '') {
  if (typeof value === 'string') {
    if (['url', 'href'].includes(key)) return value.startsWith('/') ? localizePath(value) : localizeAbsoluteUrl(value);
    if (key === 'inLanguage') return 'en';
    if (value.startsWith('https://transnavi.jp/')) return localizeAbsoluteUrl(value);
    return needsTranslation(value) ? translationOf(value) : value;
  }
  if (Array.isArray(value)) return value.map((item) => translateJson(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, translateJson(child, childKey)]));
  }
  return value;
}

function originalRoute(file) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  return `/${relative.replace(/index\.html$/, '')}`;
}

function setMeta(root, selector, attribute, value) {
  root.querySelector(selector)?.setAttribute(attribute, value);
}

function translateHtml(file) {
  const route = originalRoute(file);
  const englishRoute = `/en${route}`;
  const root = parse(fs.readFileSync(file, 'utf8'));
  const refresh = root.querySelector('meta[http-equiv="refresh"]');
  let redirectTarget = null;
  if (refresh) {
    const content = refresh.getAttribute('content') || '';
    const match = content.match(/^(.*?url=)(.*)$/i);
    if (match) {
      redirectTarget = localizePath(match[2]);
      refresh.setAttribute('content', `${match[1]}${redirectTarget}`);
    }
  }

  visitText(root, replaceTextNode);
  for (const element of root.querySelectorAll('*')) {
    for (const [name, value] of Object.entries(element.attributes)) {
      if (translatableAttribute(name, value, element)) element.setAttribute(name, translationOf(value));
    }
    if (element.hasAttribute('href')) element.setAttribute('href', localizePath(element.getAttribute('href')));
    if (element.hasAttribute('action')) element.setAttribute('action', localizePath(element.getAttribute('action')));
  }

  for (const script of jsonScripts(root)) {
    try {
      script.set_content(JSON.stringify(translateJson(JSON.parse(script.text))));
    } catch {
      // Leave malformed optional data unchanged.
    }
  }

  for (const noscript of root.querySelectorAll('noscript')) {
    const fragment = parse(noscript.text);
    visitText(fragment, replaceTextNode);
    for (const element of fragment.querySelectorAll('*')) {
      for (const [name, value] of Object.entries(element.attributes)) {
        if (translatableAttribute(name, value, element)) element.setAttribute(name, translationOf(value));
      }
      if (element.hasAttribute('href')) element.setAttribute('href', localizePath(element.getAttribute('href')));
    }
    noscript.set_content(fragment.toString());
  }

  addInlineWordSpacing(root);
  polishEnglishInterface(root);

  root.querySelector('html')?.setAttribute('lang', 'en');
  setMeta(root, 'meta[http-equiv="content-language"]', 'content', 'en');
  setMeta(root, 'meta[property="og:locale"]', 'content', 'en_US');
  setMeta(root, 'meta[property="og:url"]', 'content', new URL(englishRoute, 'https://transnavi.jp').toString());

  const canonical = new URL(redirectTarget || englishRoute, 'https://transnavi.jp').toString();
  const japanese = new URL(route, 'https://transnavi.jp').toString();
  root.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
  root.querySelector('link[rel="alternate"][hreflang="ja"]')?.setAttribute('href', japanese);
  root.querySelector('link[rel="alternate"][hreflang="en"]')?.setAttribute('href', canonical);
  root.querySelector('link[rel="alternate"][hreflang="x-default"]')?.setAttribute('href', japanese);

  const languageSwitch = root.querySelector('.language-switch');
  if (languageSwitch) {
    languageSwitch.setAttribute('href', route);
    languageSwitch.setAttribute('lang', 'ja');
    languageSwitch.setAttribute('hreflang', 'ja');
    languageSwitch.setAttribute('aria-label', 'View this page in Japanese');
    languageSwitch.set_content('日本語');
  }
  root.querySelector('.furigana-toggle')?.remove();

  const mainColumn = root.querySelector('#main-content .main-col');
  if (mainColumn) {
    mainColumn.insertAdjacentHTML(
      'afterbegin',
      `<aside class="translation-note">This site provides information about Japan. The <a href="${route}" hreflang="ja">Japanese version</a> is the authoritative version of this page. Please refer to it as well, especially for current medical, legal, and cost information.</aside>`,
    );
  }

  const relative = path.relative(DIST, file);
  const output = path.join(EN_DIR, relative);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, root.toString());
  return output;
}

function sectionLabel(route) {
  if (route === '/en/') return 'Home';
  if (route.startsWith('/en/clinics')) return 'Clinics';
  if (route.startsWith('/en/glossary')) return 'Glossary';
  if (route.startsWith('/en/library')) return 'Library';
  if (route.startsWith('/en/resources')) return 'Links';
  if (route.startsWith('/en/map')) return 'Map';
  if (route.startsWith('/en/support')) return 'Support';
  if (route.startsWith('/en/works') || route.startsWith('/en/bibliography')) return 'Books and media';
  return 'Guide';
}

function textWithSpaces(element) {
  const parts = [];
  visitText(element, (node) => {
    const text = keyOf(node.text);
    if (text) parts.push(text);
  });
  return keyOf(parts.join(' '));
}

function englishSearchSynonyms() {
  const result = {};
  for (const entry of glossary) {
    const forms = [entry.translations.en, entry.abbr, ...(entry.aliases || [])]
      .filter((value) => typeof value === 'string' && /[A-Za-z]/.test(value) && !needsTranslation(value))
      .map(keyOf)
      .filter(Boolean);
    const unique = [...new Set(forms)];
    for (const form of unique) {
      const alternatives = unique.filter((candidate) => candidate.toLowerCase() !== form.toLowerCase());
      if (alternatives.length) result[form.toLowerCase()] = alternatives;
    }
  }
  return result;
}

function buildEnglishSearch(files) {
  const entries = [];
  for (const file of files) {
    const root = parse(fs.readFileSync(file, 'utf8'));
    const main = root.querySelector('main');
    const heading = main?.querySelector('h1');
    if (!main || !heading) continue;
    main.querySelector('.breadcrumbs')?.remove();
    main.querySelector('.back-top')?.remove();
    main.querySelector('.translation-note')?.remove();
    main.querySelectorAll('script, style, rt, rp').forEach((element) => element.remove());
    const relative = path.relative(EN_DIR, file).split(path.sep).join('/');
    const route = relative === 'index.html' ? '/en/' : `/en/${relative.replace(/index\.html$/, '')}`;
    entries.push({
      u: route,
      t: textWithSpaces(heading),
      k: sectionLabel(route),
      x: textWithSpaces(main).slice(0, 1600),
    });
  }
  fs.writeFileSync(path.join(EN_DIR, 'search-index.json'), JSON.stringify(entries));
  fs.writeFileSync(path.join(EN_DIR, 'search-synonyms.json'), JSON.stringify(englishSearchSynonyms()));
  console.log(`english: search index contains ${entries.length} pages`);
}

function buildEnglishLinkMap() {
  const source = path.join(DIST, 'link-map.json');
  if (!fs.existsSync(source)) return;
  const data = translateJson(JSON.parse(fs.readFileSync(source, 'utf8')));
  const prefixId = (value) => (typeof value === 'string' ? localizePath(value) : value);
  for (const node of [...(data.nodes || []), ...(data.terms || [])]) node.id = prefixId(node.id);
  for (const link of [...(data.links || []), ...(data.termLinks || [])]) {
    link.source = prefixId(link.source);
    link.target = prefixId(link.target);
  }
  data.pagerank = Object.fromEntries(Object.entries(data.pagerank || {}).map(([key, value]) => [prefixId(key), value]));
  fs.writeFileSync(path.join(EN_DIR, 'link-map.json'), JSON.stringify(data));
}

function extendSitemap() {
  const file = path.join(DIST, 'sitemap.xml');
  if (!fs.existsSync(file)) return;
  let xml = fs.readFileSync(file, 'utf8');
  xml = xml.replace(/  <url><loc>https:\/\/transnavi\.jp\/en\/[^<]*<\/loc>.*?<\/url>\n?/g, '');
  const records = [...xml.matchAll(/  <url><loc>([^<]+)<\/loc>(.*?)<\/url>/g)].map((match) => ({ loc: match[1], rest: match[2] }));
  const english = records
    .map(({ loc, rest }) => `  <url><loc>${localizeAbsoluteUrl(loc)}</loc>${rest}</url>`)
    .join('\n');
  xml = xml.replace('</urlset>', `${english ? `${english}\n` : ''}</urlset>`);
  fs.writeFileSync(file, xml);
}

const strings = collectStrings();
if (UPDATE) await updateCatalog(strings);
const missing = strings.filter((value) => !(value in catalog) && !(value in overrides));
if (missing.length) {
  fs.writeFileSync(path.join(DIST, 'en-missing-translations.json'), `${JSON.stringify(missing, null, 2)}\n`);
  console.error(`english: ${missing.length} translations are missing. Run npm run translate:en.`);
  for (const value of missing) console.error(`  ${JSON.stringify(value)}`);
  process.exit(1);
}

if (fs.existsSync(EN_DIR)) fs.rmSync(EN_DIR, { recursive: true });
const englishFiles = japaneseHtmlFiles().map(translateHtml);
buildEnglishSearch(englishFiles);
buildEnglishLinkMap();
extendSitemap();
console.log(`english: generated ${englishFiles.length} pages in ${EN_DIR}`);
