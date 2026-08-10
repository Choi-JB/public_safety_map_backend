# API 명세서 (v1.3)

> 기준: 현재 백엔드 코드 (`src/app.ts`, `src/routes/*`, `src/controllers/*`)  
> 개발 Base URL: `http://localhost:4100` (또는 배포 API 도메인)  
> 관리자 API 상세: [`Admin API 명세서.md`](./Admin%20API%20명세서.md)

## 1. 개요

| 항목 | 내용 |
|---|---|
| 응답 포맷 | JSON |
| 공통 성공 | `{ "success": true, "data": ... }` 또는 `{ "success": true, "message": "..." }` |
| 공통 실패 | `{ "success": false, "message": "..." }` |
| BigInt | `id` 등 BigInt는 JSON에서 **문자열**로 직렬화될 수 있음 |
| CORS (개발) | `origin: http://localhost:3000`, `credentials: true` |

**인증**

| 구분 | 방식 | 사용처 |
|---|---|---|
| 일반 유저 (`USER`) | Access JWT (`Authorization: Bearer {access_token}`) + Refresh | 보호 API (`/reports` 등록 등, `/mypage`) |
| 관리자 (`ADMIN`) | express-session 쿠키 (`connect.sid`) | `/admin/*` |

**인증 표기**
- 🔓 인증 불필요
- 🔐 JWT Bearer (일반 유저)
- 👑 관리자 세션 (`adminMiddleware`)

**웹 / 앱 클라이언트 구분** (`login`, `refresh`)

| `client` / `X-Client-Type` | Refresh 전달 |
|---|---|
| `web` (기본) | httpOnly 쿠키 `refresh_token` |
| `app` | 응답 body의 `refresh_token` (Secure Storage 저장) |

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
| POST | `/auth/change-pw` | 🔓 | 비밀번호 변경 (이메일+기존 비번) |
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
| 422 | 필수값 누락 / 길이 / 비밀번호 길이 |

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
    "authType": "jwt",
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 6, "nickname": "민지킴", "role": "USER", "email": "..." }
  }
}
```
- `Set-Cookie: refresh_token=...` (httpOnly, 14일)
- access 만료: **1시간**

#### USER + app → JWT + refresh body
**Response 200**
```json
{
  "success": true,
  "data": {
    "authType": "jwt",
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
- `Set-Cookie: connect.sid=...`
- DB `active_session_id`에 현재 세션 기록 (동시 로그인 시 이전 세션 무효)

| 코드 | 상황 |
|---|---|
| 401 | 이메일 없음 / 비밀번호 틀림 |
| 403 | 비활성 계정 |
| 422 | email/password 누락 |
| 429 | 로그인 잠금 |

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
(+ 새 refresh 쿠키, 기존 refresh 로테이션/폐기)

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

**동작**
1. refresh 있으면 DB 폐기 + `refresh_token` 쿠키 clear
2. 관리자 세션 있으면 `active_session_id` null + session destroy + `connect.sid` clear

**Response 200**
```json
{ "success": true, "message": "Logged out" }
```
또는 `"Already logged out"`

---

### POST `/auth/change-pw` 🔓

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

**Query (선택)**: `type`

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "type": "CCTV", "address": "...", "lat": 37.5665, "lng": 126.9779 }
  ]
}
```

---

### GET `/grids/{id}/detail` 🔓

격자 인포카드용 조합 데이터.

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

조회: bbox 내 + `end_at > now` + 활성

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

---

### GET `/infrastructures` 🔓

중심 좌표 + 반경 내 인프라.

**Query**

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `lat`, `lng` | Y | 중심 |
| `radius_m` | Y | 반경(m), 최대 20000 |
| `type` | N | `CCTV` \| `경찰서` \| `소방서` \| `편의점` |

**Response 200**: `{ success, data: [{ id, type, address, lat, lng }] }` (최대 500건)

---

## 6. 제보 (Report) API

### GET `/reports` 🔓

**Query (선택)**: `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng`

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
- `expire_at` = 등록 시각 + **24시간**

**Response 201**
```json
{
  "success": true,
  "data": { "id": 6, "grid_id": 1, "img_url": "...", "expire_at": "..." }
}
```

---

### PATCH `/reports/{id}` 🔐 (본인)

**Request**: `{ "description"?: "...", "img_url"?: "..." | null }`  
`type` / 좌표 수정 불가.

---

### DELETE `/reports/{id}` 🔐

본인 또는 JWT role이 `ADMIN`이면 soft delete (`is_active='N'`).

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
- `safety_feeling`: `안전` \| `보통` \| `불안`
- 동일 유저·동일 격자 활성 피드백 있으면 **409**

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

---

### DELETE `/feedbacks/{id}` 🔐

본인 또는 JWT `ADMIN` → soft delete (`is_active='N'`).

---

## 8. 마이페이지 API

### GET `/mypage` 🔐

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "nickname": "...", "role": "USER", "...": "..." },
    "reportCount": 3,
    "feedbackCount": 2
  }
}
```

