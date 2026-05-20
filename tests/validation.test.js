import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isYouTubeUrl,
  sanitizeFilePart,
  validateSearchQuery,
  validateStartSeconds,
} from '../src/validation.js';
import { AppError, sendError } from '../src/errors.js';

describe('isYouTubeUrl', () => {
  test('accepts supported YouTube hosts', () => {
    assert.equal(isYouTubeUrl('https://youtube.com/watch?v=abc123'), true);
    assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=abc123'), true);
    assert.equal(isYouTubeUrl('https://m.youtube.com/watch?v=abc123'), true);
    assert.equal(isYouTubeUrl('https://youtu.be/abc123'), true);
  });

  test('rejects other domains and bad strings', () => {
    assert.equal(isYouTubeUrl('https://notyoutube.com/watch?v=abc123'), false);
    assert.equal(isYouTubeUrl('https://youtube.com.evil.test/watch?v=abc123'), false);
    assert.equal(isYouTubeUrl('https://example.com/youtube.com/watch'), false);
    assert.equal(isYouTubeUrl('not a url'), false);
    assert.equal(isYouTubeUrl(''), false);
  });
});

describe('validateSearchQuery', () => {
  test('returns a trimmed valid query with a caller-provided limit', () => {
    assert.equal(validateSearchQuery(' hello ', 10), 'hello');
  });

  test('rejects empty queries', () => {
    assert.throws(
      () => validateSearchQuery('   ', 10),
      error => error instanceof AppError && error.message === '검색어를 입력해 주세요.',
    );
  });

  test('rejects overly long queries using the caller-provided limit', () => {
    assert.throws(
      () => validateSearchQuery('a'.repeat(11), 10),
      error => error instanceof AppError && error.message === '검색어는 10자 이하로 입력해 주세요.',
    );
  });
});

describe('validateStartSeconds', () => {
  test('accepts valid start seconds', () => {
    assert.equal(validateStartSeconds(0, 100, 30), 0);
    assert.equal(validateStartSeconds(12.5, 100, 30), 12.5);
    assert.equal(validateStartSeconds('15', 100, 30), 15);
  });

  test('rejects negative and non-number values', () => {
    assert.throws(
      () => validateStartSeconds(-1, 100, 30),
      error => error instanceof AppError && error.message === '시작 시간은 0초 이상이어야 합니다.',
    );
    assert.throws(
      () => validateStartSeconds('soon', 100, 30),
      error => error instanceof AppError && error.message === '시작 시간은 숫자로 입력해 주세요.',
    );
  });

  test('rejects clips that exceed the source duration', () => {
    assert.throws(
      () => validateStartSeconds(80, 100, 30),
      error => error instanceof AppError && error.message === '선택한 구간이 영상 길이를 초과합니다.',
    );
  });
});

describe('sanitizeFilePart', () => {
  test('replaces unsafe filename characters and whitespace with underscores', () => {
    assert.equal(sanitizeFilePart('a/b:c*? song'), 'a_b_c_song');
  });

  test('returns audio when the sanitized result is empty', () => {
    assert.equal(sanitizeFilePart(' <>:"/\\|?* '), 'audio');
  });
});

describe('errors', () => {
  test('AppError stores message, status, and code', () => {
    const error = new AppError('잘못된 요청입니다.', 422, 'BAD_REQUEST');

    assert.equal(error.message, '잘못된 요청입니다.');
    assert.equal(error.status, 422);
    assert.equal(error.code, 'BAD_REQUEST');
  });

  test('sendError sends app errors as JSON', () => {
    const res = createResponse();

    sendError(res, new AppError('검색어를 입력해 주세요.', 400, 'EMPTY_QUERY'));

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      error: {
        code: 'EMPTY_QUERY',
        message: '검색어를 입력해 주세요.',
      },
    });
  });

  test('sendError hides unknown server errors', () => {
    const res = createResponse();

    sendError(res, new Error('database password leaked'));

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
  });
});

function createResponse() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
