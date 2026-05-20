import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createThirtySecondClip, ensureDataDirs, probeDurationSeconds } from './audio.js';
import { config } from './config.js';
import { AppError, sendError } from './errors.js';
import { checkTools } from './tools.js';
import { createClip, createTrack, getClip, getTrack } from './jobs.js';
import { downloadAudio, searchYouTube } from './youtube.js';
import { isYouTubeUrl, sanitizeFilePart, validateSearchQuery, validateStartSeconds } from './validation.js';

const currentFile = fileURLToPath(import.meta.url);
const publicDir = path.join(config.rootDir, 'public');

const defaultServices = {
  createThirtySecondClip,
  downloadAudio,
  probeDurationSeconds,
  searchYouTube,
};

export function createApp(options = {}) {
  const services = { ...defaultServices, ...(options.services || {}) };
  const app = express();

  app.use(express.json({ limit: '32kb' }));

  app.post('/api/search', async (req, res) => {
    try {
      const query = validateSearchQuery(req.body?.query, config.maxQueryLength);
      const results = await services.searchYouTube(query);
      res.json({ results });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/prepare', async (req, res) => {
    try {
      const url = validateSearchQuery(req.body?.url, 300);
      if (!isYouTubeUrl(url)) {
        throw new AppError('유효한 YouTube URL을 입력해 주세요.', 400, 'INVALID_YOUTUBE_URL');
      }

      const title = validateTitle(req.body?.title);
      const placeholderTrack = createTrack({
        title,
        sourcePath: '',
        previewPath: '',
        durationSeconds: null,
      });
      const sourcePath = await services.downloadAudio(url, title, placeholderTrack.id);
      const durationSeconds = await services.probeDurationSeconds(sourcePath);

      placeholderTrack.sourcePath = sourcePath;
      placeholderTrack.previewPath = sourcePath;
      placeholderTrack.durationSeconds = durationSeconds;

      res.json({
        id: placeholderTrack.id,
        title: placeholderTrack.title,
        durationSeconds,
        audioUrl: `/api/audio/${placeholderTrack.id}`,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/audio/:id', (req, res) => {
    try {
      const track = getTrack(req.params.id);
      res.sendFile(track.previewPath);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/clip', async (req, res) => {
    try {
      const track = getTrack(req.body?.id);
      const startSeconds = validateStartSeconds(
        req.body?.startSeconds,
        track.durationSeconds,
        config.clipDurationSeconds,
      );
      const clipName = `${sanitizeFilePart(track.title)}-ringtone.mp3`;
      const outputPath = path.join(config.dataDir, 'clips', `${track.id}-${Date.now()}.mp3`);

      await services.createThirtySecondClip(track.previewPath, outputPath, startSeconds);
      const clip = createClip({
        trackId: track.id,
        outputPath,
        filename: clipName,
        startSeconds,
      });

      res.json({
        clipId: clip.id,
        downloadUrl: `/api/download/${clip.id}`,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/download/:clipId', (req, res) => {
    try {
      const clip = getClip(req.params.clipId);
      if (!fs.existsSync(clip.outputPath)) {
        throw new AppError('생성된 MP3 파일을 찾을 수 없습니다.', 404, 'CLIP_FILE_NOT_FOUND');
      }
      res.download(clip.outputPath, clip.filename);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.use(express.static(publicDir));

  return app;
}

export async function startServer() {
  await ensureDataDirs();
  await checkTools();

  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn(`Warning: server binding to ${config.host}. Anyone who can reach this port can use the app.`);
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`yt-ringtone listening on http://${config.host}:${config.port}`);
  });

  return server;
}

if (process.argv[1] === currentFile) {
  startServer().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

function validateTitle(value) {
  const title = String(value || '').trim();
  return title || 'audio';
}
