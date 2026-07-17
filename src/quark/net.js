import superagent from 'superagent';
import {
  MAX_RETRY,
  PAN_ORIGIN,
  RETRY_DELAY_MS,
  USER_AGENT,
} from './constants.js';
import {
  assertCookieConfigured,
  getEffectiveCookie,
  updatePuusFromSetCookie,
} from './cookie.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function quarkRequest(url, method, data = {}, retryCount = 0) {
  const cookie = getEffectiveCookie();
  assertCookieConfigured(cookie);
  try {
    const req =
      method === 'POST' ? superagent.post(url).send(data) : superagent.get(url);
    const response = await req
      .set({
        Cookie: cookie,
        'User-Agent': USER_AGENT,
        Referer: `${PAN_ORIGIN}/`,
        Origin: PAN_ORIGIN,
        'Content-Type': 'application/json;charset=UTF-8',
      })
      .ok(() => true);

    updatePuusFromSetCookie(response.headers['set-cookie']);

    const body = response.body || {};
    if (body.code === 40001 || body.code === 10000) {
      throw new Error(`Cookie 已失效或登录过期，请重新获取（代码: ${body.code}）`);
    }
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}`);
    }
    return body;
  } catch (err) {
    const message = (err && err.message) || String(err);
    if (message.includes('Cookie 已失效')) throw err;
    if (retryCount < MAX_RETRY) {
      await sleep(RETRY_DELAY_MS);
      return quarkRequest(url, method, data, retryCount + 1);
    }
    throw new Error(`网络请求失败：${message}`);
  }
}
