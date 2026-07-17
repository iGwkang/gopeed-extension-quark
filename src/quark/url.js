const FID_PREFIX_RE = /^([a-fA-F0-9]{32})(?:-(.*))?$/;

function extractFidAndName(segment) {
  const decoded = decodeURIComponent(String(segment || '').trim());
  if (!decoded) return { fid: '', name: '' };
  // 去掉夸克 hash 里 * 后的附加参数
  const main = decoded.split('*')[0];
  const matched = main.match(FID_PREFIX_RE);
  if (!matched) return { fid: '', name: '' };
  return {
    fid: matched[1],
    name: (matched[2] || '').trim(),
  };
}

/**
 * 从自己网盘 hash 解析目标目录。
 * 支持一级/多级，例如：
 * #/list/all/{fid}-name
 * #/list/all/{fid1}-a/{fid2}-b
 * 始终取最后一段的 fid。
 */
export function parseDriveListHash(hash) {
  const text = String(hash || '').replace(/^#/, '');
  const prefixMatch = text.match(/^\/?list\/all(?:\/(.*))?$/i);
  if (!prefixMatch) {
    return { dirFid: '', dirName: '' };
  }
  const rest = (prefixMatch[1] || '').replace(/^\/+|\/+$/g, '');
  if (!rest) {
    return { dirFid: '0', dirName: '' };
  }
  const segments = rest.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const { fid, name } = extractFidAndName(last);
  return { dirFid: fid, dirName: name };
}

export function isDriveListUrl(rawUrl) {
  const text = String(rawUrl || '').trim();
  return /pan\.quark\.cn\/list/i.test(text) || /drive\.quark\.cn\/list/i.test(text);
}

export function isShareUrl(rawUrl) {
  const text = String(rawUrl || '').trim();
  return /\/s\/[a-zA-Z0-9]+/i.test(text);
}

/**
 * 统一解析夸克链接：分享 或 自己网盘目录。
 */
export function parseQuarkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('无效的夸克链接');
  }
  const clean = rawUrl.replace(/\[.*?\]/g, '').trim();

  if (isDriveListUrl(clean)) {
    let hash = '';
    try {
      hash = new URL(clean).hash || '';
    } catch {
      const idx = clean.indexOf('#');
      hash = idx >= 0 ? clean.slice(idx) : '';
    }
    const { dirFid, dirName } = parseDriveListHash(hash);
    if (!dirFid) {
      throw new Error('无效的夸克网盘目录链接：无法解析目录 ID');
    }
    return {
      type: 'drive',
      dirFid,
      dirName,
    };
  }

  let shareId = '';
  let passcode = '';
  let pdirFid = '';

  const idMatch = clean.match(/\/s\/([a-zA-Z0-9]+)/i);
  if (idMatch) shareId = idMatch[1];
  else if (/^[a-zA-Z0-9]+$/.test(clean) && clean.length > 6) shareId = clean;

  const pwMatch = clean.match(/[?&](pwd|password|pw)=([a-zA-Z0-9]+)/i);
  if (pwMatch) passcode = pwMatch[2];

  const dirMatch = clean.match(/#\/list\/share\/([a-zA-Z0-9]+)/i);
  if (dirMatch) pdirFid = dirMatch[1];

  if (!shareId) throw new Error('无效的夸克分享链接：缺少分享 ID');
  return {
    type: 'share',
    shareId,
    passcode,
    pdirFid,
  };
}

/** @deprecated 使用 parseQuarkUrl；保留给旧测试/调用 */
export function parseShareUrl(rawUrl) {
  const parsed = parseQuarkUrl(rawUrl);
  if (parsed.type !== 'share') {
    throw new Error('无效的夸克分享链接');
  }
  return {
    shareId: parsed.shareId,
    passcode: parsed.passcode,
    pdirFid: parsed.pdirFid,
  };
}
