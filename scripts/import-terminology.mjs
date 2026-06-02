import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const sourcePath = join('..', 'Next-MtF-wiki', 'source', 'data', 'terminology.tsv');
const outputPath = join('src', 'data', 'glossary.json');

function splitList(value) {
  if (!value) return [];
  return value
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
}

const categoryLabels = {
  hrt: 'ホルモン療法',
  identity: '性自認・属性',
  social: '生活・社会',
  surgery: '手術',
  voice: '声',
  'hair-removal': '脱毛',
  medical: '医療',
  legal: '法律・制度',
  lab: '検査',
  misc: 'その他',
};

const tsv = await readFile(sourcePath, 'utf8');
const [headerLine, ...lines] = tsv.trim().split('\n');
const headers = headerLine.split('\t');

const entries = lines
  .map((line) => {
    const values = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  })
  .filter((row) => row.id && row.ja)
  .map((row) => ({
    id: row.id,
    term: row.ja,
    abbr: row.abbr || undefined,
    category: categoryLabels[row.category] ?? row.category ?? 'その他',
    wikidata: row.wikidata || undefined,
    translations: {
      en: row.en || undefined,
      zhHans: row['zh-cn'] || undefined,
      zhHant: row['zh-hant'] || undefined,
      es: row.es || undefined,
    },
    aliases: splitList(row['aliases-ja']),
    avoid: splitList(row.avoid),
    disputed: splitList(row.disputed),
    notes: row.notes || undefined,
    source: row.source || undefined,
  }))
  .sort((a, b) => a.term.localeCompare(b.term, 'ja'));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`);

console.log(`Imported ${entries.length} glossary entries to ${outputPath}`);
