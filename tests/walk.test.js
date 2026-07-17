import test from 'node:test';
import assert from 'node:assert/strict';
import { collectShareFiles } from '../src/quark/walk.js';

test('递归收集并保留 path', async () => {
  const pages = {
    '': [{ fid: 'd1', file_name: 'sub', dir: true }, { fid: 'f1', file_name: 'a.txt', size: 1, dir: false, share_fid_token: 't1' }],
    d1: [{ fid: 'f2', file_name: 'b.txt', size: 2, dir: false, share_fid_token: 't2' }],
  };
  async function fetchPage(_s, _t, pdir) {
    return { list: pages[pdir || ''] || [] };
  }
  const { files } = await collectShareFiles({
    shareId: 's',
    stoken: 'st',
    pdirFid: '',
    maxCount: 0,
    fetchPage,
  });
  assert.equal(files.length, 2);
  assert.equal(files.find((f) => f.file_name === 'a.txt').path, '');
  assert.equal(files.find((f) => f.file_name === 'b.txt').path, 'sub');
});

test('根目录仅有单个文件夹时展开，避免与任务名叠成双层目录', async () => {
  const pages = {
    '': [{ fid: 'root-dir', file_name: 'ForzaHorizon6', dir: true }],
    'root-dir': [
      { fid: 'f1', file_name: 'game.iso', size: 10, dir: false, share_fid_token: 't1' },
      { fid: 'd2', file_name: 'DLC', dir: true },
    ],
    d2: [{ fid: 'f2', file_name: 'dlc.bin', size: 2, dir: false, share_fid_token: 't2' }],
  };
  async function fetchPage(_s, _t, pdir) {
    return { list: pages[pdir || ''] || [] };
  }
  const { files, suggestedName } = await collectShareFiles({
    shareId: 's',
    stoken: 'st',
    fetchPage,
  });
  assert.equal(suggestedName, 'ForzaHorizon6');
  assert.equal(files.length, 2);
  assert.equal(files.find((f) => f.file_name === 'game.iso').path, '');
  assert.equal(files.find((f) => f.file_name === 'dlc.bin').path, 'DLC');
});

test('maxCount 截断', async () => {
  async function fetchPage() {
    return {
      list: [
        { fid: '1', file_name: 'a', size: 1, dir: false, share_fid_token: 't' },
        { fid: '2', file_name: 'b', size: 1, dir: false, share_fid_token: 't' },
      ],
    };
  }
  const { files } = await collectShareFiles({
    shareId: 's',
    stoken: 'st',
    maxCount: 1,
    fetchPage,
  });
  assert.equal(files.length, 1);
});
