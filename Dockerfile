# Single container: React frontend + FastAPI backend + MCP server + sandbox runner.
# Used for Hugging Face Spaces (free CPU basic). App listens on port 7860.

# ---- 1. build the React app ----
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
# "/" = call the API on the same domain that serves the page
ENV VITE_API_URL=/
RUN npm run build

# ---- 2. Python runtime ----
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd -m -u 1000 user
USER user
# a venv (not pip --user): the sandbox runs "python -I", which ignores user site-packages
ENV HOME=/home/user PATH=/home/user/venv/bin:$PATH \
    JOBS_MODE=local MCP_MODE=auto DATA_DIR=/home/user/data
RUN python -m venv /home/user/venv
WORKDIR /home/user/app
COPY --chown=user backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY --chown=user backend/ backend/
COPY --chown=user sandbox/ sandbox/
COPY --chown=user --from=web /web/dist frontend/dist
WORKDIR /home/user/app/backend
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
