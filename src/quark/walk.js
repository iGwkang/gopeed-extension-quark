import { apiGetDetailPage } from './api.js';
import { PAGE_SIZE } from './constants.js';

function defaultFetchPage(shareId, stoken, pdirFid, page) {
  return apiGetDetailPage(shareId, stoken, pdirFid, page);
}

function joinPath(parentPath, name) {
  return parentPath ? `${parentPath}/${name}` : name;
}

export async function collectShareFiles(options) {
  const {
    shareId,
    stoken,
    pdirFid = '',
    maxCount = 0,
    fetchPage = defaultFetchPage,
  } = options;

  const files = [];

  async function collectDir(currentPdirFid, parentPath) {
    let page = 1;
    while (true) {
      const { list } = await fetchPage(shareId, stoken, currentPdirFid, page);
      for (const item of list || []) {
        if (maxCount > 0 && files.length >= maxCount) return;

        if (item.dir) {
          await collectDir(item.fid, joinPath(parentPath, item.file_name));
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
      if (!list || list.length < PAGE_SIZE) break;
      page += 1;
    }
  }

  await collectDir(pdirFid, '');
  return files;
}
