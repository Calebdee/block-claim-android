# Block Claim game server. Build from the repo root:
#   docker compose up -d --build
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    PORT=8787

WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app.py .
COPY app/src/main/assets/index.html static/index.html

# Runs as root inside the container so it can always write to the mounted ./data folder on the NAS.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request,os;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8787')+'/api/health',timeout=4)"

# gthread workers handle the steady 1.5 s polling from each phone comfortably.
CMD ["sh", "-c", "exec gunicorn --workers 2 --threads 4 --worker-class gthread --bind 0.0.0.0:${PORT} app:app"]
