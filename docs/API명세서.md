# API 명세서 (v1.4)

> 기준: 현재 백엔드 코드 (`src/app.ts`, `src/routes/*`, `src/controllers/*`)  
> 개발 Base URL: `http://localhost:4100` (또는 배포 API 도메인)  
> 관리자 API 상세: [`Admin API 명세서.md`](./Admin%20API%20명세서.md)

## 1. 개요

| 항목 | 내용 |
|---|---|
| 응답 포맷 | JSON |
| 공통 성공 | `{ "success": true, "data": ... }` 또는 `{ "success": true, "message": "..." }` |
| 공통 실패 | `{ "success": false, "message": "..." }` |
| BigInt | `id` 등 BigInt는 JSON에서 **문자열**로 직렬화될 수 있음 (`BigInt.prototype.toJSON`) |
| CORS (개발) | `origin: http://localhost:3000`, `credentials: true` |
| 쿠키 공통 | `httpOnly`, `secure: true`, `sameSite: "none"` (크로스 사이트 + HTTPS 전제) |

**인증**

| 구분 | 방식 | 사용처 |
|---|---|---|
| 일반 유저 (`USER`) | Access JWT (`Authorization: Bearer {access_token}`) + Refresh | 보호 API (`/reports` 등록 등, `/mypage`) |
| 관리자 (`ADMIN`) | express-session 쿠키 (`connect.sid`) | `/admin/*` |

**토큰 / 세션 TTL (현재 코드)**

| 항목 | 값 |
|---|---|
| Access JWT | **30분** (`expiresIn: "30m"`). payload `{ role }`, `sub` = user id 문자열 |
| Refresh | **7일**. 웹: 쿠키 `refresh_token` / 앱: body |
| 관리자 세션 | **2시간** (`maxAge`), `rolling: true` (요청마다 연장) |
| 로그인 잠금 | 비밀번호 실패 **5회** → 약 **1분** (`429`) |

**인증 표기**
- 🔓 인증 불필요
- 🔐 JWT Bearer (일반 유저)
- 👑 관리자 세션 (`adminMiddleware`)

**웹 / 앱 클라이언트 구분** (`login`, `refresh`)

| `client` / `X-Client-Type` | Refresh 전달 |
|---|---|
| `web` (기본) | httpOnly 쿠키 `refresh_token` |
| `app` | 응답 body의 `refresh_token` (Secure Storage 저장) |

`authMiddleware` 실패 시 `401` — 예: `Unauthorized 유효한 토큰이 아닙니다.` / `Unauthorized 비활성화된 계정입니다. 관리자에게 문의해주세요.`

---

