resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier                 = "${var.project_name}-db"
  engine                     = "postgres"
  engine_version             = "15"
  instance_class             = "db.t3.micro"
  allocated_storage = 20
  storage_type        = "gp2"
  db_name                    = var.db_name
  username                   = var.db_username
  password                   = random_password.db.result
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  skip_final_snapshot        = true
  publicly_accessible        = false
  storage_encrypted          = true
  backup_retention_period    = 0
  auto_minor_version_upgrade = true

  lifecycle {
    prevent_destroy = false
  }
}
