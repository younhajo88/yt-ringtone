import { spawn } from 'node:child_process';

import { config } from './config.js';
import { AppError } from './errors.js';

export function runCommand(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs ?? config.commandTimeoutMs;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let stdout = '';
    let stderr = '';

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
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
        reject(createCommandError('명령을 찾을 수 없습니다.', 500, 'COMMAND_NOT_FOUND', {
          command,
          args,
          stdout,
          stderr,
          cause: error,
        }));
        return;
      }

      reject(createCommandError('명령을 실행할 수 없습니다.', 500, 'COMMAND_FAILED', {
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

      if (timedOut) {
        reject(createCommandError('명령 실행 시간이 초과되었습니다.', 504, 'COMMAND_TIMEOUT', {
          command,
          args,
          stdout,
          stderr,
          signal,
        }));
        return;
      }

      if (exitCode !== 0) {
        reject(createCommandError('명령 실행에 실패했습니다.', 500, 'COMMAND_FAILED', {
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
