import test from 'node:test';
import assert from 'node:assert/strict';

test('handleResolve 编排分享解析并写入带扩展标签的文件请求', async () => {
  const { createResolveHandler } = await import('../src/quark/resolve.js');
  const calls = [];
  const handler = createResolveHandler({
    getEffectiveCookie: () => '__puus=abc; k=v',
    assertCookieConfigured: (cookie) => calls.push(['cookie', cookie]),
    parseShareUrl: (url) => {
      calls.push(['url', url]);
      return { shareId: 'share-1', passcode: '4321', pdirFid: 'dir-1' };
    },
    apiGetToken: async () => ({ stoken: 'st-1', title: '分享标题' }),
    collectShareFiles: async (options) => {
      calls.push(['walk', options]);
      return [{ fid: 'sf-1', file_name: 'a.txt', size: 12 }];
    },
    apiGetAvailableSpace: async () => 1024,
    processSmartChunks: async (options) => {
      calls.push(['transfer', options]);
      return {
        finalParsedFiles: [{
          name: 'a.txt',
          size: 12,
          path: '目录',
          url: 'https://download/a',
          shareFid: 'sf-1',
          shareFidToken: 'sft-1',
          savedFid: 'saved-1',
        }],
      };
    },
  });
  const ctx = {
    req: { rawUrl: 'https://pan.quark.cn/s/share-1?pwd=4321' },
    res: null,
  };
  globalThis.gopeed = {
    settings: { max_file_count: '20', delete_file: '1' },
    logger: { info() {}, error() {} },
  };

  await handler(ctx);

  assert.deepEqual(calls[0], ['cookie', '__puus=abc; k=v']);
  assert.equal(calls.find(([name]) => name === 'walk')[1].maxCount, 20);
  assert.equal(calls.find(([name]) => name === 'transfer')[1].shouldDelete, true);
  assert.equal(ctx.res.name, '分享标题');
  assert.deepEqual(ctx.res.files[0].req.labels, {
    'Gwkang@gopeed-extension-quark': '1',
    shareId: 'share-1',
    stoken: 'st-1',
    shareFid: 'sf-1',
    shareFidToken: 'sft-1',
    fid: 'saved-1',
  });
  assert.equal(ctx.res.files[0].req.extra.header.Cookie, '__puus=abc; k=v');
});

test('isDownloadUrlExpired 根据 Expires 和 Range 探活判断', async () => {
  const { isDownloadUrlExpired } = await import('../src/quark/start.js');
  const nowSeconds = Math.floor(Date.now() / 1000);
  let probeCalls = 0;

  assert.equal(
    await isDownloadUrlExpired(
      `https://download/a?Expires=${nowSeconds - 1}`,
      {},
      async () => {
        probeCalls += 1;
        return 206;
      },
    ),
    true,
  );
  assert.equal(probeCalls, 0);

  assert.equal(
    await isDownloadUrlExpired(
      `https://download/a?Expires=${nowSeconds + 60}`,
      { Cookie: 'x=1' },
      async (_url, headers) => {
        probeCalls += 1;
        assert.equal(headers.Range, 'bytes=0-0');
        return 206;
      },
    ),
    false,
  );
});

test('handleStart 优先使用保留的 fid 刷新直链', async () => {
  const { createStartHandler } = await import('../src/quark/start.js');
  let saveCalled = false;
  const handler = createStartHandler({
    isDownloadUrlExpired: async () => true,
    apiGetDownloadLinks: async (fids) => {
      assert.deepEqual(fids, ['saved-1']);
      return [{ download_url: 'https://download/refreshed' }];
    },
    apiSaveFiles: async () => {
      saveCalled = true;
    },
  });
  const ctx = {
    task: {
      meta: {
        req: {
          url: 'https://download/expired',
          labels: { fid: 'saved-1' },
        },
      },
    },
  };

  await handler(ctx);

  assert.equal(ctx.task.meta.req.url, 'https://download/refreshed');
  assert.equal(saveCalled, false);
});

test('handleStart 在 fid 不可用时单文件重转存、取链并清理', async () => {
  const { createStartHandler } = await import('../src/quark/start.js');
  const calls = [];
  globalThis.gopeed = {
    settings: { delete_file: '1' },
    logger: { warn() {}, error() {} },
  };
  const handler = createStartHandler({
    isDownloadUrlExpired: async () => true,
    apiGetDownloadLinks: async (fids) => {
      calls.push(['download', fids]);
      if (fids[0] === 'old-fid') throw new Error('旧文件不存在');
      return [{ download_url: 'https://download/new', fid: 'new-fid' }];
    },
    ensureGopeedTempFid: async () => 'temp-fid',
    apiSaveFiles: async (...args) => {
      calls.push(['save', args]);
      return 'task-1';
    },
    apiPollTask: async () => ['new-fid'],
    apiDeleteFiles: async (fids) => calls.push(['delete', fids]),
  });
  const req = {
    url: 'https://download/expired',
    labels: {
      shareId: 'share-1',
      stoken: 'st-1',
      shareFid: 'share-fid-1',
      shareFidToken: 'share-token-1',
      fid: 'old-fid',
    },
  };

  await handler({ task: { meta: { req } } });

  assert.deepEqual(calls.find(([name]) => name === 'save')[1], [
    'share-1',
    'st-1',
    ['share-fid-1'],
    ['share-token-1'],
    'temp-fid',
  ]);
  assert.deepEqual(calls.find(([name]) => name === 'delete')[1], ['new-fid']);
  assert.equal(req.url, 'https://download/new');
  assert.equal(req.labels.fid, 'new-fid');
});
