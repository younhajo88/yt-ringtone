import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from './config.js';
import { AppError } from './errors.js';
import { runCommand } from './processRunner.js';

export async function ensureDataDirs() {
  const dirs = getDataDirs();

  await Promise.all(Object.values(dirs).map(dir => fs.mkdir(dir, { recursive: true })));
  return dirs;
}

export async function probeDurationSeconds(filePath) {
  const { stdout } = await runCommand(config.ffprobeCommand, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);

  const duration = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(duration)) {
    throw new AppError('오디오 길이를 확인할 수 없습니다.', 500, 'PROBE_FAILED');
  }

  return duration;
}

export async function convertPreviewMp3(sourcePath, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runCommand(config.ffmpegCommand, [
    '-y',
    '-i',
    sourcePath,
    '-vn',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ]);

  return outputPath;
}

export async function createThirtySecondClip(previewPath, outputPath, startSeconds) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runCommand(config.ffmpegCommand, [
    '-y',
    '-ss',
    String(startSeconds),
    '-i',
    previewPath,
    '-t',
    String(config.clipDurationSeconds),
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ]);

  return outputPath;
}

export function getDataDirs() {
  return {
    data: config.dataDir,
    source: path.join(config.dataDir, 'source'),
    preview: path.join(config.dataDir, 'preview'),
    clips: path.join(config.dataDir, 'clips'),
  };
}
