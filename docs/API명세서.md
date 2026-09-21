# API 명세서 (v1.5)

> 기준: 현재 백엔드 코드 (`src/app.ts`, `src/routes/*`, `src/controllers/*`)  
> 개발 Base URL: `http://localhost:5000` (`.env`의 `PORT`, 기본값 5000)  
> Demo 버전 URL: `https://43-202-197-59.nip.io`

## 1. 개요

| 항목 | 내용 |
|---|---|
| 응답 포맷 | JSON |
| 공통 성공 | `{ "success": true, "data": ... }` 또는 `{ "success": true, "message": "..." }` |
| 공통 실패 | `{ "success": false, "message": "..." }` |
| BigInt | `id` 등 BigInt는 JSON에서 **문자열**로 직렬화될 수 있음 |
| CORS (개발) | `origin: http://localhost:3000`, `credentials: true` |
| 쿠키 공통 | `httpOnly`, `secure: true`, `sameSite: "none"` (크로스 사이트 + HTTPS 전제) |

**인증**

| 구분 | 방식 | 사용처 |
|---|---|---|
| 일반 유저 (`USER`) | Access JWT (`Authorization: Bearer {access_token}`) + Refresh | `/reports` 등록·수정·삭제, `/feedbacks` 수정·삭제, `/grids/:id/feedbacks`, `/mypage` |
| 관리자 (`ADMIN`) | express-session 쿠키 (`connect.sid`) | `/admin/*` |

**토큰 / 세션 TTL**

| 항목 | 값 |
|---|---|
| Access JWT | **30분**. payload `{ role }`, `sub` = user id 문자열 |
| Refresh | **7일**. 웹: 쿠키 `refresh_token` / 앱: body |
| 관리자 세션 | **2시간** (`maxAge`), `rolling: true` |
| 로그인 잠금 | 비밀번호 실패 **5회** → 약 **1분** (`429`) |

**인증 표기**
- 🔓 인증 불필요
- 🔐 JWT Bearer (일반 유저)
- 👑 관리자 세션 (`adminMiddleware`)

**웹 / 앱 클라이언트 구분** (`login`, `refresh`)

| `client` / `X-Client-Type` | Refresh 전달 |
|---|---|
| `web` (기본) | httpOnly 쿠키 `refresh_token` |
| `app` | 응답 body의 `refresh_token` |

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
| POST | `/auth/change-pw` | 🔓 | 비밀번호 변경 |
| GET | `/grids` | 🔓 | viewport 격자 목록 |
| GET | `/grids/{id}/infrastructures` | 🔓 | 격자 내 인프라 |
| GET | `/grids/{id}/detail` | 🔓 | 격자 인포카드 |
| POST | `/grids/{id}/feedbacks` | 🔐 | 피드백 등록 |
| GET | `/city-events` | 🔓 | 도시 행사 (bbox) |
| GET | `/infrastructures` | 🔓 | 반경 기준 인프라 |
| GET | `/reports` | 🔓 | 활성 제보 목록 |
| POST | `/reports` | 🔐 | 제보 등록 (+ FCM 알림) |
| PATCH | `/reports/{id}` | 🔐 | 제보 수정 (본인) |
| DELETE | `/reports/{id}` | 🔐 | 제보 소프트 삭제 |
| GET | `/feedbacks/tags` | 🔓 | 태그 목록 |
| PATCH | `/feedbacks/{id}` | 🔐 | 피드백 수정 (본인) |
| DELETE | `/feedbacks/{id}` | 🔐 | 피드백 소프트 삭제 |
| GET | `/mypage` | 🔐 | 마이페이지 요약 |
| GET | `/mypage/report` | 🔐 | 내 제보 목록 |
| GET | `/mypage/feedback` | 🔐 | 내 피드백 목록 |
| POST | `/uploads/image` | 🔓 | 일반 이미지 업로드 |
| POST | `/uploads/image/report` | 🔓 | 제보용 이미지 (마스킹) |
| GET | `/uploads/**` | 🔓 | 업로드 파일 정적 서빙 |
| GET | `/accident-zones` | 🔓 | 사고다발지역 (KOROAD 프록시) |
| POST | `/notification/register` | 🔓† | FCM 토큰 등록 |
| PATCH | `/notification/unregister` | 🔓 | FCM 토큰-유저 연결 해제 |
| POST | `/notification/send-all` | 🔓 | FCM 테스트 전송 |
| GET | `/sync/version` | 🔓 | 데이터 버전 목록 |
| GET | `/sync/grids` | 🔓 | 앱 캐시용 격자 전체 |
| GET | `/sync/infrastructures` | 🔓 | 앱 캐시용 인프라 (페이지네이션) |
| GET/POST | `/admin/*` | 👑 | 관리자 API |

