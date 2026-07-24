# Admin API 명세서

> 기준: `admin.controller.ts` / `admin.routes.ts` / `commonUtils.ts` 현재 구현  
> Base URL (개발): `http://localhost:4100`  
> Prefix: `/admin`

## 1. 개요

| 항목 | 내용 |
|---|---|
| 응답 포맷 | JSON |
| 공통 성공 구조 | `{ "success": true, "data": ... }` 또는 `{ "success": true, "message": "..." }` |
| 목록+타입 | 일부 목록 API는 `{ "success": true, "data": [...], "types": [...] }` |
| 공통 실패 구조 | `{ "success": false, "message": "..." }` |
| BigInt | `id` 등 BigInt 필드는 JSON에서 **문자열**로 직렬화됨 |
| 인증 | 관리자 전용 의도이나, 현재 라우트에 `adminMiddleware` 미적용 |

**인증 표기**
- 👑 관리자 전용 (의도) — 현재는 미검증

---

## 2. 엔드포인트 목록 (구현 완료)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/admin/summary` | 대시보드 집계 | 👑 |
| GET | `/admin/reports` | 제보 목록 조회 (+ types) | 👑 |
| POST | `/admin/delete-report` | 제보 소프트 삭제 (`is_active=N`) | 👑 |
| GET | `/admin/feedbacks` | 피드백 목록 조회 | 👑 |
| POST | `/admin/delete-feedback` | 피드백 소프트 삭제 (`is_active=N`) | 👑 |
| GET | `/admin/events` | 도시 행사 목록 조회 (+ types) | 👑 |
| POST | `/admin/create-event` | 도시 행사 등록 | 👑 |
| POST | `/admin/update-event` | 도시 행사 수정 | 👑 |
| POST | `/admin/delete-event` | 도시 행사 하드 삭제 | 👑 |

### 미구현

| 항목 | 상태 |
|---|---|
| `createMarker` (신규 마커 생성) | 컨트롤러 TODO |
| 관리자 JWT / `adminMiddleware` | 미연결 |

---

## 3. GET `/admin/summary` 👑

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
| 500 | `Internal server error` |

---

## 4. GET `/admin/reports` 👑

유저 제보 목록 조회 (최신순, 페이지네이션).  
작성자 닉네임(`user.nickname`)과 DB에 존재하는 제보 `type` 목록을 함께 반환.

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `10` | 페이지당 개수 |
| `filter` | string | `active` | `active` / `inactive` / 그 외(전체) |
| `date_range` | number | `30` | `date_from` 미지정 시 오늘 기준 N일 전부터 |
| `date_from` | string | (선택) | 조회 시작일 |
| `date_to` | string | (선택) | 조회 종료일. `YYYY-MM-DD`만 오면 당일 23:59:59.999로 보정. 없으면 오늘 끝(KST) |

**예시**
```
GET /admin/reports?page=1&limit=10&filter=active&date_from=2026-07-01&date_to=2026-07-23
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
- `user`가 없거나 탈퇴 등이면 `user`는 `null`일 수 있음

**에러**

| 코드 | message |
|---|---|
| 400 | `Invalid date` |
| 500 | `Internal server error` |

---

## 5. POST `/admin/delete-report` 👑

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
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 삭제된 항목입니다!` |
| 500 | `삭제에 실패했습니다!` |

---

## 6. GET `/admin/feedbacks` 👑

피드백 목록 조회 (최신순, 페이지네이션).  
작성자 닉네임(`user.nickname`) 포함.

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `10` | 페이지당 개수 |
| `filter` | string | `active` | `active` / `inactive` / 그 외(전체) |
| `date_range` | number | `30` | `date_from` 미지정 시 오늘 기준 N일 전부터 |
| `date_from` | string | (선택) | 조회 시작일 |
| `date_to` | string | (선택) | 조회 종료일. 없으면 오늘 끝(KST) |

> `/admin/reports`, `/admin/events`와 달리 `date_to`가 `YYYY-MM-DD`일 때 하루 끝으로 보정하는 로직은 없음.

