# YouTube Ringtone Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-hosted personal web app that searches or accepts YouTube URLs, prepares preview audio, clips a selected 30-second MP3 segment, and lets PC or phone browsers download the result.

**Architecture:** Use a small Node.js + Express server that serves static browser UI and exposes JSON/audio/download endpoints. The backend owns all filesystem paths, validates user input, and runs only fixed `yt-dlp` and `ffmpeg` commands through safe argument arrays.

**Tech Stack:** Node.js 20+, Express, built-in `node:test`, `yt-dlp`, `ffmpeg`, plain HTML/CSS/browser JavaScript.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `.gitignore`: excludes `node_modules/`, runtime `data/`, logs, and local env files.
- Create `src/config.js`: host, port, data directory, result limits, and command names.
- Create `src/errors.js`: typed app errors and JSON error responses.
- Create `src/validation.js`: URL/query/time/id validation and filename sanitization.
- Create `src/jobs.js`: in-memory metadata for prepared tracks and generated clips.
- Create `src/processRunner.js`: safe child-process wrapper with timeout and structured output.
- Create `src/tools.js`: startup checks for `yt-dlp` and `ffmpeg`.
- Create `src/youtube.js`: YouTube search and audio download functions.
- Create `src/audio.js`: MP3 preview conversion, duration probing, and 30-second clipping.
- Create `src/server.js`: Express app, static UI, API routes, streaming, and download responses.
- Create `public/index.html`: single-page mobile-friendly UI.
- Create `public/styles.css`: compact responsive styling.
- Create `public/app.js`: browser interactions, API calls, audio preview, slider, and download link.
- Create `tests/validation.test.js`: focused unit tests for pure validation helpers.
- Create `tests/server.test.js`: route tests for invalid inputs and expected JSON error shapes.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/config.js`
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Create npm package metadata**

Create `package.json`:

```json
{
  "name": "yt-ringtone",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Create runtime ignores**

Create `.gitignore`:

```gitignore
node_modules/
data/
.env
*.log
```

- [ ] **Step 3: Create app configuration**

Create `src/config.js`:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  rootDir,
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 8001),
  dataDir: path.join(rootDir, 'data'),
  maxSearchResults: 5,
  maxQueryLength: 120,
  clipDurationSeconds: 30,
  commandTimeoutMs: 120000,
  ytdlpCommand: process.env.YTDLP || 'yt-dlp',
  ffmpegCommand: process.env.FFMPEG || 'ffmpeg',
  ffprobeCommand: process.env.FFPROBE || 'ffprobe'
};
```

- [ ] **Step 4: Create minimal static UI files**

Create `public/index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>YT Ringtone</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <h1>YT Ringtone</h1>
        <form id="search-form" class="search-form">
          <input id="query-input" type="text" maxlength="120" autocomplete="off" placeholder="노래 제목 또는 YouTube URL">
          <button type="submit">검색</button>
        </form>
        <p id="status" class="status"></p>
      </section>
      <section id="results" class="results"></section>
      <section id="editor" class="panel editor" hidden>
        <h2 id="track-title"></h2>
        <audio id="audio" controls preload="metadata"></audio>
        <label class="range-row">
          <span>시작</span>
          <input id="start-range" type="range" min="0" value="0" step="0.1">
        </label>
        <input id="start-input" type="number" min="0" value="0" step="0.1">
        <button id="clip-button" type="button">30초 MP3 만들기</button>
        <a id="download-link" class="download" hidden>다운로드</a>
      </section>
    </main>
    <script src="/app.js" type="module"></script>
  </body>
</html>
```

Create `public/styles.css` with readable mobile-first layout and fixed button/input heights:

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f6f7f9; color: #16181d; }
.shell { width: min(880px, 100%); margin: 0 auto; padding: 20px; }
.panel, .result { background: #fff; border: 1px solid #dfe3ea; border-radius: 8px; padding: 16px; }
h1, h2 { margin: 0 0 12px; font-size: 22px; }
.search-form { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
input, button { min-height: 44px; font: inherit; border-radius: 6px; }
input { border: 1px solid #c8ced8; padding: 0 12px; }
button { border: 0; padding: 0 16px; background: #1769e0; color: #fff; cursor: pointer; }
button:disabled { background: #8daee0; cursor: wait; }
.status { min-height: 22px; margin: 12px 0 0; color: #4a5363; }
.results { display: grid; gap: 10px; margin: 16px 0; }
.result { display: grid; gap: 8px; text-align: left; color: inherit; background: #fff; cursor: pointer; }
.result-title { font-weight: 700; }
.result-meta { color: #5e6878; font-size: 14px; }
.editor { display: grid; gap: 12px; }
.editor[hidden], [hidden] { display: none !important; }
audio { width: 100%; }
.range-row { display: grid; grid-template-columns: 52px 1fr; gap: 8px; align-items: center; }
.download { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; border-radius: 6px; background: #0f8a4b; color: #fff; text-decoration: none; }
@media (max-width: 520px) { .search-form { grid-template-columns: 1fr; } .shell { padding: 12px; } }
```

