# syntax=docker/dockerfile:1.6

# ── Stage 1: build the React/Vite frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + bundled static frontend ───────────────────────
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend-builder /fe/dist ./static

# Cloud Run injects $PORT (default 8080). Honor it; fall back for local runs.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT}"]
