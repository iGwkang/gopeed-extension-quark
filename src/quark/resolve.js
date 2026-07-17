import { apiGetAvailableSpace, apiGetToken } from './api.js';
import {
  assertCookieConfigured,
  getEffectiveCookie,
} from './cookie.js';
import {
  EXTENSION_LABEL,
  PAN_ORIGIN,
  USER_AGENT,
} from './constants.js';
import { throwUserError } from './errors.js';
import { processSmartChunks } from './transfer.js';
import { parseShareUrl } from './url.js';
import { collectShareFiles } from './walk.js';

function readMaxFileCount() {
  const value = Number.parseInt(gopeed.settings.max_file_count, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function shouldDeleteTransferredFiles() {
  return gopeed.settings.delete_file !== '0';
}

function logger() {
  return gopeed?.logger || console;
}

/** 去掉与任务名重复的 path 首层，避免 ForzaHorizon6/ForzaHorizon6。 */
export function stripRedundantRootPath(rootName, files) {
  if (!rootName || !files?.length) return files || [];
  const root = String(rootName).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!root) return files;

  const normalized = files.map((f) => ({
    ...f,
    path: String(f.path || '').replace(/\\/g, '/').replace(/^\/+/, ''),
  }));
  const everyUnderRoot = normalized.every((f) => {
    const p = f.path;
    return p === root || p.startsWith(`${root}/`);
  });
  if (!everyUnderRoot) return files;

  return normalized.map((f) => {
    const p = f.path;
    let next = p;
    if (p === root) next = '';
    else if (p.startsWith(`${root}/`)) next = p.slice(root.length + 1);
    return { ...f, path: next };
  });
}

const defaultDependencies = {
  apiGetAvailableSpace,
  apiGetToken,
  assertCookieConfigured,
  collectShareFiles,
  getEffectiveCookie,
  parseShareUrl,
  processSmartChunks,
};

export function createResolveHandler(dependencies = {}) {
  const deps = { ...defaultDependencies, ...dependencies };

  return async function resolve(ctx) {
    const rawUrl = ctx?.req?.rawUrl || ctx?.req?.url;
    try {
      const cookie = deps.getEffectiveCookie();
      deps.assertCookieConfigured(cookie);

      const { shareId, passcode, pdirFid } = deps.parseShareUrl(rawUrl);
      const tokenData = await deps.apiGetToken(shareId, passcode);
      const stoken = tokenData?.stoken;
      if (!stoken) {
        throwUserError('获取分享访问令牌失败：响应中缺少 stoken');
      }

      const walkResult = await deps.collectShareFiles({
        shareId,
        stoken,
        pdirFid,
        maxCount: readMaxFileCount(),
      });
      const files = walkResult?.files || walkResult || [];
      const suggestedName = walkResult?.suggestedName || '';
      if (files.length === 0) throwUserError('分享中没有可下载的文件');

      const availableSpace = await deps.apiGetAvailableSpace();
      const { finalParsedFiles } = await deps.processSmartChunks({
        shareId,
        stoken,
        files,
        availableSpace,
        shouldDelete: shouldDeleteTransferredFiles(),
      });
      const effectiveCookie = deps.getEffectiveCookie();
      const taskName =
        suggestedName ||
        tokenData?.title ||
        tokenData?.share_name ||
        shareId;
      const normalizedFiles = stripRedundantRootPath(
        taskName,
        finalParsedFiles,
      );

      ctx.res = {
        name: taskName,
        files: normalizedFiles.map((item) => ({
          name: item.name,
          size: item.size,
          path: item.path || '',
          req: {
            url: item.url,
            labels: {
              [EXTENSION_LABEL]: '1',
              shareId,
              stoken,
              shareFid: item.shareFid,
              shareFidToken: item.shareFidToken,
              fid: item.savedFid || '',
            },
            extra: {
              header: {
                'User-Agent': USER_AGENT,
                Cookie: effectiveCookie,
                Referer: `${PAN_ORIGIN}/`,
              },
            },
          },
        })),
      };
      logger().info?.(`夸克分享解析完成，共 ${ctx.res.files.length} 个文件`);
    } catch (error) {
      const message = error?.message || String(error);
      logger().error?.(`夸克分享解析失败：${message}`);
      // 已是 MessageError 则原样抛出，避免被包装成普通 Error 后回退到默认下载页
      if (typeof MessageError === 'function' && error instanceof MessageError) {
        throw error;
      }
      throwUserError(message);
    }
  };
}

export const handleResolve = createResolveHandler();
