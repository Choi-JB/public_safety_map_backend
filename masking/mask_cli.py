"""
stdin 이미지 바이트 → stdout 마스킹 JPEG.
Node(spawn)에서 호출하는 엔트리포인트.

사용 예:
  python mask_cli.py < input.jpg > output.jpg
"""

from __future__ import annotations

import sys

from masking import ensure_model, mask_image_bytes


def main() -> int:
    ensure_model()
    data = sys.stdin.buffer.read()
    if not data:
        print("empty input", file=sys.stderr)
        return 1
    try:
        masked, face_count = mask_image_bytes(data)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"masked faces: {face_count}", file=sys.stderr)
    sys.stdout.buffer.write(masked)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
