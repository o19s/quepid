# Quepid CloudFormation Template

This directory contains an AWS CloudFormation template to create various Quepid stacks.

Refer to the `create-stack.sh` and `update-stack.sh` scripts for creating and updating stacks, respectively.

## `cloudformation.yaml`

This template creates a VPC with subnets and routing configuration to contain an EC2 instance. Quepid will be installed on the EC2 instance via docker compose. To use Quepid with a MySQL RDS instance, uncommment the RDS resources and modify the instance's user-data to set the database connection information.

## `cloudformation-fargate.yaml`

This template creates a VPC with subnets and routing configuration to contain an ECS Fargate cluster for running Quepid. It also create a MySQL RDS instance.