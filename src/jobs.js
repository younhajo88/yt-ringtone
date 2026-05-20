import { randomUUID } from 'node:crypto';

import { AppError } from './errors.js';

const tracks = new Map();
const clips = new Map();

export function createTrack(data) {
  const track = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
