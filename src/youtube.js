import path from 'node:path';

import { config } from './config.js';
import { AppError } from './errors.js';
import { ensureDataDirs } from './audio.js';
import { runCommand } from './processRunner.js';
import { sanitizeFilePart } from './validation.js';

export async function searchYouTube(query) {
  const { stdout } = await runCommand(config.ytdlpCommand, [
    `ytsearch${config.maxSearchResults}:${query}`,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
  ]);

  return parseSearchResults(stdout);
}

export function parseSearchResults(stdout) {
  const lines = stdout.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return [];
  }

  return lines.map(line => normalizeSearchItem(parseJsonLine(line)));
}

export async function downloadAudio(url, title, id) {
  const { source } = await ensureDataDirs();
  const safeTitle = sanitizeFilePart(title);
  const safeId = sanitizeFilePart(id);
  const outputTemplate = path.join(source, `${safeId}-${safeTitle}.%(ext)s`);
  const outputPath = path.join(source, `${safeId}-${safeTitle}.mp3`);

  await runCommand(config.ytdlpCommand, [
    '-f',
    'bestaudio/best',
    '--no-playlist',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '-o',
    outputTemplate,
    url,
  ]);

  return outputPath;
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    const appError = new AppError('유튜브 검색 결과를 읽을 수 없습니다.', 500, 'YOUTUBE_PARSE_FAILED');
    appError.cause = error;
    appError.line = line;
    throw appError;
  }
}

function normalizeSearchItem(item) {
  return {
    title: item.title || '',
    url: normalizeUrl(item),
    channel: item.channel || item.uploader || item.creator || '',
    duration: Number.isFinite(item.duration) ? item.duration : null,
    thumbnail: item.thumbnail || lastThumbnailUrl(item.thumbnails),
  };
}

function normalizeUrl(item) {
  if (item.webpage_url) {
    return item.webpage_url;
  }

  if (typeof item.url === 'string' && item.url.startsWith('http')) {
    return item.url;
  }

  if (item.id) {
    return `https://www.youtube.com/watch?v=${item.id}`;
  }

  return item.url || '';
}

function lastThumbnailUrl(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) {
    return '';
  }

  return thumbnails.at(-1)?.url || '';
}
