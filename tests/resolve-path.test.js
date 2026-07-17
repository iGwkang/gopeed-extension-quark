import test from 'node:test';
import assert from 'node:assert/strict';
import { stripRedundantRootPath } from '../src/quark/resolve.js';

test('去掉与任务名重复的 path 首层', () => {
  const files = stripRedundantRootPath('ForzaHorizon6', [
    { name: 'a.iso', path: 'ForzaHorizon6' },
    { name: 'b.bin', path: 'ForzaHorizon6/DLC' },
  ]);
  assert.equal(files[0].path, '');
  assert.equal(files[1].path, 'DLC');
});

test('并非全部位于同名目录下时不剥离', () => {
  const files = stripRedundantRootPath('ForzaHorizon6', [
    { name: 'a.iso', path: 'ForzaHorizon6' },
    { name: 'readme.txt', path: '' },
  ]);
  assert.equal(files[0].path, 'ForzaHorizon6');
  assert.equal(files[1].path, '');
});
