# ECR Repository (matching Pulumi's configuration)
resource "aws_ecr_repository" "main" {
  name         = "webhooks-repo"
  force_delete = true

  tags = {
    Name        = "webhooks-repo"
    Environment = var.environment
  }
}

# Build and push Docker image
resource "docker_image" "app" {
  name = "${aws_ecr_repository.main.repository_url}:latest"

  build {
    context    = var.docker_context
    dockerfile = "Dockerfile"  # Path relative to context
    platform   = var.docker_build_platform
  }
}

resource "docker_registry_image" "app" {
  name = docker_image.app.name

  triggers = {
    image_id = docker_image.app.image_id
  }
}