† `optionalAuthMiddleware`는 import만 되어 있고 **라우트에 미연결**. JWT/`req.user`로 `user_id`를 채우려면 미들웨어를 라우트에 붙여야 함. 관리자 세션(`req.session.userId`)은 미들웨어 없이도 연결 가능.

### 미구현 / 참고

| 항목 | 현재 |
|---|---|
| `/device` | `app.use` 마운트만 됨. 라우트·컨트롤러 stub → **실사용 API 없음** |
| `GET /grids/{id}/feedbacks` | 미구현 |
| 안전등급 배치 | HTTP 아님. 매일 00:00 Asia/Seoul (`SCORE_CRON_ENABLED=false`로 비활성) |

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
- `role`은 서버가 `USER`로 고정
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
| 422 | `email, password, nickname are required` 등 |

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
- `client`: `"web"` \| `"app"` (생략 시 web). 헤더 `X-Client-Type` 가능
- 실패 5회 시 약 1분 잠금 (`429`)

#### USER + web
**Response 200** — access(body) + refresh 쿠키(7일). `authType` 필드 없음.

#### USER + app
**Response 200** — `access_token` + `refresh_token` (body).

#### ADMIN
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
- `Set-Cookie: connect.sid=...`
- DB `active_session_id` 갱신 (동시 로그인 시 이전 세션 무효)

| 코드 | 상황 |
|---|---|
| 401 | 이메일/비밀번호 오류 |
| 403 | 비활성 계정 |
| 422 | 필수값 누락 |
| 429 | 로그인 잠금 |

---

### POST `/auth/refresh` 🔓*

**Request**: 쿠키 `refresh_token` 또는 body `{ "refresh_token", "client"? }`

**Response 200**: `{ "success": true, "data": { "access_token" } }` (+ app이면 `refresh_token`)

| 코드 | 상황 |
|---|---|
| 401 | refresh 없음 / 무효 / 만료 / 재사용 |

---

### POST `/auth/logout` 🔓*

1. refresh 있으면 DB 폐기 + 쿠키 clear  
2. 관리자 세션 없으면 → `"Already logged out"`  
3. 관리자 세션 있으면 `active_session_id` null + session destroy → `"Logged out"`

> USER는 세션이 없으므로 refresh를 폐기해도 메시지는 `"Already logged out"`일 수 있음.

---

### POST `/auth/change-pw` 🔓

**Request**: `{ "email", "password", "newPassword" }`  
JWT 불필요. 기존 토큰은 즉시 폐기되지 않음.

**Response 200**: `{ "success": true, "message": "비밀번호 변경 완료" }`

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

---

### GET `/grids/{id}/infrastructures` 🔓

**Query (선택)**: `type` (`CCTV` \| `경찰서` \| `소방서` \| `편의점`)

**Response 200**: `{ success, data: [{ id, type, address, lat, lng }] }`

| 코드 | 상황 |
|---|---|
| 404 | Grid not found |
| 422 | Invalid grid id |

---

### GET `/grids/{id}/detail` 🔓

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

---

### GET `/city-events` 🔓

**Query**: `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng`  
조건: bbox + `end_at > now` + `is_active='Y'`

**Response 200**: `{ success, data: [{ id, type, title, description, lat, lng, start_at, end_at, img_url }] }`

---

### GET `/infrastructures` 🔓

중심 + 반경 (Haversine, 최대 500건, `radius_m` ≤ 20000).

**Query**: `lat`, `lng`, `radius_m` (필수), `type?`

**Response 200**: `{ success, data: [{ id, type, address, lat, lng }] }`

---

## 6. 제보 (Report) API

### GET `/reports` 🔓

**Query (선택)**: bbox 네 값 모두 있을 때만 필터.  
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

---

### POST `/reports` 🔐

**Request**
```json
{
  "type": "싱크홀",
  "lat": 37.4979,
  "lng": 127.0276,
  "description": "강남역 앞 인도 싱크홀",
  "img_url": "http://localhost:5000/uploads/img/...."
}
```
- 좌표로 `grid_id` get-or-create
- `expire_at` = 등록 + **24시간** (KST 벽시계)
- 등록 후 FCM 푸시 (`type: report`, topic `all` 등)

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
| 422 | 필수값 / maxLength |

---

### PATCH `/reports/{id}` 🔐 (본인)

**Request**: `{ "description"?: "...", "img_url"?: "..." | null }`

| 코드 | 상황 |
|---|---|
| 403 | 본인 아님 |
| 404 | 없거나 비활성 |

---

### DELETE `/reports/{id}` 🔐

본인 또는 JWT `ADMIN` → soft delete (`is_active='N'`).

---

## 7. 피드백 API

> 등록: `POST /grids/{id}/feedbacks`  
> 수정·삭제: `/feedbacks/{id}`  
> 내 목록: `/mypage/feedback`

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
- `safety_feeling`: `안전` \| `보통` \| `불안`
- 동일 유저·동일 격자 활성 피드백 있으면 **409**

**Response 201**: `{ id, grid_id, safety_feeling, comment, img_url, tags, created_at }`

---

### GET `/feedbacks/tags` 🔓

```json
{ "success": true, "data": [{ "id": 1, "name": "가로등 어두움" }] }
```

---

### PATCH `/feedbacks/{id}` 🔐 (본인)

**Request**: `safety_feeling?`, `comment?`, `img_url?`, `tag_ids?`  
`tag_ids` 전송 시 기존 태그 **교체**.

---

### DELETE `/feedbacks/{id}` 🔐

본인 또는 JWT `ADMIN` → soft delete.

---

## 8. 마이페이지 API

### GET `/mypage` 🔐

```json
{
  "success": true,
  "data": {
    "user": { "id": "6", "email": "...", "nickname": "...", "role": "USER", "is_active": "Y", "created_at": "..." },
    "reportCount": 3,
    "feedbackCount": 2
  }
}
```
- `reportCount`: 해당 유저 제보 전체(비활성 포함)
- `feedbackCount`: 활성 피드백만

---

### GET `/mypage/report` 🔐

**Query**: `page`(1), `limit`(10) — 내 활성 제보

---

### GET `/mypage/feedback` 🔐

**Query**: `page`, `limit` — 내 활성 피드백 + tags

---

## 9. 업로드 API

필드명 `image`, `multipart/form-data`. 최대 **5MB**, MIME `image/*`.

### POST `/uploads/image` 🔓

**Response 201**
```json
{
  "success": true,
  "data": {
    "original_name": "photo.jpg",
    "file_name": "1785-....jpg",
    "image_path": "/uploads/img/1785-....jpg",
    "img_url": "http://localhost:5000/uploads/img/1785-....jpg",
    "size": 102400
  }
}
```

| 코드 | 상황 |
|---|---|
| 400 | 파일 없음 / 이미지가 아님 |
| 413 | 5MB 초과 |

---

### POST `/uploads/image/report` 🔓

제보용: 얼굴 마스킹 후 저장. 응답 형태 동일. 마스킹 실패 시 `500`.

---

### GET `/uploads/**` 🔓

정적 파일 서빙 (`UPLOAD_DIR` 또는 `{cwd}/uploads`).

---

## 10. 사고다발지역 API

### GET `/accident-zones` 🔓

도로교통공단 OpenAPI 프록시. `KOROAD_AUTH_KEY` 필요. 타입·시군구별 **메모리 캐시 10분**.

**Query**

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `siDo` | Y | 시도 코드 2자리 (서울 `11`) |
| `guGun` | Y | 시군구 코드 1~3자리 |
| `type` | N | `pedestrian` \| `bicycle` \| `motorcycle` \| `schoolzone` (생략 시 4종) |

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
| 422 | 파라미터/형식 오류 |
| 502 | 공단 API 실패 |
| 503 | `KOROAD_AUTH_KEY` 미설정 |

---

## 11. 알림 (FCM) API

### POST `/notification/register` 🔓†

**Request**
```json
{
  "fcmToken": "...",
  "device_type": "web"
}
```
- `device_tokens` upsert (`is_active='Y'`)
- `user_id`: `req.user`(JWT) 또는 관리자 세션이 있으면 연결, 없으면 `null`
- 현재 코드는 등록 시 `all` 토픽 구독 호출

**Response 200**: `{ "success": true, "message": "FCM token 설정 완료" }`

| 코드 | 상황 |
|---|---|
| 400 | `FCM token is required` |

---

### PATCH `/notification/unregister` 🔓

**Request**: `{ "fcmToken": "..." }`  
해당 토큰의 `user_id`를 `null`로 (토큰 행은 유지).

**Response 200**: `{ "success": true, "message": "FCM token 연결 해제 완료" }`

---

### POST `/notification/send-all` 🔓

백엔드 테스트용. body에 `fcmToken` 필요하지만 실제 전송은 topic `all`.

**Response 200**: `{ "success": true, "messageId": ... }`

---

## 12. Sync API (앱 캐시)