**예시**
```
GET /admin/feedbacks?page=1&limit=10&filter=active&date_range=30
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
| 500 | `피드백 목록 조회에 실패했습니다!` |

---

## 7. POST `/admin/delete-feedback` 👑

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
| 404 | `항목을 찾을 수 없습니다!` |
| 400 | `이미 삭제된 항목입니다!` |
| 500 | `삭제에 실패했습니다!` |

---

## 8. GET `/admin/events` 👑

도시 행사(`city_events`) 목록 조회 (최신순, 페이지네이션).  
등록자 닉네임(`user.nickname`, `created_by` 기준)과 DB에 존재하는 행사 `type` 목록을 함께 반환.

**Query**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `10` | 페이지당 개수 |
| `filter` | string | `active` | `active` → `is_active=Y`, `inactive` → `N`, 그 외 → 전체 |
| `date_range` | number | `30` | `date_from` 미지정 시 오늘 기준 N일 전부터 (`created_at` 기준) |
| `date_from` | string | (선택) | 조회 시작일 |
| `date_to` | string | (선택) | 조회 종료일. `YYYY-MM-DD`만 오면 당일 23:59:59.999로 보정. 없으면 오늘 끝(KST) |

**예시**
```
GET /admin/events?page=1&limit=10&filter=active&date_range=30
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
- 날짜 필터는 `start_at`/`end_at`이 아니라 **`created_at`** 기준

**에러**

| 코드 | message |
|---|---|
| 400 | `Invalid date` |
| 500 | `도시 행사 목록 조회에 실패했습니다!` |

---

## 9. POST `/admin/create-event` 👑

도시 행사 등록.

**Request Body** (모두 필수 — 서버 검증)
```json
{
  "type": "행사",
  "title": "OO 페스티벌",
  "description": "여의도 한강공원 일대에서 대규모 불꽃축제가 진행됩니다.",
  "lat": 37.5326,
  "lng": 126.9905,
  "start_at": "2026-08-01T19:00:00+09:00",
  "end_at": "2026-08-01T22:00:00+09:00"
}
```

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
| 400 | `입력값을 모두 채워주세요!` |
| 500 | `등록에 실패했습니다!` |

> **구현 주의**: body의 `start_at` / `end_at`은 필수 검증에만 사용되고, 실제 DB 저장 값은 `req.query.start_at` / `req.query.end_at`을 읽음. query가 없으면 `new Date()`(현재 시각)로 저장됨. 프론트는 body만 보내면 날짜가 의도대로 안 들어갈 수 있음.  
> `created_by`, `img_url`, `is_active`는 현재 create 시 설정하지 않음 (`is_active`는 DB 기본값 `Y`).

---

## 10. POST `/admin/update-event` 👑

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
  "end_at": "2026-08-01T22:00:00+09:00"
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
| 404 | `항목을 찾을 수 없습니다!` |
| 500 | `수정에 실패했습니다!` |

> create-event와 동일하게 날짜는 `req.query` 쪽을 읽는 구현 이슈가 있음.

---

## 11. POST `/admin/delete-event` 👑

도시 행사 **하드 삭제** (행 자체 삭제).  
제보/피드백과 달리 soft delete(`is_active=N`)가 아님.

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
| 404 | `항목을 찾을 수 없습니다!` |
| 500 | `삭제에 실패했습니다!` |

---

## 12. 공통 유틸 — `types` 응답

`getTypes(source)` (`src/utils/commonUtils.ts`)

| `source` | 대상 테이블 | 반환 |
|---|---|---|
| `"report"` | `report` | distinct `type` 배열 |
| `"city_events"` | `city_events` | distinct `type` 배열 |

- DB에 행이 없으면 `[]` (에러 아님)
- `type`이 NULL인 행이 있으면 배열에 `null`이 포함될 수 있음

---

## 13. 기존 `API명세서.md`와의 차이

| 항목 | 기존 명세 | 현재 구현 |
|---|---|---|
| 제보 삭제 | `DELETE /admin/reports/{id}` | `POST /admin/delete-report` + body `id` |
| 피드백 삭제 | `DELETE /admin/feedbacks/{id}` | `POST /admin/delete-feedback` + body `id` |
| 도시 행사 목록 | `GET /admin/city-events` | `GET /admin/events` (+ 페이지/필터/`types`) |
| 도시 행사 삭제 | `DELETE /admin/city-events/{id}` | `POST /admin/delete-event` + body `id` |
| 도시 행사 등록/수정 | (마커 API 등) | `POST /admin/create-event`, `POST /admin/update-event` |
| summary 필드 | `total_city_events`, `city_events_today` | `active_city_events` |
| markers | `POST /admin/markers` | 미구현 (TODO) |

본 문서는 **현재 코드 기준**이며, 통합 명세(`API명세서.md`)와 맞출 때는 path·필드 통일이 필요함.

---

## 14. 반영 이력

| 버전 | 변경사항 |
|---|---|
| v0.1 | 구현 완료된 Admin API 기준으로 최초 작성 |
| v0.2 | reports/events에 `types`·`user.nickname` 반영, events 페이지/필터/날짜 조회 반영, `city_events`의 `img_url`·`is_active` 반영 |
