// 담당: 피드백/관리자팀
// 작성자: 최정봉
// 내용 : 관리자 관련 컨트롤러
import { Request, Response } from "express";
import prismaClient from '../config/prismaClient';
import { getTypes } from '../utils/commonUtils';

// KST 시간 관련 유틸리티 함수 (오늘 시작 시간, 오늘 종료 시간, 기본 범위 시작 시간)
import { getTodayStartKst, getTodayEndKst, getDefaultRangeStartKst, parseDateStartKst, parseDateEndKst, toKstWallClock } from '../utils/dateUtils';
import { sendPushNotification } from "../utils/notification.service";

//bigint serializer 에러 바로 bigint를 문자로 리턴
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};


/** 대시보드 현황 조회 (전체(활성화된)+신규 신고 수, 전체+신규 피드백 수, 현재 진행 중인 도시 행사 수)*/
export const getAdminSummary = async (req: Request, res: Response): Promise<Response> => {

  try {
    const now = new Date(); // 현재 시각 UTC
    const todayStartKst = toKstWallClock(getTodayStartKst(now));//오늘 시작 시간(KST) 00시 00분 00초

    const [
      active_reports,
      reports_today,
      total_feedbacks,
      feedbacks_today,
      active_city_events,
      inactive_city_events,
    ] = await Promise.all([
      // 활성 제보만
      prismaClient.report.count({
        where: { is_active: "Y" },
      }),
      // 오늘 등록된 제보
      prismaClient.report.count({
        where: {
          created_at: { gte: todayStartKst },
          is_active: "Y",
        },

      }),
      // 누적 피드백 (소프트삭제 포함 전체 — 스펙의 total_feedbacks)
      prismaClient.feedback.count(),
      // 오늘 등록된 피드백
      prismaClient.feedback.count({
        where: {
          created_at: { gte: todayStartKst },
          is_active: "Y",
        },
      }),
      // 종료되지 않은 도시정보만 (end_at >= 현재시각)
      prismaClient.city_events.count({
        where: {
          is_active: "Y",
          end_at: { gte: now },
        },
      }),
      //종료된 도시정보만
      prismaClient.city_events.count({
        where: {
          is_active: "Y",
          end_at: { lt: now },
        },
      })
      
    ]);

    //최근 5일간 일별 신규 제보 수
    const reports_daily_count = await prismaClient.$queryRaw<
      {date: string, count: bigint}[]
    >`
    SELECT 
      d.date,
      COUNT(r.id) AS count
    FROM (
      SELECT CURDATE() AS date
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY)
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY)
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY)
    ) d
    LEFT JOIN report r
      ON DATE(r.created_at) = d.date
      AND r.is_active = 'Y'
    GROUP BY d.date
    ORDER BY d.date ASC
    `;

    const five_days_reports_count = reports_daily_count.map((item) => ({
      date: item.date,
      count: item.count,
    }));

    //최근 5일간 일별 피드백 수
    const feedbacks_daily_count = await prismaClient.$queryRaw<
      {date: string, count: bigint}[]
    >`
    SELECT 
      d.date,
      COUNT(f.id) AS count
    FROM (
      SELECT CURDATE() AS date
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY)
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY)
      UNION ALL
      SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY)
    ) d
    LEFT JOIN feedback f
      ON DATE(f.created_at) = d.date
      AND f.is_active = 'Y'
    GROUP BY d.date
    ORDER BY d.date ASC
    `;

    const five_days_feedbacks_count = feedbacks_daily_count.map((item) => ({
      date: item.date,
      count: item.count,
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        active_reports,
        reports_today,
        total_feedbacks,
        feedbacks_today,
        active_city_events,
        inactive_city_events,
        five_days_reports_count,
        five_days_feedbacks_count,
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

/** 현재 로그인된 관리자 세션 확인 */
export const getAdminMe = async (req: Request, res: Response): Promise<Response> => {
  const admin = (req as any).admin;
  if (!admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  return res.status(200).json({
    success: true,
    data: { id: admin.id, nickname: admin.nickname, role: admin.role, email: admin.email },
  });
};

/** 유저 신고 목록 조회(필터 별 조회) 필터: 전체(최신순), 동네 구역별, 활성화 여부 */
export const getUserReports = async (req: Request, res: Response): Promise<Response> => {
  try {

    //페이지, 한 페이지당 아이템 수, 필터, 날짜 범위(일수) (기본값: 30일)
    const { page = 1, limit = 10, filter = 'active', date_range = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    //기본값 설정
    const todayEndKst = getTodayEndKst();//오늘 종료 시간(KST)
    const defaultStart = getDefaultRangeStartKst(Number(date_range));//기본 범위 시작 시간(KST)

    //유저가 입력한 값
    const dateFromRaw = req.query.date_from as string | undefined;//날짜 범위 시작 시간
    const dateToRaw = req.query.date_to as string | undefined;//날짜 범위 종료 시간
    const nickname = (req.query.nickname as string | undefined)?.trim();
    const keyword = (req.query.keyword as string | undefined)?.trim();

    //console.log("req: ", dateFromRaw, dateToRaw);
    //날짜 범위 시작 시간, 날짜 범위 종료 시간 설정 (입력값이 있을 경우 없으면 기본값으로 대체)
    const dateFrom =
      dateFromRaw && dateFromRaw.trim() !== ""
        ? parseDateStartKst(dateFromRaw)
        : defaultStart;
    const dateTo =
      dateToRaw && dateToRaw.trim() !== ""
        ? parseDateEndKst(dateToRaw)
        : todayEndKst;

    // 잘못된 날짜면 400
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date" });
    }

    //console.log("parsed date: ", dateFrom, "dateTo: ", dateTo);
    //조회 조건 (날짜 범위)
    const where: any = {
      created_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    //조회 조건 (활성화 여부)
    if (filter === 'active') {
      where.is_active = "Y";
    } else if (filter === 'inactive') {
      where.is_active = "N";
    }

    //조회 조건 (작성자 닉네임 / 키워드: description)
    if (nickname) {
      where.user = { nickname: { contains: nickname } };
    }
    if (keyword) {
      where.description = { contains: keyword };
    }

    const orderBy = filter === "inactive"
      ? { expire_at: "desc" as const }  // 비활성 → 만료/비활성 시각 기준
      : { created_at: "desc" as const }; // 활성(또는 전체) → 등록일 기준


    // const reports = await prismaClient.report.findMany({
    //   where,
    //   skip,
    //   take: Number(limit),
    //   orderBy,
    //   //report 테이블의 user_id와 user 테이블의 id가 같은 경우 nickname 필드 추가
    //   //report 제보한 사람의 닉네임 추가
    //   include: {
    //     user: {
    //       select: {
    //         nickname: true,
    //       },
    //     },
    //   },
    // });

    const [reports, total] = await Promise.all([
      prismaClient.report.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        //report 테이블의 user_id와 user 테이블의 id가 같은 경우 nickname 필드 추가
        //report 제보한 사람의 닉네임 추가
        include: {
          user: {
            select: {
              nickname: true,
            },
          },
        },
      }),
      prismaClient.report.count({
        where
      })
    ]);

    const reportTypes = await getTypes("report");

    return res.status(200).json({
      success: true,
      data: reports,
      types: reportTypes,
      total
    });
  } catch (error) {
    console.error(error);

    if (req.query == null) {
      return res.status(400).json({ success: false, message: "유효하지 않은 요청입니다." });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** 유저 신고(제보) 등록 */
export const createUserReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id, type, description, img_url, grid_id,lat, lng } = req.body;
    if (!id || !type || !description || !grid_id || !lat || !lng) {
      return res.status(400).json({ success: false, message: "입력값을 모두 채워주세요!" });
    }
    const grid = await prismaClient.grid.findUnique({
      where: { id: BigInt(grid_id) },
    });
    if (!grid) {
      return res.status(404).json({ success: false, message: "그리드를 찾을 수 없습니다!" });
    }
    const created_by = await prismaClient.user.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
      },
    });
    if (!created_by) {
      return res.status(404).json({ success: false, message: "등록자를 찾을 수 없습니다!" });
    }
    await prismaClient.report.create({
      data: {
        user_id: created_by.id,
        type, description, img_url:img_url || null, grid_id: grid.id, lat, lng, 
        created_at: toKstWallClock(),
        expire_at: toKstWallClock(new Date(new Date().getTime() + 24 * 60 * 60 * 1000)),
      },
    }).then(async (report) => {
      //알림 전송 (모든 유저에게 전송)
      await sendPushNotification(
        {
          topic: "all",
          type: "report",
          title: "새로운 제보 등록",
          body:report.description ?? "",
          data: { 
            id: Number(report.id),
            type: report.type,
            description:report.description,
            img_url:report.img_url,
            lat: String(report.lat),
            lng: String(report.lng),
            created_at: report.created_at
          },
        }
      );
    });
    return res.status(200).json({ success: true, message: "등록되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "등록에 실패했습니다!" });
  }
};


/** 유저 신고(제보) 삭제 */
//만료일 이후 에는 자동으로 is_active를 N으로 변경(비활성화) -> 해당부분은 DB이벤트 스케쥴러 사용
export const deleteUserReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = parseInt(req.body.id);

    //유효성 검사
    const report = await prismaClient.report.findUnique({
      where: { id: BigInt(id) },
    });
    //없는 항목일 경우
    if (!report) {
      return res.status(404).json({ success: false, message: "항목을 찾을 수 없습니다!" });
    }
    //유효성 검사
    const is_active = await prismaClient.report.findUnique({
      where: {
        id: BigInt(id),
        is_active: "N"
      },
    });
    //이미 삭제되었을 경우
    if (is_active) {
      return res.status(400).json({ success: false, message: "이미 삭제된 항목입니다!" });
    }

    //삭제 로직 (is_active를 N으로 변경)
    await prismaClient.report.update({
      where: { id: BigInt(id) },
      data: {
        is_active: "N",
      },

    })
    return res.status(200).json({ success: true, message: "삭제되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "삭제에 실패했습니다!" });
  }
};

/** 유저 신고(제보) 항목 복구 */
export const restoreUserReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = parseInt(req.body.id);

    //유효성 검사
    const report = await prismaClient.report.findUnique({
      where: { id: BigInt(id) },
    });
    //없는 항목일 경우
    if (!report) {
      return res.status(404).json({ success: false, message: "항목을 찾을 수 없습니다!" });
    }
    //유효성 검사
    const is_active = await prismaClient.report.findUnique({
      where: {
        id: BigInt(id),
        is_active: "Y"
      },
    });
    //이미 복구되었을 경우
    if (is_active) {
      return res.status(400).json({ success: false, message: "이미 활성화된 항목입니다!" });
    }

    //복구 로직 (is_active를 Y으로 변경)
    await prismaClient.report.update({
      where: { id: BigInt(id) },
      data: {
        is_active: "Y",
      },
    })
    return res.status(200).json({ success: true, message: "복구되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "복구에 실패했습니다!" });
  }
};


/** 피드백 목록 조회(필터 별 조회) 필터: 전체(최신순), 동네 구역별, 활성화 여부 */
export const getFeedbackList = async (req: Request, res: Response): Promise<Response> => {
  try {
    //페이지, 한 페이지당 아이템 수, 필터, 날짜 범위(일수) (기본값: 30일)
    const { page = 1, limit = 10, filter = 'active', date_range = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    //기본값 설정
    const todayEndKst = getTodayEndKst();//오늘 종료 시간(KST) 23시 59분 59초
    const defaultStart = getDefaultRangeStartKst(Number(date_range));//기본 범위 시작 시간(KST)

    //날짜 범위 시작 시간, 날짜 범위 종료 시간 (입력값이 있을 경우)
    const dateFromRaw = req.query.date_from as string | undefined;//날짜 범위 시작 시간
    const dateToRaw = req.query.date_to as string | undefined;//날짜 범위 종료 시간
    const nickname = (req.query.nickname as string | undefined)?.trim();
    const keyword = (req.query.keyword as string | undefined)?.trim();

    //날짜 범위 시작 시간, 날짜 범위 종료 시간 설정 (입력값이 있을 경우 없으면 기본값으로 대체)
    const dateFrom =
      dateFromRaw && dateFromRaw.trim() !== ""
        ? parseDateStartKst(dateFromRaw)
        : defaultStart;
    const dateTo =
      dateToRaw && dateToRaw.trim() !== ""
        ? parseDateEndKst(dateToRaw)
        : todayEndKst;

    //조회 조건 설정 (날짜 범위)
    const where: any = {
      created_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    //조회 조건 설정 (활성화 여부)
    if (filter === 'active') {
      where.is_active = "Y";
    } else if (filter === 'inactive') {
      where.is_active = "N";
    }

    //조회 조건 (작성자 닉네임 / 키워드: comment)
    if (nickname) {
      where.user = { nickname: { contains: nickname } };
    }
    if (keyword) {
      where.comment = { contains: keyword };
    }

    const [feedbacks, total] = await Promise.all([
      prismaClient.feedback.findMany({
        where,
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
          grid:{
            select: {
              id: true,
              lat: true,
              lng: true,
            },
          },
        },
      }),
      prismaClient.feedback.count({
        where
      })
    ]);

    return res.status(200).json({
      success: true,
      data: feedbacks,
      total
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "피드백 목록 조회에 실패했습니다!" });
  }
};


/** 피드백 삭제(비활성화) */
export const deleteFeedback = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = parseInt(req.body.id);

    //유효성 검사
    const feedback = await prismaClient.feedback.findUnique({
      where: { id: BigInt(id) },
    });
    //없는 항목일 경우
    if (!feedback) {
      return res.status(404).json({ success: false, message: "항목을 찾을 수 없습니다!" });
    }
    //유효성 검사
    const is_active = await prismaClient.feedback.findUnique({
      where: {
        id: BigInt(id),
        is_active: "N"
      },
    });
    //이미 삭제되었을 경우
    if (is_active) {
      return res.status(400).json({ success: false, message: "이미 삭제된 항목입니다!" });
    }

    //삭제 로직 (is_active를 N으로 변경)
    await prismaClient.feedback.update({
      where: { id: BigInt(id) },
      data: {
        is_active: "N",
      },
    })
    return res.status(200).json({ success: true, message: "삭제되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "삭제에 실패했습니다!" });
  }
};


/** 도시 행사 목록 조회 */
export const getCityEvents = async (req: Request, res: Response): Promise<Response> => {
  try {
    //페이지, 한 페이지당 아이템 수, 필터, 날짜 범위(일수) (기본값: 30일)
    const { page = 1, limit = 10, filter = 'active', date_range = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    //기본값 설정
    const todayEndKst = getTodayEndKst();//오늘 종료 시간(KST)
    const defaultStart = getDefaultRangeStartKst(Number(date_range));//기본 범위 시작 시간(KST)

    //유저가 입력한 값
    const dateFromRaw = req.query.date_from as string | undefined;//날짜 범위 시작 시간
    const dateToRaw = req.query.date_to as string | undefined;//날짜 범위 종료 시간
    const nickname = (req.query.nickname as string | undefined)?.trim();
    const keyword = (req.query.keyword as string | undefined)?.trim();
    const status = (req.query.status as string | undefined)?.trim();

    //날짜 범위 시작 시간, 날짜 범위 종료 시간 설정 (입력값이 있을 경우 없으면 기본값으로 대체)
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

    //조회 조건 (날짜 범위)
    const where: any = {
      start_at: {
        lte: dateTo,
      },
      end_at: {
        gte: dateFrom,
      },
    };

    //조회 조건 (활성화 여부)
    if (filter === 'active') {
      where.is_active = "Y";
    } else if (filter === 'inactive') {
      where.is_active = "N";
    }

    //조회 조건 (진행 상태: scheduled | ongoing | ended)
    const now = new Date();
    if (status === "scheduled") {
      // 예정: 아직 시작 전
      where.AND = [...(where.AND || []), { start_at: { gt: now } }];
    } else if (status === "ongoing") {
      // 진행중: 시작됨 & 아직 종료 안 됨
      where.AND = [...(where.AND || []), { start_at: { lte: now }, end_at: { gte: now } }];
    } else if (status === "ended") {
      // 종료: 종료 시각이 지남
      where.AND = [...(where.AND || []), { end_at: { lt: now } }];
    }

    //조회 조건 (작성자 닉네임 / 키워드: title)
    if (nickname) {
      where.user = { nickname: { contains: nickname } };
    }
    if (keyword) {
      where.title = { contains: keyword };
    }

    const cityEventTypes = await getTypes("city_events");

    const [cityEvents, total] = await Promise.all([
      prismaClient.city_events.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [
          { is_active: "desc" },   // N → Y
          { created_at: "desc" },  // 같은 상태끼리는 최신순
        ],
        include: {
          user: {
            select: {
              nickname: true,
            },
          },
        },
      }),
      prismaClient.city_events.count({
        where
      })
    ]);

    return res.status(200).json({ success: true, data: cityEvents, types: cityEventTypes, total });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "도시 행사 목록 조회에 실패했습니다!" });
  }
};


/** 도시 행사 등록 */
export const createCityEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id, type, title, description, lat, lng, start_at, end_at, img_url } = req.body;

    //유효성 검사
    if (!type || !title || !description || !lat || !lng || !start_at || !end_at) {
      return res.status(400).json({ success: false, message: "입력값을 모두 채워주세요!" });
    }

    //유저가 입력한 값
    const dateFromRaw = req.query.start_at as string | undefined;//날짜 범위 시작 시간
    const dateToRaw = req.query.end_at as string | undefined;//날짜 범위 종료 시간

    const dateFrom =
      dateFromRaw && dateFromRaw.trim() !== ""
        ? new Date(dateFromRaw)
        : toKstWallClock();
    const dateTo =
      dateToRaw && dateToRaw.trim() !== ""
        ? new Date(dateToRaw)
        : toKstWallClock();

    const created_by = await prismaClient.user.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
      },
    });
    if (!created_by) {
      return res.status(404).json({ success: false, message: "등록자를 찾을 수 없습니다!" });
    }

    await prismaClient.city_events.create({
      data: {
        type, title, description, lat, lng, created_by: created_by.id,
        start_at: dateFrom, end_at: dateTo, created_at: toKstWallClock(), img_url: img_url || null
      },
    })
    return res.status(200).json({ success: true, message: "등록되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "등록에 실패했습니다!" });
  }
};

