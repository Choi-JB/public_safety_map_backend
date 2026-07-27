# DB 설계서 (v1.3)

## 1. 개요

| 항목 | 내용 |
|---|---|
| DB명 | `public_safety_map` |
| DBMS | MariaDB 12.3.2 |
| 문자셋 | utf8mb4 (utf8mb4_general_ci) |
| 엔진 | InnoDB |

전체 테이블: `user`, `grid`, `infrastructures`, `report`, `feedback`, `tag`, `feedback_tag`, `city_events`, `device_tokens`, `refresh_token` (총 10개)

---

## 2. 주요 설계 결정사항 요약

| 항목 | 확정 방식 | 사유 |
|---|---|---|
| 비밀번호 저장 | `password_hash` (bcrypt 해시) | 평문 저장 방지 |
| 제보 만료 처리 | `report.created_at`, `expire_at` 컬럼 | 24시간 자동만료 로직 구현을 위해 필요 |
| 관리자 등록 제보 구분 | 별도 컬럼 없음 | `user.role`(USER/ADMIN)과 `report.user_id`를 JOIN하면 이미 판별 가능 → 컬럼 중복이라 불필요 |
| 체감안전도 | `feedback.safety_feeling` ENUM(`불안`,`보통`,`안전`) | 3단계로 고정 |
| 격자 인덱스 | `grid.grid_row`, `grid.grid_col` 추가 | 아래 3번 참고 |
| 제보/피드백 사진 첨부 | `report.img_url`, `feedback.img_url` 추가 | API 명세서 작성 중 누락 발견, 기능명세서(사진 첨부 선택)에 맞춰 반영 |
| 실시간 도시정보 저장 | `city_events` 테이블 신규 생성 | FN-01-02 구현을 위해 필요 |
| 푸시 알림 대상 관리 | `device_tokens` 테이블 신규 생성 | FN-02-02 구현을 위해 필요 (비회원 수신 가능하도록 user_id는 nullable) |
| 피드백 삭제 방식 | `feedback.is_active` ENUM('Y','N') 추가 | `report`와 동일하게 소프트 삭제 지원 (완전 삭제 대신 이력 보존) |
| JWT 갱신(refresh) 처리 | `refresh_token` 테이블 신규 생성 (원본 아닌 해시 저장) | access token을 짧게(1시간) 유지하면서도 재로그인 없이 갱신 가능하게 하고, 로그아웃·탈취 의심 시 서버에서 강제 폐기 가능하도록 세션처럼 상태를 저장 |

---

## 3. grid_row / grid_col을 추가하는 이유

### 문제 상황
`grid` 테이블에 위경도(`lat`, `lng`) 소수점 좌표만 있으면 두 가지 문제가 있어요.

1. **중복 격자 방지가 어려움**: 새 인프라가 들어올 때 "이 좌표는 이미 있는 격자에 속하는가?"를 소수점 범위 비교로 확인해야 하는데, 반올림 오차 때문에 같은 격자인데 미세하게 다른 값으로 중복 생성될 위험이 있음
2. **조회 성능**: viewport(화면 범위) 조회 시 소수점 컬럼 2개로 범위 검색하는 것보다 정수 컬럼 2개로 검색하는 게 인덱스 효율이 좋음 (전국 단위로 격자 수가 많아졌을 때 체감)

### 해결 - 좌표를 격자 인덱스(정수)로 변환

```python
ORIGIN_LAT = 33.0      # 원점 위도 (대한민국 최남단 부근, 임의 고정값)
ORIGIN_LNG = 124.5     # 원점 경도
GRID_SIZE = 0.01      # 격자 한 칸 크기 (약 500m) -> 0.01(1km) 로 변경

def get_grid_index(lat, lng):
    row = int((lat - ORIGIN_LAT) / GRID_SIZE)
    col = int((lng - ORIGIN_LNG) / GRID_SIZE)
    return row, col
```

- 인프라/제보/피드백 저장 시 좌표로부터 `grid_row`, `grid_col`을 계산 → 해당 격자가 없으면 새로 생성(get-or-create) → 있으면 그대로 사용
- 화면 조회 시에는 viewport 좌표 범위를 같은 공식으로 변환해 정수 범위(BETWEEN) 조회
- `UNIQUE(grid_row, grid_col)` 제약으로 동일 위치에 중복 격자가 생기는 것을 DB 차원에서 원천 차단

### 더미 데이터 계산 결과

| grid.id | lat | lng | grid_row | grid_col |
|---|---|---|---|---|
| 1 | 37.56653500 | 126.97796900 | 913 | 495 |
| 2 | 37.55092000 | 126.92395000 | 910 | 484 |
| 3 | 37.51723500 | 127.04732500 | 903 | 509 |
| 4 | 37.48425000 | 126.92977500 | 896 | 485 |
| 5 | 37.54000000 | 127.07000000 | 908 | 514 |

