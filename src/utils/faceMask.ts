import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import { AppError } from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * backend/masking (img-masking 이식)으로 얼굴 모자이크 적용
 */
export function applyFaceMosaic(inputBuffer: Buffer): Promise<Buffer> {
  if (!config.masking.enabled) {
    return Promise.resolve(inputBuffer);
  }

  const script = path.resolve(__dirname, '..', '..', 'scripts', 'mask_face.py');
  const python = config.masking.python;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const child = spawn(python, [script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      windowsHide: true,
    });

    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', (c: Buffer) => errChunks.push(c));
    child.on('error', (err) => {
      reject(
        new AppError(
          500,
          'INTERNAL_ERROR',
          `얼굴 마스킹 Python 실행 실패 (${python}): ${err.message}`
        )
      );
    });
    child.on('close', (code) => {
      const errText = Buffer.concat(errChunks).toString('utf8').trim();
      if (code !== 0) {
        reject(
          new AppError(
            500,
            'INTERNAL_ERROR',
            errText ||
              `얼굴 마스킹 실패 (exit ${code}). backend/masking 의존성·PYTHON 경로를 확인하세요.`
          )
        );
        return;
      }
      const out = Buffer.concat(chunks);
      if (!out.length) {
        reject(new AppError(500, 'INTERNAL_ERROR', '마스킹 결과가 비어 있습니다.'));
        return;
      }
      if (errText) console.log('[masking]', errText);
      resolve(out);
    });

    child.stdin.write(inputBuffer);
    child.stdin.end();
  });
}
