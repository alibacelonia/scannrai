FROM python:3.12-slim

ARG OSV_SCANNER_VERSION=1.9.2
ARG GITLEAKS_VERSION=8.24.2

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev curl ca-certificates git tar \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt semgrep==1.86.0

RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) osv_arch="amd64"; gitleaks_arch="x64" ;; \
      arm64) osv_arch="arm64"; gitleaks_arch="arm64" ;; \
      *) echo "Unsupported architecture: $arch"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_${OSV_SCANNER_VERSION}_linux_${osv_arch}.tar.gz" \
      | tar -xz -C /usr/local/bin osv-scanner; \
    chmod +x /usr/local/bin/osv-scanner; \
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${gitleaks_arch}.tar.gz" \
      | tar -xz -C /tmp; \
    install -m 0755 /tmp/gitleaks /usr/local/bin/gitleaks

COPY . /app

WORKDIR /app/backend
