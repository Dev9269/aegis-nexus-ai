FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

RUN useradd --create-home --uid 10001 aegis \
    && mkdir -p /app/ml/artifacts \
    && chown -R aegis:aegis /app
USER aegis

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=6s --start-period=30s --retries=4 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/ready', timeout=5)"

CMD ["sh", "-c", "alembic upgrade head && python -m scripts.bootstrap && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
