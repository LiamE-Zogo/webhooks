# Terraform Infrastructure for Webhooks Service

This Terraform configuration replaces the previous Pulumi setup for deploying the webhooks service on AWS.

## Infrastructure Components

This Terraform configuration creates the following AWS resources:

- **Networking:**
  - Uses the default VPC (same as Pulumi)
  - Uses default subnets
  - Security groups for ALB and ECS tasks

- **Container Infrastructure:**
  - ECS Cluster running on AWS Fargate
  - ECR Repository for Docker images
  - Automatic Docker image building and pushing

- **Load Balancing:**
  - Application Load Balancer with HTTP to HTTPS redirect
  - Target group with health checks
  - SSL/TLS termination using ACM certificate

- **Auto Scaling:**
  - Application Auto Scaling for ECS service
  - CPU and Memory based scaling policies
  - Configurable min/max capacity

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with your credentials
3. **Terraform** version 1.0 or higher
4. **Docker** installed and running locally
5. **ACM Certificate** for your domain (required for HTTPS)

## Setup Instructions

### 1. Configure AWS Profile

Make sure your AWS CLI is configured with the appropriate profile:

```bash
aws configure --profile pulumi
```

### 2. Create Terraform Variables File

Copy the example variables file and update with your values:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and update:
- `certificate_arn` - Your ACM certificate ARN (REQUIRED)
- `aws_profile` - Your AWS profile name
- Other variables as needed

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan the Deployment

Review the resources that will be created:

```bash
terraform plan
```

### 5. Deploy the Infrastructure

```bash
terraform apply
```

Type `yes` when prompted to confirm the deployment.

## Configuration Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Name of the project | `webhooks` |
| `aws_region` | AWS region to deploy to | `us-east-1` |
| `aws_profile` | AWS profile to use | `pulumi` |
| `certificate_arn` | ACM certificate ARN for HTTPS | Required - no default |
| `container_port` | Port the container listens on | `80` |
| `cpu` | CPU units for the task | `1024` |
| `memory` | Memory for the task in MB | `1024` |
| `min_capacity` | Minimum number of tasks | `1` |
| `max_capacity` | Maximum number of tasks | `1` |

## Updating the Application

After the initial infrastructure deployment, you can update your application using:

### Option 1: Terraform (Rebuilds and Redeploys)
```bash
terraform apply
```

This will rebuild the Docker image and update the ECS service.

### Option 2: Manual Docker Push
Use the existing `build-and-deploy.sh` script for faster deployments:

```bash
./build-and-deploy.sh
```

## Outputs

After successful deployment, Terraform will output:

- `url` - The HTTPS URL of your application
- `alb_dns_name` - The DNS name of the load balancer
- `ecr_repository_url` - The ECR repository URL
- `ecs_cluster_name` - The ECS cluster name
- `ecs_service_name` - The ECS service name

## Managing the Infrastructure

### View Current State
```bash
terraform show
```

### Update Infrastructure
```bash
terraform apply
```

### Destroy Infrastructure
```bash
terraform destroy
```

**Warning:** This will delete all resources including the ECR repository and its images.

## Key Differences from Pulumi Setup

This Terraform configuration provides equivalent functionality to the Pulumi setup with these key points:

1. **Same Networking:** Uses the default VPC and subnets (just like Pulumi's awsx)
2. **Explicit Resources:** Terraform requires explicit definition of IAM roles and security groups that Pulumi's awsx creates implicitly
3. **Public IP Assignment:** ECS tasks get public IPs (same as Pulumi)
4. **Same Auto-scaling:** CPU-based auto-scaling with 70% target (exactly matching Pulumi)
5. **Same Core Resources:** Creates the exact same infrastructure - ECS cluster, ECR repo, ALB, and Fargate service

## Troubleshooting

### Docker Build Issues
If you encounter Docker build issues:
1. Ensure Docker daemon is running
2. Check Docker has permission to access the build context
3. Verify the Dockerfile path is correct

### Certificate Issues
- Ensure the certificate is validated and active in ACM
- Certificate must be in the same region as your deployment
- Certificate should cover your domain name

### Deployment Failures
1. Check AWS credentials and permissions
2. Review Terraform output for specific error messages
3. Ensure all required variables are set in `terraform.tfvars`

## Migration from Pulumi

To migrate from the existing Pulumi setup:

1. Export any important data or configurations
2. Note down any DNS records pointing to the old ALB
3. Deploy the Terraform infrastructure
4. Update DNS records to point to the new ALB
5. Once verified, remove the old Pulumi stack:
   ```bash
   pulumi destroy
   pulumi stack rm ZAPI-2.0
   ```

## Support

For issues or questions about this Terraform configuration, please refer to:
- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Docker Provider Documentation](https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs)