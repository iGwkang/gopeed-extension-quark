import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('构建产物 dist/index.js 存在且非空', () => {
  const distPath = path.join(root, 'dist', 'index.js');
  assert.ok(fs.existsSync(distPath), 'dist/index.js 应存在（请先 npm run build）');
  assert.ok(fs.statSync(distPath).size > 0, 'dist/index.js 不应为空');
});
