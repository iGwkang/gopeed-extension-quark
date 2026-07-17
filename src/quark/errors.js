/**
 * 抛出面向用户的解析错误。
 * Gopeed 对 MessageError 会弹提示并中止，而不会回退成把分享页当普通文件下载。
 */
export function throwUserError(message) {
  const text = message || '夸克分享解析失败';
  if (typeof MessageError === 'function') {
    throw new MessageError(text);
  }
  throw new Error(text);
}
