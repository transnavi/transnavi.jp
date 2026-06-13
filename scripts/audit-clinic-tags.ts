// Audit: show every derived clinic capability tag next to the source text that
// triggered it, and flag snippets whose context looks like the clinic does NOT
// actually offer it (negation / referral-only / educational / conditional), or
// keyword mentions that produced NO tag (possible misses). Run: bun run scripts/audit-clinic-tags.ts
import { readFileSync } from 'node:fs';
import { capabilitiesOf, CAPABILITY_LABELS, type Capability } from '../src/utils/clinic-genre.ts';
import type { Clinic } from '../src/types/clinic.ts';

const clinics = JSON.parse(readFileSync(new URL('../src/data/clinics.json', import.meta.url), 'utf8')) as Clinic[];

// Keyword regex per capability (mirrors clinic-genre.ts) so we can locate the
// text that justifies each tag and show its surrounding context.
const KW: Partial<Record<Capability, RegExp>> = {
  'gaht-feminizing': /(ＭＴＦ|MTF|MtF|mtf|男性から女性|女性化ホルモン|女性ホルモン)/g,
  'gaht-masculinizing': /(ＦＴＭ|FTM|FtM|ftm|女性から男性|男性化ホルモン|男性ホルモン)/g,
  'surgery-vaginoplasty': /(造腟|造膣|腟形成|膣形成)/g,
  'surgery-orchiectomy': /(睾丸摘出|精巣摘出|睾丸切除|精巣切除|精巣摘除|除睾|去勢)/g,
  'surgery-phalloplasty': /(陰茎形成|陰茎再建)/g,
  'surgery-hysterectomy': /(子宮摘出|卵巣摘出|子宮全摘|内性器摘出)/g,
  'surgery-mastectomy': /(乳房切除|乳腺摘出|胸オペ)/g,
  'surgery-breast': /(豊胸|豊乳|乳房増大|バストアップ)/g,
  'surgery-vfs': /(ＶＦＳ|VFS|声の(女性化)?手術|音声の?手術|声帯手術)/g,
  'surgery-ffs': /(ＦＦＳ|FFS|顔面女性化|顔の女性化)/g,
};

// Context markers that suggest the mention is NOT a claim of offering the service.
const SUSPICIOUS =
  /(行わ(ず|ない|ぬ)|行いません|行っていな|なし|無し|不要|せず|しな(い|いで)|しません|していな|できません|できない|対応していな|扱っていな|要しない|他院|紹介|転院|とは|について|という|場合は|希望|わからない|不明|未確認|ではありません|ません。)/;

// Keywords that, if present but UN-tagged, may be a missed capability. `cap` is
// the tag that already covers it — if present, the mention is not a miss.
const MISSABLE: { label: string; cap: Capability; re: RegExp }[] = [
  { label: 'orchiectomy?', cap: 'surgery-orchiectomy', re: /精巣切除|精巣摘除|睾丸切除|除睾/g },
  { label: 'vaginoplasty?', cap: 'surgery-vaginoplasty', re: /膣造設|腟造設|外陰形成/g },
  { label: 'mastectomy?', cap: 'surgery-mastectomy', re: /乳房形成|胸の手術|乳房手術/g },
  { label: 'breast?', cap: 'surgery-breast', re: /胸を大きく|バスト/g },
];

const snippet = (text: string, idx: number, len: number) =>
  text.slice(Math.max(0, idx - 14), idx + len + 14).replace(/\n+/g, ' ').trim();

let flagged = 0;
let tagCount = 0;
for (const c of clinics) {
  const text = `${c.notes ?? ''} ${c.services.join(' ')}`;
  const caps = capabilitiesOf(c);
  const lines: string[] = [];
  for (const cap of caps) {
    tagCount++;
    const re = KW[cap];
    if (!re) {
      lines.push(`    [${CAPABILITY_LABELS[cap]}] (services/id-derived — no text keyword)`);
      continue;
    }
    re.lastIndex = 0;
    const hits: string[] = [];
    let suspicious = false;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const ctx = snippet(text, m.index, m[0].length);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
      const flag = SUSPICIOUS.test(after) || SUSPICIOUS.test(ctx);
      if (flag) suspicious = true;
      hits.push(`「…${ctx}…」${flag ? '  ⚠' : ''}`);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (hits.length === 0) {
      lines.push(`    [${CAPABILITY_LABELS[cap]}] ⚠ tag set but keyword not found in text (services/id?)`);
    } else if (suspicious) {
      lines.push(`    [${CAPABILITY_LABELS[cap]}] ⚠ SUSPICIOUS context:`);
      for (const h of hits) lines.push(`        ${h}`);
    }
  }
  // Possible missed capabilities (keyword present, no tag, not negated/speculative).
  for (const { label, cap, re } of MISSABLE) {
    if (caps.includes(cap)) continue; // already covered
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && !SUSPICIOUS.test(text.slice(m.index + m[0].length, m.index + m[0].length + 14))) {
      lines.push(`    [miss? ${label}] 「…${snippet(text, m.index, m[0].length)}…」`);
    }
  }
  if (lines.length) {
    flagged++;
    console.log(`\n● ${c.id} — ${c.name}`);
    for (const l of lines) console.log(l);
  }
}
console.log(`\n— audited ${clinics.length} clinics, ${tagCount} tags; flagged ${flagged} clinics for review —`);
