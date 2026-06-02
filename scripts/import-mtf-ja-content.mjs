import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const sourceRoot = join('..', 'MtF-wiki', 'content', 'ja');
const outputRoot = join('src', 'content', 'imported', 'mtf-wiki-ja');
const skipNames = new Set(['_index.md']);
const skipPaths = new Set(['about/disclaimer.md']);
const skipPathParts = new Set(['hrt', 'psyco']);

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(path);
      if (entry.isFile() && entry.name.endsWith('.md') && !skipNames.has(entry.name)) return [path];
      return [];
    }),
  );
  return files.flat();
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: markdown };
  const data = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return { data, body: markdown.slice(match[0].length) };
}

function cleanupText(text) {
  return text
    .replaceAll('{{< mtf-wiki >}}', 'MtF.wiki')
    .replace(/{{<\s*telephone\s+"([^"]+)"\s*>}}/g, '$1')
    .replace(/{{<\s*alert[^>]*>}}/g, '')
    .replace(/{{<\s*\/alert\s*>}}/g, '')
    .replace(/{{<\s*hint[^>]*>}}/g, '')
    .replace(/{{<\s*\/hint\s*>}}/g, '')
    .replace(/{{<\s*([^>]+)\s*>}}/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function escapeFrontmatter(value) {
  return String(value).replaceAll('"', '\\"');
}

function categoryFromPath(path) {
  if (path.includes('/docs/medicine/')) return '医療情報';
  if (path.includes('/docs/srs/')) return '手術';
  if (path.includes('/docs/')) return '基礎情報';
  if (path.includes('/about/')) return 'サイト情報';
  return '資料';
}

await rm(outputRoot, { recursive: true, force: true });

const files = await listMarkdownFiles(sourceRoot);
let count = 0;

for (const file of files) {
  const relativeSource = relative(sourceRoot, file).split('/').join('/');
  if (skipPaths.has(relativeSource)) continue;
  if (relativeSource.split('/').some((part) => skipPathParts.has(part))) continue;

  const markdown = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(markdown);
  const title = data.title || relativeSource.replace(/\.md$/, '');
  const cleanedBody = cleanupText(body);
  if (!cleanedBody) continue;

  const outputPath = join(outputRoot, relativeSource.replace(/\.md$/, '.md'));
  const sourcePath = `content/ja/${relativeSource}`;
  const frontmatter = [
    '---',
    `title: "${escapeFrontmatter(title)}"`,
    `description: "MtF.wiki 日本語版から取り込んだ${categoryFromPath(sourcePath)}です。"`,
    'sourceProject: "MtF.wiki"',
    `sourcePath: "${escapeFrontmatter(sourcePath)}"`,
    'sourceLicense: "CC BY-SA 4.0"',
    `sourceCategory: "${categoryFromPath(sourcePath)}"`,
    'importedAt: 2026-05-31',
    'reviewStatus: needs-review',
    '---',
    '',
  ].join('\n');

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${frontmatter}${cleanedBody}\n`);
  count += 1;
}

console.log(`Imported ${count} non-clinic pages to ${outputRoot}`);
