# Local bootstrap (Windows PowerShell)

Write-Host "Starting Docker Compose stack..."
docker compose up -d --build

Write-Host "Waiting for Postgres..."
Start-Sleep -Seconds 8

Write-Host "Running Alembic migrations..."
docker compose run --rm api python -m alembic upgrade head

Write-Host "Seeding local corpus (MinIO + ingestion)..."
$env:API_URL = "http://localhost:8000"
$env:S3_ENDPOINT_URL = "http://localhost:9000"
$env:AWS_ACCESS_KEY_ID = "minioadmin"
$env:AWS_SECRET_ACCESS_KEY = "minioadmin"
py scripts/seed_local.py

Write-Host "Done. API: http://localhost:8000/docs  Frontend: cd frontend; npm run dev"
