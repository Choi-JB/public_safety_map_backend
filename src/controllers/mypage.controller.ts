// 담당: 피드백/관리자팀
// 작성자: 최정봉
// 내용 : 마이페이지 관련 컨트롤러
import { Request, Response } from "express";
import prismaClient from "../config/prismaClient";

/** 마이페이지 정보 조회 */
export const getMypage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = BigInt((req as any).user.id);

    //유효성 검사
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    //유저가 제보한 제보, 피드백 건수 조회
    const reportCount = await prismaClient.report.count({
      where: { user_id: user.id, is_active: "Y" },
    });
    const feedbackCount = await prismaClient.feedback.count({
      where: { user_id: user.id, is_active: "Y" },
    });
    return res.status(200).json({
      success: true, data: {
        user: user,
        reportCount: reportCount,
        feedbackCount: feedbackCount,
      }
    });
  } catch (err) {
    console.error("[getMypage]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** 내가 제보한 report 목록 조회*/
export const getMyReportList = async (req: Request, res: Response): Promise<Response> => {
  try {
    //페이지, 한 페이지당 아이템 수, 필터, 날짜 범위(일수) (기본값: 30일)
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const userId = BigInt((req as any).user.id);
    //내가 제보한 report 목록 조회
    const reports = await prismaClient.report.findMany({
      where: { user_id: userId, is_active: "Y" },
      skip,
      take: Number(limit),
      orderBy: {
        created_at: 'desc',
      },
      include: {
        user: {
          select: {
            nickname: true,
          },
        },
      },
    });


    return res.status(200).json({ success: true, data: reports });
  } catch (err) {
    console.error("[getMyReportList]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** 내가 제보한 feedback 목록 조회*/
export const getMyFeedbackList = async (req: Request, res: Response): Promise<Response> => {
  try {
    //페이지, 한 페이지당 아이템 수, 필터, 날짜 범위(일수) (기본값: 30일)
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const userId = BigInt((req as any).user.id);
    //내가 제보한 feedback 목록 조회
    const feedbacks = await prismaClient.feedback.findMany({
      where: { user_id: userId, is_active: "Y" },
      skip,
      take: Number(limit),
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        comment: true,
        safety_feeling: true,
        img_url: true,
        created_at: true,
        grid_id: true,
        feedback_tag: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // feedbackTags 배열을 tags 배열로 평탄화
    const result = feedbacks.map(f => ({
      id: f.id,
      comment: f.comment,
      safety_feeling: f.safety_feeling,
      img_url: f.img_url,
      created_at: f.created_at,
      grid_id: f.grid_id,
      tags: f.feedback_tag.map(ft => ft.tag), // [{id, name}, {id, name}, ...]
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[getMyFeedbackList]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};