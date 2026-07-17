export function parseShareUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('无效的夸克分享链接');
  }
  const clean = rawUrl.replace(/\[.*?\]/g, '').trim();
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
  return { shareId, passcode, pdirFid };
}