---

## 4. 테이블 상세

### 4.1 user (회원)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| password_hash | VARCHAR(255) | Y | - | bcrypt 해시 저장 |
| email | VARCHAR(50) | Y | - | 이메일 |
| nickname | VARCHAR(50) | Y | - | 닉네임 |
| role | ENUM('USER','ADMIN') | Y | USER | 권한 구분 (관리자 구분에 사용) |
| created_at | DATETIME | Y | - | 가입일시 |
| is_active | ENUM('Y','N') | Y | Y | 계정 활성 여부 |

---

### 4.2 grid (격자)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| grid_row | INT | Y | - | 원점 기준 행 인덱스 |
| grid_col | INT | Y | - | 원점 기준 열 인덱스 |
| lat | DECIMAL(10,8) | Y | - | 중심 위도 |
| lng | DECIMAL(11,8) | Y | - | 중심 경도 |
| infra_count | INT(11) | Y | - | 격자 내 인프라 개수 (캐시값) |
| safety_grade | ENUM('불안','보통','안전') | Y | - | 안전등급 |

제약: `UNIQUE KEY (grid_row, grid_col)`

---

### 4.3 infrastructures (인프라)

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | BIGINT(20) | N | PK |
| grid_id | BIGINT(20) | Y | FK → grid.id (CASCADE) |
| type | VARCHAR(50) | Y | 인프라 유형 (CCTV/보안등/소방시설/파출소·경찰서/편의점 등) |
| address | VARCHAR(50) | Y | 주소 |
| lng, lat | DECIMAL | Y | 좌표 |

---

### 4.4 report (유저 제보) — 변경됨

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| user_id | BIGINT(20) | Y | - | FK → user.id (CASCADE) |
| grid_id | BIGINT(20) | Y | - | FK → grid.id (CASCADE) |
| type | VARCHAR(50) | Y | - | 제보 유형 |
| lat, lng | DECIMAL | Y | - | 좌표 (GPS 자동, 수동입력 불가) |
| description | TEXT | Y | - | 상세 설명 |
| img_url | VARCHAR(255) | Y | - | **(신규)** 첨부 사진 URL (선택) |
| is_active | ENUM('Y','N') | Y | Y | 노출 여부 |
| created_at | DATETIME | Y | - | 등록일시 |
| expire_at | DATETIME | Y | - | 자동만료 예정일시 (기본: created_at + 24시간) |

> 관리자 등록 여부는 별도 컬럼 없이 `user_id` → `user.role='ADMIN'` 조인으로 판별

---

### 4.5 feedback (구역 피드백) — 변경됨

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| user_id | BIGINT(20) | Y | - | FK → user.id (CASCADE) |
| grid_id | BIGINT(20) | Y | - | FK → grid.id (CASCADE) |
| safety_feeling | ENUM('불안','보통','안전') | Y | 보통 | 체감안전도 (3단계로 고정) |
| comment | TEXT | Y | - | 한줄평 |
| img_url | VARCHAR(255) | Y | - | 첨부 사진 URL (선택) |
| is_active | ENUM('Y','N') | Y | Y | 노출 여부 (소프트 삭제) |
| created_at | DATETIME | Y | - | 작성일시 |

---

### 4.6 tag (태그)

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | BIGINT(20) | N | PK |
| name | VARCHAR(50) | Y | 태그명 |

**더미 데이터**: 가로등 어두움, CCTV 부족, 보안관 순찰구역, 안심택배함 위치, 유흥업소 밀집

---

### 4.7 feedback_tag (피드백-태그 조인)

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| feedback_id | BIGINT(20) | Y | FK → feedback.id (CASCADE) |
| tag_id | BIGINT(20) | Y | FK → tag.id (CASCADE) |

피드백 1건에 태그 여러 개를 매길 수 있는 N:M 관계용 조인 테이블. 별도 PK 없이 두 FK로만 구성.

---

### 4.8 city_events (실시간 도시정보) — 신규

FN-01-02(대형행사/인파밀집/교통통제 등)를 위한 테이블. `grid` 체계와 무관하게 **독립적으로 운영**하는 기능으로, 격자 참조 없이 좌표만으로 관리함.

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| type | ENUM('행사','인파밀집','교통통제') | Y | - | 이벤트 유형 |
| title | VARCHAR(100) | Y | - | 이벤트명 (예: "OO 페스티벌") |
| description | TEXT | Y | - | 상세 설명 |
| lat, lng | DECIMAL | Y | - | 좌표 |
| start_at | DATETIME | Y | - | 시작 시각 (알 수 있는 경우만) |
| end_at | DATETIME | Y | - | 종료 시각, 경과 시 자동으로 지도에서 제거 |
| created_by | BIGINT(20) | Y | - | FK → user.id, 등록한 관리자 (외부 API 자동수집 시 NULL 가능) |
| created_at | DATETIME | Y | - | 등록일시 |

