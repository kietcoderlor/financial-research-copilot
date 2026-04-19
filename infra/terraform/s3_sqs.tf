resource "random_id" "bucket" {
  byte_length = 2
}

resource "aws_s3_bucket" "raw" {
  bucket = "${var.project_name}-raw-docs-${random_id.bucket.hex}"
}

resource "aws_s3_bucket_versioning" "raw" {
  bucket = aws_s3_bucket.raw.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "raw" {
  bucket = aws_s3_bucket.raw.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_sqs_queue" "ingestion_dlq" {
  name = "ingestion-dlq"
}

resource "aws_sqs_queue" "ingestion" {
  name                       = "ingestion-queue"
  visibility_timeout_seconds = 600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingestion_dlq.arn
    maxReceiveCount     = 3
  })
}
