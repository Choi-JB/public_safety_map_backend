// 작성자 : 최정봉
// 내용 : 인증 개선 사항 검증 스크립트
//        S0. 마이페이지 응답에 민감 필드가 없는지
//        S1. 첫 시도 성공 로그인 후 실패 카운트가 0인지 (성공 시 초기화)
//        S2. 잘못된 비밀번호 1회 → 남은 횟수 안내, 이후 성공 시 초기화
//        S3. 동시 로그인 실패 20개 → bcrypt까지 가는 요청이 5개 이하인지 (시도 선점)
//        S4. 잠금 만료 후 정상 로그인 + 카운트 초기화 (--fast 이면 건너뜀)
//        S5. 같은 refresh token 동시 사용 → 1개만 성공, 유예 시간 내 중복은 전체 폐기 안 함
//        S6. 유예 시간 이후 폐기 토큰 재사용 → 전체 폐기 (--fast 이면 건너뜀)
//
// 사전 조건 : 백엔드 서버가 떠 있어야 함 (npm run dev)
// 실행      : npx ts-node --transpile-only scripts/authTest.ts [--fast] [--base=http://localhost:5000] [--allow-remote]
//   --fast          잠금/유예 시간 대기(약 62초)가 필요한 S4, S6을 건너뜀
//   --base=URL      API 주소 (기본: http://localhost:$PORT)
//   --allow-remote  localhost가 아닌 API/DB에도 실행 허용 (기본은 차단)
//
// 주의 : 테스트용 계정 2개를 만들었다가 종료 시 삭제함. DB는 .env의 DATABASE_URL을 사용

import prisma from "../src/config/prismaClient";

const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const ALLOW_REMOTE = args.includes("--allow-remote");
const BASE =
  args.find((a) => a.startsWith("--base="))?.slice("--base=".length) ??
  `http://localhost:${process.env.PORT || 5000}`;

// auth.controller.ts의 정책 값과 같아야 함
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const GRACE_MS = 10_000;

const LOGIN_CONCURRENCY = 20;
const REFRESH_CONCURRENCY = 5;

const PASSWORD = "TestPassw0rd!";
const WRONG_PASSWORD = "WrongPassw0rd!";
const stamp = Date.now();
const EMAIL_LOCK = `authtest.lock.${stamp}@example.test`;
const EMAIL_REFRESH = `authtest.refresh.${stamp}@example.test`;

/* ---------------------------------- 유틸 ---------------------------------- */

type CheckResult = { name: string; ok: boolean; detail: string };
const results: CheckResult[] = [];

function check(name: string, ok: boolean, detail = ""): void {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   (${detail})` : ""}`);
}

function title(text: string): void {
  console.log(`\n■ ${text}`);
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 본문 없음 */
  }
  return { status: res.status, json };
}

/** 앱 방식(client=app)으로 로그인: refresh token을 쿠키가 아닌 body로 받음 */
function login(email: string, password: string) {
  return call("POST", "/auth/login", { email, password, client: "app" });
}

function refreshWith(token: string) {
  return call("POST", "/auth/refresh", { refresh_token: token, client: "app" });
}

async function register(email: string): Promise<void> {
  const res = await call("POST", "/auth/register", {
    email,
    password: PASSWORD,
    nickname: "authtest",
  });
  if (res.status !== 201) {
    throw new Error(`테스트 계정 생성 실패 (${res.status}): ${JSON.stringify(res.json)}`);
  }
}

async function dbUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, failed_login_count: true, locked_until: true },
  });
  if (!user) throw new Error(`DB에서 테스트 계정을 찾지 못함: ${email}`);
  return user;
}

async function sleep(ms: number, label: string): Promise<void> {
  console.log(`  … ${label}: ${Math.round(ms / 1000)}초 대기`);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, Math.min(10_000, end - Date.now())));
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    if (left > 0) console.log(`    ${left}초 남음`);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isLocal(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
}

/** 테스트 계정을 만들고 지우는 스크립트라, 원격 API/DB에는 명시적 허용이 있어야 실행 */
function assertSafeTarget(): void {
  const apiHost = hostOf(BASE);
  const dbHost = hostOf(process.env.DATABASE_URL ?? "");
  console.log(`대상 API : ${BASE}`);
  console.log(`대상 DB  : ${dbHost || "(DATABASE_URL 없음)"}`);
  if (!ALLOW_REMOTE && (!isLocal(apiHost) || !isLocal(dbHost))) {
    throw new Error(
      "API 또는 DB가 localhost가 아닙니다. 테스트 계정을 생성/삭제하므로 기본적으로 차단합니다. " +
        "정말 실행하려면 --allow-remote 를 붙이세요."
    );
  }
}

/* --------------------------------- 시나리오 -------------------------------- */

