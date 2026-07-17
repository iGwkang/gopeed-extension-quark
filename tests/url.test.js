import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShareUrl } from '../src/quark/url.js';

test('解析 shareId 与 passcode', () => {
  const r = parseShareUrl('https://pan.quark.cn/s/abc123xyz?pwd=ab12');
  assert.equal(r.shareId, 'abc123xyz');
  assert.equal(r.passcode, 'ab12');
  assert.equal(r.pdirFid, '');
});

test('解析 hash 子目录', () => {
  const r = parseShareUrl('https://pan.quark.cn/s/abc123xyz#/list/share/fid999');
  assert.equal(r.shareId, 'abc123xyz');
  assert.equal(r.pdirFid, 'fid999');
});

test('无效链接抛错', () => {
  assert.throws(() => parseShareUrl('https://example.com/x'), /分享/);
});
