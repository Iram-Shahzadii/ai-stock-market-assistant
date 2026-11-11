# Isolated Python sandbox for analysis scripts
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir numpy==2.1.3 pandas==2.2.3 \
 && useradd --create-home --uid 10001 sandbox
WORKDIR /sandbox
COPY runner.py server.py ./
COPY scripts ./scripts
USER sandbox
EXPOSE 8080
CMD ["python", "server.py"]
