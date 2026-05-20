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
  test('returns a trimmed valid query', () => {
    assert.equal(validateSearchQuery('  lo-fi ringtone  '), 'lo-fi ringtone');
  });

  test('rejects empty queries', () => {
    assert.throws(
      () => validateSearchQuery('   '),
      error => error instanceof AppError && error.message === '검색어를 입력해 주세요.',
    );
  });

  test('rejects overly long queries', () => {
    assert.throws(
      () => validateSearchQuery('a'.repeat(101)),
      error => error instanceof AppError && error.message === '검색어는 100자 이하로 입력해 주세요.',
    );
  });
});

describe('validateStartSeconds', () => {
  test('accepts valid start seconds', () => {
    assert.equal(validateStartSeconds(0, 30, 120), 0);
    assert.equal(validateStartSeconds(12.5, 30, 120), 12.5);
    assert.equal(validateStartSeconds('15', 30, 120), 15);
  });

  test('rejects negative and non-number values', () => {
    assert.throws(
      () => validateStartSeconds(-1, 30, 120),
      error => error instanceof AppError && error.message === '시작 시간은 0초 이상이어야 합니다.',
    );
    assert.throws(
      () => validateStartSeconds('soon', 30, 120),
      error => error instanceof AppError && error.message === '시작 시간은 숫자로 입력해 주세요.',
    );
  });

  test('rejects clips that exceed the source duration', () => {
    assert.throws(
      () => validateStartSeconds(95, 30, 120),
      error => error instanceof AppError && error.message === '선택한 구간이 영상 길이를 초과합니다.',
    );
  });
});

describe('sanitizeFilePart', () => {
  test('removes Windows-unsafe filename characters', () => {
    assert.equal(sanitizeFilePart('a<b>c:d"e/f\\g|h?i*j'), 'abcdefghij');
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
        code: 'SERVER_ERROR',
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
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
