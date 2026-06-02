// Populates the `poster` field of src/data/works.json by resolving a poster /
// thumbnail image URL for each work.
//
// Strategy per entry:
//   - Wikipedia (ja/en): use the REST summary API → thumbnail.source (reliable,
//     CORS-friendly, hotlink-safe upload.wikimedia.org URLs).
//   - Everything else: fetch the page HTML and read the og:image / twitter:image
//     meta tag.
//
// Re-run any time. Existing non-null posters are kept unless --force is passed.
//
//   node scripts/fetch-work-posters.mjs [--force]

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATA_PATH = fileURLToPath(new URL('../src/data/works.json', import.meta.url));
const FORCE = process.argv.includes('--force');
const UA =
  'Mozilla/5.0 (compatible; transnavi-poster-bot/1.0; +https://transnavi.jp)';
const TIMEOUT_MS = 15000;
const CONCURRENCY = 6;

function timeoutFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, 'accept-language': 'ja,en;q=0.8' },
    signal: controller.signal,
    ...options,
  }).finally(() => clearTimeout(timer));
}

function parseWikipedia(url) {
  const m = url.match(/^https?:\/\/(ja|en)\.wikipedia\.org\/wiki\/(.+)$/);
  if (!m) return null;
  const [, lang, rawTitle] = m;
  // The stored title may be percent-encoded already; normalise to a bare title.
  let title;
  try {
    title = decodeURIComponent(rawTitle);
  } catch {
    title = rawTitle;
  }
  return { lang, title };
}

async function posterFromWikipedia({ lang, title }) {
  const api = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title,
  )}`;
  const res = await timeoutFetch(api);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.thumbnail?.source ?? data?.originalimage?.source ?? null;
}

// Generic share-icons / logo fallbacks that some sites (Amazon, etc.) serve
// instead of a real cover when they detect a bot — not useful as posters.
const JUNK_IMAGE = /share-icons|previewdoh|sprite|logo[._-]|default[._-]|noimage|no-image/i;

function isJunkImage(url) {
  return !url || JUNK_IMAGE.test(url);
}

function extractMetaImage(html, baseUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try {
        return new URL(m[1], baseUrl).toString();
      } catch {
        return m[1];
      }
    }
  }
  return null;
}

async function posterFromOgImage(url) {
  const res = await timeoutFetch(url);
  if (!res.ok) return null;
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('html')) return null;
  const html = await res.text();
  return extractMetaImage(html, res.url || url);
}

async function resolvePoster(url) {
  const wiki = parseWikipedia(url);
  const poster = wiki ? await posterFromWikipedia(wiki) : await posterFromOgImage(url);
  return isJunkImage(poster) ? null : poster;
}

async function run() {
  const works = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const targets = works.filter(
    (w) => w.url && (FORCE || !w.poster),
  );
  console.log(`Resolving posters for ${targets.length} / ${works.length} works…`);

  let done = 0;
  let found = 0;
  const queue = [...targets];

  async function worker() {
    while (queue.length) {
      const work = queue.shift();
      try {
        const poster = await resolvePoster(work.url);
        work.poster = poster ?? null;
        if (poster) {
          found += 1;
        } else {
          console.warn(`  no image: ${work.title} (${work.url})`);
        }
      } catch (err) {
        console.warn(`  failed:   ${work.title} — ${err.message}`);
      }
      done += 1;
      if (done % 10 === 0) console.log(`  …${done}/${targets.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await writeFile(DATA_PATH, JSON.stringify(works, null, 2) + '\n', 'utf8');
  console.log(`Done. Found ${found} posters; wrote ${DATA_PATH}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