/** 도시 행사 수정 */
export const updateCityEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id, type, title, description, lat, lng, start_at, end_at, created_at, img_url } = req.body;

    //유효성 검사
    const cityEvent = await prismaClient.city_events.findUnique({
      where: { id: BigInt(id) },
    });
    //없는 항목일 경우
    if (!cityEvent) {
      return res.status(404).json({ success: false, message: "항목을 찾을 수 없습니다!" });
    }

    //유저가 입력한 값
    const dateFromRaw = req.query.start_at as string | undefined;//날짜 범위 시작 시간
    const dateToRaw = req.query.end_at as string | undefined;//날짜 범위 종료 시간

    const dateFrom =
      dateFromRaw && dateFromRaw.trim() !== ""
        ? new Date(dateFromRaw)
        : new Date();
    const dateTo =
      dateToRaw && dateToRaw.trim() !== ""
        ? new Date(dateToRaw)
        : new Date();

    //수정 로직
    await prismaClient.city_events.update({
      where: { id: BigInt(id) },
      data: {
        type, title, description, lat, lng,
        start_at: dateFrom, end_at: dateTo,
        img_url: img_url || null,
      },
    })
    return res.status(200).json({ success: true, message: "수정되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "수정에 실패했습니다!" });
  }
};

/** 도시 행사 삭제 */
export const deleteCityEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = parseInt(req.body.id);

    //유효성 검사
    const cityEvent = await prismaClient.city_events.findUnique({
      where: { id: BigInt(id) },
    });
    //없는 항목일 경우
    if (!cityEvent) {
      return res.status(404).json({ success: false, message: "항목을 찾을 수 없습니다!" });
    }
    //이미 비활성화된 경우
    const is_active = await prismaClient.city_events.findUnique({
      where: {
        id: BigInt(id),
        is_active: "N"
      },
    });
    //이미 비활성화된 경우
    if (is_active) {
      return res.status(400).json({ success: false, message: "이미 삭제된 항목입니다!" });
    }

    //삭제 로직
    await prismaClient.city_events.update({
      where: { id: BigInt(id) },
      data: {
        is_active: "N"
      },
    })
    return res.status(200).json({ success: true, message: "삭제되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "삭제에 실패했습니다!" });
  }
};

