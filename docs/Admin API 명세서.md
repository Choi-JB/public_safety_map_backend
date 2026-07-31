# Admin API 명세서

> 기준: `admin.controller.ts` / `admin.routes.ts` / `admin.middleware.ts` / `commonUtils.ts` 현재 구현  
> Base URL (개발): `http://localhost:4100`  
> Prefix: `/admin`  
> 관련: 이미지 업로드는 `/uploads/image` (별도 라우트)

## 1. 개요

| 항목 | 내용 |
|---|---|
| 응답 포맷 | JSON |
| 공통 성공 구조 | `{ "success": true, "data": ... }` 또는 `{ "success": true, "message": "..." }` |
| 목록+타입 | 일부 목록 API는 `{ "success": true, "data": [...], "types": [...] }` |
| 공통 실패 구조 | `{ "success": false, "message": "..." }` |
| BigInt | `id` 등 BigInt 필드는 JSON에서 **문자열**로 직렬화됨 |
| 인증 | `/admin/*` 전 구간에 `adminMiddleware` 적용 (세션 `userId` + `role === "ADMIN"`) |

**인증 표기**
- 👑 관리자 전용 — 세션 쿠키 필요. 미인증 시 `401 Unauthorized`

---

## 2. 엔드포인트 목록

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/admin/me` | 현재 관리자 세션 확인 | 👑 |
| GET | `/admin/summary` | 대시보드 집계 | 👑 |
| GET | `/admin/reports` | 제보 목록 조회 (+ types) | 👑 |
| POST | `/admin/create-report` | 제보 등록 | 👑 |
| POST | `/admin/delete-report` | 제보 소프트 삭제 (`is_active=N`) | 👑 |
| POST | `/admin/restore-report` | 제보 복구 (`is_active=Y`) | 👑 |
| GET | `/admin/feedbacks` | 피드백 목록 조회 | 👑 |
| POST | `/admin/delete-feedback` | 피드백 소프트 삭제 (`is_active=N`) | 👑 |
| GET | `/admin/events` | 도시 행사 목록 조회 (+ types) | 👑 |
| POST | `/admin/create-event` | 도시 행사 등록 | 👑 |
| POST | `/admin/update-event` | 도시 행사 수정 | 👑 |
| POST | `/admin/delete-event` | 도시 행사 소프트 삭제 (`is_active=N`) | 👑 |
| POST | `/admin/restore-event` | 도시 행사 복구 (`is_active=Y`) | 👑 |
| GET | `/admin/grid-id` | 좌표 → grid id 조회 | 👑 |
| POST | `/uploads/image` | 이미지 업로드 (admin prefix 아님) | — |

### 미구현

| 항목 | 상태 |
|---|---|
| `createMarker` (신규 마커 생성) | 컨트롤러 TODO |

---

## 3. GET `/admin/me` 👑

현재 로그인된 관리자 세션 확인.

**Request**: 없음 (세션 쿠키)

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "nickname": null,
    "role": "ADMIN",
    "email": null
  }
}
```

> 미들웨어가 `id`, `role`만 세션에서 넣음. `nickname` / `email`은 세션에 없으면 `null`/`undefined`일 수 있음.

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |

---

## 4. GET `/admin/summary` 👑

관리자 대시보드용 집계 지표.

**Request**: 없음

**Response 200**
```json
{
  "success": true,
  "data": {
    "active_reports": 24,
    "reports_today": 3,
    "total_feedbacks": 1286,
    "feedbacks_today": 17,
    "active_city_events": 5
  }
}
```

| 필드 | 의미 |
|---|---|
| `active_reports` | `report.is_active = 'Y'` 개수 |
| `reports_today` | 오늘(KST 00:00~) 등록된 제보 수 |
| `total_feedbacks` | 피드백 전체 개수 (비활성 포함) |
| `feedbacks_today` | 오늘(KST 00:00~) 등록된 피드백 수 |
| `active_city_events` | `end_at >= now` 인 도시 행사 수 |

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 500 | `Internal server error` |

---

## 5. GET `/admin/reports` 👑

유저 제보 목록 조회 (페이지네이션).  
작성자 닉네임(`user.nickname`)과 DB에 존재하는 제보 `type` 목록을 함께 반환.

- `filter=inactive` → `expire_at` 내림차순
- 그 외 → `created_at` 내림차순

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `10` | 페이지당 개수 |
| `filter` | string | `active` | `active` → `is_active=Y` / `inactive` → `N` / 그 외 → 전체 |
| `date_range` | number | `30` | `date_from` 미지정 시 오늘 기준 N일 전부터 |
| `date_from` | string | (선택) | 조회 시작일 (`created_at`, KST 파싱) |
| `date_to` | string | (선택) | 조회 종료일. 없으면 오늘 끝(KST) |
| `nickname` | string | (선택) | 작성자 닉네임 부분 검색 (`user.nickname contains`) |
| `keyword` | string | (선택) | 제보 설명 부분 검색 (`description contains`) |

