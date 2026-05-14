# PrivAI backend — FastAPI + YOLO + OpenCV + EasyOCR
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Keep Ultralytics' writable config inside the persisted storage volume.
    YOLO_CONFIG_DIR=/app/storage/.ultralytics

WORKDIR /app

# System libraries required by OpenCV (cv2) at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install the CPU-only build of PyTorch FIRST so that ultralytics / easyocr
# do not pull the much larger CUDA build. This keeps the image small.
RUN pip install --upgrade pip \
    && pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

# Application code + trained model (model is small, baked in for portability).
COPY app ./app
COPY models ./models

EXPOSE 8000

# uvicorn binds 0.0.0.0 so the container is reachable. No --reload in the image.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