Create `public/app.js` with a boot marker so the page is functional before APIs exist:

```js
const statusEl = document.querySelector('#status');
statusEl.textContent = '검색어 또는 YouTube URL을 입력하세요.';
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and `express` is installed.

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json package-lock.json .gitignore src/config.js public/index.html public/styles.css public/app.js
git commit -m "feat: scaffold ringtone webapp"
```

## Task 2: Validation And Error Foundation

**Files:**
- Create: `src/errors.js`
- Create: `src/validation.js`
- Create: `tests/validation.test.js`

- [ ] **Step 1: Write validation tests**

Create `tests/validation.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isYouTubeUrl, sanitizeFilePart, validateSearchQuery, validateStartSeconds } from '../src/validation.js';

test('detects supported YouTube URLs', () => {
  assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.equal(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
  assert.equal(isYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ'), false);
});

test('rejects empty or overly long search queries', () => {
  assert.equal(validateSearchQuery(' hello ', 10), 'hello');
  assert.throws(() => validateSearchQuery('   ', 10), /검색어/);
  assert.throws(() => validateSearchQuery('a'.repeat(11), 10), /너무 깁니다/);
});

test('validates clip start seconds', () => {
  assert.equal(validateStartSeconds(12.5, 100, 30), 12.5);
  assert.throws(() => validateStartSeconds(-1, 100, 30), /시작 시간/);
  assert.throws(() => validateStartSeconds(80, 100, 30), /30초/);
});

test('sanitizes filename parts', () => {
  assert.equal(sanitizeFilePart('a/b:c*? song'), 'a_b_c_song');
  assert.equal(sanitizeFilePart('   '), 'audio');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/validation.js` does not exist.

- [ ] **Step 3: Implement typed errors**

Create `src/errors.js`:

```js
export class AppError extends Error {
  constructor(message, status = 400, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function sendError(res, error) {
  const status = error.status || 500;
  const message = error instanceof AppError ? error.message : '서버 오류가 발생했습니다.';
  const code = error.code || 'INTERNAL_ERROR';
  res.status(status).json({ error: { code, message } });
}
```

- [ ] **Step 4: Implement validation helpers**

Create `src/validation.js`:

```js
import { AppError } from './errors.js';

export function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function validateSearchQuery(value, maxLength) {
  const query = String(value || '').trim();
  if (!query) throw new AppError('검색어를 입력하세요.', 400, 'EMPTY_QUERY');
  if (query.length > maxLength) throw new AppError(`검색어가 너무 깁니다. 최대 ${maxLength}자까지 입력하세요.`, 400, 'QUERY_TOO_LONG');
  return query;
}

export function validateStartSeconds(value, durationSeconds, clipDurationSeconds) {
  const start = Number(value);
  if (!Number.isFinite(start) || start < 0) throw new AppError('시작 시간은 0 이상의 숫자여야 합니다.', 400, 'BAD_START');
  if (Number.isFinite(durationSeconds) && start + clipDurationSeconds > durationSeconds) {
    throw new AppError(`선택한 시작 시간에서는 ${clipDurationSeconds}초 클립을 만들 수 없습니다.`, 400, 'START_TOO_LATE');
  }
  return start;
}

export function sanitizeFilePart(value) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return cleaned || 'audio';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`

Expected: PASS for `tests/validation.test.js`.

- [ ] **Step 6: Commit validation foundation**

```bash
git add src/errors.js src/validation.js tests/validation.test.js
git commit -m "feat: add validation foundation"
```

## Task 3: Process Runner And Tool Checks

**Files:**
- Create: `src/processRunner.js`
- Create: `src/tools.js`

- [ ] **Step 1: Implement safe process runner**

Create `src/processRunner.js`:

```js
import { spawn } from 'node:child_process';
import { AppError } from './errors.js';
import { config } from './config.js';

export function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || config.commandTimeoutMs;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new AppError(`${command} 실행 시간이 초과되었습니다.`, 504, 'COMMAND_TIMEOUT'));
    }, timeoutMs);

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      reject(new AppError(`${command} 실행 파일을 찾을 수 없습니다.`, 500, 'COMMAND_NOT_FOUND'));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new AppError(`${command} 실행에 실패했습니다.`, 500, 'COMMAND_FAILED'));
    });
  });
}
```

- [ ] **Step 2: Implement startup tool checks**

Create `src/tools.js`:

```js
import { config } from './config.js';
import { runCommand } from './processRunner.js';

export async function checkTools() {
  await runCommand(config.ytdlpCommand, ['--version'], { timeoutMs: 10000 });
  await runCommand(config.ffmpegCommand, ['-version'], { timeoutMs: 10000 });
  await runCommand(config.ffprobeCommand, ['-version'], { timeoutMs: 10000 });
}
```

- [ ] **Step 3: Manually verify expected missing-tool behavior if tools are absent**

Run: `npm test`

Expected: validation tests still pass. Tool checks are not called by tests yet.

- [ ] **Step 4: Commit process utilities**

```bash
git add src/processRunner.js src/tools.js
git commit -m "feat: add media tool process runner"
```

## Task 4: Job Store And Audio Processing

**Files:**
- Create: `src/jobs.js`
- Create: `src/audio.js`

- [ ] **Step 1: Implement in-memory job store**

Create `src/jobs.js`:

```js
import crypto from 'node:crypto';
import { AppError } from './errors.js';

const tracks = new Map();
const clips = new Map();

export function createTrack(data) {
  const id = crypto.randomUUID();
  const track = { id, createdAt: new Date().toISOString(), ...data };
  tracks.set(id, track);
  return track;
}

export function getTrack(id) {
  const track = tracks.get(id);
  if (!track) throw new AppError('준비된 오디오를 찾을 수 없습니다.', 404, 'TRACK_NOT_FOUND');
  return track;
}

export function createClip(data) {
  const id = crypto.randomUUID();
  const clip = { id, createdAt: new Date().toISOString(), ...data };
  clips.set(id, clip);
  return clip;
}

export function getClip(id) {
  const clip = clips.get(id);
  if (!clip) throw new AppError('생성된 MP3 파일을 찾을 수 없습니다.', 404, 'CLIP_NOT_FOUND');
  return clip;
}
```

- [ ] **Step 2: Implement audio helpers**

Create `src/audio.js`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { runCommand } from './processRunner.js';

export async function ensureDataDirs() {
  await fs.mkdir(path.join(config.dataDir, 'source'), { recursive: true });
  await fs.mkdir(path.join(config.dataDir, 'preview'), { recursive: true });
  await fs.mkdir(path.join(config.dataDir, 'clips'), { recursive: true });
}

export async function probeDurationSeconds(filePath) {
  const { stdout } = await runCommand(config.ffprobeCommand, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ]);
  return Number(stdout.trim());
}

export async function convertPreviewMp3(sourcePath, outputPath) {
  await runCommand(config.ffmpegCommand, [
    '-y',
    '-i', sourcePath,
    '-vn',
    '-codec:a', 'libmp3lame',
    '-b:a', '192k',
    outputPath
  ]);
}

export async function createThirtySecondClip(previewPath, outputPath, startSeconds) {
  await runCommand(config.ffmpegCommand, [
    '-y',
    '-ss', String(startSeconds),
    '-i', previewPath,
    '-t', String(config.clipDurationSeconds),
    '-codec:a', 'libmp3lame',
    '-b:a', '192k',
    outputPath
  ]);
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: validation tests pass.

- [ ] **Step 4: Commit job and audio helpers**

```bash
git add src/jobs.js src/audio.js
git commit -m "feat: add audio job helpers"
```

## Task 5: YouTube Search And Download

**Files:**
- Create: `src/youtube.js`

- [ ] **Step 1: Implement search and download wrappers**

Create `src/youtube.js`:

```js
import path from 'node:path';
import { config } from './config.js';
import { runCommand } from './processRunner.js';
import { sanitizeFilePart } from './validation.js';

export async function searchYouTube(query) {
  const { stdout } = await runCommand(config.ytdlpCommand, [
    `ytsearch${config.maxSearchResults}:${query}`,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings'
  ]);

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .map(item => ({
      title: item.title,
      url: item.url?.startsWith('http') ? item.url : `https://www.youtube.com/watch?v=${item.id}`,
      channel: item.channel || item.uploader || '',
      duration: item.duration || null,
      thumbnail: item.thumbnail || ''
    }));
}