앱이 로컬 버전과 비교 후 필요한 데이터만 받는 용도.  
`data_version` 테이블의 `data_type` 예: `grid`, `infrastructure`.

### GET `/sync/version` 🔓

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "data_type": "grid",
      "version": "1",
      "updated_at": "2026-08-20T04:27:36.000Z"
    }
  ]
}
```

---

### GET `/sync/grids` 🔓

격자 **전체** + 버전 메타.

**Response 200**
```json
{
  "success": true,
  "data": {
    "data_type": "grid",
    "version": "1",
    "updated_at": "...",
    "items": [
      {
        "grid_id": 1,
        "grid_row": 0,
        "grid_col": 0,
        "lat": 37.5,
        "lng": 127.0,
        "infra_count": 3,
        "safety_grade": "보통"
      }
    ]
  }
}
```

---

### GET `/sync/infrastructures` 🔓

인프라 **커서 페이지네이션** (id 오름차순).

**Query**

| 파라미터 | 기본 | 설명 |
|---|---|---|
| `limit` | 2000 | 페이지 크기 (최대 5000) |
| `cursor` | 0 | 이 id **초과**부터 조회 (`id > cursor`) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "data_type": "infrastructure",
    "version": "1",
    "updated_at": "...",
    "items": [
      {
        "id": 1,
        "grid_id": 10,
        "type": "CCTV",
        "address": "...",
        "lat": 37.5,
        "lng": 127.0
      }
    ],
    "next_cursor": 2000,
    "has_more": true
  }
}
```

앱: `has_more === true`이면 `cursor=next_cursor`로 반복. 전부 받은 뒤 로컬 버전 갱신.

| 코드 | 상황 |
|---|---|
| 422 | `limit` / `cursor` 형식 오류 |

---

## 13. 관리자 API 요약 👑

`/admin/*` 전 구간 `adminMiddleware` (세션 `role=ADMIN` + `active_session_id`).  
세션 없음 → `401`, 다른 곳 로그인 → `403`.

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/me` | 세션 관리자 정보 |
| GET | `/admin/summary` | 대시보드 집계 |
| GET | `/admin/reports` | 제보 목록 |
| POST | `/admin/create-report` | 제보 등록 (+ FCM) |
| POST | `/admin/delete-report` | 제보 소프트 삭제 |
| POST | `/admin/restore-report` | 제보 복구 |
| GET | `/admin/feedbacks` | 피드백 목록 |
| POST | `/admin/delete-feedback` | 피드백 소프트 삭제 |
| GET | `/admin/events` | 도시행사 목록 |
| POST | `/admin/create-event` | 행사 등록 |
| POST | `/admin/update-event` | 행사 수정 |
| POST | `/admin/delete-event` | 행사 소프트 삭제 |
| POST | `/admin/restore-event` | 행사 복구 |
| GET | `/admin/grid-id` | lat/lng → grid id |

**GET `/admin/summary` 응답 필드**

| 필드 | 의미 |
|---|---|
| `active_reports` | 활성 제보 수 |
| `reports_today` | 오늘(KST) 등록 활성 제보 |
| `total_feedbacks` | 피드백 전체(비활성 포함) |
| `feedbacks_today` | 오늘 등록 활성 피드백 |
| `active_city_events` | 활성 + 미종료 |
| `inactive_city_events` | 활성 + 종료됨 |
| `five_days_reports_count` | 최근 5일 일별 제보 |
| `five_days_feedbacks_count` | 최근 5일 일별 피드백 |

상세 쿼리·바디: **`docs/Admin API 명세서.md`**

---

## 14. 인증 흐름 요약

```
[USER 웹]
  login → access(body, 30분) + refresh(cookie, 7일)
  API → Authorization: Bearer access
  access 만료 → POST /auth/refresh (cookie)
  logout → POST /auth/logout

[USER 앱]
  login (client=app) → access + refresh (body)
  refresh/logout → body.refresh_token

[ADMIN]
  login → connect.sid 세션 (2시간, rolling) + authType: session
  /admin/* → credentials: include
  logout → session destroy
```

---

## 15. 반영 이력

| 버전 | 변경사항 |
|---|---|
| v1.0 ~ v1.4 | 이전 이력 (인증·지도·제보·피드백·마이페이지·업로드·사고다발·Admin) |
| v1.5 | **코드 재대조**: Base URL 포트 5000, `/notification/*`(register·unregister·send-all), `/sync/*`(version·grids·infrastructures 페이지네이션), `/device` stub 명시, 제보 등록 FCM 언급, optionalAuth 미연결 주의 |
