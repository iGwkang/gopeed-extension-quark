import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePuusIntoCookie, assertCookieConfigured } from '../src/quark/cookie.js';

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
