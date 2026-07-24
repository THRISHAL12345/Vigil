# RDS scaffolding
resource "aws_db_instance" "default" {
  allocated_storage    = 20
  db_name              = "vigil"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.micro"
  username             = "postgres"
  password             = "placeholder123"
  skip_final_snapshot  = true
}