### GET `/mypage/report` 🔐

**Query**: `page` (기본 1), `limit` (기본 10)  
내 활성 제보 목록 (`user.nickname` include).

### GET `/mypage/feedback` 🔐

**Query**: `page`, `limit`  
내 활성 피드백 + `tags: [{ id, name }]`.

---

## 9. 업로드 API

### POST `/uploads/image` 🔓

`multipart/form-data`, 필드명 `image`  
제한: 이미지 MIME, 최대 5MB

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

### POST `/uploads/image/report` 🔓

제보용: 메모리 수신 → 얼굴 마스킹 → 디스크 저장. 응답 형태는 위와 동일.

### GET `/uploads/**` 🔓

정적 파일 서빙 (`express.static`).

---

## 10. 사고다발지역 API

### GET `/accident-zones` 🔓

도로교통공단 OpenAPI 프록시. `KOROAD_AUTH_KEY` 필요.

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
    "items": [ ]
  }
}
```

| 코드 | 상황 |
|---|---|
| 422 | siDo/guGun/type 형식 오류 |
| 503 | `KOROAD_AUTH_KEY` 미설정 |

---

## 11. 관리자 API 요약 👑

`/admin/*` 전 구간 `adminMiddleware` (세션 `role=ADMIN` + `active_session_id` 검증).

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/me` | 세션 관리자 정보 |
| GET | `/admin/summary` | 대시보드 집계 |
| GET | `/admin/reports` | 제보 목록 (+ types, nickname/keyword 검색) |
| POST | `/admin/create-report` | 제보 등록 |
| POST | `/admin/delete-report` | 제보 소프트 삭제 |
| POST | `/admin/restore-report` | 제보 복구 |
| GET | `/admin/feedbacks` | 피드백 목록 |
| POST | `/admin/delete-feedback` | 피드백 소프트 삭제 |
| GET | `/admin/events` | 도시행사 목록 (+ status 필터) |
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
    "inactive_city_events": 2
  }
}
```

쿼리·바디·에러 상세는 **`docs/Admin API 명세서.md`** 를 기준으로 한다.

---

## 12. 디바이스 API

`app.use("/devices", ...)` 는 마운트되어 있으나 **라우트 미등록**.  
`device.controller` stub만 존재 → `POST /devices/register` 등은 **미구현**.

---

## 13. 인증 흐름 요약

```
[USER 웹]
  login → access(body) + refresh(cookie)
  API → Authorization: Bearer access
  access 만료 → POST /auth/refresh (cookie) → 새 access
  logout → POST /auth/logout (cookie clear + DB revoke)

[USER 앱]
  login (client=app) → access + refresh (body)
  refresh/logout → body.refresh_token
  로컬 Secure Storage에서 토큰 삭제

[ADMIN]
  login → connect.sid 세션
  /admin/* → credentials include
  logout → session destroy
```

---

## 14. 반영 이력

| 버전 | 변경사항 |
|---|---|
| v1.0 | 최초 작성 |
| v1.1 | DB설계서 반영 (`img_url`, city-events, devices 등) |
| v1.2 | `admin/summary`, `feedbacks/me` 등 UI 공백 반영 |
| v1.3 | **현재 코드 기준 전면 갱신**: JWT+세션 이중 인증, web/app refresh 분기, `/auth/register`·`refresh`·`logout`·`change-pw`, `/mypage`, `/uploads`, `/infrastructures`, `/accident-zones`, Admin path 정리, 미구현 API 명시 (`shelters`, `devices`, 격자 피드백 목록/`me`) |
