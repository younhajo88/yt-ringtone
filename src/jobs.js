import { randomUUID } from 'node:crypto';

import { AppError } from './errors.js';

const tracks = new Map();
const clips = new Map();

export function createTrack(data) {
  const track = {
    ...data,
    id: randomUUID(),
    createdAt: Date.now(),
  };

  tracks.set(track.id, track);
  return track;
}

export function getTrack(id) {
  const track = tracks.get(id);

  if (!track) {
    throw new AppError('트랙을 찾을 수 없습니다.', 404, 'TRACK_NOT_FOUND');
  }

  return track;
}

export function createClip(data) {
  const clip = {
    ...data,
    id: randomUUID(),
    createdAt: Date.now(),
  };

  clips.set(clip.id, clip);
  return clip;
}

export function getClip(id) {
  const clip = clips.get(id);

  if (!clip) {
    throw new AppError('클립을 찾을 수 없습니다.', 404, 'CLIP_NOT_FOUND');
  }

  return clip;
}

export function cleanupOldJobs(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;

  return {
    tracksRemoved: removeOlderThan(tracks, cutoff),
    clipsRemoved: removeOlderThan(clips, cutoff),
  };
}

function removeOlderThan(records, cutoff) {
  let removed = 0;

  for (const [id, record] of records) {
    if (createdAtMs(record.createdAt) < cutoff) {
      records.delete(id);
      removed += 1;
    }
  }

  return removed;
}

function createdAtMs(value) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
