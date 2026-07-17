import { apiGetDownloadLinks } from './api.js';
import { DEFAULT_CHUNK_FILE_COUNT } from './constants.js';
import { matchDownloadLinks } from './transfer.js';

function logger() {
  if (typeof gopeed !== 'undefined' && gopeed?.logger) return gopeed.logger;
  return console;
}

/**
 * 自己网盘文件直接批量取直链（无需转存）。
 */
export async function fetchDriveDownloadFiles(files, options = {}) {
  const {
    batchSize = DEFAULT_CHUNK_FILE_COUNT,
    getDownloadLinks = apiGetDownloadLinks,
  } = options;
  const source = Array.isArray(files) ? files : [];
  if (source.length === 0) {
    throw new Error('目录中没有可下载的文件');
  }

  const size = Math.max(1, Math.floor(batchSize) || 1);
  const finalParsedFiles = [];

  for (let i = 0; i < source.length; i += size) {
    const chunk = source.slice(i, i + size);
    const fids = chunk.map((file) => file.fid);
    const links = await getDownloadLinks(fids);
    if (!Array.isArray(links) || links.length === 0) {
      throw new Error(
        `获取直链返回为空（本批 ${chunk.length} 个文件）`,
      );
    }
    const matched = matchDownloadLinks(chunk, links, fids);
    for (let index = 0; index < chunk.length; index += 1) {
      const file = chunk[index];
      const link = matched[index];
      if (!link?.download_url) {
        logger().error?.(
          `文件“${file.file_name}”未获取到下载链接（接口返回 ${links.length} 条）`,
        );
        continue;
      }
      finalParsedFiles.push({
        name: file.file_name,
        size: file.size,
        path: file.path || '',
        url: link.download_url,
        fid: link.fid || file.fid,
      });
    }
  }

  if (finalParsedFiles.length === 0) {
    throw new Error('提取失败，未生成有效直链');
  }
  return finalParsedFiles;
}
