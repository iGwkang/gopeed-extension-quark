import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChunks } from '../src/quark/transfer.js';

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
