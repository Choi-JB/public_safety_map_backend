import os
import urllib.request

import cv2
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "face_detection_yunet_2023mar.onnx")
MODEL_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

MOSAIC_SCALE = 0.08
SCORE_THRESHOLD = 0.45
NMS_THRESHOLD = 0.3
BOX_PAD = 0.12
DETECT_SIZE = (1280, 1280)
MAX_SIDE = 1920  # 저장 전 긴 변 제한 (원본보다 커지지 않게 축소만)


def ensure_model(path=MODEL_PATH, url=MODEL_URL):
    if os.path.exists(path):
        return path
    print(f"모델 다운로드 중: {url}")
    urllib.request.urlretrieve(url, path)
    return path


def mosaic_roi(img, x1, y1, x2, y2, scale=MOSAIC_SCALE):
    h, w = img.shape[:2]
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w, int(x2)), min(h, int(y2))
    if x2 <= x1 or y2 <= y1:
        return
    roi = img[y1:y2, x1:x2]
    rh, rw = roi.shape[:2]
    sw = max(1, int(rw * scale))
    sh = max(1, int(rh * scale))
    small = cv2.resize(roi, (sw, sh), interpolation=cv2.INTER_LINEAR)
    mosaic = cv2.resize(small, (rw, rh), interpolation=cv2.INTER_NEAREST)
    img[y1:y2, x1:x2] = mosaic


def merge_boxes(boxes, iou_thresh=0.35):
    if not boxes:
        return []

    def iou(a, b):
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b
        ix1, iy1 = max(ax1, bx1), max(ay1, by1)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        if inter == 0:
            return 0.0
        area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
        area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
        return inter / (area_a + area_b - inter + 1e-6)

    kept = []
    for box in boxes:
        merged = False
        for i, k in enumerate(kept):
            if iou(box, k) >= iou_thresh:
                kept[i] = (
                    min(box[0], k[0]),
                    min(box[1], k[1]),
                    max(box[2], k[2]),
                    max(box[3], k[3]),
                )
                merged = True
                break
        if not merged:
            kept.append(box)
    return kept


def detect_faces(image, model_path):
    h, w = image.shape[:2]
    detector = cv2.FaceDetectorYN.create(
        model_path,
        "",
        DETECT_SIZE,
        SCORE_THRESHOLD,
        NMS_THRESHOLD,
        5000,
    )
    detector.setInputSize((w, h))
    _, faces = detector.detect(image)

    boxes = []
    if faces is not None:
        for face in faces:
            x, y, bw, bh = face[:4].astype(int)
            if bw >= 4 and bh >= 4:
                boxes.append((x, y, x + bw, y + bh))

    tile = 640
    overlap = 160
    if max(h, w) > tile:
        for y0 in range(0, h, tile - overlap):
            for x0 in range(0, w, tile - overlap):
                x1 = min(x0 + tile, w)
                y1 = min(y0 + tile, h)
                crop = image[y0:y1, x0:x1]
                ch, cw = crop.shape[:2]
                if ch < 64 or cw < 64:
                    continue
                detector.setInputSize((cw, ch))
                _, tile_faces = detector.detect(crop)
                if tile_faces is None:
                    continue
                for face in tile_faces:
                    fx, fy, fbw, fbh = face[:4].astype(int)
                    if fbw >= 4 and fbh >= 4:
                        boxes.append((x0 + fx, y0 + fy, x0 + fx + fbw, y0 + fy + fbh))

    return merge_boxes(boxes)


def resize_max_side(image, max_side=MAX_SIDE):
    h, w = image.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return image
    scale = max_side / longest
    return cv2.resize(
        image,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_AREA,
    )


def mask_bgr(image, model_path=None):
    """BGR 이미지에 얼굴 모자이크를 적용한다. 원본 배열은 변경하지 않는다."""
    if model_path is None:
        model_path = ensure_model()
    boxes = detect_faces(image, model_path)
    out = image.copy()
    for x1, y1, x2, y2 in boxes:
        bw, bh = x2 - x1, y2 - y1
        pad_x, pad_y = int(BOX_PAD * bw), int(BOX_PAD * bh)
        mosaic_roi(out, x1 - pad_x, y1 - pad_y, x2 + pad_x, y2 + pad_y)
    out = resize_max_side(out)
    return out, len(boxes)


def mask_image_bytes(data: bytes, model_path=None):
    """
    업로드 바이트를 메모리에서만 디코딩·마스킹한다.
    원본 파일은 디스크에 쓰지 않는다.
    반환: (jpeg_bytes, face_count)
    """
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("이미지 디코딩에 실패했습니다.")
    masked, face_count = mask_bgr(image, model_path=model_path)
    ok, buf = cv2.imencode(".jpg", masked, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise ValueError("마스킹 이미지 인코딩에 실패했습니다.")
    return buf.tobytes(), face_count


def main():
    input_path = "./maskingexm.jpg"
    output_path = "./maskingexm_masked.jpg"
    with open(input_path, "rb") as f:
        data = f.read()
    jpeg_bytes, face_count = mask_image_bytes(data)
    with open(output_path, "wb") as f:
        f.write(jpeg_bytes)
    print(f"저장: {output_path} (마스킹된 얼굴 수: {face_count})")


if __name__ == "__main__":
    main()
