FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir sqlalchemy pymysql psycopg2-binary

COPY runner.py /app/runner.py

ENTRYPOINT ["python", "/app/runner.py"]
