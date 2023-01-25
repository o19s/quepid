#!/bin/bash

DOCKERHUB_USERNAME=""
DOCKERHUB_PASSWORD=""

aws cloudformation update-stack \
  --stack-name "quepid" \
  --template-body "file://./cloudformation.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameters \
      ParameterKey=DockerHubUsername,ParameterValue=$DOCKERHUB_USERNAME \
      ParameterKey=DockerHubPassword,ParameterValue=$DOCKERHUB_PASSWORD \
      ParameterKey=KeyName,ParameterValue=mtnfog 
