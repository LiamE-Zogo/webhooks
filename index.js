import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const config = new pulumi.Config();
const containerPort = config.getNumber("containerPort") || 80;
const cpu = config.getNumber("cpu") || 1024;
const memory = config.getNumber("memory") || 1024;
const minCapacity = config.getNumber("minCapacity") || 1;
const maxCapacity = config.getNumber("maxCapacity") || 1;

// An ECS cluster to deploy into
const cluster = new aws.ecs.Cluster("cluster", {});

// An ALB to serve the container endpoint to the internet
const loadbalancer = new awsx.lb.ApplicationLoadBalancer("loadbalancer", {
  listener: {
    port: 443,
    protocol: "HTTPS",
    certificateArn: config.require("certificateArn"),
  },
});

// An ECR repository to store our application's container image
const repo = new awsx.ecr.Repository("repo", {
  forceDelete: true,
});

// Build and publish our application's container image from ./app to the ECR repository
const image = new awsx.ecr.Image("image", {
  repositoryUrl: repo.url,
  context: "./src",
  platform: "linux/amd64",
  dockerfile: "./src/Dockerfile",
  builderVersion: "BuilderBuildKit",
});

// Deploy an ECS Service on Fargate to host the application container
const service = new awsx.ecs.FargateService("service", {
  cluster: cluster.arn,
  assignPublicIp: true,
  taskDefinitionArgs: {
    container: {
      name: "app",
      image: image.imageUri,
      cpu: cpu,
      memory: memory,
      essential: true,
      portMappings: [
        {
          containerPort: containerPort,
          targetGroup: loadbalancer.defaultTargetGroup,
        },
      ],
    },
  },
  autoScalingSettings: {
    targetValue: 70,
    scaleInCooldown: "60s",
    scaleOutCooldown: "60s",
    minCapacity: minCapacity,
    maxCapacity: maxCapacity,
  },
});

// The URL at which the container's HTTPS endpoint will be available
export const url = pulumi.interpolate`https://${loadbalancer.loadBalancer.dnsName}`;
