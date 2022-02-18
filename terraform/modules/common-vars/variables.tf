/* Variables */

variable "app" {
  type        = string
  description = "App name"
  default     = "cnn-search-quepid"
}

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

variable "saml_role" {
  type        = string
  description = "Role that will have access to the resource"
  default     = "aws-cnn-ci-cep-nonprod-devops"
}

variable "tags" {
  type        = map(any)
  description = "AWS tags"
  default = {
    cnn-unit         = "di"
    contact-email    = "content_intelligence@warnermedia.com"
    contact-slack    = "cnn-dataintel-ci"
    customer         = "cnn"
    operations-email = "content_intelligence@warnermedia.com"
    repo-url         = "https://github.com/cnnlabs/cnn-search-quepid"
    team             = "ci"
  }
}
