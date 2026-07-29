// 작업자 : 최정봉
// 작업일 : 2026-07-23
// 내용 : KST 시간 관련 유틸리티 함수

/** KST 오프셋(9시간) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 오늘 시작 시간(KST) */
export function getTodayStartKst(now = new Date()): Date {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      0, 0, 0, 0
    ) - KST_OFFSET_MS
  );
}

/** 오늘 종료 시간(KST) */
export function getTodayEndKst(now = new Date()): Date {
  return new Date(getTodayStartKst(now).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** 기본 범위 시작 시간(KST) */
export function getDefaultRangeStartKst(days = 30, now = new Date()): Date {
  return new Date(getTodayStartKst(now).getTime() - days * 24 * 60 * 60 * 1000);
}


/** 프론트가 보낸 벽시계(타임존 없음)를 DB DATETIME 비교용으로 그대로 사용 */
function parseWallClockAsUtc(raw: string): Date {
  const s = raw.trim().replace(" ", "T");
  // 이미 Z/+09:00 있으면 그대로
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  // "2026-07-28T23:59:59.999" → 23:59:59 그대로 유지 (로컬 -9h 금지)
  return new Date(s + "Z");
}

export function parseDateStartKst(raw: string): Date {
  const s = raw.trim();
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    // 날짜만 → 그날 00:00:00 (DATETIME 기준, -9h 하지 않음)
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  return parseWallClockAsUtc(s);
}
export function parseDateEndKst(raw: string): Date {
  const s = raw.trim();
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }
  return parseWallClockAsUtc(s);
}


/** Prisma → DATETIME에 KST 벽시계로 저장할 때 사용 */
export function toKstWallClock(date = new Date()): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}