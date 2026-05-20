import { spawn } from 'node:child_process';

import { config } from './config.js';
import { AppError } from './errors.js';

export function runCommand(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs ?? config.commandTimeoutMs;
  const spawnCommand = options.spawn ?? spawn;

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';

    const child = spawnCommand(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;

      try {
        child.kill();
      } catch {
        // The timeout error is the failure callers need to handle.
      }

      reject(createCommandError('작업 시간이 너무 오래 걸려 중단했습니다. 짧은 영상인지 확인하고 다시 시도해 주세요.', 504, 'COMMAND_TIMEOUT', {
        command,
        args,
        stdout,
        stderr,
      }));
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', chunk => {
      stdout += chunk;
    });

    child.stderr?.on('data', chunk => {
      stderr += chunk;
    });

    child.on('error', error => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (error.code === 'ENOENT') {
          reject(createCommandError('필요한 프로그램을 찾을 수 없습니다. yt-dlp, ffmpeg, ffprobe 설치를 확인해 주세요.', 500, 'COMMAND_NOT_FOUND', {
          command,
          args,
          stdout,
          stderr,
          cause: error,
        }));
        return;
      }

      reject(createCommandError('작업을 실행할 수 없습니다. URL을 확인하거나 다른 영상을 시도해 주세요.', 500, 'COMMAND_FAILED', {
        command,
        args,
        stdout,
        stderr,
        cause: error,
      }));
    });

    child.on('close', (exitCode, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (exitCode !== 0) {
        reject(createCommandError('작업에 실패했습니다. URL을 확인하거나 다른 영상을 시도해 주세요.', 500, 'COMMAND_FAILED', {
          command,
          args,
          stdout,
          stderr,
          exitCode,
          signal,
        }));
        return;
      }

      resolve({ stdout, stderr, exitCode, signal });
    });
  });
}

function createCommandError(message, status, code, details) {
  const error = new AppError(message, status, code);

  Object.assign(error, details);
  return error;
}
