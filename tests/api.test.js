import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuarkApi } from '../src/quark/api.js';

test('apiGetToken 将 shareId 映射为 pwd_id', async () => {
  const calls = [];
  const api = createQuarkApi(async (...args) => {
    calls.push(args);
    return { code: 0, data: { stoken: 'token-1' } };
  });

  const data = await api.apiGetToken('share-1', '1234');

  assert.deepEqual(data, { stoken: 'token-1' });
  assert.deepEqual(calls[0][2], {
    pwd_id: 'share-1',
    passcode: '1234',
  });
});

test('apiGetToken 对 31001 和 31002 返回中文错误', async (t) => {
  await t.test('31001 提示需要提取码', async () => {
    const api = createQuarkApi(async () => ({ code: 31001 }));
    await assert.rejects(
      api.apiGetToken('share-1', ''),
      /此分享需要提取码，请在链接末尾加上 \?pwd=提取码/,
    );
  });

  await t.test('31002 提示分享失效', async () => {
    const api = createQuarkApi(async () => ({ code: 31002 }));
    await assert.rejects(
      api.apiGetToken('share-1', ''),
      /分享链接已失效或被取消/,
    );
  });
});

test('apiPollTask 状态 2 返回 fids', async () => {
  const api = createQuarkApi(async () => ({
    code: 0,
    data: {
      status: 2,
      save_as: { save_as_top_fids: ['fid-1', 'fid-2'] },
    },
  }));

  assert.deepEqual(await api.apiPollTask('task-1', 2), ['fid-1', 'fid-2']);
});

test('apiPollTask 状态 3 抛出中文错误', async () => {
  const api = createQuarkApi(async () => ({
    code: 0,
    data: { status: 3 },
  }));

  await assert.rejects(
    api.apiPollTask('task-1'),
    /转存失败，云端空间满或触发风控/,
  );
});

test('apiPollTask 有文件但响应 fids 为空时抛错', async () => {
  const api = createQuarkApi(async () => ({
    code: 0,
    data: { status: 2, save_as: { save_as_top_fids: [] } },
  }));

  await assert.rejects(
    api.apiPollTask('task-1', 1),
    /转存任务已完成，但响应中缺少文件 ID/,
  );
});

test('ensureGopeedTempFid 返回已有临时目录', async () => {
  const calls = [];
  const api = createQuarkApi(async (url, method, data) => {
    calls.push({ url, method, data });
    return {
      code: 0,
      data: {
        list: [
          { fid: 'other', dir: true, file_name: 'Other' },
          { fid: 'temp-1', dir: true, file_name: 'GopeedTemp' },
        ],
      },
    };
  });

  assert.equal(await api.ensureGopeedTempFid(), 'temp-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

test('ensureGopeedTempFid 在目录不存在时创建', async () => {
  const calls = [];
  const api = createQuarkApi(async (url, method, data) => {
    calls.push({ url, method, data });
    if (method === 'GET') return { code: 0, data: { list: [] } };
    return { code: 0, data: { fid: 'temp-created' } };
  });

  assert.equal(await api.ensureGopeedTempFid(), 'temp-created');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].data, {
    pdir_fid: '0',
    file_name: 'GopeedTemp',
    dir: true,
  });
});

test('缺少 code 的响应不视为成功', async () => {
  const api = createQuarkApi(async () => ({
    data: { list: [{ fid: 'unexpected' }] },
  }));

  await assert.rejects(api.apiListDir('0'), /获取网盘目录列表失败/);
});
