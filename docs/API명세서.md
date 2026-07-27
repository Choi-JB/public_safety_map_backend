# API 명세서 (v1.2)

## 1. 개요

| 항목 | 내용 |
|---|---|
| Base URL | `https://api.example.com/v1` (개발환경 placeholder) |
| 인증 방식 | JWT Bearer Token (`Authorization: Bearer {token}`) |
| 응답 포맷 | JSON |
| 공통 응답 구조 | `{ "success": true/false, "data": {...}, "error": null }` |
| 날짜 형식 | ISO 8601 (`2026-07-21T10:30:00+09:00`) |

**인증 필요 여부 표기**
- 🔓 인증 불필요 (비회원 가능)
- 🔐 로그인 필요 (일반회원 이상)
- 👑 관리자 전용 (`role='ADMIN'`)

---

## 2. 엔드포인트 목록

| 기능ID | Method | Path | 인증 |
|---|---|---|---|
| 인증 | POST | /auth/signup | 🔓 |
| 인증 | POST | /auth/login | 🔓 |
| FN-01-01 | GET | /grids | 🔓 |
| FN-01-01 | GET | /grids/{grid_id}/infrastructures | 🔓 |
| FN-01-02 | GET | /city-events | 🔓 |
| FN-01-03 | GET | /shelters | 🔓 |
| FN-01-04 | GET | /grids/{grid_id}/detail | 🔓 |
| FN-02-01-R | GET | /reports | 🔓 |
| FN-02-01 | POST | /reports | 🔐 |
| FN-02-01 | PATCH | /reports/{id} | 🔐 (본인) |
| FN-02-01 | DELETE | /reports/{id} | 🔐 (본인) / 👑 |
| FN-02-02 | POST | /devices/register | 🔓 |
| FN-03-01 | GET | /grids/{grid_id}/feedbacks | 🔓 |
| FN-03-01 | POST | /grids/{grid_id}/feedbacks | 🔐 |
| FN-03-01 | PATCH | /feedbacks/{id} | 🔐 (본인) |
| FN-03-01 | DELETE | /feedbacks/{id} | 🔐 (본인) / 👑 |
| 공통 | GET | /tags | 🔓 |
| FN-05-01 | GET | /admin/reports | 👑 |
| FN-05-01 | DELETE | /admin/reports/{id} | 👑 |
| FN-05-01 | GET | /admin/feedbacks | 👑 |
| FN-05-01 | DELETE | /admin/feedbacks/{id} | 👑 |
| FN-05-01 | POST | /admin/markers | 👑 |
| FN-05-01 | GET | /admin/city-events | 👑 |
| FN-05-01 | DELETE | /admin/city-events/{id} | 👑 |
| FN-05-01 | GET | /admin/summary | 👑 |
| FN-03-01 | GET | /grids/{grid_id}/feedbacks/me | 🔐 |

---

## 3. 인증 API

### POST /auth/signup 🔓
**Request**
```json
{
  "email": "kim.minji@example.com",
  "password": "plainPassword123!",
  "nickname": "민지킴"
}
```
서버는 `password`를 bcrypt로 해시하여 `user.password_hash`에 저장. `role`은 클라이언트가 지정할 수 없고 서버가 항상 `USER`로 고정 (관리자 계정은 회원가입으로 생성 불가, DB에 직접 시딩된 1개 계정만 존재)

**Response 201**
```json
{ "success": true, "data": { "id": 6, "email": "kim.minji@example.com", "nickname": "민지킴", "role": "USER" } }
```

**에러**
| 코드 | 상황 |
|---|---|
| 409 | 이메일 중복 |
| 422 | 비밀번호 형식 미달 등 유효성 실패 |

---

### POST /auth/login 🔓
**Request**
```json
{ "email": "kim.minji@example.com", "password": "plainPassword123!" }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 6, "nickname": "민지킴", "role": "USER" }
  }
}
```
- `role`이 `ADMIN`인 계정이 로그인하면 클라이언트는 이 값으로 관리자 페이지 진입 여부를 판단
- 별도의 관리자 전용 로그인 엔드포인트는 두지 않음 (동일 엔드포인트, role로 구분)

**에러**: 401 (이메일/비밀번호 불일치), 403 (`is_active='N'`인 비활성 계정)

