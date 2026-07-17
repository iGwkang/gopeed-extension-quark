import {
  DRIVE_BASE,
  PAGE_SIZE,
  PAN_ORIGIN,
  TEMP_FOLDER_NAME,
} from './constants.js';
import { quarkRequest } from './net.js';

const TASK_POLL_INTERVAL_MS = 1000;
const TASK_MIN_POLL_ATTEMPTS = 15;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiMessage(body, fallback) {
  return body?.message || body?.msg || fallback;
}

function assertApiSuccess(body, fallback) {
  if (body?.code === 0) return body.data;
  throw new Error(apiMessage(body, fallback));
}

export async function apiGetToken(
  shareId,
  passcode,
  request = quarkRequest,
) {
  const url = `${PAN_ORIGIN}/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc`;
  const body = await request(url, 'POST', {
    pwd_id: shareId,
    passcode: passcode || '',
  });

  if (body.code === 31001) {
    throw new Error('此分享需要提取码，请在链接末尾加上 ?pwd=提取码');
  }
  if (body.code === 31002) {
    throw new Error('分享链接已失效或被取消');
  }
  if (body?.code !== 0) {
    throw new Error(
      `提取码错误，请检查链接中的 ?pwd=：${apiMessage(body, `接口错误 ${body?.code ?? '未知'}`)}`,
    );
  }
  return body.data;
}

export async function apiGetDetailPage(
  shareId,
  stoken,
  pdirFid = '0',
  page = 1,
  request = quarkRequest,
) {
  const url =
    `${PAN_ORIGIN}/1/clouddrive/share/sharepage/detail` +
    `?pr=ucpro&fr=pc&pwd_id=${encodeURIComponent(shareId)}` +
    `&stoken=${encodeURIComponent(stoken)}` +
    `&pdir_fid=${encodeURIComponent(pdirFid || '0')}` +
    `&_page=${page}&_size=${PAGE_SIZE}` +
    '&_sort=file_type:asc,updated_at:desc';
  const data = assertApiSuccess(
    await request(url, 'GET'),
    '获取分享文件列表失败',
  );
  const list = data?.list || [];
  const metadata = data?.metadata || {};
  const total = metadata._total ?? data?.total ?? list.length;
  return {
    list,
    count: data?.count ?? list.length,
    total,
  };
}

export async function apiSaveFiles(
  shareId,
  stoken,
  fidList,
  fidTokenList,
  toPdirFid,
  request = quarkRequest,
) {
  const url = `${DRIVE_BASE}/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc`;
  const data = assertApiSuccess(
    await request(url, 'POST', {
      fid_list: fidList,
      fid_token_list: fidTokenList,
      to_pdir_fid: toPdirFid,
      pwd_id: shareId,
      stoken,
      pdir_fid: '0',
      scene: 'link',
    }),
    '提交转存任务失败',
  );
  const taskId = data?.task_id;
  if (!taskId) throw new Error('提交转存任务失败：响应中缺少任务 ID');
  return taskId;
}

export async function apiPollTask(
  taskId,
  fileCount = 1,
  request = quarkRequest,
) {
  const maxAttempts = Math.max(
    TASK_MIN_POLL_ATTEMPTS,
    Math.ceil(Math.max(1, fileCount) / 10) * 5,
  );
  const url =
    `${DRIVE_BASE}/1/clouddrive/task?pr=ucpro&fr=pc` +
    `&task_id=${encodeURIComponent(taskId)}`;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = assertApiSuccess(
      await request(url, 'GET'),
      '查询转存任务失败',
    );
    if (data?.status === 2) {
      const fids = data.save_as?.save_as_top_fids || [];
      if (fileCount > 0 && fids.length === 0) {
        throw new Error('转存任务已完成，但响应中缺少文件 ID');
      }
      return fids;
    }
    if (data?.status === 3) {
      throw new Error('转存失败，云端空间满或触发风控');
    }
    if (attempt < maxAttempts - 1) await sleep(TASK_POLL_INTERVAL_MS);
  }
  throw new Error('转存任务等待超时，请稍后重试');
}

