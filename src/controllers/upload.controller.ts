// 작성자: 최정봉
// 내용: 이미지 업로드 컨트롤러
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { IMAGE_UPLOAD_DIR } from "../utils/imageUpload";
import { maskImageBuffer } from "../utils/imgMasking";

/** 이미지 업로드 */
export const uploadImage = (req: Request, res: Response): Response => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "업로드할 이미지 파일이 필요합니다.",
    });
  }

  const imagePath = `/uploads/img/${req.file.filename}`;

  return res.status(201).json({
    success: true,
    data: {
      original_name: req.file.originalname,
      file_name: req.file.filename,
      image_path: imagePath,
      img_url: `${req.protocol}://${req.get("host")}${imagePath}`,
      size: req.file.size,
    },
  });
};

/** 제보 이미지 업로드 (마스킹 후 저장) */
export const uploadReportImage = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "업로드할 이미지 파일이 필요합니다.",
    });
  }
  try {
    const masked = await maskImageBuffer(req.file.buffer);
    const fileName = `${Date.now()}-${randomUUID()}.jpg`;
    await fs.writeFile(path.join(IMAGE_UPLOAD_DIR, fileName), masked);
    const imagePath = `/uploads/img/${fileName}`;
    return res.status(201).json({
      success: true,
      data: {
        original_name: req.file.originalname,
        file_name: fileName,
        image_path: imagePath,
        img_url: `${req.protocol}://${req.get("host")}${imagePath}`,
        size: masked.length,
      },
    });
  } catch (error) {
    console.error("[uploadReportImage]", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "이미지 마스킹에 실패했습니다.",
    });
  }
};
