import { apiListDirPage } from './api.js';
import { PAGE_SIZE } from './constants.js';

function joinPath(parentPath, name) {
  return parentPath ? `${parentPath}/${name}` : name;
}

async function listAllPages(fetchPage, pdirFid) {
  const items = [];
  let page = 1;
  while (true) {
    const { list } = await fetchPage(pdirFid, page);
    items.push(...(list || []));
    if (!list || list.length < PAGE_SIZE) break;
    page += 1;
  }
  return items;
}

function defaultFetchPage(pdirFid, page) {
  return apiListDirPage(pdirFid, page);
}

/**
 * 递归收集自己网盘目录下的文件。
 * 根下仅有单个文件夹时展开，避免双层同名目录。
 */
export async function collectDriveFiles(options) {
  const {
    dirFid = '0',
    maxCount = 0,
    fetchPage = defaultFetchPage,
  } = options;

  const files = [];
  let startFid = dirFid || '0';
  let suggestedName = '';

  const rootItems = await listAllPages(fetchPage, startFid);
  const rootDirs = rootItems.filter((item) => item.dir);
  const rootFiles = rootItems.filter((item) => !item.dir);

  let seedItems = rootItems;
  if (rootFiles.length === 0 && rootDirs.length === 1) {
    suggestedName = rootDirs[0].file_name || '';
    startFid = rootDirs[0].fid;
    seedItems = await listAllPages(fetchPage, startFid);
  }

  async function collectFromItems(items, parentPath) {
    for (const item of items || []) {
      if (maxCount > 0 && files.length >= maxCount) return;
      if (item.dir) {
        const childItems = await listAllPages(fetchPage, item.fid);
        await collectFromItems(
          childItems,
          joinPath(parentPath, item.file_name),
        );
        if (maxCount > 0 && files.length >= maxCount) return;
      } else {
        files.push({
          fid: item.fid,
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
