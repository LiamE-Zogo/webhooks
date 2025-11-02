variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "webhooks"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS profile to use"
  type        = string
  default     = "pulumi"
}

variable "container_port" {
  description = "Port that the container listens on"
  type        = number
  default     = 80
}

variable "cpu" {
  description = "CPU units for the task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "memory" {
  description = "Memory for the task in MB"
  type        = number
  default     = 1024
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 1
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  # This must be provided - no default
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "docker_build_platform" {
  description = "Docker build platform"
  type        = string
  default     = "linux/amd64"
}

variable "dockerfile_path" {
  description = "Path to Dockerfile"
  type        = string
  default     = "../src/Dockerfile"
}

variable "docker_context" {
  description = "Docker build context path"
  type        = string
  default     = "../src"
}