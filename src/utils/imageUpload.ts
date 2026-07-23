import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import sharp from 'sharp';
import config from '../config/index.js';
import { AppError } from './errors.js';
import { applyFaceMosaic } from './faceMask.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadRoot = path.resolve(__dirname, '..', '..', config.uploadDir);

function ensureUploadDir() {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!ok) {
      return cb(new AppError(400, 'VALIDATION_ERROR', 'image must be jpeg/png/webp'));
    }
    return cb(null, true);
  },
});

/** Multer field name MUST be `image` (Contract). */
export const uploadImage = upload.single('image');

export async function saveResizedImage(file?: Express.Multer.File | null): Promise<string | null> {
  if (!file) return null;
  ensureUploadDir();

  const maskedBuffer = await applyFaceMosaic(file.buffer);

  const filename = `report_${Date.now()}.jpg`;
  const fullPath = path.join(uploadRoot, filename);
  await sharp(maskedBuffer)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(fullPath);

  const url = `${config.publicBaseUrl}/uploads/${filename}`;
  if (url.length > 255) {
    throw new AppError(400, 'VALIDATION_ERROR', 'img_url exceeds 255 characters');
  }
  return url;
}
