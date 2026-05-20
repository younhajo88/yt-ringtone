import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createApp } from '../src/server.js';

async function withServer(services, callback) {
  const app = createApp({ services });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('search rejects empty query', async () => {
  await withServer({}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'EMPTY_QUERY');
  });
});

test('search returns normalized service results', async () => {
  await withServer({
    searchYouTube: async query => [{ title: query, url: 'https://youtu.be/demo', channel: 'demo', duration: 91, thumbnail: '' }],
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'test song' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.results[0].title, 'test song');
  });
});

test('prepare rejects non-YouTube URL', async () => {
  await withServer({}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/video', title: 'bad' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_YOUTUBE_URL');
  });
});

test('prepare creates a playable track id', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-ringtone-test-'));
  const audioPath = path.join(tempDir, 'preview.mp3');
  await fs.writeFile(audioPath, 'fake mp3 bytes');

  await withServer({
    getYouTubeInfo: async () => ({ title: 'Demo Song', duration: 120 }),
    downloadAudio: async () => audioPath,
    probeDurationSeconds: async () => 120,
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtu.be/demo', title: 'Demo Song' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.title, 'Demo Song');
    assert.equal(body.durationSeconds, 120);
    assert.match(body.audioUrl, /^\/api\/audio\//);
  });
});

test('prepare rejects videos above the configured duration limit before download', async () => {
  let downloadCalled = false;

  await withServer({
    getYouTubeInfo: async () => ({ title: 'Long playlist', duration: 27_576 }),
    downloadAudio: async () => {
      downloadCalled = true;
    },
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtu.be/D-SPzWajMFQ', title: 'Long playlist' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VIDEO_TOO_LONG');
    assert.equal(downloadCalled, false);
  });
});

test('clip rejects unknown track id', async () => {
  await withServer({}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/clip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'missing', startSeconds: 0 }),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'TRACK_NOT_FOUND');
  });
});

test('clip creates a download URL for prepared track', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-ringtone-test-'));
  const audioPath = path.join(tempDir, 'preview.mp3');
  const clipPath = path.join(tempDir, 'clip.mp3');
  await fs.writeFile(audioPath, 'fake mp3 bytes');

  await withServer({
    getYouTubeInfo: async () => ({ title: 'Demo Song', duration: 120 }),
    downloadAudio: async () => audioPath,
    probeDurationSeconds: async () => 120,
    createThirtySecondClip: async (_previewPath, outputPath) => {
      await fs.writeFile(outputPath, 'fake clip bytes');
      return clipPath;
    },
  }, async baseUrl => {
    const prepare = await fetch(`${baseUrl}/api/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtu.be/demo', title: 'Demo Song' }),
    });
    const track = await prepare.json();

    const response = await fetch(`${baseUrl}/api/clip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: track.id, startSeconds: 10 }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.downloadUrl, /^\/api\/download\//);
  });
});
