# Terraform - AWS Elastic Container Registry

# Usage

## Prod

```sh
# Initialize local state and modules
AWS_PROFILE=" aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 BACKEND_AWS_PROFILE=" aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 TFENV=prod \
 make terraform-ecr-init

# Create ECR repository
AWS_PROFILE="aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 BACKEND_AWS_PROFILE="aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 TFENV=prod \
 make terraform-ecr-create

# !!! DANGER !!!
# Destroy ECR repository
# !!! DANGER !!!
AWS_PROFILE=" aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 BACKEND_AWS_PROFILE=" aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 TFENV=prod \
 make terraform-ecr-destroy
```