**조회 방식 변경**: `grid` 기반 격자 조회(FN-01-01)와 달리, `city_events`는 `lat`/`lng`를 직접 bounding box(viewport 좌표 범위)로 조회함. `grid` 테이블과 조인하지 않는 완전히 독립된 도메인으로 취급.

**참고**: 하나의 이벤트가 넓은 영역에 걸치는 경우(대규모 행사 등)는 현재 구조로는 대표 좌표 1개만 저장함. 필요 시 영향 반경(`affected_radius_m`) 컬럼을 추가로 검토.

---

### 4.9 device_tokens (푸시 알림 대상) — 신규

FN-02-02(긴급 위험 알림)를 실제로 발송하려면 "어떤 기기로, 어느 위치 기준으로 보낼지"를 알아야 하는데, 지금까지 스키마엔 이 정보를 저장할 곳이 없었음. 앱 전용 기능이며 비회원도 수신 가능해야 하므로 `user_id`는 nullable로 설계.

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| user_id | BIGINT(20) | Y | NULL | FK → user.id (CASCADE), 비회원이면 NULL |
| device_token | VARCHAR(255) | N | - | FCM(안드로이드 푸시) 토큰, 고유값 |
| last_lat | DECIMAL(10,8) | Y | - | 마지막으로 확인된 위치(위도) |
| last_lng | DECIMAL(11,8) | Y | - | 마지막으로 확인된 위치(경도) |
| created_at | DATETIME | Y | - | 최초 등록일시 |
| updated_at | DATETIME | Y | - | 토큰/위치 마지막 갱신일시 |

제약: `UNIQUE KEY (device_token)` — 동일 기기 중복 등록 방지

**발송 로직 개요**
1. 신규 `report` 또는 `city_events`(관리자 등록 도시정보) 등록 시, 해당 좌표를 기준으로 `device_tokens.last_lat/last_lng`가 반경 500m 이내인 대상을 조회
2. 조회된 `device_token` 목록으로 FCM 발송 API 호출
3. 앱은 위치가 바뀔 때마다 주기적으로 `last_lat/last_lng`를 갱신 (API 명세서의 `/devices/register` 참고)

**주의**: `last_lat/last_lng`가 오래된 값이면 실제 위치와 어긋날 수 있음 — 앱에서 일정 주기(예: 위치 변경 시 또는 10분마다)로 갱신 호출하도록 구현 필요

---

### 4.10 refresh_token (JWT 갱신 토큰) — 신규

일반 유저 로그인은 JWT(access token)를 쓰는데, 탈취 위험을 줄이려고 access token 유효기간을 짧게(1시간) 잡음. 대신 매번 재로그인하지 않고도 갱신할 수 있도록 refresh token을 별도 발급하고, 세션처럼 서버(DB)에도 상태를 저장해 로그아웃·탈취 의심 시 강제 폐기가 가능하도록 설계함.

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| id | BIGINT(20) | N | AUTO_INCREMENT | PK |
| user_id | BIGINT(20) | N | - | FK → user.id (CASCADE) |
| token_hash | VARCHAR(255) | N | - | refresh token 원본의 SHA-256 해시값 (원본 자체는 저장하지 않음) |
| expires_at | DATETIME | N | - | 만료 예정일시 (발급/갱신 시점 + 14일) |
| revoked_at | DATETIME | Y | NULL | 폐기 시각. NULL이면 아직 유효, 값이 있으면 로그아웃/로테이션/탈취탐지로 폐기된 것 |
| created_at | DATETIME | Y | - | 발급일시 |

제약: `UNIQUE KEY (token_hash)`, FK `user_id` → `user.id` (CASCADE)

**갱신(로테이션) 로직 개요**
1. 클라이언트는 refresh token 원본을 httpOnly 쿠키로만 보관 (JS로 읽을 수 없어 XSS로부터 상대적으로 안전, access token은 응답 body로 내려 별도 저장)
2. `POST /auth/refresh` 호출 시 쿠키의 원본 값을 해시해서 `token_hash`와 대조 조회
3. 조회된 토큰이 이미 `revoked_at`이 있으면(= 이미 사용된 토큰이 재사용됨) 탈취 의심으로 간주해 해당 `user_id`의 살아있는 토큰을 전부 폐기
4. 정상이면 기존 토큰은 `revoked_at`을 채워 폐기하고 새 토큰을 발급 (**1회용, 사용할 때마다 교체**)

**주의**: 만료/폐기된 지 오래된 행이 계속 쌓이는 구조라, 운영 단계에서는 주기적으로 정리(batch delete)하는 배치 작업이 별도로 필요함 (아직 미구현)
