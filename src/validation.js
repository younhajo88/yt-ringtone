import { AppError } from './errors.js';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);
const YOUTUBE_PROTOCOLS = new Set(['http:', 'https:']);
const WINDOWS_RESERVED_BASENAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_FILE_PART_LENGTH = 80;

export function isYouTubeUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const url = new URL(value);
    return YOUTUBE_PROTOCOLS.has(url.protocol) && YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function validateSearchQuery(value, maxLength) {
  const query = String(value || '').trim();

  if (query.length === 0) {
    throw new AppError('검색어를 입력해 주세요.', 400, 'EMPTY_QUERY');
  }

  if (query.length > maxLength) {
    throw new AppError(`검색어는 ${maxLength}자 이하로 입력해 주세요.`, 400, 'QUERY_TOO_LONG');
  }

  return query;
}

export function validateStartSeconds(value, durationSeconds, clipDurationSeconds) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    typeof value === 'object' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    throw new AppError('시작 시간은 숫자로 입력해 주세요.', 400, 'INVALID_START_SECONDS');
  }

  const start = Number(value);

  if (!Number.isFinite(start)) {
    throw new AppError('시작 시간은 숫자로 입력해 주세요.', 400, 'INVALID_START_SECONDS');
  }

  if (start < 0) {
    throw new AppError('시작 시간은 0초 이상이어야 합니다.', 400, 'NEGATIVE_START_SECONDS');
  }

  const duration = Number(durationSeconds);
  const clipDuration = Number(clipDurationSeconds);

  if (Number.isFinite(duration) && Number.isFinite(clipDuration) && start + clipDuration > duration) {
    throw new AppError('선택한 구간이 영상 길이를 초과합니다.', 400, 'CLIP_EXCEEDS_DURATION');
  }

  return start;
}

export function sanitizeFilePart(value) {
  let sanitized = String(value ?? '')
    .replace(/[<>:"/\\|?*\x00-\x1f\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/[._]+$/g, '');

  if (!sanitized) {
    return 'audio';
  }

  const [basename] = sanitized.split('.');
  if (WINDOWS_RESERVED_BASENAMES.test(basename)) {
    sanitized = `audio_${sanitized}`;
  }

  sanitized = sanitized
    .slice(0, MAX_FILE_PART_LENGTH)
    .replace(/[._]+$/g, '');

  return sanitized || 'audio';
}
