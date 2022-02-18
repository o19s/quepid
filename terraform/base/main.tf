/* Entry point for `terraform apply` */

# Using the AWS Provider
# https://www.terraform.io/docs/providers/
provider "aws" {
  region  = "us-east-1"
  profile = module.common_vars.aws_profile
}

terraform {
  required_version = ">= 0.12"
}

# Returns the name of the S3 bucket that will be used in later Terraform files
output "tfstate_bucket" {
  value = module.tf_remote_state.bucket
}
