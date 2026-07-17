import superagent from 'superagent';
import {
  apiDeleteFiles,
  apiGetDownloadLinks,
  apiPollTask,
  apiSaveFiles,
  ensureGopeedTempFid,
} from './api.js';

async function probeDownloadUrl(url, headers) {
  const response = await superagent
    .get(url)
    .set(headers)
    .redirects(0)
    .ok(() => true);
  return response.status;
}

export async function isDownloadUrlExpired(
  url,
  headers = {},
  probe = probeDownloadUrl,
) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    const expiresValue =
      parsed.searchParams.get('Expires') || parsed.searchParams.get('expires');
    if (expiresValue) {
      const expiresAt = Number(expiresValue);
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now() / 1000) {
        return true;
      }
    }
  } catch {
    return true;
  }

  try {
    const status = await probe(url, { ...headers, Range: 'bytes=0-0' });
    return !(status >= 200 && status < 400);
  } catch {
    return true;
  }
}

function logger() {
  if (typeof gopeed !== 'undefined' && gopeed?.logger) return gopeed.logger;
  return console;
}

function shouldDeleteTransferredFiles() {
  return typeof gopeed === 'undefined' || gopeed.settings.delete_file !== '0';
}

function firstDownloadLink(links) {
  return (links || []).find((item) => item?.download_url);
}

const defaultDependencies = {
  apiDeleteFiles,
  apiGetDownloadLinks,
  apiPollTask,
  apiSaveFiles,
  ensureGopeedTempFid,
  isDownloadUrlExpired,
};

export function createStartHandler(dependencies = {}) {
  const deps = { ...defaultDependencies, ...dependencies };

  return async function start(ctx) {
    const req = ctx?.task?.meta?.req;
    if (!req) throw new Error('刷新夸克下载链接失败：任务请求信息缺失');

    const labels = req.labels || {};
    const expired = await deps.isDownloadUrlExpired(
      req.url,
      req.extra?.header || {},
    );
    if (!expired) return;

    if (labels.fid) {
      try {
        const link = firstDownloadLink(
          await deps.apiGetDownloadLinks([labels.fid]),
        );
        if (link) {
          req.url = link.download_url;
          labels.fid = link.fid || labels.fid;
          req.labels = labels;
          return;
        }
      } catch (error) {
        if (labels.source === 'drive') {
          throw new Error(
            `刷新夸克网盘直链失败：${error?.message || error}`,
          );
        }
        logger().warn?.(
          `使用原转存文件刷新直链失败，将重新转存：${error?.message || error}`,
        );
      }
    }

    if (labels.source === 'drive') {
      throw new Error('刷新夸克网盘直链失败：缺少可用的文件 ID');
    }

    const requiredLabels = [
      ['shareId', '分享 ID'],
      ['stoken', '分享访问令牌'],
      ['shareFid', '分享文件 ID'],
      ['shareFidToken', '分享文件令牌'],
    ];
    const missing = requiredLabels.find(([key]) => !labels[key]);
    if (missing) {
      throw new Error(`刷新夸克下载链接失败：缺少${missing[1]}`);
    }

    let savedFids = [];
    try {
      const tempFid = await deps.ensureGopeedTempFid();
      const taskId = await deps.apiSaveFiles(
        labels.shareId,
        labels.stoken,
        [labels.shareFid],
        [labels.shareFidToken],
        tempFid,
      );
      savedFids = await deps.apiPollTask(taskId, 1);
      const link = firstDownloadLink(
        await deps.apiGetDownloadLinks(savedFids),
      );
      if (!link) throw new Error('重新转存后仍未获取到有效下载链接');

      req.url = link.download_url;
      labels.fid = link.fid || savedFids[0] || '';
      req.labels = labels;
    } catch (error) {
      const message = error?.message || String(error);
      throw new Error(`刷新夸克下载链接失败：${message}`);
    } finally {
      if (shouldDeleteTransferredFiles() && savedFids.length > 0) {
        await deps.apiDeleteFiles(savedFids);
      }
    }
  };
}

export const handleStart = createStartHandler();
