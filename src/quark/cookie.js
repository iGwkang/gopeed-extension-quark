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

function parsePuusFromCookie(cookie) {
  const part = (cookie || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('__puus='));
  return part?.slice('__puus='.length) || null;
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
  const settingsCookie = (gopeed.settings.cookie || '').trim();
  const storedPuus = parsePuusFromCookie(
    gopeed.storage.get(STORAGE_COOKIE_KEY),
  );
  return storedPuus
    ? mergePuusIntoCookie(settingsCookie, `__puus=${storedPuus}`)
    : settingsCookie;
}

export function persistCookie(cookie) {
  const puus = parsePuusFromCookie(cookie);
  if (puus) gopeed.storage.set(STORAGE_COOKIE_KEY, `__puus=${puus}`);
}

export function updatePuusFromSetCookie(setCookie) {
  const current = getEffectiveCookie() || '';
  const merged = mergePuusIntoCookie(current, setCookie);
  if (merged && merged !== current) persistCookie(merged);
}