---

## 4. 지도 / 격자 API

### GET /grids 🔓 — FN-01-01
현재 지도 화면(viewport) 범위 내 격자 목록 조회

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| sw_lat, sw_lng | float | Y | 화면 좌측하단 좌표 |
| ne_lat, ne_lng | float | Y | 화면 우측상단 좌표 |

서버는 요청받은 4개 좌표를 `grid_row`/`grid_col` 범위로 변환해 `WHERE grid_row BETWEEN ... AND grid_col BETWEEN ...`로 조회 (좌표 계산식은 DB설계서 3번 참고)

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "grid_id": 1,
      "lat": 37.56653500,
      "lng": 126.97796900,
      "infra_count": 12,
      "safety_grade": "안전"
    }
  ]
}
```

---

### GET /grids/{grid_id}/infrastructures 🔓 — FN-01-01 (상세 줌)
줌 레벨이 높아졌을 때 개별 인프라 마커를 표시하기 위한 조회

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "type": "CCTV", "address": "서울특별시 중구 태평로1가 31", "lat": 37.56650000, "lng": 126.97790000 },
    { "id": 2, "type": "비상벨", "address": "서울특별시 중구 태평로1가 35", "lat": 37.56660000, "lng": 126.97810000 }
  ]
}
```

---

### GET /grids/{grid_id}/detail 🔓 — FN-01-04
구역별 상세 인포카드용 데이터 (인프라 집계 + 체감안전도 + 최근 피드백 + 진행중 제보를 한 번에 조합)

**Response 200**
```json
{
  "success": true,
  "data": {
    "grid_id": 1,
    "lat": 37.56653500,
    "lng": 126.97796900,
    "safety_grade": "안전",
    "infra_count": 12,
    "tags": ["보안관 순찰구역"],
    "safety_feeling_ratio": { "안전": 50, "보통": 50, "불안": 0 },
    "recent_feedbacks": [
      { "id": 4, "safety_feeling": "안전", "comment": "순찰도 자주 돌고 비상벨도 잘 보여요.", "created_at": "2026-02-20T14:00:00+09:00" }
    ],
    "active_reports": [
      { "id": 5, "type": "공사", "description": "태평로 일대 상수도관 교체공사로 인해 인도 일부 통행이 제한됩니다. 우회 바랍니다.", "expire_at": "2026-07-25T18:00:00+09:00" }
    ]
  }
}
```

**서버 처리 로직**
1. `grid` 테이블에서 `safety_grade`, `infra_count` 조회 (캐시값 그대로 사용)
2. `feedback`을 `grid_id` + `is_active='Y'` 기준 `GROUP BY safety_feeling`으로 비율 계산
3. `feedback`을 동일 조건 + `created_at DESC LIMIT 3`으로 최근 항목 조회
4. `feedback_tag` JOIN `tag`로 해당 격자 피드백들의 태그 집계
5. `report`를 `grid_id` + `is_active='Y'` + `expire_at > NOW()` 조건으로 조회

---

### GET /city-events 🔓 — FN-01-02
대형행사/인파밀집/교통통제 정보 조회. `grid` 체계와 무관한 독립 도메인이라 `grid_id`를 거치지 않고 좌표(bounding box)로 직접 조회

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| sw_lat, sw_lng | float | Y | 화면 좌측하단 좌표 |
| ne_lat, ne_lng | float | Y | 화면 우측상단 좌표 |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "행사",
      "title": "서울 불꽃축제",
      "description": "여의도 한강공원 일대에서 대규모 불꽃축제가 진행됩니다.",
      "lat": 37.53260000,
      "lng": 126.99050000,
      "start_at": "2026-08-01T19:00:00+09:00",
      "end_at": "2026-08-01T22:00:00+09:00"
    }
  ]
}
```

조회 조건: `end_at > NOW()` (종료 시각 경과 시 자동으로 목록에서 제외)

---

### GET /shelters 🔓 — FN-01-03
현재 위치 인근 피난처(파출소·경찰서, 편의점) 조회

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| lat, lng | float | Y | 기준 좌표 |
| radius | int | N | 조회 반경(m), 기본값 500 |

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 5, "type": "경찰서", "address": "서울특별시 관악구 신림로 210", "lat": 37.48430000, "lng": 126.92980000, "distance_m": 120 }
  ]
}
```
서버 로직: `infrastructures` 중 `type IN ('파출소_경찰서','편의점')`을 기준 좌표로부터 거리순 정렬, 반경 내 없으면 반경을 2배씩 확대하여 재검색

