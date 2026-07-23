"""
stdin: 원본 이미지 bytes
stdout: 얼굴 모자이크 JPEG bytes
프로젝트 내 backend/masking 사용 (D:\\img-masking 이식본)
"""
import os
import sys
from pathlib import Path

MASKING_DIR = Path(__file__).resolve().parent.parent / "masking"
sys.path.insert(0, str(MASKING_DIR))

from masking import ensure_model, mask_image_bytes  # noqa: E402


def main():
    os.chdir(MASKING_DIR)
    ensure_model()
    data = sys.stdin.buffer.read()
    if not data:
        print("empty stdin", file=sys.stderr)
        sys.exit(2)
    try:
        jpeg_bytes, face_count = mask_image_bytes(data)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    print(f"faces={face_count}", file=sys.stderr)
    sys.stdout.buffer.write(jpeg_bytes)


if __name__ == "__main__":
    main()
