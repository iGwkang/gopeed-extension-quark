import test from 'node:test';
import assert from 'node:assert/strict';
import { throwUserError } from '../src/quark/errors.js';

test('存在 MessageError 时抛出 MessageError', () => {
  class FakeMessageError extends Error {
    constructor(message) {
      super(message);
      this.name = 'MessageError';
    }
  }
  globalThis.MessageError = FakeMessageError;
  try {
    assert.throws(
      () => throwUserError('提取失败，转存任务未生成有效直链'),
      (error) =>
        error instanceof FakeMessageError &&
        error.message === '提取失败，转存任务未生成有效直链',
    );
  } finally {
    delete globalThis.MessageError;
  }
});

test('无 MessageError 时回退为 Error', () => {
  delete globalThis.MessageError;
  assert.throws(() => throwUserError('网络异常'), /网络异常/);
});
