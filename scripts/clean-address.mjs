// The part of a Japanese address a geocoder can resolve: prefecture through the
// last block or lot number, without the postal code, building name or floor.
//
// The number part is read as a run of numerals and the words that join them, so
// 「北2条西28丁目1-26」 and 「4条通8右2号」 stay whole. Stopping at the first
// numeral would cut 「北2条…」 to 「北2」 and pin the address a few kilometres off.
const NUMBER = '[0-9０-９]+';
const JOIN = '(?:条|丁目|番地|番|号|線|通|[東西南北右左のノ]|[-‐－−])';

export function cleanAddress(addr) {
  if (!addr) return '';
  const body = addr
    .replace(/^\s*〒?\s*[0-9０-９]{3}[-‐－ー−]?[0-9０-９]{4}\s*/, '')
    .replace(/\s+/g, '');
  const m = body.match(new RegExp(`^.*?${NUMBER}(?:${JOIN}*${NUMBER})*(?:丁目|番地|番|号)?`));
  return m ? m[0] : body;
}
