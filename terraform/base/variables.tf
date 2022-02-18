/* Variables used by other Terraform scripts. */

variable "aws_profile" {
  type        = string
  description = "Same as AWS_PROFILE"
}

variable "aws_region" {
  type        = string
  description = "Same as AWS_REGION / AWS_DEFAULT_REGION"
  default     = "us-east-1"
}

variable "env" {
  type        = string
  description = "Resource environment"
  default     = "dev"
}

module "common_vars" {
  source      = "../modules/common-vars"
  aws_profile = var.aws_profile
  aws_region  = var.aws_region
  env         = var.env
}