export async function downloadAudio(url, title, id) {
  const baseName = `${id}-${sanitizeFilePart(title)}`;
  const outputTemplate = path.join(config.dataDir, 'source', `${baseName}.%(ext)s`);
  await runCommand(config.ytdlpCommand, [
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputTemplate,
    url
  ]);
  return path.join(config.dataDir, 'source', `${baseName}.mp3`);
}
```

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: existing tests pass.

- [ ] **Step 3: Commit YouTube integration wrapper**

```bash
git add src/youtube.js
git commit -m "feat: add youtube media wrapper"
```

## Task 6: Express Server And API Routes

**Files:**
- Create: `src/server.js`
- Create: `tests/server.test.js`

- [ ] **Step 1: Create route tests for invalid input**

Create `tests/server.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/server.js';

async function withServer(callback) {
  const app = createApp({ checkExternalTools: false });
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
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '' })
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'EMPTY_QUERY');
  });
});

test('clip rejects unknown track id', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/clip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'missing', startSeconds: 0 })
    });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'TRACK_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/server.js` does not exist or does not export `createApp`.

- [ ] **Step 3: Implement Express server**

Create `src/server.js`:

```js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { sendError } from './errors.js';
import { validateSearchQuery, validateStartSeconds } from './validation.js';
import { ensureDataDirs, probeDurationSeconds, createThirtySecondClip } from './audio.js';
import { createTrack, getTrack, createClip, getClip } from './jobs.js';
import { searchYouTube, downloadAudio } from './youtube.js';
import { checkTools } from './tools.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(path.join(rootDir, 'public')));

  app.post('/api/search', async (req, res) => {
    try {
      const query = validateSearchQuery(req.body?.query, config.maxQueryLength);
      const results = await searchYouTube(query);
      res.json({ results });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/prepare', async (req, res) => {
    try {
      const url = validateSearchQuery(req.body?.url, 300);
      const title = String(req.body?.title || 'audio');
      const tempTrack = createTrack({ title, sourcePath: '', previewPath: '', durationSeconds: null });
      const sourcePath = await downloadAudio(url, title, tempTrack.id);
      const durationSeconds = await probeDurationSeconds(sourcePath);
      tempTrack.sourcePath = sourcePath;
      tempTrack.previewPath = sourcePath;
      tempTrack.durationSeconds = durationSeconds;
      res.json({ id: tempTrack.id, title: tempTrack.title, durationSeconds, audioUrl: `/api/audio/${tempTrack.id}` });
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
      const startSeconds = validateStartSeconds(req.body?.startSeconds, track.durationSeconds, config.clipDurationSeconds);
      const outputPath = path.join(config.dataDir, 'clips', `${track.id}-${Date.now()}.mp3`);
      await createThirtySecondClip(track.previewPath, outputPath, startSeconds);
      const clip = createClip({ trackId: track.id, outputPath, filename: `${track.title}-ringtone.mp3` });
      res.json({ clipId: clip.id, downloadUrl: `/api/download/${clip.id}` });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/download/:clipId', (req, res) => {
    try {
      const clip = getClip(req.params.clipId);
      res.download(clip.outputPath, clip.filename);
    } catch (error) {
      sendError(res, error);
    }
  });

  return app;
}

export async function startServer() {
  await ensureDataDirs();
  await checkTools();
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn(`Warning: server binding to ${config.host}. Anyone who can reach this port can use the app.`);
  }
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`YT Ringtone listening at http://${config.host}:${config.port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS for validation and route tests.

- [ ] **Step 5: Commit API server**

```bash
git add src/server.js tests/server.test.js
git commit -m "feat: add ringtone api server"
```

## Task 7: Browser UI Behavior

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace boot marker with full browser behavior**

Replace `public/app.js`:

