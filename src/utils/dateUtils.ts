// 작업자 : 최정봉
// 작업일 : 2026-07-23
// 내용 : KST 시간 관련 유틸리티 함수

/** KST 오프셋(9시간) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

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