import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const currentFile = fileURLToPath(import.meta.url);
const publicDir = path.join(config.rootDir, 'public');

export function createApp() {
  const app = express();

  app.use(express.static(publicDir));

  return app;
}

export function startServer() {
  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`yt-ringtone listening on http://${config.host}:${config.port}`);
  });

  return server;
}

if (process.argv[1] === currentFile) {
  startServer();
}
