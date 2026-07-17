import { apiGetDetailPage } from './api.js';
import { PAGE_SIZE } from './constants.js';

function defaultFetchPage(shareId, stoken, pdirFid, page) {
  return apiGetDetailPage(shareId, stoken, pdirFid, page);
}

function joinPath(parentPath, name) {
  return parentPath ? `${parentPath}/${name}` : name;
}

async function listAllPages(fetchPage, shareId, stoken, pdirFid) {
  const items = [];
  let page = 1;
  while (true) {
    const { list } = await fetchPage(shareId, stoken, pdirFid, page);
    items.push(...(list || []));
    if (!list || list.length < PAGE_SIZE) break;
    page += 1;
  }
  return items;
}

/**
 * 递归收集分享文件。
 * 若根目录（或入口目录）下仅有一个文件夹且无文件，则展开该层，
 * 避免 Gopeed 任务名与 path 首层同名叠成「标题\标题」。
 */
export async function collectShareFiles(options) {
  const {
    shareId,
    stoken,
    pdirFid = '',
    maxCount = 0,
    fetchPage = defaultFetchPage,
  } = options;

  const files = [];
  let startPdirFid = pdirFid || '';
  let suggestedName = '';

  const rootItems = await listAllPages(fetchPage, shareId, stoken, startPdirFid);
  const rootDirs = rootItems.filter((item) => item.dir);
  const rootFiles = rootItems.filter((item) => !item.dir);

  let seedItems = rootItems;
  if (rootFiles.length === 0 && rootDirs.length === 1) {
    suggestedName = rootDirs[0].file_name || '';
    startPdirFid = rootDirs[0].fid;
    seedItems = await listAllPages(fetchPage, shareId, stoken, startPdirFid);
  }

  async function collectFromItems(items, parentPath) {
    for (const item of items || []) {
      if (maxCount > 0 && files.length >= maxCount) return;

      if (item.dir) {
        const childItems = await listAllPages(
          fetchPage,
          shareId,
          stoken,
          item.fid,
        );
        await collectFromItems(
          childItems,
          joinPath(parentPath, item.file_name),
        );
        if (maxCount > 0 && files.length >= maxCount) return;
      } else {
        files.push({
          fid: item.fid,
          share_fid_token: item.share_fid_token,
          file_name: item.file_name,
          size: item.size,
          path: parentPath,
          dir: false,
        });
      }
    }
  }

  await collectFromItems(seedItems, '');
  return { files, suggestedName };
}
