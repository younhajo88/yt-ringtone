import { config } from './config.js';
import { runCommand } from './processRunner.js';

const TOOL_CHECK_TIMEOUT_MS = 10000;

export async function checkTools() {
  const [ytdlp, ffmpeg, ffprobe] = await Promise.all([
    readVersion(config.ytdlpCommand, ['--version']),
    readVersion(config.ffmpegCommand, ['-version']),
    readVersion(config.ffprobeCommand, ['-version']),
  ]);

  return { ytdlp, ffmpeg, ffprobe };
}

async function readVersion(command, args) {
  const { stdout, stderr } = await runCommand(command, args, { timeoutMs: TOOL_CHECK_TIMEOUT_MS });
  const output = stdout || stderr;

  return output.split(/\r?\n/).find(line => line.trim())?.trim() || '';
}
