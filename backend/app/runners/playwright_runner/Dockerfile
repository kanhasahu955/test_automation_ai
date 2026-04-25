FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

WORKDIR /app

RUN pip install --no-cache-dir httpx pytest playwright pytest-playwright

COPY runner.py /app/runner.py

ENTRYPOINT ["python", "/app/runner.py"]