---

## 5. 제보(Report) API

### GET /reports 🔓 — FN-02-01-R
viewport 내 활성 제보 마커 조회 (앱/웹 공통, 비회원 포함)

**Query**: sw_lat, sw_lng, ne_lat, ne_lng

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "긴급 통행차단",
      "lat": 37.48420000,
      "lng": 126.92970000,
      "description": "공사 자재가 붕괴되어 골목 통행이 완전히 막혀있습니다. 돌아가세요!",
      "img_url": "https://cdn.example.com/reports/1.jpg",
      "user_nickname": "안전파수꾼",
      "created_at": "2026-07-21T07:00:00+09:00",
      "expire_at": "2026-07-22T07:00:00+09:00",
      "is_admin_posted": false
    }
  ]
}
```
`is_admin_posted`는 응답 조립 시 `report.user_id` → `user.role` JOIN으로 계산해서 내려줌 (DB에 저장된 값이 아님)

조회 조건: `is_active='Y' AND expire_at > NOW()`

---

### POST /reports 🔐 (앱 전용) — FN-02-01
**Request**
```json
{
  "type": "싱크홀",
  "lat": 37.49790000,
  "lng": 127.02760000,
  "description": "강남역 2번출구 앞 인도에 작은 싱크홀 발견, 통행주의",
  "img_url": "https://cdn.example.com/reports/tmp_upload_001.jpg"
}
```
- `lat`/`lng`는 클라이언트가 GPS로 획득한 값 그대로 전송 (수동 좌표 선택 불가)
- `img_url`은 선택값. 사진 파일 자체는 이 API가 받지 않고, 클라이언트가 별도 이미지 업로드 API(또는 스토리지 presigned URL)로 먼저 올린 뒤 반환받은 URL을 여기에 실어 보내는 방식
- 서버는 좌표로 `grid_id`를 계산해서 저장, 없는 격자면 새로 생성(get-or-create)
- `created_at`은 서버 시각으로 자동 기록, `expire_at`은 `created_at + 24시간`으로 자동 계산

**Response 201**
```json
{ "success": true, "data": { "id": 6, "grid_id": 1, "img_url": "https://cdn.example.com/reports/tmp_upload_001.jpg", "expire_at": "2026-07-22T15:00:00+09:00" } }
```

**에러**: 401(비로그인), 422(필수값 누락/좌표 획득 실패)

---

### PATCH /reports/{id} 🔐 (본인) — FN-02-01
**Request**
```json
{ "description": "수정된 설명입니다", "img_url": "https://cdn.example.com/reports/new_photo.jpg" }
```
- `lat`/`lng`, `type`은 수정 불가 항목으로 제한 (등록 시점 GPS 고정 원칙과 동일하게 유지 권장)
- `img_url`은 수정 가능. 사진을 삭제하고 싶으면 `"img_url": null`로 전송

**에러**: 403 (본인 게시물이 아님)

---

### DELETE /reports/{id} 🔐 (본인) / 👑 — FN-02-01
본인 또는 관리자만 삭제 가능. 실제 삭제 대신 `is_active='N'`으로 소프트 삭제 권장 (통계/이력 보존)

---

## 6. 푸시 알림 관련 API

### POST /devices/register 🔓 — FN-02-02
푸시 발송 대상이 되기 위한 기기 토큰 등록/갱신 (비회원도 수신 가능하므로 로그인 불필요, 로그인 상태면 토큰에 `user_id` 자동 연결)

**Request**
```json
{ "device_token": "fcm_abcdef123...", "last_lat": 37.4979, "last_lng": 127.0276 }
```

**동작 방식**: `device_token` 기준 upsert
- 최초 등록: `device_tokens`에 신규 행 생성 (`created_at`, `updated_at` 동일 시각)
- 이미 존재하는 토큰: `last_lat`/`last_lng`, `updated_at`만 갱신 (앱이 위치 변경 시마다 또는 주기적으로 재호출)

**Response 200**
```json
{ "success": true, "data": { "id": 2, "device_token": "fcm_abcdef123...", "updated_at": "2026-07-21T09:00:00+09:00" } }
```

**서버 발송 로직 (내부, 클라이언트가 직접 호출하는 API 아님)**
- 신규 `report` 등록 시: 해당 좌표 기준 반경 500m 내 `device_tokens.last_lat/last_lng` 대상을 조회해 FCM 발송
- 신규 `city_events` 등록 시(관리자 등록 도시정보): 이벤트 좌표 기준 반경 500m 내 대상을 조회해 발송 (반경은 추후 이벤트 규모별로 조정 가능)
- 재난문자 연동 시: 외부 API(행정안전부 등)가 지정한 반경 그대로 사용
- `device_tokens.updated_at`이 오래된(예: 30일 이상 미갱신) 토큰은 배치로 정리하는 정책 검토 필요

---

## 7. 피드백(Feedback) API

### GET /grids/{grid_id}/feedbacks 🔓 — FN-03-01
**Query**: sort=`latest`(기본) | `recommended`

조회 조건: `is_active='Y'`

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "user_nickname": "안전파수꾼",
      "safety_feeling": "안전",
      "comment": "순찰도 자주 돌고 비상벨도 잘 보여요.",
      "img_url": null,
      "tags": ["보안관 순찰구역"],
      "created_at": "2026-02-20T14:00:00+09:00"
    }
  ]
}
```

