# Run from repo root. Uses DB_URL from environment or .env (via pydantic-settings in Alembic env).
# Example (Docker Compose Postgres on localhost):
#   $env:DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/copilot"
#   .\scripts\alembic-upgrade.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
python -m alembic upgrade head
