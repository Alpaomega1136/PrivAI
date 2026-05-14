from pathlib import Path

import cv2
import numpy as np
from fastapi import HTTPException, status

from app.utils.file_utils import slugify_filename

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def validate_image_filename(filename: str | None) -> None:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image extension. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
        )


def read_image_bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image file")
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or unsupported image bytes")
    return image


def get_image_shape(image: np.ndarray) -> dict[str, int]:
    height, width = image.shape[:2]
    channels = image.shape[2] if len(image.shape) > 2 else 1
    return {"width": int(width), "height": int(height), "channels": int(channels)}


def cv2_image_to_bytes(image: np.ndarray, extension: str = ".jpg") -> bytes:
    if not extension.startswith("."):
        extension = f".{extension}"
    success, encoded = cv2.imencode(extension, image)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to encode image")
    return encoded.tobytes()


def clamp_box_to_image(x1: float, y1: float, x2: float, y2: float, image_width: int, image_height: int) -> dict[str, int]:
    left = max(0, min(int(round(x1)), image_width - 1))
    top = max(0, min(int(round(y1)), image_height - 1))
    right = max(0, min(int(round(x2)), image_width))
    bottom = max(0, min(int(round(y2)), image_height))
    if right <= left:
        right = min(image_width, left + 1)
    if bottom <= top:
        bottom = min(image_height, top + 1)
    return {"x1": left, "y1": top, "x2": right, "y2": bottom}


def safe_filename(original_filename: str | None) -> str:
    suffix = Path(original_filename or "upload.jpg").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        suffix = ".jpg"
    return f"{slugify_filename(original_filename or 'upload')}{suffix}"
