# syntax=docker/dockerfile:1

# ---- Base Stage ----
# Start with the slim Python image and add Node.js capabilities
FROM python:3.11-slim-bookworm AS base
ARG PYTHON_VERSION=3.11

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install Node.js, npm, and required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Create a non-root user for improved security
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid 1000 --shell /bin/bash --create-home appuser

# ---- Builder Stage ----
# This stage pre-installs dependencies and caches them for faster builds
FROM base AS builder
ARG PYTHON_VERSION

# Create a virtual environment
RUN python -m venv /opt/venv

# Activate the virtual environment for subsequent RUN commands
ENV PATH="/opt/venv/bin:$PATH"

# Copy dependency definition files
COPY --chown=appuser:appuser requirements.txt .
COPY --chown=appuser:appuser package*.json ./

# Install Python dependencies using a cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# Install Node.js dependencies using a cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install && \
    chown -R appuser:appuser /app/node_modules

# ---- Production Stage (Final Image) ----
# This stage builds the final, optimized image for production
FROM base AS prod
ARG PYTHON_VERSION

# Copy from the venv's predictable site-packages to the user's site-packages
COPY --from=builder --chown=appuser:appuser /opt/venv/lib/python${PYTHON_VERSION}/site-packages \
     /home/appuser/.local/lib/python${PYTHON_VERSION}/site-packages

# Copy package files and install only production Node.js dependencies
COPY --chown=appuser:appuser package*.json ./
RUN npm install --omit=dev

# Copy the application source code after installing dependencies to improve caching
COPY --chown=appuser:appuser src/ ./src
COPY --chown=appuser:appuser static/ ./static

# Switch to the non-root user
USER appuser

ENV LOG_LEVEL="${WEB_LOG_LEVEL:-info}" \
    UVICORN_PORT="80" \
    UVICORN_HOST="0.0.0.0"

# Set the command to run the FastAPI application with Uvicorn
CMD ["python", "-m", "uvicorn", "src.main:app", "--log-level", "${WEB_LOG_LEVEL:-info}"]


# ---- Development Stage ----
# This stage is for local development with mounted source code
FROM base as dev
ARG PYTHON_VERSION

# Copy from the venv's predictable site-packages to the user's site-packages
COPY --from=builder --chown=appuser:appuser /opt/venv/lib/python${PYTHON_VERSION}/site-packages \
     /home/appuser/.local/lib/python${PYTHON_VERSION}/site-packages

# The source code will be bind mounted from the host for live coding in the docker-compose.dev.yaml

# Switch to the non-root user
USER appuser

# Keep the container running to allow for IDE attachment and interactive use
#CMD ["sleep", "infinity"]
ENV LOG_LEVEL="${WEB_LOG_LEVEL:-info}" \
    UVICORN_PORT="80" \
    UVICORN_HOST="0.0.0.0"

# Run the container in reload mode for live coding
CMD ["python", "-m", "uvicorn", "src.main:app", "--reload"]