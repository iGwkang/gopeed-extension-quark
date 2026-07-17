import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDriveListHash,
  parseQuarkUrl,
  parseShareUrl,
} from '../src/quark/url.js';

test('解析 shareId 与 passcode', () => {
  const r = parseShareUrl('https://pan.quark.cn/s/abc123xyz?pwd=ab12');
  assert.equal(r.shareId, 'abc123xyz');
  assert.equal(r.passcode, 'ab12');
  assert.equal(r.pdirFid, '');
});

test('解析分享 hash 子目录', () => {
  const r = parseShareUrl('https://pan.quark.cn/s/abc123xyz#/list/share/fid999');
  assert.equal(r.shareId, 'abc123xyz');
  assert.equal(r.pdirFid, 'fid999');
});

test('无效链接抛错', () => {
  assert.throws(() => parseShareUrl('https://example.com/x'), /分享|夸克/);
});

test('解析一级自己网盘目录', () => {
  const r = parseQuarkUrl(
    'https://pan.quark.cn/list#/list/all/ac4895e82db441e886c2a40c5543393a-0000temp',
  );
  assert.equal(r.type, 'drive');
  assert.equal(r.dirFid, 'ac4895e82db441e886c2a40c5543393a');
  assert.equal(r.dirName, '0000temp');
});

test('解析二级自己网盘目录，取最后一级 fid', () => {
  const url =
    'https://pan.quark.cn/list#/list/all/' +
    'c1d9577233b4425b8604dec5b0164769-GopeedTemp/' +
    '036db22de87b453d84773c2da9ecd5b3-%E6%96%B0%E5%BB%BA%E6%96%87%E4%BB%B6%E5%A4%B9*101260717*101215116675';
  const r = parseQuarkUrl(url);
  assert.equal(r.type, 'drive');
  assert.equal(r.dirFid, '036db22de87b453d84773c2da9ecd5b3');
  assert.equal(r.dirName, '新建文件夹');
});

test('parseDriveListHash 根目录', () => {
  assert.deepEqual(parseDriveListHash('#/list/all'), {
    dirFid: '0',
    dirName: '',
  });
});
