import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertHasParsedFiles,
  buildChunks,
  matchDownloadLinks,
} from '../src/quark/transfer.js';

test('跳过超过 maxChunkSize 的文件，其余按体积分批', () => {
  const files = [
    { fid: '1', file_name: 'big', size: 160, share_fid_token: 't' },
    { fid: '2', file_name: 'a', size: 10, share_fid_token: 't' },
    { fid: '3', file_name: 'b', size: 20, share_fid_token: 't' },
    { fid: '4', file_name: 'c', size: 140, share_fid_token: 't' },
  ];
  // available=200, buffer=50 → maxChunkSize=150
  const { chunks, skippedCount } = buildChunks(files, 200, true, 50, 50);
  assert.equal(skippedCount, 1);
  assert.equal(chunks.length, 2);
  assert.deepEqual(
    chunks[0].map((f) => f.fid),
    ['2', '3'],
  );
  assert.deepEqual(
    chunks[1].map((f) => f.fid),
    ['4'],
  );
});

test('容量未知时按 defaultCount 切批', () => {
  const files = Array.from({ length: 5 }, (_, i) => ({
    fid: String(i),
    file_name: `f${i}`,
    size: 1,
    share_fid_token: 't',
  }));
  const { chunks, skippedCount } = buildChunks(files, -1, true, 50, 2);
  assert.equal(skippedCount, 0);
  assert.equal(chunks.length, 3);
});

test('关闭删除时按累计容量跳过溢出文件及后续文件', () => {
  const files = [
    { fid: '1', file_name: 'a', size: 60 },
    { fid: '2', file_name: 'b', size: 50 },
    { fid: '3', file_name: 'c', size: 10 },
  ];

  const { chunks, skippedCount } = buildChunks(files, 150, false, 50, 50);

  assert.equal(skippedCount, 2);
  assert.equal(chunks.length, 1);
  assert.deepEqual(
    chunks[0].map((file) => file.fid),
    ['1'],
  );
});

test('取链先完成全部精确匹配，再按大小匹配且不盲目位置兜底', () => {
  const files = [
    { file_name: 'first', size: 10 },
    { file_name: 'exact', size: 10 },
    { file_name: 'last', size: 30 },
  ];
  const links = [
    { file_name: 'exact', size: 10, download_url: 'exact-url' },
    { file_name: 'other', size: 10, download_url: 'size-url' },
    { file_name: 'fallback', size: 99, download_url: 'position-url' },
  ];

  const matchedLinks = matchDownloadLinks(files, links);

  assert.deepEqual(
    matchedLinks.map((link) => link?.download_url),
    ['size-url', 'exact-url', undefined],
  );
});

test('名称和大小均不匹配时不按位置错配直链', () => {
  const matchedLinks = matchDownloadLinks(
    [{ file_name: 'wanted', size: 10 }],
    [{ file_name: 'wrong', size: 99, download_url: 'wrong-url' }],
  );

  assert.deepEqual(matchedLinks, [undefined]);
});

test('所有批次均未生成有效直链时抛出中文错误', () => {
  assert.throws(
    () => assertHasParsedFiles([]),
    /提取失败，转存任务未生成有效直链/,
  );
});