/** 도시 행사 복구 */
export const restoreCityEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = parseInt(req.body.id);

    //유효성 검사
    const cityEvent = await prismaClient.city_events.findUnique({
      where: { id: BigInt(id) },
    });
    //없는 항목일 경우
    if (!cityEvent) {
      return res.status(404).json({ success: false, message: "항목을 찾을 수 없습니다!" });
    }
    //유효성 검사
    const is_active = await prismaClient.city_events.findUnique({
      where: {
        id: BigInt(id),
        is_active: "Y"
      },
    });
    //이미 복구되었을 경우
    if (is_active) {
      return res.status(400).json({ success: false, message: "이미 활성화된 항목입니다!" });
    }

    //복구 로직 (is_active를 Y으로 변경)
    await prismaClient.city_events.update({
      where: { id: BigInt(id) },
      data: { is_active: "Y" },
    })
    return res.status(200).json({ success: true, message: "복구되었습니다!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "복구에 실패했습니다!" });
  }
};

/** 그리드 아이디 조회
 * request: lat, lng
 * response: grid_id
*/
export const getGridId = async (req: Request, res: Response): Promise<Response> => {
  try {
    const ORIGIN_LAT = 33.0;
    const ORIGIN_LNG = 124.5;
    const CELL = 0.01;  //-> 격자 1km로 필요시 수정 
    const BATCH_SIZE = 500;

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const row = Math.floor((lat - ORIGIN_LAT) / CELL)
    const col = Math.floor((lng - ORIGIN_LNG) / CELL)
    const gridId = await prismaClient.grid.findUnique({
      where: { grid_row_grid_col: { grid_row: row, grid_col: col } },
      select: {
        id: true,
      },
    });

    if (!gridId) {
      return res.status(200).json({ success: true, message: "그리드 아이디가 없는 곳입니다." });
    }
    return res.status(200).json({ success: true, data: gridId.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "그리드 아이디 조회에 실패했습니다!" });
  }
};