---

### GET /grids/{grid_id}/feedbacks/me 🔐 — FN-03-01
사용자가 "피드백 남기기"를 누르기 전에, 해당 격자에 본인이 이미 작성한 피드백이 있는지 확인. 있으면 등록 폼 대신 수정 폼을 바로 열어 중복 등록(409)을 사전에 차단하는 용도

**Response 200 (이미 있음)**
```json
{ "success": true, "data": { "id": 4, "safety_feeling": "안전", "comment": "...", "tag_ids": [3], "img_url": null } }
```

**Response 200 (없음)**
```json
{ "success": true, "data": null }
```

### POST /grids/{grid_id}/feedbacks 🔐 — FN-03-01
**Request**
```json
{
  "safety_feeling": "보통",
  "comment": "출구 쪽은 밝은데 골목 안쪽은 좀 어두움",
  "tag_ids": [1],
  "img_url": "https://cdn.example.com/feedbacks/tmp_upload_002.jpg"
}
```
- `img_url`은 선택값, `report`와 동일하게 별도 업로드 후 URL만 전달받는 방식
- `safety_feeling`은 `불안`/`보통`/`안전` 중 하나만 허용 (그 외 값은 422)
- 동일 유저-동일 격자 피드백 중복 등록 방지: 이미 존재하면 409 반환. 클라이언트는 폼을 열기 전 `GET .../feedbacks/me`로 먼저 확인해 이 상황 자체를 사전 차단하는 것을 기본 흐름으로 하고, 409는 동시 요청 등 예외 상황을 막는 안전장치로 유지

**에러**: 401, 409(중복 등록), 422(safety_feeling 값 오류)

---

### PATCH /feedbacks/{id} 🔐 (본인)
**Request**
```json
{ "comment": "수정된 한줄평입니다", "img_url": null }
```
- `safety_feeling`, `comment`, `tag_ids`, `img_url` 수정 가능. `img_url`을 삭제하려면 `null` 전송
- `grid_id`는 수정 불가 (다른 격자로 옮기려면 삭제 후 재등록)

**에러**: 403 (본인 게시물이 아님)

### DELETE /feedbacks/{id} 🔐 (본인) / 👑
`report`와 동일하게 **소프트 삭제** (`feedback.is_active='N'`으로 전환, 실제 행은 보존)

---

## 8. 공통 API

### GET /tags 🔓
피드백 작성 시 선택 가능한 사전 정의 태그 목록

**Response 200**
```json
{ "success": true, "data": [ { "id": 1, "name": "가로등 어두움" }, { "id": 3, "name": "보안관 순찰구역" } ] }
```

---

## 9. 관리자 API (FN-05-01)

### GET /admin/reports 👑
**Query**: type, date_from, date_to, is_active (필터, 전부 선택)

