import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError, sendError } from '../src/errors.js';
import {
  isYouTubeUrl,
  sanitizeFilePart,
  validateSearchQuery,
  validateStartSeconds,
} from '../src/validation.js';

describe('isYouTubeUrl', () => {
  test('accepts supported YouTube hosts over http and https', () => {
    assert.equal(isYouTubeUrl('http://youtube.com/watch?v=abc123'), true);
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

  test('rejects unsupported URL schemes', () => {
    assert.equal(isYouTubeUrl('ftp://youtube.com/watch?v=x'), false);
    assert.equal(isYouTubeUrl('javascript://youtube.com/%0Aalert(1)'), false);
    assert.equal(isYouTubeUrl('data://youtube.com/watch?v=x'), false);
  });
});

describe('validateSearchQuery', () => {
  test('returns a trimmed valid query with a caller-provided limit', () => {
    assert.equal(validateSearchQuery(' hello ', 10), 'hello');
  });

  test('rejects empty queries', () => {
    assertAppErrorCode(() => validateSearchQuery('   ', 10), 'EMPTY_QUERY');
  });

  test('rejects overly long queries using the caller-provided limit', () => {
    assertAppErrorCode(() => validateSearchQuery('a'.repeat(11), 10), 'QUERY_TOO_LONG');
  });
});

describe('validateStartSeconds', () => {
  test('accepts valid start seconds', () => {
    assert.equal(validateStartSeconds(0, 100, 30), 0);
    assert.equal(validateStartSeconds(12.5, 100, 30), 12.5);
    assert.equal(validateStartSeconds('15', 100, 30), 15);
  });

  test('rejects negative and non-number values', () => {
    assertAppErrorCode(() => validateStartSeconds(-1, 100, 30), 'NEGATIVE_START_SECONDS');
    assertAppErrorCode(() => validateStartSeconds('soon', 100, 30), 'INVALID_START_SECONDS');
  });

  test('rejects blank and non-scalar values before number coercion', () => {
    for (const value of ['', '   ', null, undefined, true, false, [], [15], {}, { value: 15 }]) {
      assertAppErrorCode(() => validateStartSeconds(value, 100, 30), 'INVALID_START_SECONDS');
    }
  });

  test('rejects clips that exceed the source duration', () => {
    assertAppErrorCode(() => validateStartSeconds(80, 100, 30), 'CLIP_EXCEEDS_DURATION');
  });
});

describe('sanitizeFilePart', () => {
  test('replaces unsafe filename characters and whitespace with underscores', () => {
    assert.equal(sanitizeFilePart('a/b:c*? song'), 'a_b_c_song');
  });

  test('returns audio when the sanitized result is empty', () => {
    assert.equal(sanitizeFilePart(' <>:"/\\|?* '), 'audio');
  });

  test('prefixes Windows reserved basenames case-insensitively', () => {
    assert.equal(sanitizeFilePart('CON'), 'audio_CON');
    assert.equal(sanitizeFilePart('prn.txt'), 'audio_prn.txt');
    assert.equal(sanitizeFilePart('Aux.mp3'), 'audio_Aux.mp3');
    assert.equal(sanitizeFilePart('nul'), 'audio_nul');
    assert.equal(sanitizeFilePart('COM1.wav'), 'audio_COM1.wav');
    assert.equal(sanitizeFilePart('lpt9'), 'audio_lpt9');
  });

  test('avoids dot-like and trailing-dot names', () => {
    assert.equal(sanitizeFilePart('.'), 'audio');
    assert.equal(sanitizeFilePart('..'), 'audio');
    assert.equal(sanitizeFilePart('song.'), 'song');
    assert.equal(sanitizeFilePart('song_.'), 'song');
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

function assertAppErrorCode(fn, code) {
  assert.throws(
    fn,
    error => error instanceof AppError && error.code === code,
  );
}

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