## 2. 엔드포인트 목록 (구현됨)

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/health/` | 🔓 | 헬스체크 |
| GET | `/health/db` | 🔓 | DB 연결 확인 |
| POST | `/auth/register` | 🔓 | 회원가입 |
| POST | `/auth/login` | 🔓 | 로그인 (USER=JWT / ADMIN=세션) |
| POST | `/auth/refresh` | 🔓* | Access 갱신 (*refresh 필요) |
| POST | `/auth/logout` | 🔓* | 로그아웃 (*refresh/세션) |
| POST | `/auth/change-pw` | 🔓 | 비밀번호 변경 (이메일+기존 비번, JWT 불필요) |
| GET | `/grids` | 🔓 | viewport 격자 목록 |
| GET | `/grids/{id}/infrastructures` | 🔓 | 격자 내 인프라 |
| GET | `/grids/{id}/detail` | 🔓 | 격자 인포카드 |
| POST | `/grids/{id}/feedbacks` | 🔐 | 피드백 등록 |
| GET | `/city-events` | 🔓 | 도시 행사 (bbox, 진행중) |
| GET | `/infrastructures` | 🔓 | 반경 기준 인프라 |
| GET | `/reports` | 🔓 | 활성 제보 목록 |
| POST | `/reports` | 🔐 | 제보 등록 |
| PATCH | `/reports/{id}` | 🔐 | 제보 수정 (본인) |
| DELETE | `/reports/{id}` | 🔐 | 제보 소프트 삭제 (본인/ADMIN role) |
| GET | `/feedbacks/tags` | 🔓 | 태그 목록 |
| PATCH | `/feedbacks/{id}` | 🔐 | 피드백 수정 (본인) |
| DELETE | `/feedbacks/{id}` | 🔐 | 피드백 소프트 삭제 (본인/ADMIN role) |
| GET | `/mypage` | 🔐 | 마이페이지 요약 |
| GET | `/mypage/report` | 🔐 | 내 제보 목록 |
| GET | `/mypage/feedback` | 🔐 | 내 피드백 목록 |
| POST | `/uploads/image` | 🔓 | 일반 이미지 업로드 |
| POST | `/uploads/image/report` | 🔓 | 제보용 이미지 (마스킹 후 저장) |
| GET | `/uploads/**` | 🔓 | 업로드 파일 정적 서빙 |
| GET | `/accident-zones` | 🔓 | 사고다발지역 (KOROAD 프록시) |
| GET/POST | `/admin/*` | 👑 | 관리자 API (상세는 Admin 명세) |

### 미구현 / 구 명세와 다름

| 구 명세 | 현재 |
|---|---|
| `POST /auth/signup` | → `POST /auth/register` |
| `GET /shelters` | 미구현 (`GET /infrastructures`로 유사 조회) |
| `GET /grids/{id}/feedbacks` | 미구현 (격자별 피드백 목록 API 없음) |
| `GET /grids/{id}/feedbacks/me` | 미구현 |
| `GET /tags` | → `GET /feedbacks/tags` |
| `POST /devices/register` | 라우트 미등록 (컨트롤러 stub만 존재) |
| Admin path (`DELETE /admin/reports/{id}` 등) | → `POST /admin/delete-report` 등 (Admin 명세 참고) |

HTTP API가 아닌 백엔드 잡: 매일 00:00(Asia/Seoul) 안전등급 배치 (`SCORE_CRON_ENABLED=false`로 비활성).

---

## 3. Health

### GET `/health/` 🔓
```json
{ "status": "ok" }
```

### GET `/health/db` 🔓
```json
{ "db": "connected" }
```

| 코드 | 본문 |
|---|---|
| 500 | `{ "db": "disconnected", "error": "..." }` |

---

## 4. 인증 API

### POST `/auth/register` 🔓

**Request**
```json
{
  "email": "kim.minji@example.com",
  "password": "plainPassword123!",
  "nickname": "민지킴"
}
```
- `role`은 서버가 항상 `USER`로 고정
- 비밀번호 최소 8자, email/nickname 최대 50자

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 6,
    "email": "kim.minji@example.com",
    "nickname": "민지킴",
    "role": "USER"
  }
}
```

| 코드 | message 예 |
|---|---|
| 409 | `Email already exists` |
| 422 | `email, password, nickname are required` / `email/nickname too long` / `password must be at least 8 characters` |

---

### POST `/auth/login` 🔓

**Request**
```json
{
  "email": "kim.minji@example.com",
  "password": "plainPassword123!",
  "client": "web"
}
```
- `client`: `"web"` \| `"app"` (생략 시 `web`). 헤더 `X-Client-Type`으로도 가능
- 실패 5회 시 약 1분 잠금 (`429`)

#### USER + web → JWT + refresh 쿠키
**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 6, "nickname": "민지킴", "role": "USER", "email": "..." }
  }
}
```
- `Set-Cookie: refresh_token=...` (httpOnly, **7일**)
- access 만료: **30분**
- USER 응답에는 `authType` 필드 **없음** (ADMIN만 `authType: "session"`)

#### USER + app → JWT + refresh body
**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "user": { "id": 6, "nickname": "민지킴", "role": "USER", "email": "..." }
  }
}
```

#### ADMIN → 세션
**Response 200**
```json
{
  "success": true,
  "data": {
    "authType": "session",
    "user": { "id": 1, "nickname": "관리자", "role": "ADMIN", "email": "..." }
  }
}
```
- `Set-Cookie: connect.sid=...` (2시간, rolling)
- DB `active_session_id`에 현재 세션 기록 (동시 로그인 시 이전 세션 무효)

| 코드 | 상황 / message 예 |
|---|---|
| 401 | `존재하지 않는 이메일입니다.` / `잘못된 비밀번호 입니다. 남은 로그인 횟수: N 회` |
| 403 | `비활성화된 계정입니다. 관리자에게 문의해주세요.` |
| 422 | `email, password are required` |
| 429 | `로그인 시도가 너무 많습니다. N분 후 다시 시도해주세요.` |

---

### POST `/auth/refresh` 🔓*

Access 만료 시 호출. **`authMiddleware` 없음** (만료된 access로도 호출 가능해야 함).

**Request**
- 웹: 쿠키 `refresh_token` + `credentials: include`
- 앱: body `{ "refresh_token": "...", "client": "app" }`

**Response 200 (web)**
```json
{ "success": true, "data": { "access_token": "..." } }
```
(+ 새 refresh 쿠키 7일, 기존 refresh 로테이션/폐기)

**Response 200 (app)**
```json
{
  "success": true,
  "data": { "access_token": "...", "refresh_token": "..." }
}
```

| 코드 | 상황 |
|---|---|
| 401 | refresh 없음 / 무효 / 만료 / 재사용(탈취 의심 시 해당 유저 refresh 전부 폐기) |

---

### POST `/auth/logout` 🔓*

**Request**
- 웹: refresh 쿠키 및/또는 관리자 세션 쿠키
- 앱: `{ "refresh_token": "..." }` (쿠키 없으면 body)

**동작 (현재 구현)**
1. refresh가 있으면 DB 폐기 + `refresh_token` 쿠키 clear
2. 세션에 `userId`가 **없으면** (일반 USER 로그아웃 포함) → `{ "success": true, "message": "Already logged out" }`
3. 관리자 세션이 있으면 `active_session_id` null + session destroy + `connect.sid` clear → `"Logged out"`

> USER는 세션이 없으므로 refresh를 정상 폐기해도 응답 메시지는 `"Already logged out"` 이다.

---

### POST `/auth/change-pw` 🔓

JWT 없이 email + 기존 비밀번호로 변경. **기존 refresh/access는 즉시 폐기되지 않음.**

**Request**
```json
{
  "email": "kim.minji@example.com",
  "password": "oldPassword",
  "newPassword": "newPassword123!"
}
```

**Response 200**
```json
{ "success": true, "message": "비밀번호 변경 완료" }
```

| 코드 | message 예 |
|---|---|
| 422 | `이메일, 비밀번호, 새 비밀번호는 필수 입력 항목입니다.` |
| 401 | `존재하지 않는 이메일입니다.` / `잘못된 비밀번호 입니다.(기존 비밀번호 확인)` |

---

## 5. 지도 / 격자 API

### GET `/grids` 🔓

**Query**: `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng` (필수)

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "grid_id": 1,
      "lat": 37.566535,
      "lng": 126.977969,
      "infra_count": 12,
      "safety_grade": "안전"
    }
  ]
}
```

| 코드 | message |
|---|---|
| 422 | `sw_lat, sw_lng, ne_lat, ne_lng are required` |

---

### GET `/grids/{id}/infrastructures` 🔓

**Query (선택)**: `type` (`CCTV` \| `경찰서` \| `소방서` \| `편의점`)

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "type": "CCTV", "address": "...", "lat": 37.5665, "lng": 126.9779 }
  ]
}
```

| 코드 | 상황 |
|---|---|
| 404 | Grid not found |
| 422 | Invalid grid id |

---

### GET `/grids/{id}/detail` 🔓

격자 인포카드용 조합 데이터. 최근 피드백은 **최대 3건**.

**Response 200**
```json
{
  "success": true,
  "data": {
    "grid_id": 1,
    "lat": 37.566535,
    "lng": 126.977969,
    "safety_grade": "안전",
    "infra_count": 12,
    "tags": [{ "name": "보안관 순찰구역", "count": 3 }],
    "top_tag": "보안관 순찰구역",
    "safety_feeling_ratio": { "안전": 50, "보통": 50, "불안": 0 },
    "recent_feedbacks": [
      { "id": 4, "safety_feeling": "안전", "comment": "...", "created_at": "..." }
    ],
    "active_reports": [
      { "id": 5, "type": "공사", "description": "...", "expire_at": "..." }
    ],
    "feedback_count": 10,
    "participant_count": 8
  }
}
```

| 코드 | 상황 |
|---|---|
| 404 | Grid not found |
| 422 | Invalid grid id |

---

### GET `/city-events` 🔓

**Query**: `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng` (필수)

조회: bbox 내 + `end_at > now` + `is_active='Y'`

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "행사",
      "title": "서울 불꽃축제",
      "description": "...",
      "lat": 37.5326,
      "lng": 126.9905,
      "start_at": "...",
      "end_at": "...",
      "img_url": null
    }
  ]
}
```

| 코드 | message |
|---|---|
| 422 | `sw_lat, sw_lng, ne_lat, ne_lng are required` |

---

### GET `/infrastructures` 🔓

중심 좌표 + 반경 내 인프라 (Haversine, 최대 500건).

**Query**

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `lat`, `lng` | Y | 중심 |
| `radius_m` | Y | 반경(m), `> 0` 이고 최대 **20000** |
| `type` | N | `CCTV` \| `경찰서` \| `소방서` \| `편의점` |

**Response 200**: `{ success, data: [{ id, type, address, lat, lng }] }`

| 코드 | message |
|---|---|
| 422 | `lat, lng, radius_m are required` |
| 422 | `lat/lng out of range` |
| 422 | `radius_m must be > 0 and <= 20000` |
| 422 | `type must be one of CCTV\|경찰서\|소방서\|편의점` |

---

## 6. 제보 (Report) API

### GET `/reports` 🔓

**Query (선택)**: `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng` — 네 값 모두 있을 때만 bbox 필터

조건: `is_active='Y'` AND `expire_at > now`

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "싱크홀",
      "lat": 37.4842,
      "lng": 126.9297,
      "description": "...",
      "img_url": "...",
      "user_nickname": "안전파수꾼",
      "created_at": "...",
      "expire_at": "...",
      "is_admin_posted": false
    }
  ]
}
```
- `is_admin_posted`: 작성자 `user.role === 'ADMIN'` 여부 (응답 조립값)

---

### POST `/reports` 🔐

**Request**
```json
{
  "type": "싱크홀",
  "lat": 37.4979,
  "lng": 127.0276,
  "description": "강남역 앞 인도 싱크홀",
  "img_url": "http://localhost:4100/uploads/img/...."
}
```
- `img_url` 선택. 파일은 `/uploads/image` 또는 `/uploads/image/report`로 선업로드
- 서버가 좌표로 `grid_id` get-or-create
- `created_at` / `expire_at`은 **KST 벽시계**로 저장. `expire_at` = 등록 시각 + **24시간**
- `type` 최대 50자, `img_url` 최대 255자

**Response 201**
```json
{
  "success": true,
  "data": { "id": 6, "grid_id": 1, "img_url": "...", "expire_at": "..." }
}
```

| 코드 | 상황 |
|---|---|
| 401 | Unauthorized |
| 422 | `type, lat, lng, description are required` / `type maxLength 50` / `img_url maxLength 255` |

---

### PATCH `/reports/{id}` 🔐 (본인)

**Request**: `{ "description"?: "...", "img_url"?: "..." | null }`  
`type` / 좌표 수정 불가. `description` 최대 5000자.

**Response 200**: `GET /reports`와 동일한 list item 형태 (`id, type, lat, lng, description, img_url, user_nickname, created_at, expire_at, is_admin_posted`)

| 코드 | 상황 |
|---|---|
| 401 | Unauthorized |
| 403 | Forbidden (본인 아님) |
| 404 | Report not found (없거나 `is_active=N`) |
| 422 | Invalid report id / Invalid description / img_url maxLength 255 |

---

### DELETE `/reports/{id}` 🔐

본인 또는 JWT role이 `ADMIN`이면 soft delete (`is_active='N'`).

**Response 200**
```json
{ "success": true }
```

| 코드 | 상황 |
|---|---|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Report not found |
| 422 | Invalid report id |

---

## 7. 피드백 API

> 격자별 피드백 **목록** API(`GET /grids/{id}/feedbacks`)와 `.../me`는 **미구현**.  
> 등록은 `POST /grids/{id}/feedbacks`, 수정·삭제는 `/feedbacks/{id}`, 내 목록은 `/mypage/feedback`.

### POST `/grids/{id}/feedbacks` 🔐

**Request**
```json
{
  "safety_feeling": "보통",
  "comment": "골목이 어두움",
  "tag_ids": [1],
  "img_url": null
}
```
- `safety_feeling`: `안전` \| `보통` \| `불안` (필수)
- `comment`, `tag_ids`, `img_url` 선택
- 동일 유저·동일 격자 활성 피드백 있으면 **409**
- `created_at`은 KST 벽시계

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "grid_id": 1,
    "safety_feeling": "보통",
    "comment": "...",
    "img_url": null,
    "tags": [{ "id": 1, "name": "가로등 어두움" }],
    "created_at": "..."
  }
}
```

| 코드 | 상황 |
|---|---|
| 401 | Unauthorized |
| 404 | Grid not found |
| 409 | `Feedback already exists for this grid` |
| 422 | Invalid grid id / safety_feeling / tag_ids / Unknown tag_ids / img_url maxLength 255 |

---

### GET `/feedbacks/tags` 🔓

```json
{
  "success": true,
  "data": [{ "id": 1, "name": "가로등 어두움" }]
}
```

---

### PATCH `/feedbacks/{id}` 🔐 (본인)

**Request**: `safety_feeling?`, `comment?`, `img_url?`, `tag_ids?`  
`tag_ids`를 보내면 기존 태그를 **교체**(delete + insert).

**Response 200**: 등록 응답과 동일 형태 (`id, grid_id, safety_feeling, comment, img_url, tags, created_at`)

| 코드 | 상황 |
|---|---|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Feedback not found |
| 422 | Invalid feedback id / safety_feeling / tag_ids / img_url |

---

### DELETE `/feedbacks/{id}` 🔐

본인 또는 JWT `ADMIN` → soft delete (`is_active='N'`).

**Response 200**
```json
{ "success": true }
```

---

## 8. 마이페이지 API

### GET `/mypage` 🔐

현재 구현은 Prisma `user` **레코드 전체**를 반환한다. (`password_hash`, `failed_login_count`, `locked_until`, `active_session_id` 포함)  
클라이언트는 `id`, `email`, `nickname`, `role`, `is_active`, `created_at`만 사용하면 된다.

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6",
      "email": "kim.minji@example.com",
      "nickname": "민지킴",
      "role": "USER",
      "is_active": "Y",
      "created_at": "..."
    },
    "reportCount": 3,
    "feedbackCount": 2
  }
}
```
- `reportCount`: 해당 유저 제보 **전체** (비활성 포함)
- `feedbackCount`: 활성 피드백만 (`is_active='Y'`)

| 코드 | 상황 |
|---|---|
| 404 | User not found |

---

### GET `/mypage/report` 🔐

**Query**: `page` (기본 1), `limit` (기본 10)  
내 활성 제보 (`is_active='Y'`), `created_at` desc, `user.nickname` include.  
Prisma row 그대로 반환 (BigInt id는 문자열일 수 있음).

---

### GET `/mypage/feedback` 🔐

**Query**: `page`, `limit`  
내 활성 피드백 + `tags: [{ id, name }]`.

```json
{
  "success": true,
  "data": [
    {
      "id": "4",
      "comment": "...",
      "safety_feeling": "보통",
      "img_url": null,
      "created_at": "...",
      "grid_id": "1",
      "tags": [{ "id": "1", "name": "가로등 어두움" }]
    }
  ]
}
```

---

## 9. 업로드 API

필드명 `image`, `multipart/form-data`.  
제한: 이미지 MIME (`image/*`), 최대 **5MB**.  
저장 경로: `UPLOAD_DIR/img` (없으면 `{cwd}/uploads/img`).

### POST `/uploads/image` 🔓

디스크에 원본 저장.

**Response 201**
```json
{
  "success": true,
  "data": {
    "original_name": "photo.jpg",
    "file_name": "1785-....jpg",
    "image_path": "/uploads/img/1785-....jpg",
    "img_url": "http://localhost:4100/uploads/img/1785-....jpg",
    "size": 102400
  }
}
```

| 코드 | 상황 |
|---|---|
| 400 | 파일 없음 / 이미지가 아님 |
| 413 | 5MB 초과 (`LIMIT_FILE_SIZE`) |

---

### POST `/uploads/image/report` 🔓

제보용: 메모리 수신 → 얼굴 마스킹 → jpg로 디스크 저장. 응답 형태는 위와 동일 (`size`는 마스킹 후 바이트).

마스킹 실패 시 `500`.

---

### GET `/uploads/**` 🔓

정적 파일 서빙 (`express.static`, `UPLOAD_DIR` 또는 `{cwd}/uploads`).

---

## 10. 사고다발지역 API

### GET `/accident-zones` 🔓

도로교통공단 OpenAPI 프록시. `KOROAD_AUTH_KEY` 필요.  
타입·시군구별 **메모리 캐시 10분**. 폴리곤 `path` 길이가 3 미만인 항목은 제외.

**Query**

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `siDo` | Y | 시도 코드 2자리 (예: 서울 `11`) |
| `guGun` | Y | 시군구 코드 1~3자리 |
| `type` | N | `pedestrian` \| `bicycle` \| `motorcycle` \| `schoolzone` (생략 시 4종 전부) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "siDo": "11",
    "guGun": "680",
    "types": ["pedestrian"],
    "count": 10,
    "items": [
      {
        "id": "pedestrian:2025083:12345",
        "type": "pedestrian",
        "name": "강남역 인근",
        "yearCd": "2025083",
        "lat": 37.4979,
        "lng": 127.0276,
        "occrrnc_cnt": 12,
        "caslt_cnt": 15,
        "dth_dnv_cnt": 0,
        "path": [{ "lat": 37.497, "lng": 127.027 }]
      }
    ]
  }
}
```

| 코드 | 상황 |
|---|---|
| 422 | `siDo, guGun are required` / 형식 오류 / type 값 오류 |
| 502 | 공단 API 조회 실패 (`failed to fetch koroad frequentzone`) |
| 503 | `KOROAD_AUTH_KEY is not configured` |

---

## 11. 관리자 API 요약 👑

`/admin/*` 전 구간 `adminMiddleware` (세션 `role=ADMIN` + `active_session_id` 검증).  
다른 곳에서 로그인되어 세션이 바뀌면 `403` (`다른 곳에서 로그인되어 세션이 만료되었습니다.`).

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/me` | 세션 관리자 정보 |
| GET | `/admin/summary` | 대시보드 집계 |
| GET | `/admin/reports` | 제보 목록 (+ `types`, `total`, nickname/keyword 검색) |
| POST | `/admin/create-report` | 제보 등록 |
| POST | `/admin/delete-report` | 제보 소프트 삭제 |
| POST | `/admin/restore-report` | 제보 복구 |
| GET | `/admin/feedbacks` | 피드백 목록 (+ `total`) |
| POST | `/admin/delete-feedback` | 피드백 소프트 삭제 |
| GET | `/admin/events` | 도시행사 목록 (+ `types`, `total`, status 필터) |
| POST | `/admin/create-event` | 행사 등록 |
| POST | `/admin/update-event` | 행사 수정 |
| POST | `/admin/delete-event` | 행사 소프트 삭제 |
| POST | `/admin/restore-event` | 행사 복구 |
| GET | `/admin/grid-id` | lat/lng → grid id |

**GET `/admin/summary` 응답 예**
```json
{
  "success": true,
  "data": {
    "active_reports": 24,
    "reports_today": 3,
    "total_feedbacks": 1286,
    "feedbacks_today": 17,
    "active_city_events": 5,
    "inactive_city_events": 2,
    "five_days_reports_count": [
      { "date": "2026-08-07", "count": "4" }
    ],
    "five_days_feedbacks_count": [
      { "date": "2026-08-07", "count": "11" }
    ]
  }
}
```

| 필드 | 의미 |
|---|---|
| `active_reports` | `is_active='Y'` 제보 수 |
| `reports_today` | 오늘(KST 00:00~) 등록된 활성 제보 |
| `total_feedbacks` | 피드백 전체 (비활성 포함) |
| `feedbacks_today` | 오늘 등록된 활성 피드백 |
| `active_city_events` | 활성 + `end_at >= now` |
| `inactive_city_events` | 활성 + `end_at < now` (종료됨) |
| `five_days_reports_count` | 최근 5일(오늘 포함) 일별 활성 제보 수 |
| `five_days_feedbacks_count` | 최근 5일 일별 활성 피드백 수 |

목록 API(`reports` / `feedbacks` / `events`)는 `{ success, data, total }` 형태이며 reports·events는 `types`도 포함.

쿼리·바디·에러 상세는 **`docs/Admin API 명세서.md`** 를 기준으로 한다.

---

## 12. 디바이스 API

`app.use("/devices", ...)` 는 마운트되어 있으나 **라우트 미등록**.  
`device.controller` stub만 존재 → `POST /devices/register` 등은 **미구현**.

---

## 13. 인증 흐름 요약

```
[USER 웹]
  login → access(body, 30분) + refresh(cookie, 7일)
  API → Authorization: Bearer access
  access 만료 → POST /auth/refresh (cookie) → 새 access
  logout → POST /auth/logout (refresh 폐기, 메시지는 "Already logged out")

[USER 앱]
  login (client=app) → access + refresh (body)
  refresh/logout → body.refresh_token
  로컬 Secure Storage에서 토큰 삭제

[ADMIN]
  login → connect.sid 세션 (2시간, rolling) + authType: session
  /admin/* → credentials include
  logout → session destroy ("Logged out")
```

---

## 14. 반영 이력

| 버전 | 변경사항 |
|---|---|
| v1.0 | 최초 작성 |
| v1.1 | DB설계서 반영 (`img_url`, city-events, devices 등) |
| v1.2 | `admin/summary`, `feedbacks/me` 등 UI 공백 반영 |
| v1.3 | **코드 기준 전면 갱신**: JWT+세션 이중 인증, web/app refresh 분기, `/auth/register`·`refresh`·`logout`·`change-pw`, `/mypage`, `/uploads`, `/infrastructures`, `/accident-zones`, Admin path 정리, 미구현 API 명시 |
| v1.4 | **코드 재대조**: Access 30분·Refresh 7일·세션 2시간, USER 로그인에 `authType` 없음, logout USER 메시지, change-pw 에러코드, admin summary `five_days_*`/`inactive_city_events`/`total`, accident-zones item DTO·502·캐시, 제보/피드백 응답·에러, 마이페이지 카운트/user 필드, 업로드 413, KST expire_at |
