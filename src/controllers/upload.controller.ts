// 작성자: 최정봉
// 내용: 이미지 업로드 컨트롤러
import { Request, Response } from "express";

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
