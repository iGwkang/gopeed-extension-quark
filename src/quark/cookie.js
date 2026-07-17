import { STORAGE_COOKIE_KEY } from './constants.js';

function parsePuusFromSetCookie(setCookie) {
  if (!setCookie) return null;
  const headers = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const header of headers) {
    const first = header.split(';')[0].trim();
    if (first.startsWith('__puus=')) {
      return first.slice('__puus='.length);
    }
  }
  return null;
}

export function mergePuusIntoCookie(cookie, setCookie) {
  const puus = parsePuusFromSetCookie(setCookie);
  if (!puus) return cookie;

  const parts = cookie
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith('__puus='));
  parts.push(`__puus=${puus}`);
  return parts.join('; ');
}

export function assertCookieConfigured(cookie) {
  const trimmed = (cookie || '').trim();
  if (!trimmed) {
    throw new Error('请先配置 Cookie（从浏览器登录 pan.quark.cn 后复制）');
  }
  const hasPuus = trimmed
    .split(';')
    .map((s) => s.trim())
    .some((p) => p.startsWith('__puus=') && p.length > '__puus='.length);
  if (!hasPuus) {
    throw new Error('Cookie 缺少 __puus，请从 list 类请求头重新复制完整 Cookie');
  }
}

export function getEffectiveCookie() {
  return gopeed.storage.get(STORAGE_COOKIE_KEY) || (gopeed.settings.cookie || '').trim();
}

export function persistCookie(cookie) {
  gopeed.storage.set(STORAGE_COOKIE_KEY, cookie);
}

export function updatePuusFromSetCookie(setCookie) {
  const current = getEffectiveCookie() || '';
  const merged = mergePuusIntoCookie(current, setCookie);
  if (merged && merged !== current) persistCookie(merged);
}