async function s0toS3(): Promise<void> {
  await register(EMAIL_LOCK);

  // S0. 마이페이지 응답
  title("S0. 마이페이지 응답에 민감 필드가 없는지");
  const first = await login(EMAIL_LOCK, PASSWORD);
  const accessToken: string | undefined = first.json?.data?.access_token;
  check("로그인 성공(200)", first.status === 200, `status=${first.status}`);
  if (!accessToken) throw new Error("access_token을 받지 못함");

  const mypage = await call("GET", "/mypage", undefined, accessToken);
  const userObj = mypage.json?.data?.user ?? {};
  const forbidden = ["password_hash", "active_session_id", "failed_login_count", "locked_until"];
  const leaked = forbidden.filter((k) => k in userObj);
  check("마이페이지 조회 성공(200)", mypage.status === 200, `status=${mypage.status}`);
  check(
    "민감 필드가 응답에 없음",
    leaked.length === 0,
    leaked.length ? `노출된 필드: ${leaked.join(", ")}` : `응답 필드: ${Object.keys(userObj).join(", ")}`
  );

  // S1. 첫 시도 성공 후 카운트
  title("S1. 첫 시도 성공 로그인 후 실패 카운트가 0인지");
  const afterFirst = await dbUser(EMAIL_LOCK);
  check("성공 로그인 후 failed_login_count == 0", afterFirst.failed_login_count === 0, `count=${afterFirst.failed_login_count}`);

  // S2. 실패 1회 → 안내 메시지, 성공 시 초기화
  title("S2. 실패 1회 → 남은 횟수 안내, 이후 성공하면 초기화");
  const wrongOnce = await login(EMAIL_LOCK, WRONG_PASSWORD);
  const remaining = MAX_FAILED_ATTEMPTS - 1;
  check("잘못된 비밀번호 → 401", wrongOnce.status === 401, `status=${wrongOnce.status}`);
  check(
    `남은 횟수 안내가 ${remaining}회`,
    String(wrongOnce.json?.message ?? "").includes(`${remaining} 회`),
    `message="${wrongOnce.json?.message}"`
  );
  const okAgain = await login(EMAIL_LOCK, PASSWORD);
  const afterOk = await dbUser(EMAIL_LOCK);
  check("이어서 성공 로그인(200)", okAgain.status === 200, `status=${okAgain.status}`);
  check("성공 후 failed_login_count == 0", afterOk.failed_login_count === 0, `count=${afterOk.failed_login_count}`);

  // S3. 동시 실패 요청
  title(`S3. 틀린 비밀번호로 동시에 ${LOGIN_CONCURRENCY}개 요청 (시도 선점)`);
  const burst = await Promise.all(
    Array.from({ length: LOGIN_CONCURRENCY }, () => login(EMAIL_LOCK, WRONG_PASSWORD))
  );
  const n401 = burst.filter((r) => r.status === 401).length;
  const n429 = burst.filter((r) => r.status === 429).length;
  const nOther = LOGIN_CONCURRENCY - n401 - n429;
  console.log(`  결과: 401(비교까지 감)=${n401}, 429(비교 전 차단)=${n429}, 기타=${nOther}`);
  check(
    `bcrypt까지 간 요청이 ${MAX_FAILED_ATTEMPTS}개 이하`,
    n401 <= MAX_FAILED_ATTEMPTS,
    `401=${n401}`
  );
  check(
    `나머지는 429로 차단 (최소 ${LOGIN_CONCURRENCY - MAX_FAILED_ATTEMPTS}개)`,
    n429 >= LOGIN_CONCURRENCY - MAX_FAILED_ATTEMPTS,
    `429=${n429}`
  );
  check("500 등 예상 밖 응답 없음", nOther === 0, `기타=${nOther}`);

  const locked = await dbUser(EMAIL_LOCK);
  check(
    "DB에 잠금(locked_until)이 미래 시각으로 설정됨",
    !!locked.locked_until && locked.locked_until.getTime() > Date.now() - 1000,
    `locked_until=${locked.locked_until?.toISOString() ?? "null"}`
  );
  const duringLock = await login(EMAIL_LOCK, PASSWORD);
  check("잠금 중에는 맞는 비밀번호도 429", duringLock.status === 429, `status=${duringLock.status}`);
}

