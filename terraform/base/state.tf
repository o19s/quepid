/*
 * state.tf
 * Generate a remote state bucket in S3 for use with later Terraform run
 * Uses a Turner created Terraform module; more information at:
 * https://github.com/turnerlabs/terraform-remote-state/blob/master/readme.md
 *
 * To learn more about remote state:
 * https://www.terraform.io/docs/state/remote.html
 */

module "tf_remote_state" {
  source      = "github.com/turnerlabs/terraform-remote-state"
  role        = module.common_vars.saml_role
  application = module.common_vars.app
  tags        = module.common_vars.tags
}
