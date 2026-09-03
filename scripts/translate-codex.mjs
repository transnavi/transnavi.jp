// Japanese -> English translation for the catalogue behind the /en mirror,
// through the local Codex CLI. A batch goes out as a JSON array and comes back
// through --output-schema, so the reply is a same-length array of strings and
// nothing has to be parsed out of prose.
//
// Only `gen-english.mjs --update` calls this; ordinary builds read the
// committed catalogue and make no model calls at all.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MODEL = process.env.TRANSNAVI_TRANSLATE_MODEL ?? 'gpt-5.6-terra';
const EFFORT = process.env.TRANSNAVI_TRANSLATE_EFFORT ?? 'low';

const SCHEMA = {
  type: 'object',
  properties: { translations: { type: 'array', items: { type: 'string' } } },
  required: ['translations'],
  additionalProperties: false,
};

// The site's own vocabulary, so a term reads the same on every page and in the
// glossary. Terms the glossary itself defines are appended from glossary.json.
const STYLE = `You translate a Japanese transgender health and rights website into English.

Each input is one string as it appears on the page: a UI label, a heading, a
sentence, a link title, a metadata field. Translate it for that place, not as
part of a document, and never merge or split entries.

Rules:
- Return exactly one translation per input, in the same order.
- Keep placeholders such as {0} and {1} unchanged and in a natural position.
- Keep URLs, numbers, and Latin-script names as they are.
- Romanize clinic, hospital, place and personal names in Hepburn rather than
  translating them word by word; keep a facility's own Latin-script name where
  the string shows one. 心のクリニック is a mental health clinic, 産婦人科 an
  obstetrics and gynecology clinic.
- 中国 among Japanese regions is the Chugoku region, not China.
- Write plain, factual English at the reading level of the Japanese. No added
  explanation, no hedging the Japanese does not have, no marketing tone.
- Sentence case everywhere, headings and page titles included: capitalize the
  first word and proper nouns only. Never Title Case A Heading.
- Medical and legal terms follow the site's vocabulary below.`;

const CORE_TERMS = [
  ['とらんすナビ', 'TransNavi'],
  ['性別違和', 'gender dysphoria'],
  ['性別不合', 'gender incongruence'],
  ['性同一性障害', 'gender identity disorder (the older legal term)'],
  ['性自認', 'gender identity'],
  ['性的指向', 'sexual orientation'],
  ['ホルモン療法', 'hormone therapy'],
  ['性別適合ホルモン療法', 'gender-affirming hormone therapy (GAHT)'],
  ['性別適合手術', 'gender-affirming surgery (SRS)'],
  ['フラホル', 'DIY HRT'],
  ['女性化', 'feminization'],
  ['男性化', 'masculinization'],
  ['当事者', 'trans people themselves; first-person when describing an account'],
  ['特例法', 'the Act on Special Cases (legal gender change)'],
  ['戸籍', 'family register'],
  ['診断書', 'medical certificate'],
  ['妊よう性', 'fertility'],
  ['アウティング', 'outing'],
  ['日本GI（性別不合）学会', 'Japan Society of Gender Incongruence'],
];

const glossaryTerms = () => {
  const file = 'src/data/glossary.json';
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'))
    .map((entry) => [entry.term, entry.translations?.en])
    .filter(([, english]) => english);
};

// Only the terms a batch actually contains, so the prompt stays small.
function vocabularyFor(values) {
  const text = values.join('\n');
  const terms = [...CORE_TERMS, ...glossaryTerms()].filter(([japanese]) => text.includes(japanese));
  return terms.length ? `\n\nVocabulary:\n${terms.map(([ja, en]) => `- ${ja} = ${en}`).join('\n')}` : '';
}

function runCodex(prompt) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transnavi-translate-'));
  const schemaFile = path.join(dir, 'schema.json');
  const outputFile = path.join(dir, 'out.json');
  fs.writeFileSync(schemaFile, JSON.stringify(SCHEMA));
  const args = [
    'exec',
    '--model', MODEL,
    '-c', `model_reasoning_effort=${EFFORT}`,
    '--sandbox', 'read-only',
    '--ephemeral',
    '--skip-git-repo-check',
    '--output-schema', schemaFile,
    '-o', outputFile,
    '-',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      try {
        if (code !== 0) throw new Error(`codex exited ${code}: ${stderr.trim().split('\n').slice(-3).join(' ')}`);
        resolve(JSON.parse(fs.readFileSync(outputFile, 'utf8')));
      } catch (error) {
        reject(error);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    child.stdin.end(prompt);
  });
}

// One batch, retried on a transport error or a reply of the wrong length; a
// batch that keeps coming back wrong is split, down to single strings.
export async function translateBatch(values, attempt = 0) {
  const prompt = `${STYLE}${vocabularyFor(values)}\n\nInput (JSON array of ${values.length} strings):\n${JSON.stringify(values, null, 1)}`;
  try {
    const { translations } = await runCodex(prompt);
    if (!Array.isArray(translations) || translations.length !== values.length) {
      throw new Error(`expected ${values.length} translations, got ${translations?.length}`);
    }
    if (translations.some((value) => typeof value !== 'string' || !value.trim())) throw new Error('empty translation');
    return translations;
  } catch (error) {
    if (attempt < 2) return translateBatch(values, attempt + 1);
    if (values.length === 1) throw error;
    const half = Math.ceil(values.length / 2);
    const [left, right] = await Promise.all([translateBatch(values.slice(0, half)), translateBatch(values.slice(half))]);
    return [...left, ...right];
  }
}

export const translationModel = () => `${MODEL} (effort ${EFFORT})`;
