// Variable parts of a rendered string — counts, dates and phone numbers —
// change with the data but never with the language, so they are lifted out of
// the English catalogue key. 「153件」 and 「154件」 share one entry, and adding
// a clinic no longer leaves a string untranslated. House numbers stay put — an
// address is content, and is translated whole.
const ISO_DATE = /(?<![\d-])\d{4}-\d{2}-\d{2}(?![\d-])/;
const COUNT = /\d[\d,]*(?=\s?(?:件|語|サイト|ページ|人|団体|校|冊))/;
const PHONE = /(?<![\d-])\d{2,4}-\d{2,4}-\d{3,4}(?![\d-])/;
const PHONE_LINE = /^(?:電話|TEL|Tel)/;
const SENTENCE = /。/;

// A count is a counter's reading only outside running prose: 「154件」 in a
// filter bar varies with the data, while a figure quoted inside a sentence is
// part of what the sentence says. Phone numbers are read only from a line that
// announces one, so a house number is never mistaken for one. Japanese dates
// keep their own entries, since English writes them as September 1, 2026.
export const variablePattern = (value) => {
  const parts = [ISO_DATE];
  if (!SENTENCE.test(value)) parts.push(COUNT);
  if (PHONE_LINE.test(value)) parts.push(PHONE);
  return new RegExp(parts.map((part) => part.source).join('|'), 'g');
};

// { template, values } for a string with variable parts, else null. A bare 1
// keeps its own entry, because English needs the singular beside the plural
// ("1 word" / "{0} words"), and a string that is nothing but a date keeps its
// entry too, so 2026年9月1日 can still be rendered as September 1, 2026.
export function templatize(value) {
  const values = [];
  const template = value.replace(variablePattern(value), (match) => `{${values.push(match) - 1}}`);
  if (!values.length || values.includes('1')) return null;
  if (!template.replace(/\{\d+\}/g, '').trim()) return null;
  return { template, values };
}

export const fillTemplate = (template, values) =>
  template.replace(/\{(\d+)\}/g, (match, index) => values[Number(index)] ?? match);

// The catalogue key a rendered string is stored under.
export const catalogKeyOf = (value) => templatize(value)?.template ?? value;

// Put the placeholders back into a translated sample, so one translated
// sentence serves every value. Null when a value did not survive translation,
// in which case the sample is stored as it is.
export function retemplatize(translated, values) {
  let out = translated;
  for (const [index, value] of values.entries()) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const at = new RegExp(`(?<![\\d,])${escaped}(?![\\d,])`);
    if (!at.test(out)) return null;
    out = out.replace(at, `{${index}}`);
  }
  return out;
}
