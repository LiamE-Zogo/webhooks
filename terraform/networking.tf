# Use the default VPC (same as Pulumi's awsx behavior)
data "aws_vpc" "default" {
  default = true
}

# Get default subnets in the default VPC
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Get details of each subnet for availability zone information
data "aws_subnet" "default" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "webhooks-cluster"

  tags = {
    Name        = "webhooks-cluster"
    Environment = var.environment
  }
}