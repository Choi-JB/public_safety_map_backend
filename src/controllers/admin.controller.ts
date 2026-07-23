// 담당: 피드백/관리자팀
import { Request, Response } from "express";
import prismaClient from '../config/prismaClient';

//bigint serializer 에러 바로 bigint를 문자로 리턴
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/** 대시보드 현황 조회 (전체(활성화된)+신규 신고 수, 전체+신규 피드백 수, 현재 진행 중인 도시 행사 수)*/
export const getAdminSummary = async (req: Request, res: Response): Promise<Response> => {

  try {
    const now = new Date(); // 현재 시각 UTC
    const kstOffsetMs = 9 * 60 * 60 * 1000; // KST 오프셋 (9시간)
    const kstNow = new Date(now.getTime() + kstOffsetMs); // 현재 시각 KST
    const todayStartKst = new Date(
      Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate(),
        0, 0, 0, 0
      ) - kstOffsetMs // KST 00:00:00
    ); // 오늘 00:00:00 KST

    const [
      active_reports,
      reports_today,
      total_feedbacks,
      feedbacks_today,
      active_city_events,
    ] = await Promise.all([
      // 활성 제보만
      prismaClient.report.count({
        where: { is_active: "Y" },
      }),
      // 오늘 등록된 제보
      prismaClient.report.count({
        where: {
          created_at: { gte: todayStartKst },
        },
      }),
      // 누적 피드백 (소프트삭제 포함 전체 — 스펙의 total_feedbacks)
      prismaClient.feedback.count(),
      // 오늘 등록된 피드백
      prismaClient.feedback.count({
        where: {
          created_at: { gte: todayStartKst },
        },
      }),
      // 종료되지 않은 도시정보만 (end_at >= 현재시각)
      prismaClient.city_events.count({
        where: {
          end_at: { gte: now },
        },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        active_reports,
        reports_today,
        total_feedbacks,
        feedbacks_today,
        active_city_events,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/** 유저 신고 목록 조회(필터 별 조회) 필터: 전체(최신순), 동네 구역별, 활성화 여부 */
export const getUserReports = async (req: Request, res: Response): Promise<Response> => {
  try {
    const now = new Date(); // 현재 시각 UTC
    const kstOffsetMs = 9 * 60 * 60 * 1000; // KST 오프셋 (9시간)
    const kstNow = new Date(now.getTime() + kstOffsetMs); // 현재 시각 KST
    const todayStartKst = new Date(
      Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate(),
        0, 0, 0, 0
      ) - kstOffsetMs // KST 00:00:00
    ); // 오늘 00:00:00 KST

    // 오늘 끝(다음날 0시 직전) — 날짜없을 경우 기본값
    const todayEndKst = new Date(todayStartKst.getTime() + 24 * 60 * 60 * 1000 - 1);
    const defaultStart = new Date(todayStartKst.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dateFromRaw = req.query.date_from as string | undefined;
    const dateToRaw = req.query.date_to as string | undefined;
    
    const dateFrom =
      dateFromRaw && dateFromRaw.trim() !== ""
        ? new Date(dateFromRaw)
        : defaultStart;
    const dateTo =
      dateToRaw && dateToRaw.trim() !== ""
      ? (() => {
        const d = new Date(dateToRaw);
        // 날짜만 온 경우(시간이 00:00) → 그날 23:59:59.999
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw.trim());
        if (isDateOnly) {
          d.setHours(23, 59, 59, 999); // 로컬 기준이면 KST 서버에 맞춤
          // 또는: d.setUTCHours(14, 59, 59, 999); // UTC로 KST 하루 끝 맞출 때
        }
        return d;
      })()
        : todayEndKst;
        
    // 잘못된 날짜면 400
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date" });
    }

    const where: any = {
      created_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    //기본값
    const { page = 1, limit = 10, filter = 'active' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (filter === 'active') {
      where.is_active = "Y";
    } else if (filter === 'inactive') {
      where.is_active = "N";
    }

    const reports = await prismaClient.report.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: {
        created_at: 'desc',
      },
    });
    return res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error(error);

    if (req.query == null) {
      return res.status(400).json({ success: false, message: "유효하지 않은 요청입니다." });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


/** 유저 신고 삭제 */
//만료일 이후 에는 자동으로 is_active를 N으로 변경(비활성화) -> 해당부분은 DB이벤트 스케쥴러 사용
export const deleteUserReport = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};




/** 피드백 목록 조회(필터 별 조회) 필터: 전체(최신순), 동네 구역별, 활성화 여부 */
export const getFeedbackList = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};

/** 피드백 상세 조회 */
export const getFeedbackDetail = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};

/** 피드백 삭제(비활성화) */
export const deleteFeedback = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};


/** 도시 행사 목록 조회 */
export const getCityEvents = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};

/** 도시 행사 상세 조회 */
export const getCityEventDetail = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};

/** 도시 행사 등록 */
export const createCityEvent = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};

/** 도시 행사 수정 */
export const updateCityEvent = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};

/** 도시 행사 삭제 */
export const deleteCityEvent = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
};
