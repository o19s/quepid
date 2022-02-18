/* Elastic Container Registry */

module "ecr" {
  source      = "git@github.com:turnercode/cnn-terraform//ecr?ref=v2.1.0"
  application = module.common_vars.app
  saml_role   = module.common_vars.saml_role
  tags        = module.common_vars.tags
}

terraform {
  required_version = ">= 0.12.18"
  backend "s3" {
    region = "us-east-1"
  }
}
