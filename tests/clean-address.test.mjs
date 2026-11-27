import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAddress } from '../scripts/clean-address.mjs';

test('keeps the whole 条丁目 number of a Sapporo address', () => {
  assert.equal(cleanAddress('〒064-0822 北海道札幌市中央区北2条西28丁目1-26 エストラーダ円山2F'), '北海道札幌市中央区北2条西28丁目1-26');
  assert.equal(cleanAddress('北海道札幌市中央区南1条西16丁目291番地'), '北海道札幌市中央区南1条西16丁目291番地');
  assert.equal(cleanAddress('北海道帯広市西 20 条南 2 丁目 5 番 3 号'), '北海道帯広市西20条南2丁目5番3号');
  assert.equal(cleanAddress('北海道旭川市 4 条通 8 右 2 号ヒサコーポレーションビル 2F'), '北海道旭川市4条通8右2号');
});

test('drops the postal code, building and floor', () => {
  assert.equal(cleanAddress('〒105-0001 東京都港区虎ノ門3-17-7 虎ノ門平井ビル2階'), '東京都港区虎ノ門3-17-7');
  assert.equal(cleanAddress('北海道札幌市中央区南二条西 3-11-1 エルセントロ札幌 3F'), '北海道札幌市中央区南二条西3-11-1');
  assert.equal(cleanAddress('大阪府大阪市中央区南船場4-5-8 ラスターオン心斎橋9階'), '大阪府大阪市中央区南船場4-5-8');
  assert.equal(cleanAddress('〒530-0041 大阪府大阪市北区天神橋4丁目5-2 エンゼル天満301'), '大阪府大阪市北区天神橋4丁目5-2');
});

test('leaves an address without a number as it is', () => {
  assert.equal(cleanAddress('千葉県市川市加藤新田'), '千葉県市川市加藤新田');
  assert.equal(cleanAddress(''), '');
});
