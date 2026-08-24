# 
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

# 컨테이너 시작할 때마다: ① DB를 최신 마이그레이션까지 적용 → ② 성공해야만 서버 실행.
# &&로 묶여있어서 마이그레이션 실패 시 서버 자체가 안 켜짐(스키마 안 맞는 채로 뜨는 것 방지).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
