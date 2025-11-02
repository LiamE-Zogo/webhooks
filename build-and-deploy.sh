#!/bin/bash

set -e

# Load environment variables from .env file if specified
if [ ! -z "$1" ]; then
    if [ -f "$1" ]; then
        echo "📋 Loading environment from: $1"
        set -a
        source "$1"
        set +a
    else
        echo "❌ Error: Environment file '$1' not found"
        exit 1
    fi
elif [ -f .env ]; then
    echo "📋 Loading environment from: .env"
    set -a
    source .env
    set +a
fi

AWS_REGION=${AWS_REGION:-"us-east-1"}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY=${ECR_REPOSITORY:-"webhooks-repo"}
ECS_CLUSTER=${ECS_CLUSTER:-"webhooks-cluster"}
ECS_SERVICE=${ECS_SERVICE:-"webhook-service"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

echo "🔧 Building and deploying webhooks..."
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"
echo "Repository: $ECR_REPOSITORY"
echo "Cluster: $ECS_CLUSTER"
echo "Service: $ECS_SERVICE"
echo "Tag: $IMAGE_TAG"

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"

echo "🔑 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Check if buildx is available and set up
echo "🔧 Setting up Docker buildx for multi-platform builds..."
if ! docker buildx ls | grep -q "multi-platform-builder"; then
    docker buildx create --name multi-platform-builder --use
else
    docker buildx use multi-platform-builder
fi

docker buildx inspect --bootstrap

echo "📦 Building and pushing multi-platform Docker image (linux/amd64 for Fargate)..."
docker buildx build \
    --platform linux/amd64 \
    -t $ECR_URI:$IMAGE_TAG \
    -t $ECR_URI:latest \
    -f $DOCKER_FILE \
    --push \
    src/

if [ $? -eq 0 ]; then
    echo "✅ Multi-platform image built and pushed successfully"
else
    echo "❌ Failed to build/push multi-platform image"
    exit 1
fi

echo "📝 Getting current task definition..."
TASK_DEFINITION=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'services[0].taskDefinition' \
    --output text)

# Extract just the family name from the ARN (e.g., arn:aws:ecs:region:account:task-definition/family:revision)
TASK_FAMILY=$(echo $TASK_DEFINITION | sed 's/.*task-definition\///' | sed 's/:.*$//')
echo "Task definition ARN: $TASK_DEFINITION"
echo "Task definition family: $TASK_FAMILY"

echo "🔄 Creating new task definition revision with updated image..."
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEFINITION \
    --region $AWS_REGION \
    --query 'taskDefinition' \
    --output json)

# Create a temporary file for the updated task definition
TEMP_FILE=$(mktemp /tmp/task-def.XXXXXX.json)

# Update the image in the task definition and clean up fields AWS doesn't accept for registration
echo "$CURRENT_TASK_DEF" | jq --arg IMAGE "$ECR_URI:$IMAGE_TAG" \
    '.containerDefinitions |= (map(
    .pseudoTerminal = false
    | .interactive = false
    | .environment = (
        (.environment // [])
        | map(select(.name != "NO_COLOR"))
        + [{name:"NO_COLOR", value:"1"}]
      )
    )) 
    |.containerDefinitions[0].image = $IMAGE | 
     del(.taskDefinitionArn) | 
     del(.revision) | 
     del(.status) | 
     del(.requiresAttributes) | 
     del(.compatibilities) | 
     del(.registeredAt) | 
     del(.registeredBy) |
     del(.deregisteredAt)' > "$TEMP_FILE"

# Register the new task definition
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json "file://$TEMP_FILE" \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

# Clean up temp file
rm -f "$TEMP_FILE"

if [ -z "$NEW_TASK_DEF_ARN" ] || [ "$NEW_TASK_DEF_ARN" == "None" ]; then
    echo "❌ Failed to register new task definition"
    exit 1
fi

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"

echo "🚀 Updating ECS service with new task definition..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $NEW_TASK_DEF_ARN \
    --force-new-deployment \
    --region $AWS_REGION \
    --output json > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Service update initiated successfully with new image"
else
    echo "❌ Failed to update service"
    exit 1
fi

echo "⏳ Waiting for service to stabilize..."
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION

echo "✅ Deployment complete!"