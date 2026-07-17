import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDriveDownloadFiles } from '../src/quark/driveDownload.js';

test('自己网盘按 fid 批量取直链', async () => {
  const files = [
    { fid: 'a', file_name: 'a.txt', size: 1, path: '' },
    { fid: 'b', file_name: 'b.txt', size: 2, path: 'sub' },
  ];
  const result = await fetchDriveDownloadFiles(files, {
    getDownloadLinks: async (fids) => {
      assert.deepEqual(fids, ['a', 'b']);
      return [
        { fid: 'a', file_name: 'a.txt', size: 1, download_url: 'https://dl/a' },
        { fid: 'b', file_name: 'b.txt', size: 2, download_url: 'https://dl/b' },
      ];
    },
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].url, 'https://dl/a');
  assert.equal(result[1].path, 'sub');
});
