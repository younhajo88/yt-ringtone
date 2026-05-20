import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { config } from '../src/config.js';
import { AppError } from '../src/errors.js';
import { createClip, createTrack, getClip, getTrack } from '../src/jobs.js';
import { runCommand } from '../src/processRunner.js';
import { downloadAudio, parseSearchResults } from '../src/youtube.js';

describe('jobs', () => {
  test('stores tracks and clips by generated id', () => {
    const track = createTrack({ title: 'Song', sourcePath: 'source.mp3' });
    const clip = createClip({ trackId: track.id, outputPath: 'clip.mp3', startSeconds: 12 });

    assert.equal(typeof track.id, 'string');
    assert.equal(getTrack(track.id), track);
    assert.equal(typeof clip.id, 'string');
    assert.equal(getClip(clip.id), clip);
  });

  test('throws AppError when a track or clip is missing', () => {
    assertAppErrorCode(() => getTrack('missing-track'), 'TRACK_NOT_FOUND');
    assertAppErrorCode(() => getClip('missing-clip'), 'CLIP_NOT_FOUND');
  });
});

describe('runCommand', () => {
  test('resolves stdout and stderr for a successful command', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'console.log("hello"); console.error("note");'],
      { timeoutMs: 5000 },
    );

    assert.equal(result.stdout.trim(), 'hello');
    assert.equal(result.stderr.trim(), 'note');
    assert.equal(result.exitCode, 0);
  });

  test('throws COMMAND_FAILED for non-zero exits', async () => {
    await assert.rejects(
      runCommand(process.execPath, ['-e', 'console.error("bad"); process.exit(7);'], { timeoutMs: 5000 }),
      error => error instanceof AppError && error.code === 'COMMAND_FAILED' && error.exitCode === 7,
    );
  });

  test('throws COMMAND_TIMEOUT when a process exceeds timeout', async () => {
    await assert.rejects(
      runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 1000);'], { timeoutMs: 20 }),
      error => error instanceof AppError && error.code === 'COMMAND_TIMEOUT',
    );
  });
});

describe('parseSearchResults', () => {
  test('returns normalized search results from yt-dlp JSON lines', () => {
    const stdout = [
      JSON.stringify({
        title: 'First',
        url: 'https://youtube.com/watch?v=first',
        channel: 'Channel A',
        duration: 123,
        thumbnail: 'https://img.test/first.jpg',
      }),
      JSON.stringify({
        title: 'Second',
        webpage_url: 'https://youtube.com/watch?v=second',
        uploader: 'Channel B',
        duration: null,
        thumbnails: [{ url: 'https://img.test/thumb-small.jpg' }, { url: 'https://img.test/thumb-large.jpg' }],
      }),
    ].join('\n');

    assert.deepEqual(parseSearchResults(stdout), [
      {
        title: 'First',
        url: 'https://youtube.com/watch?v=first',
        channel: 'Channel A',
        duration: 123,
        thumbnail: 'https://img.test/first.jpg',
      },
      {
        title: 'Second',
        url: 'https://youtube.com/watch?v=second',
        channel: 'Channel B',
        duration: null,
        thumbnail: 'https://img.test/thumb-large.jpg',
      },
    ]);
  });

  test('returns an empty list for blank yt-dlp output', () => {
    assert.deepEqual(parseSearchResults('  \n'), []);
  });
});

describe('downloadAudio', () => {
  test('rejects non-YouTube URLs before command execution', async () => {
    const previousCommand = config.ytdlpCommand;
    config.ytdlpCommand = 'definitely-not-a-real-command-for-this-test';

    try {
      await assert.rejects(
        downloadAudio('https://example.com/watch?v=not-youtube', 'Title', 'video-id'),
        error => error instanceof AppError && error.code === 'INVALID_YOUTUBE_URL' && error.status === 400,
      );
    } finally {
      config.ytdlpCommand = previousCommand;
    }
  });
});

function assertAppErrorCode(fn, code) {
  assert.throws(
    fn,
    error => error instanceof AppError && error.code === code,
  );
}
