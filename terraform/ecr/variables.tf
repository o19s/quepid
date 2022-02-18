/* Variables */

# Jenkins is only setup to pull from ECRs in the aws-news-prod account
variable "aws_profile" {
  type        = string
  description = "Same as AWS_PROFILE"
  default     = " aws-cnn-ci-cep-nonprod:aws-cnn-ci-cep-nonprod-devops"
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

# Jenkins is only setup to pull from ECRs in the aws-news-prod account
variable "saml_role" {
  type        = string
  description = "Role that will have access to the resource"
  default     = "aws-cnn-ci-cep-nonprod-devops"
}

module "common_vars" {
  source      = "../modules/common-vars"
  aws_profile = var.aws_profile
  aws_region  = var.aws_region
  env         = var.env
  saml_role   = var.saml_role
}