export async function apiGetDownloadLinks(fids, request = quarkRequest) {
  const url = `${DRIVE_BASE}/1/clouddrive/file/download?pr=ucpro&fr=pc`;
  const body = await request(url, 'POST', { fids });
  if (body.code === 23018) {
    throw new Error('获取下载链接失败：账号触发风控，请稍后重试');
  }
  const data = assertApiSuccess(body, '获取下载链接失败');
  return Array.isArray(data) ? data : data?.list || [];
}

export async function apiDeleteFiles(fids, request = quarkRequest) {
  if (!fids?.length) return;
  const url = `${DRIVE_BASE}/1/clouddrive/file/delete?pr=ucpro&fr=pc`;
  try {
    assertApiSuccess(
      await request(url, 'POST', {
        action_type: 2,
        filelist: fids,
        exclude_fids: [],
      }),
      '清理临时转存文件失败',
    );
  } catch (err) {
    console.warn(`清理临时转存文件失败：${err.message || err}`);
  }
}

export async function apiGetAvailableSpace(request = quarkRequest) {
  const url =
    `${DRIVE_BASE}/1/clouddrive/member?pr=ucpro&fr=pc` +
    '&fetch_subscribe=true&fetch_identity=true';
  try {
    const data = assertApiSuccess(
      await request(url, 'GET'),
      '查询网盘可用空间失败',
    );
    const total = Number(data?.total_capacity);
    const used = Number(data?.use_capacity);
    if (!Number.isFinite(total) || !Number.isFinite(used)) return -1;
    return Math.max(0, total - used);
  } catch (err) {
    console.warn(`查询网盘可用空间失败：${err.message || err}`);
    return -1;
  }
}

export async function apiListDir(pdirFid, request = quarkRequest) {
  const url =
    `${DRIVE_BASE}/1/clouddrive/file/sort?pr=ucpro&fr=pc` +
    `&pdir_fid=${encodeURIComponent(pdirFid)}` +
    '&_page=1&_size=100&_sort=file_type:asc,file_name:asc';
  const data = assertApiSuccess(
    await request(url, 'GET'),
    '获取网盘目录列表失败',
  );
  return data?.list || [];
}

export async function apiCreateFolder(
  pdirFid,
  name,
  request = quarkRequest,
) {
  const url = `${DRIVE_BASE}/1/clouddrive/file?pr=ucpro&fr=pc`;
  const data = assertApiSuccess(
    await request(url, 'POST', {
      pdir_fid: pdirFid,
      file_name: name,
      dir: true,
    }),
    '创建临时目录失败',
  );
  const fid = data?.fid || data?.file?.fid;
  if (!fid) throw new Error('创建临时目录失败：响应中缺少目录 ID');
  return fid;
}

export async function ensureGopeedTempFid(request = quarkRequest) {
  const list = await apiListDir('0', request);
  const found = (list || []).find(
    (item) => item.dir && item.file_name === TEMP_FOLDER_NAME,
  );
  if (found) return found.fid;
  return apiCreateFolder('0', TEMP_FOLDER_NAME, request);
}

export function createQuarkApi(request = quarkRequest) {
  return {
    apiGetToken: (shareId, passcode) =>
      apiGetToken(shareId, passcode, request),
    apiGetDetailPage: (shareId, stoken, pdirFid = '0', page = 1) =>
      apiGetDetailPage(shareId, stoken, pdirFid, page, request),
    apiSaveFiles: (
      shareId,
      stoken,
      fidList,
      fidTokenList,
      toPdirFid,
    ) =>
      apiSaveFiles(
        shareId,
        stoken,
        fidList,
        fidTokenList,
        toPdirFid,
        request,
      ),
    apiPollTask: (taskId, fileCount = 1) =>
      apiPollTask(taskId, fileCount, request),
    apiGetDownloadLinks: (fids) => apiGetDownloadLinks(fids, request),
    apiDeleteFiles: (fids) => apiDeleteFiles(fids, request),
    apiGetAvailableSpace: () => apiGetAvailableSpace(request),
    apiListDir: (pdirFid) => apiListDir(pdirFid, request),
    apiCreateFolder: (pdirFid, name) =>
      apiCreateFolder(pdirFid, name, request),
    ensureGopeedTempFid: () => ensureGopeedTempFid(request),
  };
}