```js
const form = document.querySelector('#search-form');
const input = document.querySelector('#query-input');
const statusEl = document.querySelector('#status');
const resultsEl = document.querySelector('#results');
const editorEl = document.querySelector('#editor');
const trackTitleEl = document.querySelector('#track-title');
const audioEl = document.querySelector('#audio');
const startRangeEl = document.querySelector('#start-range');
const startInputEl = document.querySelector('#start-input');
const clipButton = document.querySelector('#clip-button');
const downloadLink = document.querySelector('#download-link');

let selectedTrackId = null;
let selectedTitle = '';

function setStatus(message) {
  statusEl.textContent = message;
}

async function api(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || '요청에 실패했습니다.');
  return payload;
}

function renderResults(results) {
  resultsEl.innerHTML = '';
  for (const result of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result';
    button.innerHTML = `
      <span class="result-title"></span>
      <span class="result-meta"></span>
    `;
    button.querySelector('.result-title').textContent = result.title;
    button.querySelector('.result-meta').textContent = [result.channel, result.duration ? `${result.duration}s` : ''].filter(Boolean).join(' · ');
    button.addEventListener('click', () => prepareTrack(result.url, result.title));
    resultsEl.append(button);
  }
}

async function prepareTrack(url, title) {
  setStatus('오디오를 준비하는 중입니다.');
  downloadLink.hidden = true;
  const track = await api('/api/prepare', { url, title });
  selectedTrackId = track.id;
  selectedTitle = track.title;
  trackTitleEl.textContent = track.title;
  audioEl.src = track.audioUrl;
  startRangeEl.max = Math.max(0, Math.floor(track.durationSeconds - 30));
  startRangeEl.value = '0';
  startInputEl.value = '0';
  editorEl.hidden = false;
  setStatus('미리듣기 후 시작 시간을 선택하세요.');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    setStatus('검색 중입니다.');
    editorEl.hidden = true;
    downloadLink.hidden = true;
    const payload = await api('/api/search', { query: input.value });
    renderResults(payload.results);
    setStatus(payload.results.length ? '결과를 선택하세요.' : '검색 결과가 없습니다.');
  } catch (error) {
    setStatus(error.message);
  }
});

startRangeEl.addEventListener('input', () => {
  startInputEl.value = startRangeEl.value;
  audioEl.currentTime = Number(startRangeEl.value);
});

startInputEl.addEventListener('input', () => {
  startRangeEl.value = startInputEl.value;
});

clipButton.addEventListener('click', async () => {
  try {
    if (!selectedTrackId) return;
    clipButton.disabled = true;
    setStatus('30초 MP3를 만드는 중입니다.');
    const clip = await api('/api/clip', { id: selectedTrackId, startSeconds: Number(startInputEl.value) });
    downloadLink.href = clip.downloadUrl;
    downloadLink.download = `${selectedTitle}-ringtone.mp3`;
    downloadLink.textContent = 'MP3 다운로드';
    downloadLink.hidden = false;
    setStatus('완성되었습니다.');
  } catch (error) {
    setStatus(error.message);
  } finally {
    clipButton.disabled = false;
  }
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Commit browser UI behavior**

```bash
git add public/app.js
git commit -m "feat: add ringtone browser workflow"
```

## Task 8: Final Local Verification

**Files:**
- No planned code changes unless verification reveals a concrete defect.

- [ ] **Step 1: Check external tools**

Run: `yt-dlp --version`

Expected: prints a version.

Run: `ffmpeg -version`

Expected: prints ffmpeg version details.

- [ ] **Step 2: Start the server**

Run: `npm start`

Expected: logs `YT Ringtone listening at http://0.0.0.0:8001`.

- [ ] **Step 3: Test from PC browser**

Open: `http://127.0.0.1:8001`

Expected:

- Page loads.
- Search input is visible.
- Searching a phrase returns up to 5 results.
- Selecting a result prepares playable audio.
- Choosing a start time and clicking the clip button creates a download link.
- Downloaded file is an MP3 around 30 seconds long.

- [ ] **Step 4: Test from phone browser**

Find the PC IPv4 address with `ipconfig`, then open `http://PC_IP:8001` on the phone.

Expected:

- Page loads on the phone.
- Generated MP3 downloads from the phone browser.

- [ ] **Step 5: Commit verification fixes only if needed**

If verification required code changes:

```bash
git status --short
git add public/app.js src/server.js src/audio.js src/youtube.js src/validation.js tests/server.test.js tests/validation.test.js
git commit -m "fix: stabilize ringtone workflow"
```

Only include files that actually changed in the `git add` command. If no code changes were needed, do not create a commit.

## Self-Review Notes

- Spec coverage: search, URL preparation, preview playback, 30-second clipping, download, Windows local hosting, no-login constraints, and phone browser access are all covered by tasks.
- Deferred scope: waveform editing, ringtone auto-setting, cloud hosting, accounts, and batch conversion are intentionally absent from implementation tasks.
- Validation consistency: `validateSearchQuery`, `validateStartSeconds`, job ids, `track.id`, and `clip.id` are introduced before route and UI tasks use them.
