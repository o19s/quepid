# Terraform - TF State Bucket

# Usage

```sh
# Initialize local state and modules
AWS_PROFILE="aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 make terraform-base-init

# Create TF state bucket
AWS_PROFILE=" aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-admin" \
 make terraform-base-create
```
