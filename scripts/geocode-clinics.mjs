// Incremental geocoder: fill/upgrade { lat, lng, geoSource } on clinics in
// clinics.json.
//
// Addresses are read by @geolonia/normalize-japanese-addresses, which matches
// them against the national town and residence data instead of guessing where
// the number part ends (「北2条西28丁目1-26」, 「間之町通押小路上る鍵屋町481」).
// A match down to the house number carries its own coordinates. A match down
// to the town is completed by the GSI (Geospatial Information Authority of
// Japan) address search, and the two answers are compared: when they disagree
// the entry is reported and left as it was.
//
// Safe to re-run: OVERSEAS clinics (a `country` field) are skipped entirely.
// Domestic clinics already at street level ('address') are also skipped unless
// `--force`, so a normal run only fills gaps and upgrades approximate pins.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalize } from '@geolonia/normalize-japanese-addresses';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/data/clinics.json');
const clinics = JSON.parse(readFileSync(file, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resilient single query: retry a few times on transient network/HTTP errors
// with backoff, so one hiccup doesn't abort a whole --force run. Returns null
// when the address can't be resolved (distinct from a thrown error).
async function geocode(q) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'transnavi-geocode/1.0' } });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) { await sleep(800 * (attempt + 1)); continue; }
        return null;
      }
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.geometry?.coordinates) {
        const [lng, lat] = data[0].geometry.coordinates;
        return { lat, lng, title: data[0].properties?.title ?? '' };
      }
      return null;
    } catch {
      await sleep(800 * (attempt + 1)); // transient network error — back off and retry
    }
  }
  return null;
}

const force = process.argv.includes('--force');

const km = (a, b) => {
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Farther apart than this, the town the library matched and the place GSI
// found are not the same address.
const AGREE_KM = 1.5;

// { lat, lng, level } for one clinic, or { review } when the sources disagree.
async function locate(c) {
  // The postal code is not part of the address the library reads.
  const text = (c.address ?? '').replace(/^\s*〒?\s*[0-9０-９]{3}[-‐－ー−]?[0-9０-９]{4}/, '').replace(/\s+/g, '');
  const parsed = text ? await normalize(text) : null;
  if (parsed?.point && parsed.level >= 8) return { lat: parsed.point.lat, lng: parsed.point.lng, level: 'address' };
  if (parsed?.point && parsed.level >= 3) {
    const hit = await geocode(`${parsed.pref}${parsed.city}${parsed.town}${parsed.addr ?? ''}${parsed.other ?? ''}`);
    await sleep(120);
    if (hit && km(hit, parsed.point) <= AGREE_KM) return { lat: hit.lat, lng: hit.lng, level: 'address' };
    if (hit) return { review: `read as ${parsed.town}, but GSI places it ${km(hit, parsed.point).toFixed(1)} km away at ${hit.title}` };
    return { lat: parsed.point.lat, lng: parsed.point.lng, level: 'town' };
  }
  for (const [q, level] of [[text, 'address'], [[c.prefecture, c.city].filter(Boolean).join(''), 'city'], [c.prefecture, 'prefecture']]) {
    if (!q) continue;
    const hit = await geocode(q);
    await sleep(120);
    if (hit) return { lat: hit.lat, lng: hit.lng, level };
  }
  return null;
}

const RANK = { address: 3, town: 2, city: 1, prefecture: 0 };
let ok = 0, approx = 0, fail = 0, skipped = 0, review = 0;
for (const c of clinics) {
  // Never geocode overseas facilities: both sources only know Japan.
  if (c.country) { skipped++; continue; }
  // Skip clinics already pinned to a street address unless forced.
  if (!force && c.geoSource === 'address') { skipped++; continue; }

  const found = await locate(c);
  const hadCoords = typeof c.lat === 'number' && typeof c.lng === 'number';
  if (found?.review) {
    review++;
    console.log('REVIEW', c.id, c.address, '—', found.review);
  } else if (found && (!hadCoords || RANK[found.level] >= (RANK[c.geoSource] ?? -1))) {
    // Never trade an existing pin for a coarser one.
    c.lat = Number(found.lat.toFixed(6));
    c.lng = Number(found.lng.toFixed(6));
    c.geoSource = found.level;
    if (found.level === 'address') ok++; else approx++;
  } else if (!found && !hadCoords) {
    fail++;
    console.log('FAIL', c.id, c.prefecture, c.city, c.address);
  } else {
    skipped++;
  }
}

writeFileSync(file, JSON.stringify(clinics, null, 2) + '\n');
console.log(`done: ${ok} at address level, ${approx} approximate, ${review} to review, ${fail} failed, ${skipped} skipped/kept, of ${clinics.length}`);
