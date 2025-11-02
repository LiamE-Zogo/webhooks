# Project Configuration
project_name = "webhooks"
environment  = "development"

# AWS Configuration
aws_region  = "us-east-1"
aws_profile = "pulumi"  # Update this to your AWS profile

# Container Configuration
container_port = 80
cpu            = 512  # 1 vCPU
memory         = 1024  # 1024 MB

# Auto Scaling Configuration
min_capacity = 1
max_capacity = 5

# REQUIRED: ACM Certificate ARN for HTTPS
# You must provide your own certificate ARN
certificate_arn = "arn:aws:acm:us-east-1:045170075239:certificate/85744c57-47be-4403-824d-19db1b9360ed"

# Network Configuration (Optional - defaults are usually fine)
# vpc_cidr             = "10.0.0.0/16"
# public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
# private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]

# Docker Build Configuration (Optional)
# docker_build_platform = "linux/amd64"
# dockerfile_path       = "../src/Dockerfile"
# docker_context        = "../src"