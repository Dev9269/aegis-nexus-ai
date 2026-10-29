# Multi-stage build: frontend + backend + model
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
ENV VITE_API_BASE=/api
ENV VITE_WS_PATH=/api/ws/events
RUN npm run build

FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

RUN python -m scripts.train_model --rows 5000 --seed 42
RUN python -m scripts.seed_demo

RUN useradd --create-home --uid 10001 aegis \
    && chown -R aegis:aegis /app
USER aegis

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=6s --start-period=60s --retries=4 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=5)"

CMD ["sh", "-c", "alembic upgrade head 2>/dev/null; exec uvicorn app.main:app --host 0.0.0.0 --port 8080"]
