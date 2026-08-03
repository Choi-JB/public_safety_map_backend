# 이미지 얼굴 마스킹

제보 이미지 업로드 시 얼굴을 모자이크 처리한 뒤 저장한다.  
원본은 디스크에 쓰지 않고, 메모리 → Python CLI → 마스킹 JPEG만 `uploads/img/`에 저장한다.

## 구조

| 경로 | 역할 |
| :--- | :--- |
| `masking/masking.py` | YuNet 얼굴 검출 + 모자이크 |
| `masking/mask_cli.py` | stdin 이미지 → stdout JPEG (Node spawn용) |
| `masking/requirements.txt` | Python 의존성 |
| `src/utils/imgMasking.ts` | Node에서 `mask_cli.py` 호출 |
| `src/utils/imageUpload.ts` | `reportImageUpload` (memoryStorage) |
| `src/controllers/upload.controller.ts` | `uploadReportImage` |
| `src/routes/upload.routes.ts` | `POST /uploads/image/report` |

일반 업로드 `POST /uploads/image`는 마스킹 없이 디스크 저장(기존).  
제보용만 `POST /uploads/image/report`에서 마스킹한다.

## 흐름

클라이언트 multipart (field: image) → multer memoryStorage → maskImageBuffer (spawn Python) → 마스킹 JPEG만 uploads/img/{timestamp}-{uuid}.jpg 저장 → { img_url, image_path, ... } 반환


## Python 환경 설정 (최초 1회)

Windows 예:

cd masking
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 개인 PC 경로로 수정
MASKING_PYTHON=D:\0727\public_safety_map_backend\masking\.venv\Scripts\python.exe



POST /uploads/image/report
Content-Type: multipart/form-data
field: image

{
  "success": true,
  "data": {
    "original_name": "photo.jpg",
    "file_name": "1730000000000-xxxx.jpg",
    "image_path": "/uploads/img/1730000000000-xxxx.jpg",
    "img_url": "http://localhost:4100/uploads/img/1730000000000-xxxx.jpg",
    "size": 123456
  }
}