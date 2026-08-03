// 작성자: 최정봉
// 내용: 이미지 업로드 라우터
import { Router } from "express";
import multer from "multer";
import { uploadImage, uploadReportImage } from "../controllers/upload.controller";
import { imageUpload, reportImageUpload } from "../utils/imageUpload";
const router = Router();

router.post("/image", (req, res, next) => {
  imageUpload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ success: false, message: error.message });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    next();
  });
}, uploadImage);

router.post("/image/report", (req, res, next) => {
  reportImageUpload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next();
  });
}, uploadReportImage);


export default router;