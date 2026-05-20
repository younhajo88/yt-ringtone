import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');

export const config = {
  rootDir,
  host: process.env.HOST || '0.0.0.0',
  port: Number.parseInt(process.env.PORT || '3000', 10),
  dataDir: process.env.DATA_DIR || path.join(rootDir, 'data'),
  maxSearchResults: 5,
  maxQueryLength: 120,
  clipDurationSeconds: 30,
  commandTimeoutMs: 120000,
  ytdlpCommand: process.env.YTDLP_COMMAND || 'yt-dlp',
  ffmpegCommand: process.env.FFMPEG_COMMAND || 'ffmpeg',
  ffprobeCommand: process.env.FFPROBE_COMMAND || 'ffprobe'
};