### DELETE /admin/reports/{id} 👑
본인 확인 없이 전체 제보 삭제 가능

### GET /admin/feedbacks 👑 / DELETE /admin/feedbacks/{id} 👑
동일한 패턴

### POST /admin/markers 👑
관리자가 지도에 직접 마커 생성. `type`에 따라 저장되는 테이블이 다름 (클라이언트는 신경 쓸 필요 없이 동일한 폼으로 등록, 서버가 내부적으로 라우팅)

| type 값 | 저장 테이블 | 비고 |
|---|---|---|
| 교통사고 / 싱크홀 / 자연재해 / 공사 / 기타 (제보 유형) | `report` | `user_id=관리자ID`로 저장, `POST /reports`와 동일 로직이나 좌표 수동 지정 가능 |
| 행사 / 인파밀집 / 교통통제 (도시정보 유형) | `city_events` | `created_by=관리자ID`로 저장 |

**Request (제보 유형 예시)**
```json
{
  "type": "공사",
  "lat": 37.56650000,
  "lng": 126.97800000,
  "description": "강남대로 하수관 교체공사, 7/25까지",
  "expire_at": "2026-07-25T18:00:00+09:00"
}
```
- 일반 `/reports` 등록과 달리 **좌표를 직접 입력/지도 클릭으로 지정 가능** (GPS 제약 없음), `expire_at`도 직접 지정 가능

**Request (도시정보 유형 예시)**
```json
{
  "type": "행사",
  "title": "OO 페스티벌",
  "lat": 37.53260000,
  "lng": 126.99050000,
  "description": "여의도 한강공원 일대에서 대규모 불꽃축제가 진행됩니다.",
  "start_at": "2026-08-01T19:00:00+09:00",
  "end_at": "2026-08-01T22:00:00+09:00"
}
```
- `city_events`는 `grid`와 무관하게 독립적으로 저장되므로, 이 경우 `grid_id` 계산 로직을 거치지 않음

---

### GET /admin/city-events 👑
전체 도시정보(행사/인파밀집/교통통제) 목록 조회, 종료된 이벤트 포함 (필터: type, date_from, date_to)

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "type": "행사", "title": "서울 불꽃축제", "start_at": "2026-08-01T19:00:00+09:00", "end_at": "2026-08-01T22:00:00+09:00", "created_by": 1 }
  ]
}
```

### DELETE /admin/city-events/{id} 👑
관리자가 잘못 등록했거나 취소된 도시정보를 삭제. `city_events`는 등록·삭제 모두 관리자 전용으로, 일반 유저는 열람(`GET /city-events`)만 가능

### GET /admin/summary 👑
관리자 대시보드용 집계 지표

**Response 200**
```json
{
  "success": true,
  "data": {
    "active_reports": 24,
    "reports_today": 3,
    "total_feedbacks": 1286,
    "feedbacks_today": 17,
    "total_city_events": 42,
    "city_events_today": 2
  }
}
```

**서버 처리**: 별도 테이블/뷰 없이, 요청 시점에 `report`/`feedback`/`city_events` 각각에 대해 `COUNT()` 쿼리를 실행해 조합. 데이터 규모가 커져 성능이 문제되면 그때 캐싱(Redis 등) 도입을 검토

---

## 10. 반영 이력

| 버전 | 변경사항 |
|---|---|
| v1.0 | 최초 작성. 사진 첨부(`img_url`), `city_events`, `device_tokens` 관련 DB 미비 사항 발견 |
| v1.1 | DB설계서 반영 완료 후 `img_url` 필드, `city-events`/`devices/register` 정식 스펙, `admin/markers` 라우팅 로직, `city_events` 관리자 전용 등록·삭제, 푸시 알림에 `city_events` 포함, `img_url` 수정/삭제 지원, `feedback` 소프트 삭제(`is_active`), `report` 응답 `user_nickname` 추가, 회원가입 `role` 고정 명시 |
| v1.2 | UI 화면설계서(와이어프레임) 검토 중 발견된 공백 반영: `GET /admin/summary`(대시보드 집계), `GET /grids/{grid_id}/feedbacks/me`(중복 등록 사전 차단용) 신규 추가 |
