import {
  apiDeleteFiles,
  apiGetDownloadLinks,
  apiPollTask,
  apiSaveFiles,
  ensureGopeedTempFid,
} from './api.js';
import {
  DEFAULT_CHUNK_FILE_COUNT,
  SAFE_BUFFER_BYTES,
} from './constants.js';

function fileSize(file) {
  const size = Number(file?.size);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function buildChunks(
  files,
  availableSpace,
  shouldDelete,
  bufferBytes = SAFE_BUFFER_BYTES,
  defaultCount = DEFAULT_CHUNK_FILE_COUNT,
) {
  const sourceFiles = Array.isArray(files) ? files : [];
  if (availableSpace === -1) {
    const count = Math.max(1, Math.floor(defaultCount) || 1);
    const chunks = [];
    for (let index = 0; index < sourceFiles.length; index += count) {
      chunks.push(sourceFiles.slice(index, index + count));
    }
    return { chunks, skippedCount: 0 };
  }

  const maxChunkSize = Math.max(0, availableSpace - bufferBytes);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  let skippedCount = 0;
  let capacityExceeded = false;

  for (const file of sourceFiles) {
    if (capacityExceeded) {
      skippedCount += 1;
      continue;
    }
    const size = fileSize(file);
    if (size > maxChunkSize) {
      skippedCount += 1;
      continue;
    }

    if (currentChunk.length > 0 && currentSize + size > maxChunkSize) {
      if (!shouldDelete) {
        skippedCount += 1;
        capacityExceeded = true;
        continue;
      }
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(file);
    currentSize += size;
  }

  if (currentChunk.length > 0) chunks.push(currentChunk);
  return { chunks, skippedCount };
}

function logger() {
  if (typeof gopeed !== 'undefined' && gopeed?.logger) {
    return gopeed.logger;
  }
  return console;
}

function sameSize(left, right) {
  return Number(left?.size) === Number(right?.size);
}

function matchDownloadLinkIndexes(files, links, savedFids = []) {
  const sourceFiles = Array.isArray(files) ? files : [];
  const downloadLinks = Array.isArray(links) ? links : [];
  const fids = Array.isArray(savedFids) ? savedFids : [];
  const matchedIndexes = Array(sourceFiles.length).fill(-1);
  const usedIndexes = new Set();

  const matchRound = (predicate) => {
    for (let sourceIndex = 0; sourceIndex < sourceFiles.length; sourceIndex += 1) {
      if (matchedIndexes[sourceIndex] >= 0) continue;
      const linkIndex = downloadLinks.findIndex(
        (link, candidateIndex) =>
          !usedIndexes.has(candidateIndex) &&
          predicate(sourceFiles[sourceIndex], link, sourceIndex),
      );
      if (linkIndex >= 0) {
        matchedIndexes[sourceIndex] = linkIndex;
        usedIndexes.add(linkIndex);
      }
    }
  };

  matchRound(
    (file, link) =>
      link?.file_name === file?.file_name && sameSize(link, file),
  );
  matchRound((file, link) => sameSize(link, file));
  matchRound((file, link, sourceIndex) => {
    const fid = fids[sourceIndex];
    return Boolean(fid && link?.fid === fid && link?.download_url);
  });

  // 夸克 download 接口通常按请求 fids 顺序返回；等长时对剩余项按索引对齐
  if (downloadLinks.length === sourceFiles.length) {
    for (let sourceIndex = 0; sourceIndex < sourceFiles.length; sourceIndex += 1) {
      if (matchedIndexes[sourceIndex] >= 0) continue;
      if (
        !usedIndexes.has(sourceIndex) &&
        downloadLinks[sourceIndex]?.download_url
      ) {
        matchedIndexes[sourceIndex] = sourceIndex;
        usedIndexes.add(sourceIndex);
      }
    }
  }

  return matchedIndexes;
}

export function matchDownloadLinks(files, links, savedFids = []) {
  const downloadLinks = Array.isArray(links) ? links : [];
  return matchDownloadLinkIndexes(files, downloadLinks, savedFids).map(
    (index) => (index >= 0 ? downloadLinks[index] : undefined),
  );
}

export function assertHasParsedFiles(finalParsedFiles) {
  if (!Array.isArray(finalParsedFiles) || finalParsedFiles.length === 0) {
    throw new Error('提取失败，转存任务未生成有效直链');
  }
}

export async function processSmartChunks(options) {
  const { shareId, stoken, files, availableSpace, shouldDelete } = options;
  const toPdirFid = await ensureGopeedTempFid();
  const { chunks, skippedCount } = buildChunks(
    files,
    availableSpace,
    shouldDelete,
  );

  if (chunks.length === 0) {
    throw new Error(
      availableSpace >= 0
        ? `网盘空间不足（可用约 ${(availableSpace / 1073741824).toFixed(2)}GB），无法转存`
        : '没有可转存的文件',
    );
  }

  if (skippedCount > 0) {
    logger().warn?.(`有 ${skippedCount} 个文件因网盘空间不足被跳过`);
  }

  const finalParsedFiles = [];
  for (const chunk of chunks) {
    let savedFids = [];
    try {
      const taskId = await apiSaveFiles(
        shareId,
        stoken,
        chunk.map((file) => file.fid),
        chunk.map((file) => file.share_fid_token || file.fid_token),
        toPdirFid,
      );
      savedFids = await apiPollTask(taskId, chunk.length);
      const links = await apiGetDownloadLinks(savedFids);
      if (!Array.isArray(links) || links.length === 0) {
        throw new Error(
          `获取直链返回为空（本批 ${chunk.length} 个文件，转存 fid ${savedFids.length} 个）`,
        );
      }
      const matchedLinkIndexes = matchDownloadLinkIndexes(
        chunk,
        links,
        savedFids,
      );

      for (let sourceIndex = 0; sourceIndex < chunk.length; sourceIndex += 1) {
        const file = chunk[sourceIndex];
        const linkIndex = matchedLinkIndexes[sourceIndex];
        const link = linkIndex >= 0 ? links[linkIndex] : undefined;
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
          savedFid: link.fid || savedFids[linkIndex] || savedFids[sourceIndex],
          shareFid: file.fid,
          shareFidToken: file.share_fid_token || file.fid_token,
        });
      }
    } catch (error) {
      logger().error?.(`批次失败：${error?.message || error}`);
    } finally {
      if (shouldDelete && savedFids.length > 0) {
        await apiDeleteFiles(savedFids);
      }
    }
  }

  assertHasParsedFiles(finalParsedFiles);
  return { finalParsedFiles, skippedCount };
}
