// // 담당: 제보/알림팀
import { randomUUID } from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

// export const IMAGE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "img");

// fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });

// const storage = multer.diskStorage({
//   destination: (_req, _file, callback) => {
//     callback(null, IMAGE_UPLOAD_DIR);
//   },
//   filename: (_req, file, callback) => {
//     const extension = path.extname(file.originalname).toLowerCase();
//     callback(null, `${Date.now()}-${randomUUID()}${extension}`);
//   },
// });

// export const imageUpload = multer({
//   storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024,
//   },
//   fileFilter: (_req, file, callback) => {
//     if (!file.mimetype.startsWith("image/")) {
//       callback(new Error("이미지 파일만 업로드할 수 있습니다."));
//       return;
//     }

//     callback(null, true);
//   },
// });

export const IMAGE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "img");

fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, IMAGE_UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("이미지 파일만 업로드할 수 있습니다."));
      return;
    }

    callback(null, true);
  },
});

/** 제보 전용: 원본은 메모리만 (마스킹 후 컨트롤러에서 저장) */
export const reportImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("이미지 파일만 업로드할 수 있습니다."));
      return;
    }
    callback(null, true);
  },
});