/** S5 결과를 S6이 이어서 쓰기 위해 반환 */
async function s5(): Promise<{ userId: bigint; oldToken: string; latestToken: string } | null> {
  title(`S5. 같은 refresh token으로 동시에 ${REFRESH_CONCURRENCY}개 refresh`);
  await register(EMAIL_REFRESH);
  const loggedIn = await login(EMAIL_REFRESH, PASSWORD);
  const r1: string | undefined = loggedIn.json?.data?.refresh_token;
  if (!r1) {
    check("refresh token 발급", false, `status=${loggedIn.status}`);
    return null;
  }
  const { id: userId } = await dbUser(EMAIL_REFRESH);

  const burst = await Promise.all(
    Array.from({ length: REFRESH_CONCURRENCY }, () => refreshWith(r1))
  );
  const ok200 = burst.filter((r) => r.status === 200);
  const n401 = burst.filter((r) => r.status === 401).length;
  const nOther = REFRESH_CONCURRENCY - ok200.length - n401;
  console.log(`  결과: 200=${ok200.length}, 401=${n401}, 기타=${nOther}`);
  check("성공은 정확히 1개 (토큰 중복 발급 없음)", ok200.length === 1, `200=${ok200.length}`);
  check(
    `나머지 ${REFRESH_CONCURRENCY - 1}개는 401 (500 없음)`,
    n401 === REFRESH_CONCURRENCY - 1,
    `401=${n401}, 기타=${nOther}`
  );

  const r2: string | undefined = ok200[0]?.json?.data?.refresh_token;
  if (!r2) return null;

  // 유예 시간 안의 중복 요청이 "전체 폐기"를 일으키지 않았다면, 방금 받은 새 토큰이 살아 있어야 함
  const next = await refreshWith(r2);
  check("유예 시간 내 중복 요청 후에도 새 토큰이 유효 (전체 폐기 안 됨)", next.status === 200, `status=${next.status}`);
  const r3: string | undefined = next.json?.data?.refresh_token;
  if (!r3) return null;

  return { userId, oldToken: r1, latestToken: r3 };
}

async function s4AndS6(refreshState: { userId: bigint; oldToken: string; latestToken: string } | null): Promise<void> {
  // 잠금(60초)과 유예(10초)가 모두 지나도록 한 번만 기다림
  await sleep(LOCKOUT_MS + 2_000, "잠금 만료 및 유예 시간 경과");

  title("S4. 잠금 만료 후 정상 동작");
  const relogin = await login(EMAIL_LOCK, PASSWORD);
  const afterUnlock = await dbUser(EMAIL_LOCK);
  check("잠금 만료 후 맞는 비밀번호 로그인(200)", relogin.status === 200, `status=${relogin.status}`);
  check(
    "카운트와 잠금이 초기화됨",
    afterUnlock.failed_login_count === 0 && afterUnlock.locked_until === null,
    `count=${afterUnlock.failed_login_count}, locked_until=${afterUnlock.locked_until?.toISOString() ?? "null"}`
  );
  const wrongAfter = await login(EMAIL_LOCK, WRONG_PASSWORD);
  check(
    "잠금 해제 후 틀리면 곧바로 재잠금되지 않고 새로 카운트 (401)",
    wrongAfter.status === 401 &&
      String(wrongAfter.json?.message ?? "").includes(`${MAX_FAILED_ATTEMPTS - 1} 회`),
    `status=${wrongAfter.status}, message="${wrongAfter.json?.message}"`
  );

  title(`S6. 유예 시간(${GRACE_MS / 1000}초) 이후 폐기 토큰 재사용 → 탈취 의심 처리`);
  if (!refreshState) {
    check("S5 결과가 있어야 검증 가능", false, "S5에서 토큰을 확보하지 못함");
    return;
  }
  const reuse = await refreshWith(refreshState.oldToken);
  check("오래전에 폐기된 토큰 재사용 → 401", reuse.status === 401, `status=${reuse.status}`);
  const alive = await prisma.refresh_token.count({
    where: { user_id: refreshState.userId, revoked_at: null },
  });
  check("해당 유저의 토큰이 전부 폐기됨", alive === 0, `살아 있는 토큰 ${alive}개`);
  const latest = await refreshWith(refreshState.latestToken);
  check("전체 폐기 후에는 최신 토큰도 401", latest.status === 401, `status=${latest.status}`);
}

/* ---------------------------------- 실행 ---------------------------------- */

async function cleanup(): Promise<void> {
  for (const email of [EMAIL_LOCK, EMAIL_REFRESH]) {
    try {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) continue;
      await prisma.refresh_token.deleteMany({ where: { user_id: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    } catch (err) {
      console.error(`테스트 계정 삭제 실패 (${email}) — 수동으로 삭제해 주세요:`, err);
    }
  }
}

async function main(): Promise<void> {
  assertSafeTarget();
  try {
    const health = await fetch(`${BASE}/health`).catch(() => null);
    if (!health || !health.ok) {
      throw new Error(`서버에 연결할 수 없습니다 (${BASE}). 먼저 npm run dev 로 서버를 켜세요.`);
    }

    await s0toS3();
    const refreshState = await s5();

    if (FAST) {
      console.log("\n(--fast: S4, S6은 대기 시간이 필요해 건너뜀)");
    } else {
      await s4AndS6(refreshState);
    }
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n==================== 요약 ====================");
  console.log(`통과 ${results.length - failed.length} / 전체 ${results.length}`);
  for (const f of failed) console.log(`  FAIL  ${f.name}   (${f.detail})`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error("\n스크립트 실행 실패:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // DB 연결 풀이 남아 있으면 프로세스가 끝나지 않으므로, 어떤 경로로 끝나든 연결을 닫고 종료
    await prisma.$disconnect().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
