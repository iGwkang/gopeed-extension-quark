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
      if (!stoken) throw new Error('获取分享访问令牌失败：响应中缺少 stoken');

      const files = await deps.collectShareFiles({
        shareId,
        stoken,
        pdirFid,
        maxCount: readMaxFileCount(),
      });
      if (files.length === 0) throw new Error('分享中没有可下载的文件');

      const availableSpace = await deps.apiGetAvailableSpace();
      const { finalParsedFiles } = await deps.processSmartChunks({
        shareId,
        stoken,
        files,
        availableSpace,
        shouldDelete: shouldDeleteTransferredFiles(),
      });
      const effectiveCookie = deps.getEffectiveCookie();

      ctx.res = {
        name: tokenData?.title || tokenData?.share_name || shareId,
        files: finalParsedFiles.map((item) => ({
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
      throw new Error(message);
    }
  };
}

export const handleResolve = createResolveHandler();
