import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDriveFiles } from '../src/quark/driveWalk.js';

test('自己网盘递归收集并保留 path', async () => {
  const pages = {
    root: [
      { fid: 'd1', file_name: 'sub', dir: true },
      { fid: 'f1', file_name: 'a.txt', size: 1, dir: false },
    ],
    d1: [{ fid: 'f2', file_name: 'b.txt', size: 2, dir: false }],
  };
  async function fetchPage(pdir) {
    const key = pdir === 'root' || pdir === '0' ? 'root' : pdir;
    return { list: pages[key] || [] };
  }
  const { files } = await collectDriveFiles({
    dirFid: 'root',
    fetchPage,
  });
  assert.equal(files.length, 2);
  assert.equal(files.find((f) => f.file_name === 'a.txt').path, '');
  assert.equal(files.find((f) => f.file_name === 'b.txt').path, 'sub');
});

test('二级目录入口可直接从目标 fid 开始收集', async () => {
  async function fetchPage(pdir) {
    if (pdir === '036db22de87b453d84773c2da9ecd5b3') {
      return {
        list: [
          {
            fid: 'f1',
            file_name: 'inner.bin',
            size: 3,
            dir: false,
          },
        ],
      };
    }
    return { list: [] };
  }
  const { files } = await collectDriveFiles({
    dirFid: '036db22de87b453d84773c2da9ecd5b3',
    fetchPage,
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].file_name, 'inner.bin');
  assert.equal(files[0].path, '');
});
