import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCookieConfigured,
  getEffectiveCookie,
  mergePuusIntoCookie,
  persistCookie,
  updatePuusFromSetCookie,
} from '../src/quark/cookie.js';

test('合并 __puus', () => {
  const next = mergePuusIntoCookie('a=1; __puus=old', '__puus=new; Path=/; HttpOnly');
  assert.match(next, /__puus=new/);
  assert.doesNotMatch(next, /__puus=old/);
});

test('缺少 Cookie 抛错', () => {
  assert.throws(() => assertCookieConfigured(''), /Cookie/);
});

test('缺少 __puus 抛错', () => {
  assert.throws(() => assertCookieConfigured('a=1; b=2'), /__puus/);
});

test('设置 Cookie 为基底且存储只覆盖 __puus', () => {
  globalThis.gopeed = {
    settings: { cookie: 'fresh=setting; __puus=settings-value' },
    storage: {
      get: () => 'stale=storage; __puus=stored-value',
      set() {},
    },
  };

  assert.equal(
    getEffectiveCookie(),
    'fresh=setting; __puus=stored-value',
  );
});

test('持久化 Cookie 时只保存 __puus 片段', () => {
  let stored;
  globalThis.gopeed = {
    settings: { cookie: 'fresh=setting; __puus=old' },
    storage: {
      get: () => stored,
      set: (_key, value) => {
        stored = value;
      },
    },
  };

  persistCookie('stale=should-not-persist; __puus=direct-value');
  assert.equal(stored, '__puus=direct-value');

  updatePuusFromSetCookie('__puus=response-value; Path=/; HttpOnly');
  assert.equal(stored, '__puus=response-value');
  assert.equal(
    getEffectiveCookie(),
    'fresh=setting; __puus=response-value',
  );
});