**예시**
```
GET /admin/reports?page=1&limit=10&filter=active&date_from=2026-07-01&date_to=2026-07-23&nickname=안전&keyword=공사
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "user_id": "2",
      "grid_id": "10",
      "type": "공사",
      "lat": "37.56650000",
      "lng": "126.97800000",
      "description": "강남대로 하수관 교체공사",
      "img_url": null,
      "is_active": "Y",
      "created_at": "2026-07-21T07:00:00.000Z",
      "expire_at": "2026-07-22T07:00:00.000Z",
      "user": {
        "nickname": "안전파수꾼"
      }
    }
  ],
  "types": ["공사", "싱크홀", "교통사고"]
}
```

- `types`: `report.type` distinct 목록. 데이터 없으면 `[]`
- `user`가 없으면 `null`일 수 있음

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 400 | `Invalid date` |
| 500 | `Internal server error` |

---

## 6. POST `/admin/create-report` 👑

관리자 제보 등록.  
`created_at`은 KST 벽시계, `expire_at`은 등록 시각 + 30일.

**Request Body**
```json
{
  "id": 1,
  "type": "공사",
  "description": "강남대로 하수관 교체공사",
  "img_url": "http://localhost:4100/uploads/img/....jpg",
  "grid_id": 10,
  "lat": 37.5665,
  "lng": 126.9780
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | O | 등록자(user) id → `user_id` |
| `type` | O | 제보 유형 |
| `description` | O | 설명 |
| `grid_id` | O | 격자 id |
| `lat` | O | 위도 |
| `lng` | O | 경도 |
| `img_url` | X | 없으면 `null` |

**Response 200**
```json
{
  "success": true,
  "message": "등록되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 400 | `입력값을 모두 채워주세요!` |
| 404 | `그리드를 찾을 수 없습니다!` |
| 404 | `등록자를 찾을 수 없습니다!` |
| 500 | `등록에 실패했습니다!` |

---

## 7. POST `/admin/delete-report` 👑

제보 소프트 삭제 (`is_active` → `N`).  
만료일 이후 자동 비활성화는 DB 이벤트 스케줄러 담당.

**Request Body**
```json
{
  "id": 1
}
```

**Response 200**
```json
{
  "success": true,
  "message": "삭제되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 삭제된 항목입니다!` |
| 500 | `삭제에 실패했습니다!` |

---

## 8. POST `/admin/restore-report` 👑

제보 복구 (`is_active` → `Y`).

**Request Body**
```json
{
  "id": 1
}
```

**Response 200**
```json
{
  "success": true,
  "message": "복구되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 활성화된 항목입니다!` |
| 500 | `복구에 실패했습니다!` |

---

## 9. GET `/admin/feedbacks` 👑

피드백 목록 조회 (최신순, 페이지네이션).  
작성자 닉네임(`user.nickname`) 포함.

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `10` | 페이지당 개수 |
| `filter` | string | `active` | `active` / `inactive` / 그 외(전체) |
| `date_range` | number | `30` | `date_from` 미지정 시 오늘 기준 N일 전부터 |
| `date_from` | string | (선택) | 조회 시작일 (`created_at`) |
| `date_to` | string | (선택) | 조회 종료일. 없으면 오늘 끝(KST) |
| `nickname` | string | (선택) | 작성자 닉네임 부분 검색 (`user.nickname contains`) |
| `keyword` | string | (선택) | 피드백 내용 부분 검색 (`comment contains`) |

> `/admin/reports`와 달리 `date_from`/`date_to`는 `new Date(...)`로 파싱 (`parseDateStartKst`/`parseDateEndKst` 미사용). `YYYY-MM-DD`만 올 때 하루 끝 보정 없음.

**예시**
```
GET /admin/feedbacks?page=1&limit=10&filter=active&keyword=가로등&nickname=민지
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "user_id": "2",
      "grid_id": "10",
      "safety_feeling": "보통",
      "comment": "가로등이 어두워요",
      "img_url": null,
      "is_active": "Y",
      "created_at": "2026-07-21T07:00:00.000Z",
      "user": {
        "nickname": "민지킴"
      }
    }
  ]
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 500 | `피드백 목록 조회에 실패했습니다!` |

---

## 10. POST `/admin/delete-feedback` 👑

피드백 소프트 삭제 (`is_active` → `N`).

**Request Body**
```json
{
  "id": 1
}
```

**Response 200**
```json
{
  "success": true,
  "message": "삭제되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 삭제된 항목입니다!` |
| 500 | `삭제에 실패했습니다!` |

---

## 11. GET `/admin/events` 👑

도시 행사(`city_events`) 목록 조회 (페이지네이션).  
등록자 닉네임(`user.nickname`, `created_by` 기준)과 DB에 존재하는 행사 `type` 목록을 함께 반환.

정렬: `is_active` desc → `created_at` desc

**날짜 필터**: 행사의 `start_at`/`end_at`이 조회 구간과 **겹치는** 항목  
(`start_at <= date_to` AND `end_at >= date_from`)

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `10` | 페이지당 개수 |
| `filter` | string | `active` | `active` → `is_active=Y`, `inactive` → `N`, 그 외 → 전체 |
| `date_range` | number | `30` | `date_from` 미지정 시 오늘 기준 N일 전부터 |
| `date_from` | string | (선택) | 조회 구간 시작 |
| `date_to` | string | (선택) | 조회 구간 끝. `YYYY-MM-DD`만 오면 당일 23:59:59.999로 보정. 없으면 오늘 끝(KST) |
| `status` | string | (선택) | `scheduled` / `ongoing` / `ended`. 없으면 상태 필터 없음 |
| `nickname` | string | (선택) | 등록자 닉네임 부분 검색 (`user.nickname contains`) |
| `keyword` | string | (선택) | 제목 부분 검색 (`title contains`) |

**status 기준 (현재 시각 `now`)**

| 값 | 조건 |
|---|---|
| `scheduled` | `start_at > now` (예정) |
| `ongoing` | `start_at <= now` AND `end_at >= now` (진행 중) |
| `ended` | `end_at < now` (종료) |

**예시**
```
GET /admin/events?page=1&limit=10&filter=active&status=ongoing&keyword=축제&nickname=관리
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "type": "행사",
      "title": "서울 불꽃축제",
      "description": "여의도 한강공원 일대",
      "lat": "37.53260000",
      "lng": "126.99050000",
      "img_url": null,
      "start_at": "2026-08-01T10:00:00.000Z",
      "end_at": "2026-08-01T13:00:00.000Z",
      "created_by": "1",
      "created_at": "2026-07-20T00:00:00.000Z",
      "is_active": "Y",
      "user": {
        "nickname": "관리자"
      }
    }
  ],
  "types": ["행사", "인파밀집", "교통통제"]
}
```

- `types`: `city_events.type` distinct 목록. 데이터 없으면 `[]`

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 400 | `Invalid date` |
| 500 | `도시 행사 목록 조회에 실패했습니다!` |

---

## 12. POST `/admin/create-event` 👑

도시 행사 등록.

**Request Body**
```json
{
  "id": 1,
  "type": "행사",
  "title": "OO 페스티벌",
  "description": "여의도 한강공원 일대에서 대규모 불꽃축제가 진행됩니다.",
  "lat": 37.5326,
  "lng": 126.9905,
  "start_at": "2026-08-01T19:00:00+09:00",
  "end_at": "2026-08-01T22:00:00+09:00",
  "img_url": "http://localhost:4100/uploads/img/....jpg"
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `type`, `title`, `description`, `lat`, `lng`, `start_at`, `end_at` | O | 서버 필수 검증 |
| `id` | O* | 등록자 user id → `created_by` (*검증 목록에는 없으나 없으면 조회 실패/500) |
| `img_url` | X | 없으면 `null` |

**Response 200**
```json
{
  "success": true,
  "message": "등록되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 400 | `입력값을 모두 채워주세요!` |
| 404 | `등록자를 찾을 수 없습니다!` |
| 500 | `등록에 실패했습니다!` |

> **구현 주의**: body의 `start_at` / `end_at`은 필수 검증에만 사용되고, 실제 DB 저장 값은 `req.query.start_at` / `req.query.end_at`을 읽음. query가 없으면 `toKstWallClock()`(현재)로 저장됨. 프론트는 body만 보내면 날짜가 의도대로 안 들어갈 수 있음.

---

## 13. POST `/admin/update-event` 👑

도시 행사 수정.

**Request Body**
```json
{
  "id": 1,
  "type": "행사",
  "title": "수정된 제목",
  "description": "수정된 설명",
  "lat": 37.5326,
  "lng": 126.9905,
  "start_at": "2026-08-01T19:00:00+09:00",
  "end_at": "2026-08-01T22:00:00+09:00",
  "img_url": null
}
```

**Response 200**
```json
{
  "success": true,
  "message": "수정되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 404 | `항목을 찾을 수 없습니다!` |
| 500 | `수정에 실패했습니다!` |

> create-event와 동일하게 날짜는 `req.query.start_at` / `req.query.end_at`을 읽음. query가 없으면 `new Date()`로 저장.

---

## 14. POST `/admin/delete-event` 👑

도시 행사 **소프트 삭제** (`is_active` → `N`).  
제보/피드백과 동일.

**Request Body**
```json
{
  "id": 1
}
```

**Response 200**
```json
{
  "success": true,
  "message": "삭제되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 삭제된 항목입니다!` |
| 500 | `삭제에 실패했습니다!` |

---

## 15. POST `/admin/restore-event` 👑

도시 행사 복구 (`is_active` → `Y`).

**Request Body**
```json
{
  "id": 1
}
```

**Response 200**
```json
{
  "success": true,
  "message": "복구되었습니다!"
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 활성화된 항목입니다!` |
| 500 | `복구에 실패했습니다!` |

---

## 16. GET `/admin/grid-id` 👑

위경도 → 격자 id 조회.  
원점 `(33.0, 124.5)`, 셀 크기 `0.01`.

**Query**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `lat` | number | O | 위도 |
| `lng` | number | O | 경도 |

**예시**
```
GET /admin/grid-id?lat=37.5665&lng=126.9780
```

**Response 200** (격자 있음)
```json
{
  "success": true,
  "data": "10"
}
```

**Response 200** (격자 없음)
```json
{
  "success": true,
  "message": "그리드 아이디가 없는 곳입니다."
}
```

**에러**

| 코드 | message |
|---|---|
| 401 | `Unauthorized` |
| 500 | `그리드 아이디 조회에 실패했습니다!` |

---

## 17. POST `/uploads/image` (관련)

이미지 업로드. `/admin` prefix가 아니며, 현재 `adminMiddleware` 미적용.  
제보/행사 `img_url`에 사용할 수 있음.

**Request**: `multipart/form-data`, 필드명 `image`  
제한: 이미지 MIME만, 최대 5MB

**Response 201**
```json
{
  "success": true,
  "data": {
    "original_name": "photo.jpg",
    "file_name": "1785461177016-3a7a42ea-....jpg",
    "image_path": "/uploads/img/1785461177016-3a7a42ea-....jpg",
    "img_url": "http://localhost:4100/uploads/img/1785461177016-3a7a42ea-....jpg",
    "size": 102400
  }
}
```

**에러**

| 코드 | message |
|---|---|
| 400 | `업로드할 이미지 파일이 필요합니다.` / 이미지 아님 등 |
| 413 | 파일 크기 초과 (`LIMIT_FILE_SIZE`) |

---

## 18. 공통 유틸 — `types` 응답

`getTypes(source)` (`src/utils/commonUtils.ts`)

| `source` | 대상 테이블 | 반환 |
|---|---|---|
| `"report"` | `report` | distinct `type` 배열 |
| `"city_events"` | `city_events` | distinct `type` 배열 |

- DB에 행이 없으면 `[]` (에러 아님)
- `type`이 NULL인 행이 있으면 배열에 `null`이 포함될 수 있음

---

## 19. 기존 `API명세서.md`와의 차이

| 항목 | 기존 명세 | 현재 구현 |
|---|---|---|
| 인증 | (문서마다 상이) | `/admin/*`에 `adminMiddleware` (세션 ADMIN) |
| 제보 등록 | — | `POST /admin/create-report` |
| 제보 삭제 | `DELETE /admin/reports/{id}` | `POST /admin/delete-report` + body `id` |
| 제보 복구 | — | `POST /admin/restore-report` |
| 피드백 삭제 | `DELETE /admin/feedbacks/{id}` | `POST /admin/delete-feedback` + body `id` |
| 도시 행사 목록 | `GET /admin/city-events` | `GET /admin/events` (+ status/nickname/keyword/`types`) |
| 도시 행사 삭제 | `DELETE /admin/city-events/{id}` | `POST /admin/delete-event` (소프트 삭제) |
| 도시 행사 복구 | — | `POST /admin/restore-event` |
| 도시 행사 등록/수정 | (마커 API 등) | `POST /admin/create-event`, `POST /admin/update-event` |
| summary 필드 | `total_city_events`, `city_events_today` | `active_city_events` |
| grid-id / me | — | `GET /admin/grid-id`, `GET /admin/me` |
| markers | `POST /admin/markers` | 미구현 (TODO) |

본 문서는 **현재 코드 기준**이며, 통합 명세(`API명세서.md`)와 맞출 때는 path·필드 통일이 필요함.

---

## 20. 반영 이력

| 버전 | 변경사항 |
|---|---|
| v0.1 | 구현 완료된 Admin API 기준으로 최초 작성 |
| v0.2 | reports/events에 `types`·`user.nickname` 반영, events 페이지/필터/날짜 조회 반영, `city_events`의 `img_url`·`is_active` 반영 |
| v0.3 | `adminMiddleware` 적용 반영. `me` / `create-report` / `restore-report` / `restore-event` / `grid-id` 추가. 목록 검색(`nickname`/`keyword`), events `status` 필터 추가. `delete-event` 소프트 삭제로 수정. `/uploads/image` 관련 절 추가 |
